import { EncodeObject } from '@cosmjs/proto-signing'
import { FormData as NodeFormData } from 'formdata-node'
import { makeMasterBroadcaster, storageQueryApi, storageQueryClient, storageTxClient, filetreeTxClient, filetreeQueryClient } from 'jackal.js-protos'
import FileDownloadHandler from './fileDownloadHandler'
import { finalizeGas } from '../utils/gas'
import { hashAndHex, hexFullPath, merkleMeBro } from '../utils/hash'
import { IFileDownloadHandler, IFileIo, IFolderHandler, IWalletHandler } from '../interfaces/classes'
import { TFileOrFFile } from '../types/TFoldersAndFiles'
import FolderHandler from './folderHandler'
import { exportJackalKey, genIv, genKey, importJackalKey } from '../utils/crypt'
import {
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
} from '../interfaces'
import { randomUUID } from 'make-random'
import IDeleteItem from '../interfaces/IDeleteItem'
import { checkResults } from '../utils/misc'
import WalletHandler from './walletHandler'

export default class FileIo implements IFileIo {
  private walletRef: IWalletHandler
  private txAddr26657: string
  private queryAddr1317: string
  private fileTxClient: any
  private storageTxClient: any
  private storageQueryClient: any
  private availableProviders: IMiner[]
  private currentProvider: IMiner

  private constructor (wallet: IWalletHandler, txAddr26657: string, queryAddr1317: string, fTxClient: any, sTxClient: any, sQClient: any, providers: IMiner[]) {
    this.walletRef = wallet
    this.txAddr26657 = txAddr26657
    this.queryAddr1317 = queryAddr1317
    this.fileTxClient = fTxClient
    this.storageTxClient = sTxClient
    this.storageQueryClient = sQClient
    this.availableProviders = providers
    this.currentProvider = providers[Math.floor(Math.random() * providers.length)]
  }

  static async trackIo (wallet: IWalletHandler): Promise<FileIo> {
    const txAddr = wallet.txAddr26657 // txAddr || defaultTxAddr26657
    const queryAddr = wallet.queryAddr1317 // queryAddr || defaultQueryAddr1317
    const ftxClient = await filetreeTxClient(wallet.getSigner(), { addr: txAddr })
    const stxClient = await storageTxClient(wallet.getSigner(), { addr: txAddr })
    const sqClient = await storageQueryClient({ addr: queryAddr })
    const providers = await getProvider(sqClient)
    console.dir(providers)
    return new FileIo(wallet, txAddr, queryAddr, ftxClient, stxClient, sqClient, providers)
  }

  async shuffle (): Promise<void> {
    this.availableProviders = await getProvider(await storageQueryClient({ addr: this.queryAddr1317 }))
    this.currentProvider = this.availableProviders[Math.floor(Math.random() * this.availableProviders.length)]
  }
  forceProvider (toSet: IMiner): void {
    this.currentProvider = toSet
  }

