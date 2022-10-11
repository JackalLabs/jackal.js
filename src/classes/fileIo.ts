import { EncodeObject } from '@cosmjs/proto-signing'
import { FormData as NodeFormData } from 'formdata-node'
import { storageQueryApi, storageQueryClient, storageTxClient, filetreeTxClient, filetreeQueryClient } from 'jackal.js-protos'
import FileDownloadHandler from './fileDownloadHandler'
import { finalizeGas } from '../utils/gas'
import { hashAndHex, hexFullPath, merkleMeBro } from '../utils/hash'
import { IFileDownloadHandler, IFileIo, IFolderHandler, IWalletHandler } from '../interfaces/classes'
import { TFileOrFFile } from '../types/TFoldersAndFiles'
import FileUploadHandler from './fileUploadHandler'
import FolderHandler from './folderHandler'
import { exportJackalKey, genIv, genKey, importJackalKey } from '../utils/crypt'
import {
  IEditorsViewers,
  IFileConfigFull,
  IFileConfigRaw,
  IFileMeta,
  IMiner,
  IMsgFinalPostFileBundle,
  IMsgPostFileBundle,
  IProviderModifiedResponse,
  IProviderResponse,
  IQueueItemPostUpload
} from '../interfaces'

export default class FileIo implements IFileIo {
  private walletRef: IWalletHandler
  private txAddr26657: string
  private queryAddr1317: string
  private fileTxClient: any
  private storageTxClient: any
  private availableProviders: IMiner[]
  private currentProvider: IMiner

  private constructor (wallet: IWalletHandler, txAddr26657: string, queryAddr1317: string, fTxClient: any, sTxClient: any, providers: IMiner[]) {
    this.walletRef = wallet
    this.txAddr26657 = txAddr26657
    this.queryAddr1317 = queryAddr1317
    this.fileTxClient = fTxClient
    this.storageTxClient = sTxClient
    this.availableProviders = providers
    this.currentProvider = providers[Math.floor(Math.random() * providers.length)]
  }

  static async trackIo (wallet: IWalletHandler): Promise<FileIo> {
    const txAddr = wallet.txAddr26657 // txAddr || defaultTxAddr26657
    const queryAddr = wallet.queryAddr1317 // queryAddr || defaultQueryAddr1317
    const ftxClient = await filetreeTxClient(wallet.getSigner(), { addr: txAddr })
    const stxClient = await storageTxClient(wallet.getSigner(), { addr: txAddr })
    const providers = await getProvider(await storageQueryClient({ addr: queryAddr }))
    console.dir(providers)
    return new FileIo(wallet, txAddr, queryAddr, ftxClient, stxClient, providers)
  }

  async shuffle (): Promise<void> {
    this.availableProviders = await getProvider(await storageQueryClient({ addr: this.queryAddr1317 }))
    this.currentProvider = this.availableProviders[Math.floor(Math.random() * this.availableProviders.length)]
  }
  forceProvider (toSet: IMiner): void {
    this.currentProvider = toSet
  }

