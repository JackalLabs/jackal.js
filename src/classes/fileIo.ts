import { EncodeObject } from '@cosmjs/proto-signing'
// import { randomUUID, random } from 'make-random'
import { IQueryFileTree, IQueryStorage, ITxFileTree } from 'jackal.js-protos'

import { finalizeGas } from '@/utils/gas'
import { hashAndHex, hexFullPath, merkleMeBro } from '@/utils/hash'
import { exportJackalKey, genIv, genKey, importJackalKey } from '@/utils/crypt'
import { checkResults } from '@/utils/misc'
import FileDownloadHandler from '@/classes/fileDownloadHandler'
import FolderHandler from '@/classes/folderHandler'
import { IFileDownloadHandler, IFileIo, IFolderHandler, IProtoHandler, IWalletHandler } from '@/interfaces/classes'
import {
  IAesBundle,
  IDeleteItem,
  IEditorsViewers,
  IFileConfigFull,
  IFileConfigRaw,
  IFileMeta,
  IFiletreeParsedContents,
  IMiner,
  IMsgFinalPostFileBundle,
  IMsgPartialPostFileBundle,
  IProviderModifiedResponse,
  IProviderResponse,
  IQueueItemPostUpload,
  IStray
} from '@/interfaces'
import { TFileOrFFile } from '@/types/TFoldersAndFiles'

export default class FileIo implements IFileIo {
  private readonly walletRef: IWalletHandler
  private readonly pH: IProtoHandler
  private availableProviders: IMiner[]
  private currentProvider: IMiner

  private constructor (wallet: IWalletHandler, providers: IMiner[], currentProvider: IMiner) {
    this.walletRef = wallet
    this.pH = wallet.getProtoHandler()
    this.availableProviders = providers
    this.currentProvider = currentProvider
  }

  static async trackIo (wallet: IWalletHandler): Promise<FileIo> {
    const providers = await getProvider(wallet.getProtoHandler().storageQuery)
    console.dir(providers)
    const provider = providers[await random(providers.length)]
    return new FileIo(wallet, providers, provider)
  }