  async uploadFolders (toUpload: IFolderHandler[], owner: string): Promise<void> {
    const { ip } = this.currentProvider
    const url = `${ip.endsWith('/') ? ip.slice(0, -1) : ip}/u`
    const jackalAddr = this.walletRef.getJackalAddress()

    toUpload[0].setIds(await doUpload(url, jackalAddr, await toUpload[0].getForUpload()))
    const { cfg, file } = await prepExistingUpload(toUpload[1], owner, this.walletRef)
    toUpload[1].setIds(await doUpload(url, jackalAddr, file))

    await this.afterUpload([
      { handler: toUpload[0], data: null },
      { handler: toUpload[1], data: cfg }
    ])
  }
  async uploadFiles (toUpload: TFileOrFFile[], owner: string, existingChildren: { [name: string]: IFileMeta }): Promise<void> {
    if (!toUpload.length) {
      throw new Error('Empty File array submitted for upload')
    } else {
      const { ip } = this.currentProvider
      const url = `${ip.endsWith('/') ? ip.slice(0, -1) : ip}/u`
      const ids: IQueueItemPostUpload[] = await Promise.all(toUpload.map(async (item: TFileOrFFile) => {
        const itemName = item.getWhoAmI()
        const jackalAddr = this.walletRef.getJackalAddress()
        const { cfg, file } = (!existingChildren[itemName] && !item.isFolder)
          ? { cfg: null, file: await item.getForUpload()}
          : await prepExistingUpload(item, owner, this.walletRef)

        item.setIds(await doUpload(url, jackalAddr, file))
        console.log(itemName)
        console.dir(item.getIds())
        return { handler: item, data: cfg }
      }))
      await this.afterUpload(ids)
    }
  }
  private async afterUpload (ids: IQueueItemPostUpload[]): Promise<void> {
    const { masterBroadcaster } = await makeMasterBroadcaster(this.walletRef.getSigner(), { addr: this.txAddr26657 })
    const { msgPostFile } = await this.fileTxClient
    const { msgSignContract } = await this.storageTxClient

    const creator = this.walletRef.getJackalAddress()

    const needingReset: EncodeObject[] = []
    const ready = await Promise.all(ids.flatMap(async (item: IQueueItemPostUpload) => {
      const { cid, fid } = item.handler.getIds()
      const msgPostFileBundle: IMsgPartialPostFileBundle = {
        creator,
        // account: (item.data?.owner) ? item.data.owner : await hashAndHex(creator),
        account: await hashAndHex(creator),
        hashParent: await item.handler.getMerklePath(),
        hashChild: await hashAndHex(item.handler.getWhoAmI()),
        contents: JSON.stringify({ fids: fid }),
        viewers: '',
        editors: '',
        trackingNumber: ''
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
      } else {
        const pubKey = this.walletRef.getPubkey()
        const { iv, key } = await item.handler.getEnc()
        const folderView: IEditorsViewers = {}
        const folderEdit: IEditorsViewers = {}
        const perms = JSON.stringify({
          iv: this.walletRef.asymmetricEncrypt(iv, pubKey),
          key: this.walletRef.asymmetricEncrypt(key, pubKey)
        })
        const workingUUID = await randomUUID()
        folderView[await hashAndHex(`v${workingUUID}${creator}`)] = JSON.parse(perms)
        folderEdit[await hashAndHex(`e${workingUUID}${creator}`)] = JSON.parse(perms)
        msgPostFileBundle.viewers = JSON.stringify(folderView)
        msgPostFileBundle.editors = JSON.stringify(folderEdit)
        msgPostFileBundle.trackingNumber = workingUUID
      }
      console.log(Object.keys(msgPostFileBundle))
      const finalBundle: IMsgFinalPostFileBundle = {
        ...msgPostFileBundle,
        viewersToNotify: '',
        editorsToNotify: '',
        notiForViewers: '',
        notiForEditors: ''
      }
      console.log(Object.keys(finalBundle))

      const msgPost: EncodeObject = await msgPostFile(finalBundle)
      const msgSign: EncodeObject = await msgSignContract({ creator, cid })
      console.log('msgSign')
      console.dir(msgSign)
      return [msgPost, msgSign]
    }))

    ready.unshift(ready.pop() as EncodeObject[])
    const readyToBroadcast = [...needingReset, ...ready.flat()]
    // const readyToBroadcast = [...ready.flat()]
    console.dir(readyToBroadcast)
    checkResults(await masterBroadcaster(readyToBroadcast, { fee: finalizeGas(readyToBroadcast), memo: '' }))
    // const lastStep = await masterBroadcaster(needingReset, { fee: finalizeGas(needingReset), memo: '' })
    // checkResults(lastStep)
    // const lastStep2 = await masterBroadcaster(ready.flat(), { fee: finalizeGas(ready.flat()), memo: '' })
    // checkResults(lastStep2)
  }
  async downloadFile (hexAddress: string, owner: string, isFolder: boolean): Promise<IFileDownloadHandler | IFolderHandler> {
    const hexedOwner = await hashAndHex(`o${hexAddress}${await hashAndHex(owner)}`)
    const { version, data } = await getFileChainData(hexAddress, hexedOwner, this.queryAddr1317)
    const storageQueryResults = await this.storageQueryClient.queryFindFile(version)

    if (!storageQueryResults || !storageQueryResults.data.providerIps) throw new Error('No FID found!')
    const providers = storageQueryResults.data.providerIps
    console.dir(providers)
    const targetProvider = JSON.parse(providers)[0]
    if (targetProvider && targetProvider.length) {
      const url = `${targetProvider.endsWith('/') ? targetProvider.slice(0, -1) : targetProvider}/d/${version}`
      return await fetch(url)
        .then(resp => resp.arrayBuffer())
        .then(async (resp): Promise<IFileDownloadHandler | IFolderHandler> => {
          const config = {
            editAccess: JSON.parse(data.editAccess as string), // json string array of edit access object (to be discussed
            viewingAccess: JSON.parse(data.viewingAccess as string), // json string of viewing access object (to be discussed)
            trackingNumber: data.trackingNumber as string // uuid
          }
          const requestor = await hashAndHex(`e${config.trackingNumber}${this.walletRef.getJackalAddress()}`)
          console.dir(config.trackingNumber)
          console.log(requestor)
          console.dir(config.editAccess)
          const { key, iv } = config.editAccess[requestor]
          console.log('pre-crypt')
          console.dir(key)
          console.dir(iv)
          const recoveredKey = await importJackalKey(new Uint8Array(this.walletRef.asymmetricDecrypt(key)))
          const recoveredIv = new Uint8Array(this.walletRef.asymmetricDecrypt(iv))
          console.log('crypt')
          console.dir(recoveredKey)
          console.dir(recoveredIv)
          if (isFolder) {
            return await FolderHandler.trackFolder(resp, config, recoveredKey, recoveredIv)
          } else {
            return await FileDownloadHandler.trackFile(resp, config, recoveredKey, recoveredIv)
          }
        })
    } else {
      throw new Error('No available providers!')
    }
  }
  async deleteTargets (targets: IDeleteItem[], parent: IFolderHandler): Promise<void> {
    const { masterBroadcaster } = await makeMasterBroadcaster(this.walletRef.getSigner(), { addr: this.txAddr26657 })

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

    console.dir(await masterBroadcaster(msgs, { fee: finalizeGas(msgs), memo: '' }))
  }
  async generateInitialDirs (startingDirs?: string[]): Promise<void> {
    const { masterBroadcaster } = await makeMasterBroadcaster(this.walletRef.getSigner(), { addr: this.txAddr26657 })
    const { msgMakeRoot, msgPostFile } = await this.fileTxClient
    const { msgSignContract } = await this.storageTxClient
    const { ip } = this.currentProvider
    const url = `${ip.replace(/\/+$/, '')}/u`
    const toGenerate = startingDirs || ['Config', 'Home', 'WWW']

    const creator = this.walletRef.getJackalAddress()
    const pubKey = this.walletRef.getPubkey()
    const account = await hashAndHex(creator)

    const initMsg = await WalletHandler.initAccount(this.walletRef, this.fileTxClient)

    const rootTrackingNumber = await randomUUID()
    const rootPermissions: IEditorsViewers = {}
    rootPermissions[await hashAndHex(`e${rootTrackingNumber}${creator}`)] = {
      iv: this.walletRef.asymmetricEncrypt(genIv(), pubKey),
      key: this.walletRef.asymmetricEncrypt(await exportJackalKey(await genKey()), pubKey)
    }
    console.log('merkle')
    console.dir(await merkleMeBro('s'))
    const rootPerms = JSON.stringify(rootPermissions)
    const msgRoot = await msgMakeRoot({
      creator,
      account,
      rootHashPath: await merkleMeBro('s'),
      contents: JSON.stringify({ fids: [] }),
      editors: rootPerms,
      viewers: '',
      trackingNumber: rootTrackingNumber
    })

    // console.dir(await masterBroadcaster([msgRoot], { fee: finalizeGas([]), memo: '' }))

    const folderHandlerList: TFileOrFFile[] = []
    for (let i = 0; i < toGenerate.length; i++) {
      const folder = await FolderHandler.trackNewFolder(
        { myName: toGenerate[i], myParent: 's', myOwner: this.walletRef.getJackalAddress()
        })
      folderHandlerList.push(folder)
    }

    const msgs: EncodeObject[][] = await Promise.all(folderHandlerList.map(async (item: TFileOrFFile) => {
      const tmp = await doUpload(url, this.walletRef.getJackalAddress(), await item.getForUpload())
      console.dir(tmp)
      const { cid, fid } = tmp
      console.log('merkle path')
      console.dir(await item.getMerklePath())

      const { iv, key } = await item.getEnc()
      const folderView: IEditorsViewers = {}
      const folderEdit: IEditorsViewers = {}
      const perms = JSON.stringify({
        iv: this.walletRef.asymmetricEncrypt(iv, pubKey),
        key: this.walletRef.asymmetricEncrypt(key, pubKey)
      })
      const workingUUID = await randomUUID()
      folderView[await hashAndHex(`v${workingUUID}${creator}`)] = JSON.parse(perms)
      folderEdit[await hashAndHex(`e${workingUUID}${creator}`)] = JSON.parse(perms)
      const frame: IMsgFinalPostFileBundle = {
        creator,
        account,
        hashParent: await item.getMerklePath(),
        hashChild: await hashAndHex(item.getWhoAmI()),
        contents: JSON.stringify({ fids: fid }),
        viewers: JSON.stringify(folderView),
        editors: JSON.stringify(folderEdit),
        trackingNumber: workingUUID,
        viewersToNotify: '',
        editorsToNotify: '',
        notiForViewers: '',
        notiForEditors: ''
      }

      const msgPost: EncodeObject = await msgPostFile(frame)
      const msgSign: EncodeObject = await msgSignContract({ creator, cid })
      return [ msgPost, msgSign ]
    }))
    console.dir(msgs.flat())
    const readyToBroadcast = [initMsg, msgRoot, ...msgs.flat()]
    console.dir(await masterBroadcaster(readyToBroadcast, { fee: finalizeGas(readyToBroadcast), memo: '' }))
  }