  async uploadFiles (toUpload: TFileOrFFile[], owner: string, existingChildren: { [name: string]: IFileMeta }): Promise<void> {
    /**
     * http to provider
     * receive fid/cid
     * use cid to msgSignContract and also msgPostFile
     */
    if (!toUpload.length) {
      throw new Error('Empty File array submitted for upload')
    } else {
      const { ip } = this.currentProvider
      const url = `${ip.endsWith('/') ? ip.slice(0, -1) : ip}/u`
      const ids: IQueueItemPostUpload[] = await Promise.all(toUpload.map(async (item: TFileOrFFile) => {
        const fileName = item.getWhoAmI()
        let file
        let configData: IFileConfigFull | undefined
        if (existingChildren[fileName]) {
          const path = await hexFullPath(await item.getMerklePath(), fileName)
          const { data } = await getFileChainData(path, owner, this.queryAddr1317)
          const typedData = data as IFileConfigRaw
          configData = {
            address: typedData.address,
            contents: typedData.contents,
            owner: typedData.owner,
            editAccess: JSON.parse(typedData.editAccess),
            viewingAccess: JSON.parse(typedData.viewingAccess),
            trackingNumber: typedData.trackingNumber
          }

          const editorKeys = configData.editAccess[await hexFullPath(configData.trackingNumber, this.walletRef.getJackalAddress())]
          const { asymmetricDecrypt } = this.walletRef
          const recoveredKey = await importJackalKey(new Uint8Array(asymmetricDecrypt(editorKeys.key)))
          const recoveredIv = new Uint8Array(asymmetricDecrypt(editorKeys.iv))
          file = await item.getForUpload(recoveredKey, recoveredIv)
        } else {
          file = await item.getForUpload()
        }
        item.setIds(await doUpload(url, this.walletRef.getJackalAddress(), file))
        return { handler: item, data: configData }
      }))
      await this.afterUpload(ids)
    }
  }
  async downloadFile (hexAddress: string, owner: string, isFolder?: boolean): Promise<IFileDownloadHandler | IFolderHandler> {
    /**
     * update to build fileAddress
     *
     * fid to /d/
     * process
     */
    const { queryFindFile } = await storageQueryClient({ addr: this.queryAddr1317 })
    const { version, data } = await getFileChainData(hexAddress, owner, this.queryAddr1317)
    const storageQueryResults = await queryFindFile(version)

    if (!storageQueryResults || !storageQueryResults.data.minerIps) throw new Error('No FID found!')
    const providers = storageQueryResults.data.minerIps
    const targetProvider = JSON.parse(providers)
    if (targetProvider && targetProvider.length) {
      const url = `${targetProvider.endsWith('/') ? targetProvider.slice(0, -1) : targetProvider}/d/${version}`
      return await fetch(url, { mode: 'no-cors' })
        .then(resp => resp.arrayBuffer())
        .then(async (resp): Promise<IFileDownloadHandler | IFolderHandler> => {
          const config = {
            editAccess: JSON.parse(data.editAccess as string), // json stirng array of edit access object (to be discussed
            viewingAccess: JSON.parse(data.viewingAccess as string), // json string of viewing access object (to be discussed)
            trackingNumber: data.trackingNumber as string // uuid
          }
          const requestor = await hashAndHex(`${config.trackingNumber}${await hashAndHex(this.walletRef.getJackalAddress())}`)
          const { key, iv } = config.editAccess[requestor]
          const { asymmetricDecrypt } = this.walletRef
          const recoveredKey = await importJackalKey(new Uint8Array(asymmetricDecrypt(key)))
          const recoveredIv = new Uint8Array(asymmetricDecrypt(iv))
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
  private async afterUpload (ids: IQueueItemPostUpload[]): Promise<void> {
    const { signAndBroadcast, msgPostFile } = await this.fileTxClient
    const { msgSignContract } = await this.storageTxClient

    const creator = this.walletRef.getJackalAddress()
    const ready = await Promise.all(ids.flatMap(async (item: IQueueItemPostUpload) => {
      const { cid, fid } = item.handler.getIds()
      const msgPostFileBundle: IMsgPostFileBundle = {
        account: '',
        editors: {},
        viewers: {},
        creator,
        contents: fid,
        hashParent: await item.handler.getMerklePath(),
        hashChild: await hashAndHex(item.handler.getWhoAmI()),
        trackingNumber: 123
        // trackingNumber: item.handler.getUUID()
      }
      if (item.data) {
        msgPostFileBundle.account = item.data.owner
        msgPostFileBundle.editors = item.data.editAccess
        msgPostFileBundle.viewers = item.data.viewingAccess
      } else {
        const { iv, key } = await item.handler.getEnc()
        const pubKey = this.walletRef.getPubkey()
        const partial = {
          iv: this.walletRef.asymmetricEncrypt(iv, pubKey),
          key: this.walletRef.asymmetricEncrypt(key, pubKey)
        }
        const permissions: IEditorsViewers = {}
        msgPostFileBundle.account = await hexFullPath(item.handler.getUUID(), this.walletRef.getJackalAddress())
        permissions[msgPostFileBundle.account] = partial
        msgPostFileBundle.editors = permissions
        msgPostFileBundle.viewers = permissions
      }

      const finalBundle: IMsgFinalPostFileBundle = {
        ...msgPostFileBundle,
        contents: JSON.stringify(msgPostFileBundle.contents),
        editors: JSON.stringify(msgPostFileBundle.editors),
        viewers: JSON.stringify(msgPostFileBundle.viewers)
      }
      const msgPost: EncodeObject = await msgPostFile(finalBundle)

      const msgSign: EncodeObject = await msgSignContract({
        creator, // tx initiator jkl address
        cid // cid from above
      })
      return [msgPost, msgSign]
    }))
    const lastStep = await signAndBroadcast(ready.flat(), { fee: finalizeGas(ready.flat()), memo: '' })
    console.dir(lastStep)
  }
  async generateInitialDirs (rns: string, startingDirs?: string[]): Promise<void> {
    const toGenerate = startingDirs || ['Config', 'Home', 'Shared', 'WWW']
    const root = await FolderHandler.trackNewFolder({ myName: '', myParent: '', myOwner: this.walletRef.getJackalAddress() })
    root.addChildDirs(toGenerate)
    const folderHandlerList: TFileOrFFile[] = [root]
    for (let i = 0; i < toGenerate.length; i++) {
      const folder = await FolderHandler.trackNewFolder(
        { myName: toGenerate[i], myParent: '', myOwner: this.walletRef.getJackalAddress()
        })
      if (folder.getWhoAmI() === 'Config') {
        const configFile = new File([(new TextEncoder()).encode(JSON.stringify({primary: rns}))], 'rns.json', {type: 'application/json'})
        const configHandler = await FileUploadHandler.trackFile(configFile, 'Config')
        folder.addChildFiles([configHandler.getMeta()])
        folderHandlerList.push(configHandler)
      }
      folderHandlerList.push(folder)
    }
    const { ip } = this.currentProvider
    const url = `${ip.replace(/\/+$/, '')}/u`
    const ids: IQueueItemPostUpload[] = await Promise.all(folderHandlerList.map(async (item: TFileOrFFile) => {
      console.log(await item.getForUpload())
      item.setIds(await doUpload(url, this.walletRef.getJackalAddress(), await item.getForUpload()))
      return { handler: item, data: undefined }
    }))
    const { signAndBroadcast, msgMakeFolder } = await this.fileTxClient
    const { msgSignContract } = await this.storageTxClient
    const creator = this.walletRef.getJackalAddress()
    // const msgPostFileBundleTemplate: IMsgFinalPostFileBundle = {
    //   account: 'abc',
    //   editors: 'abc',
    //   viewers: 'abc',
    //   creator,
    //   contents: 'abc',
    //   hashParent: 'abc',
    //   hashChild: 'abc',
    //   trackingNumber: Date.now()
    // }
    const trackingNumber = Date.now()
    const account = await hashAndHex(creator)
    const pubKey = this.walletRef.getPubkey()

    const permissions: IEditorsViewers = {}
    permissions[account] = {
      iv: this.walletRef.asymmetricEncrypt(genIv(), pubKey),
      key: this.walletRef.asymmetricEncrypt(await exportJackalKey(await genKey()), pubKey)
    }

    const tst = await msgMakeFolder({
      creator,
      account,
      rootHashPath: await merkleMeBro('s'),
      contents: JSON.stringify([]),
      editors: JSON.stringify(permissions),
      viewers: JSON.stringify(permissions),
      trackingNumber: trackingNumber
    })
    await signAndBroadcast([tst], { fee: finalizeGas([]), memo: '' })

    // const final: EncodeObject[] = []
    // for (let i = 0; i < ids.length; i++) {
    //   const { cid, fid } = ids[i].handler.getIds()
    //   const frame = {...msgPostFileBundleTemplate}
    //   frame.account = await hexFullPath(ids[i].handler.getUUID(), creator)
    //   if (i === 0) {
    //     // do nothing
    //   } else {
    //     frame.hashChild = await hashAndHex(ids[0].handler.getWhoAmI())
    //   }
    //   const { iv, key } = await ids[0].handler.getEnc()
    //   const pubKey = this.walletRef.getPubkey()
    //   const permissions: IEditorsViewers = {}
    //   permissions[frame.account] = {
    //     iv: this.walletRef.asymmetricEncrypt(iv, pubKey),
    //     key: this.walletRef.asymmetricEncrypt(key, pubKey)
    //   }
    //   frame.editors = JSON.stringify(permissions)
    //   frame.viewers = JSON.stringify(permissions)
    //   frame.contents = JSON.stringify(fid)
    //   // frame.trackingNumber = ids[i].handler.getUUID()
    //   const msgPost: EncodeObject = await msgPostFile(frame)
    //   const msgSign: EncodeObject = await msgSignContract({
    //     creator, // tx initiator jkl address
    //     cid // cid from above
    //   })
    //   console.dir(msgSign)
    //   const lastStep = await signAndBroadcast([msgPost], { fee: finalizeGas(final), memo: '' })
    //   await (await this.storageTxClient).signAndBroadcast([msgSign], { fee: finalizeGas(final), memo: '' })
    // }
    // const lastStep = await signAndBroadcast([msgPost], { fee: finalizeGas(final), memo: '' })
    // const otherLast = (await this.storageTxClient.signAndBroadcast([msgSign], { fee: finalizeGas(final), memo: '' }))
    // console.dir(lastStep)
  }
}

/** Helpers */
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
  const rawProviderReturn = await queryClient.queryMinersAll()

  if (!rawProviderReturn || !rawProviderReturn.data.miners) throw new Error('Unable to get Storage Provider list!')
  const rawProviderList = rawProviderReturn.data.miners as IMiner[]
  return rawProviderList.slice(0, 100)
}
async function getFileChainData (hexAddress: string, owner: string, queryAddr1317: string) {
  const { queryFiles } = await filetreeQueryClient({ addr: queryAddr1317 })
  const filetreeQueryResults = await queryFiles(hexAddress, owner)

  if (!filetreeQueryResults || !filetreeQueryResults.data.files) throw new Error('No address found!')
  const fileData = filetreeQueryResults.data.files
  const versions: string[] = JSON.parse(fileData.contents as string)
  return {
    version: versions[versions.length - 1],
    data: fileData
  }
}