  async shuffle (): Promise<void> {
    this.availableProviders = await getProvider(this.pH.storageQuery)
    this.currentProvider = this.availableProviders[await random(this.availableProviders.length)]
  }
  forceProvider (toSet: IMiner): void {
    this.currentProvider = toSet
  }
   async uploadFolders (toUpload: IFolderHandler[], owner: string): Promise<void> {
    const url = `${this.currentProvider.ip.replace(/\/+$/, '')}/upload`
    const jackalAddr = this.walletRef.getJackalAddress()

    toUpload[0].setIds(await doUpload(url, jackalAddr, await toUpload[0].getForUpload()))
    const { cfg, file } = await prepExistingUpload(toUpload[1], owner, this.walletRef)
    toUpload[1].setIds(await doUpload(url, jackalAddr, file))

    await this.afterUpload([
      { handler: toUpload[0], data: null },
      { handler: toUpload[1], data: cfg }
    ])
  }
  async verifyFoldersExist (toCheck: string[]): Promise<number> {
    const toCreate = []

    for (let i = 0; i < toCheck.length; i++) {
      const folderName = toCheck[i]
      const hexAddress = await merkleMeBro(`s/${folderName}`)
      console.log(`verify : ${hexAddress}`)
      const hexedOwner = await hashAndHex(`o${hexAddress}${await hashAndHex(this.walletRef.getJackalAddress())}`)
      const { version } = await getFileChainData(hexAddress, hexedOwner, this.pH.fileTreeQuery)
      if (version) {
        console.warn(`${folderName} exists`)
      } else {
        console.warn(`${folderName} does not exist`)
        toCreate.push(folderName)
      }
    }

    console.dir(toCreate)
    if (toCreate.length) {
      await this.generateInitialDirs(null, toCreate)
    }
    return toCreate.length
  }
  async uploadFiles (toUpload: TFileOrFFile[], owner: string, existingChildren: { [name: string]: IFileMeta }): Promise<void> {
    if (!toUpload.length) {
      throw new Error('Empty File array submitted for upload')
    } else {
      const url = `${this.currentProvider.ip.replace(/\/+$/, '')}/upload`
      console.log('toUpload')
      console.dir(toUpload)

      const ids: IQueueItemPostUpload[] = await Promise.all(toUpload.map(async (item: TFileOrFFile) => {
        const itemName = item.getWhoAmI()
        const jackalAddr = this.walletRef.getJackalAddress()
        const { cfg, file } = (!existingChildren[itemName] && !item.isFolder)
          ? { cfg: null, file: await item.getForUpload()}
          : await prepExistingUpload(item, owner, this.walletRef)

        item.setIds(await doUpload(url, jackalAddr, file))
        return { handler: item, data: cfg }
      }))
      await this.afterUpload(ids)
    }
  }
  private async afterUpload (ids: IQueueItemPostUpload[]): Promise<void> {
    const { msgPostFile } = await this.pH.fileTreeTx
    const { msgSignContract } = await this.pH.storageTx

    const creator = this.walletRef.getJackalAddress()

    const needingReset: EncodeObject[] = []
    const ready = await Promise.all(ids.flatMap(async (item: IQueueItemPostUpload) => {
      const { cid, fid } = item.handler.getIds()

      const pubKey = this.walletRef.getPubkey()

      const perms = await aesToString(this.walletRef, pubKey, await item.handler.getEnc())
      const workingUUID = self.crypto.randomUUID()
      const folderView: IEditorsViewers = {}
      folderView[await hashAndHex(`v${workingUUID}${creator}`)] = perms
      const folderEdit: IEditorsViewers = {}
      folderEdit[await hashAndHex(`e${workingUUID}${creator}`)] = perms

      const msgPostFileBundle: IMsgPartialPostFileBundle = {
        creator,
        account: await hashAndHex(creator),
        hashParent: await item.handler.getMerklePath(),
        hashChild: await hashAndHex(item.handler.getWhoAmI()),
        contents: JSON.stringify({ fids: fid }),
        viewers: JSON.stringify(folderView),
        editors: JSON.stringify(folderEdit),
        trackingNumber: workingUUID
      }

      if (item.data) {
        msgPostFileBundle.viewers = JSON.stringify(item.data.viewingAccess)
        msgPostFileBundle.editors = JSON.stringify(item.data.editAccess)
        msgPostFileBundle.trackingNumber = item.data.trackingNumber
        const delItem = await this.makeDelete(
          creator,
          [
            {
              location: item.handler.getWhereAmI(),
              name: item.handler.getWhoAmI()
            }
          ]
        )
        needingReset.push(...delItem)
      }

      const msgPost: EncodeObject = await buildPostFile(msgPostFileBundle, this.pH.fileTreeTx)
      const msgSign: EncodeObject = await msgSignContract({ creator, cid })
      return [msgPost, msgSign]
    }))

    ready.unshift(ready.pop() as EncodeObject[])
    const readyToBroadcast = [...needingReset, ...ready.flat()]
    // await this.pH.debugBroadcaster(readyToBroadcast, true)
    await this.pH.debugBroadcaster(readyToBroadcast)
  }
  async downloadFile (hexAddress: string, owner: string, isFolder: boolean): Promise<IFileDownloadHandler | IFolderHandler> {
    const hexedOwner = await hashAndHex(`o${hexAddress}${await hashAndHex(owner)}`)
    const { version, data } = await getFileChainData(hexAddress, hexedOwner, this.pH.fileTreeQuery)
    if (!version) throw new Error('No Existing File')

    const storageQueryResults = await this.pH.storageQuery.queryFindFile({ fid: version })

    if (!storageQueryResults || !storageQueryResults.value.providerIps) throw new Error('No Matching CIDs found!')
    const providers = storageQueryResults.value.providerIps
    console.log('File providers :')
    console.dir(providers)
    const targetProvider = JSON.parse(providers)[0]
    if (targetProvider && targetProvider.length) {
      const url = `${targetProvider.replace(/\/+$/, '')}/download/${version}`
      return await fetch(url)
        .then(resp => resp.arrayBuffer())
        .then(async (resp): Promise<IFileDownloadHandler | IFolderHandler> => {
          const config = {
            editAccess: JSON.parse(data.editAccess),
            viewingAccess: JSON.parse(data.viewingAccess),
            trackingNumber: data.trackingNumber
          }
          const requester = await hashAndHex(`e${config.trackingNumber}${this.walletRef.getJackalAddress()}`)
          const { key, iv } = await stringToAes(this.walletRef, config.editAccess[requester])
          if (isFolder) {
            return await FolderHandler.trackFolder(resp, config, key, iv)
          } else {
            return await FileDownloadHandler.trackFile(resp, config, key, iv)
          }
        })
    } else {
      throw new Error('No available providers!')
    }
  }
   async deleteTargets (targets: IDeleteItem[], parent: IFolderHandler): Promise<void> {

    const names = targets.map((target:IDeleteItem) => target.name)
    parent.removeChildDirs(names)
    parent.removeChildFiles(names)
    targets.push({
      location: parent.getWhereAmI(),
      name: parent.getWhoAmI()
    })

    const msgs = await this.makeDelete(this.walletRef.getJackalAddress(), targets)

    if (parent) {
      // todo - logic here
    }

    console.dir(await this.pH.broadcaster(msgs))
  }
  async generateInitialDirs (initMsg: EncodeObject | null, startingDirs?: string[]): Promise<void> {
    const url = `${this.currentProvider.ip.replace(/\/+$/, '')}/upload`
    const toGenerate = startingDirs || ['Config', 'Home', 'WWW']

    const creator = this.walletRef.getJackalAddress()
    const pubKey = this.walletRef.getPubkey()
    const account = await hashAndHex(creator)

    const rootTrackingNumber = self.crypto.randomUUID()
    const rootPermissions: IEditorsViewers = {}
    rootPermissions[await hashAndHex(`e${rootTrackingNumber}${creator}`)] = await aesToString(
      this.walletRef,
      pubKey,
      {
        iv: genIv(),
        key: await genKey()
      })
    const msgRoot = this.pH.fileTreeTx.msgMakeRoot({
      creator,
      account,
      rootHashPath: await merkleMeBro('s'),
      contents: JSON.stringify({ fids: [] }),
      editors: JSON.stringify(rootPermissions),
      viewers: JSON.stringify(rootPermissions),
      trackingNumber: rootTrackingNumber
    })

    const folderHandlerList: TFileOrFFile[] = []
    for (let i = 0; i < toGenerate.length; i++) {
      const folder = await FolderHandler.trackNewFolder(
        { myName: toGenerate[i], myParent: 's', myOwner: this.walletRef.getJackalAddress()
        })
      folderHandlerList.push(folder)
    }

    const msgs: EncodeObject[][] = await Promise.all(folderHandlerList.map(async (item: TFileOrFFile) => {
      const { cid, fid } = await doUpload(url, this.walletRef.getJackalAddress(), await item.getForUpload())
      const folderView: any = {}
      const folderEdit: any = {}
      const perms = await aesToString(this.walletRef, pubKey, await item.getEnc())
      const workingUUID = self.crypto.randomUUID()
      folderView[await hashAndHex(`v${workingUUID}${creator}`)] = perms
      folderEdit[await hashAndHex(`e${workingUUID}${creator}`)] = perms

      const msgPost: EncodeObject = await buildPostFile({
        creator,
        account,
        hashParent: await item.getMerklePath(),
        hashChild: await hashAndHex(item.getWhoAmI()),
        contents: JSON.stringify({ fids: fid }),
        viewers: JSON.stringify(folderView),
        editors: JSON.stringify(folderEdit),
        trackingNumber: workingUUID
      }, this.pH.fileTreeTx)

      const msgSign: EncodeObject = this.pH.storageTx.msgSignContract({ creator, cid })
      return [ msgPost, msgSign ]
    }))
    const readyToBroadcast: EncodeObject[] = []
    if (initMsg) {
      readyToBroadcast.push(initMsg)
    }
    readyToBroadcast.push(
      msgRoot,
      ...msgs.flat()
    )
    // await this.pH.debugBroadcaster(readyToBroadcast, true)
    await this.pH.debugBroadcaster(readyToBroadcast)
  }