  private async makeDelete (creator: string, targets: IDeleteItem[]): Promise<EncodeObject[]> {
    const { msgDeleteFile } = await this.fileTxClient
    const { msgCancelContract } = await this.storageTxClient

    const readyToDelete: EncodeObject[][] = await Promise.all(targets.map(async (target: IDeleteItem) => {
      const hexPath = await hexFullPath(await merkleMeBro(target.location), target.name)
      const hexOwner = await hashAndHex(`o${hexPath}${await hashAndHex(creator)}`)
      const { version } = await getFileChainData(hexPath, hexOwner, this.queryAddr1317)
      const possibleCids = await this.storageQueryClient.queryFidCid(version)
      const cidsToRemove = JSON.parse(possibleCids.data.fidCid?.cids || '[]')
      const strays: IStray[] = (await this.storageQueryClient.queryStraysAll()).data.strays || []
      const strayCids = strays.map((stray: IStray) => stray.cid)
      const finalCids = cidsToRemove.filter((cid: string) => !strayCids.includes(cid))
      const cancelContractsArr = await Promise.all(finalCids.map(async (cid: string) => {
        return msgCancelContract({ creator, cid })
      }))
      const msgDelFile = await msgDeleteFile({
        creator,
        hashPath: hexPath,
        account: await hashAndHex(creator),
      })
      return [...cancelContractsArr, msgDelFile]
    }))
    return readyToDelete.flat()
  }
}

/** Helpers */
async function prepExistingUpload (data: TFileOrFFile, ownerAddr: string, walletRef: IWalletHandler): Promise<{ file: File, cfg: IFileConfigFull }> {
  const hexedOwner = await hashAndHex(`o${await data.getFullMerkle()}${await hashAndHex(ownerAddr)}`)
  const fileChainResult = await getFileChainData(await data.getFullMerkle(), hexedOwner, walletRef.queryAddr1317)
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
  const recoveredKey = await importJackalKey(new Uint8Array(walletRef.asymmetricDecrypt(editorKeys.key)))
  const recoveredIv = new Uint8Array(walletRef.asymmetricDecrypt(editorKeys.iv))

  return {
    cfg: configData,
    file: await data.getForUpload(recoveredKey, recoveredIv)
  }
}
async function doUpload (url: string, sender: string, file: File): Promise<IProviderModifiedResponse> {
  const fileFormData = new NodeFormData()
  fileFormData.set('file', file)
  fileFormData.set('sender', sender)
  return await fetch(url, { method: 'POST', body: fileFormData as FormData })
    .then((resp): Promise<IProviderResponse> => resp.json())
    .then((resp) => {
      return { fid: [resp.FID], cid: resp.CID }
    })
}

async function getProvider (queryClient: storageQueryApi<any>): Promise<IMiner[]> {
  const rawProviderReturn = await queryClient.queryProvidersAll()

  if (!rawProviderReturn || !rawProviderReturn.data.providers) throw new Error('Unable to get Storage Provider list!')
  const rawProviderList = rawProviderReturn.data.providers as IMiner[]
  return rawProviderList.slice(0, 100)
}
async function getFileChainData (hexAddress: string, owner: string, queryAddr1317: string) {
  const { queryFiles } = await filetreeQueryClient({ addr: queryAddr1317 })
  const filetreeQueryResults = await queryFiles(hexAddress, owner)
  console.dir(filetreeQueryResults)

  if (!filetreeQueryResults || !filetreeQueryResults.data.files) throw new Error('No address found!')
  const fileData = filetreeQueryResults.data.files
  const parsedContents: IFiletreeParsedContents = JSON.parse(fileData.contents as string)
  return {
    version: parsedContents.fids[parsedContents.fids.length - 1],
    data: fileData
  }
}