  private async makeDelete (creator: string, targets: IDeleteItem[]): Promise<EncodeObject[]> {
    const { msgDeleteFile } = await this.pH.fileTreeTx
    const { msgCancelContract } = await this.pH.storageTx
    const readyToDelete: EncodeObject[][] = await Promise.all(targets.map(async (target: IDeleteItem) => {
      const hexPath = await hexFullPath(await merkleMeBro(target.location), target.name)
      const hexOwner = await hashAndHex(`o${hexPath}${await hashAndHex(creator)}`)
      const { version } = await getFileChainData(hexPath, hexOwner, this.pH.fileTreeQuery)
      const linkedCids  = JSON.parse((await this.pH.storageQuery.queryFidCid({ fid: version })).value.fidCid?.cids || '[]')
      const toRemove: string[] = await Promise.all(linkedCids.filter(async (cid: string) => {
        return await matchOwnerToCid(this.pH, cid, creator)
      }))
      const cancelContractsMsgs: EncodeObject[] = toRemove.map((cid: string) => msgCancelContract({ creator, cid }))
      const msgDelFile = await msgDeleteFile({
        creator,
        hashPath: hexPath,
        account: await hashAndHex(creator),
      })
      return [...cancelContractsMsgs, msgDelFile]
    }))
    return readyToDelete.flat()
  }
}

/** Helpers */
 async function prepExistingUpload (data: TFileOrFFile, ownerAddr: string, walletRef: IWalletHandler): Promise<{ file: File, cfg: IFileConfigFull }> {
  const hexedOwner = await hashAndHex(`o${await data.getFullMerkle()}${await hashAndHex(ownerAddr)}`)
  const fileChainResult = await getFileChainData(await data.getFullMerkle(), hexedOwner, walletRef.getProtoHandler().fileTreeQuery)
  const typedData = fileChainResult.data as IFileConfigRaw

  const configData: IFileConfigFull = {
    address: typedData.address,
    contents: JSON.parse(typedData.contents),
    owner: typedData.owner,
    editAccess: JSON.parse(typedData.editAccess),
    viewingAccess: JSON.parse(typedData.viewingAccess),
    trackingNumber: typedData.trackingNumber
  }

  const editorKeys = configData.editAccess[
    await hashAndHex(`e${configData.trackingNumber}${walletRef.getJackalAddress()}`)
    ]
  // const parsedKeys = JSON.parse(editorKeys)
  // const recoveredKey = await importJackalKey(new Uint8Array(walletRef.asymmetricDecrypt(parsedKeys.key)))
  // const recoveredIv = new Uint8Array(walletRef.asymmetricDecrypt(parsedKeys.iv))

  return {
    cfg: configData,
    file: await data.getForUpload(await stringToAes(walletRef, editorKeys))
  }
}
async function doUpload (url: string, sender: string, file: File): Promise<IProviderModifiedResponse> {
  const fileFormData = new FormData()
  fileFormData.set('file', file)
  fileFormData.set('sender', sender)
  return await fetch(url, { method: 'POST', body: fileFormData as FormData })
    .then((resp): Promise<IProviderResponse> => resp.json())
    .then((resp) => {
      console.log('Upload Resp')
      console.dir(resp)
      return { fid: [resp.fid], cid: resp.cid }
    })
}

async function getProvider (queryClient: IQueryStorage): Promise<IMiner[]> {
  const rawProviderReturn = await queryClient.queryProvidersAll({})

  if (!rawProviderReturn || !rawProviderReturn.value.providers) throw new Error('Unable to get Storage Provider list!')
  const rawProviderList = rawProviderReturn.value.providers as IMiner[] || []
  return rawProviderList.slice(0, 100)
}
async function getFileChainData (hexAddress: string, owner: string, fileTreeQuery: IQueryFileTree) {
  const fileResp = await fileTreeQuery.queryFiles({ address: hexAddress, ownerAddress: owner })
  console.dir(fileResp.value)

  if (!fileResp.value || !fileResp.value.files) throw new Error('No address found!')
  const fileData = fileResp.value.files
  if (!fileResp.success) {
    fileData.contents = '{ "fids": [] }'
  }
  const parsedContents: IFiletreeParsedContents = JSON.parse(fileData.contents)
  return {
    version: parsedContents.fids[parsedContents.fids.length - 1],
    data: fileData
  }
}
async function matchOwnerToCid (pH: IProtoHandler, cid: string, owner: string): Promise<boolean> {
   if ((await pH.storageQuery.queryContracts({ cid })).value.contracts?.signee == owner) {
     return true
   } else if ((await pH.storageQuery.queryStrays({ cid })).value.strays?.signee == owner) {
     return true
   } else {
     return false
   }
}
async function aesToString (wallet: IWalletHandler, pubKey: string, aes: IAesBundle): Promise<string> {
  const theIv = wallet.asymmetricEncrypt(aes.iv, pubKey)
  const theKey = wallet.asymmetricEncrypt(await exportJackalKey(aes.key), pubKey)
  return `${theIv}|${theKey}`
}
async function stringToAes (wallet: IWalletHandler, source: string): Promise<IAesBundle> {
  if (source.indexOf('|') < 0) throw new Error('stringToAes() : Invalid source string')

  const parts = source.split('|')
  return {
    iv: new Uint8Array(wallet.asymmetricDecrypt(parts[0])),
    key: await importJackalKey(new Uint8Array(wallet.asymmetricDecrypt(parts[1])))
  }
}
async function buildPostFile (data: IMsgPartialPostFileBundle, fileTreeTx: ITxFileTree): Promise<EncodeObject> {
  return fileTreeTx.msgPostFile({
    creator: data.creator,
    account: data.account,
    hashParent: data.hashParent,
    hashChild: data.hashChild,
    contents: data.contents,
    editors: data.editors,
    viewers: data.viewers,
    trackingNumber: data.trackingNumber
  })
}
async function random (max: number) {
   return Math.floor(Math.random() * max)
}
