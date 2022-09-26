import { EncodeObject } from '@cosmjs/proto-signing'
import { FormData as NodeFormData } from 'formdata-node'
import { storageQueryApi, storageQueryClient, storageTxClient, filetreeTxClient, filetreeQueryClient } from 'jackal.js-protos'
import FileDownloadHandler from './fileDownloadHandler'
import { finalizeGas } from '../utils/gas'
import { hashAndHex, hexFullPath } from '../utils/hash'
import IFileDownloadHandler from '../interfaces/classes/IFileDownloadHandler'
import IWalletHandler from '../interfaces/classes/IWalletHandler'
import IFileIo from '../interfaces/classes/IFileIo'
import IProviderResponse from '../interfaces/IProviderResponse'
import IMiner from '../interfaces/IMiner'
import { TFileOrFFile } from '../types/TFoldersAndFiles'
import FolderHandler from './folderHandler'
import IFolderHandler from '../interfaces/classes/IFolderHandler'
import IFileMeta from '../interfaces/IFileMeta'
import { importJackalKey } from '../utils/crypt'
import IProviderModifiedResponse from '../interfaces/IProviderModifiedResponse'
import IQueueItemPostUpload from '../interfaces/IQueueItemPostUpload'
import IMsgPostFileBundle from '../interfaces/IMsgPostFileBundle'
import IEditorsViewers from '../interfaces/IEditorsViewers'
import IFileConfigFull from '../interfaces/IFileConfigFull'

export default class FileIo implements IFileIo {
  walletRef: IWalletHandler
  txAddr26657: string
  queryAddr1317: string
  fileTxClient: any
  storageTxClient: any
  availableProviders: IMiner[]
  currentProvider: IMiner

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
    return new FileIo(wallet, txAddr, queryAddr, ftxClient, stxClient, providers)
  }

  async shuffle (): Promise<void> {
    this.availableProviders = await getProvider(await storageQueryClient({ addr: this.queryAddr1317 }))
    this.currentProvider = this.availableProviders[Math.floor(Math.random() * this.availableProviders.length)]
  }
  forceProvider (toSet: IMiner): void {
    this.currentProvider = toSet
  }

  async uploadFiles (toUpload: TFileOrFFile[], existingChildren: { [name: string]: IFileMeta }): Promise<void> {
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
          const { data } = await getFileChainData(await hexFullPath(await item.getMerklePath(), fileName), this.queryAddr1317)
          configData = {
            address: data.address as string,
            contents: data.contents as string,
            owner: data.owner as string,
            editAccess: JSON.parse(data.editAccess as string),
            viewingAccess: JSON.parse(data.viewingAccess as string),
            trackingNumber: data.trackingNumber as string
          }

          const editorKeys = configData.editAccess[await hexFullPath(configData.trackingNumber, this.walletRef.getJackalAddress())]
          const { asymmetricDecrypt } = this.walletRef
          const recoveredKey = await importJackalKey(new Uint8Array(asymmetricDecrypt(editorKeys.key)))
          const recoveredIv = new Uint8Array(asymmetricDecrypt(editorKeys.iv))
          file = await item.getForUpload(recoveredKey, recoveredIv)
        } else {
          file = await item.getForUpload()
        }
        item.setIds(await doUpload(url, file))
        return { handler: item, data: configData }
      }))
      await this.afterUpload(ids)
    }
  }
  async downloadFile (hexAddress: string, isFolder?: boolean): Promise<IFileDownloadHandler | IFolderHandler> {
    /**
     * update to build fileAddress
     *
     * fid to /d/
     * process
     */
    const { queryFindFile } = await storageQueryClient({ addr: this.queryAddr1317 })
    const { version, data } = await getFileChainData(hexAddress, this.queryAddr1317)
    const storageQueryResults = await queryFindFile(version)

    if (!storageQueryResults || !storageQueryResults.data.minerIps) throw new Error('No FID found!')
    const providers = storageQueryResults.data.minerIps
    const targetProvider = JSON.parse(providers)
    if (targetProvider && targetProvider.length) {
      const url = `${targetProvider.endsWith('/') ? targetProvider.slice(0, -1) : targetProvider}/d/${version}`
      return await fetch(url)
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
    const { signAndBroadcast, msgPostFile } = await this.fileTxClient()
    const { msgSignContract } = await this.storageTxClient()
    const { getJackalAddress, asymmetricEncrypt, getPubkey } = this.walletRef

    const creator = getJackalAddress()
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
        trackingNumber: item.handler.getUUID()
      }
      if (item.data) {
        msgPostFileBundle.account = item.data.owner
        msgPostFileBundle.editors = item.data.editAccess
        msgPostFileBundle.viewers = item.data.viewingAccess
      } else {
        const { iv, key } = await item.handler.getEnc()
        const pubKey = getPubkey()
        const partial = {
          iv: asymmetricEncrypt(iv, pubKey),
          key: asymmetricEncrypt(key, pubKey)
        }
        const permissions: IEditorsViewers = {}
        msgPostFileBundle.account = await hexFullPath(item.handler.getUUID(), getJackalAddress())
        permissions[msgPostFileBundle.account] = partial
        msgPostFileBundle.editors = permissions
        msgPostFileBundle.viewers = permissions
      }

      const msgPost: EncodeObject = await msgPostFile(JSON.stringify(msgPostFileBundle as any))

      const msgSign: EncodeObject = await msgSignContract({
        creator, // tx initiator jkl address
        cid // cid from above
      })
      return [msgPost, msgSign]
    }))
    const lastStep = await signAndBroadcast(ready.flat(), { fee: finalizeGas(ready.flat()), memo: '' })
    console.dir(lastStep)
  }
  async generateInitialDirs (startingDirs?: string[]): Promise<void> {
    const toGenerate = startingDirs || ['Home', 'Shared', 'WWW']
    const folderHandlerList = [
      await FolderHandler.trackNewFolder({ myName: '', myParent: '' })
    ]
    folderHandlerList[0].addChildDirs(toGenerate)
    for (let i = 0; i < toGenerate.length; i++) {
      folderHandlerList.push(await FolderHandler.trackNewFolder({ myName: toGenerate[i], myParent: '' }))
    }
    const {ip} = this.currentProvider
    const url = `${ip.endsWith('/') ? ip.slice(0, -1) : ip}/u`
    const ids: IQueueItemPostUpload[] = await Promise.all(folderHandlerList.map(async (item: TFileOrFFile) => {
      item.setIds(await doUpload(url, await item.getForUpload()))
      return { handler: item, data: undefined }
    }))
    const { signAndBroadcast, msgPostFile } = await this.fileTxClient()
    const { msgSignContract } = await this.storageTxClient()
    const { getJackalAddress, asymmetricEncrypt, getPubkey } = this.walletRef
    const creator = getJackalAddress()
    const msgPostFileBundleTemplate: IMsgPostFileBundle = {
      account: '',
      editors: {},
      viewers: {},
      creator,
      contents: [],
      hashParent: '',
      hashChild: '',
      trackingNumber: ''
    }
    const final: EncodeObject[] = []
    for (let i = 0; i < ids.length; i++) {
      const { cid, fid } = ids[i].handler.getIds()
      const frame = msgPostFileBundleTemplate
      frame.account = await hexFullPath(ids[i].handler.getUUID(), creator)
      if (i === 0) {
        // do nothing
      } else {
        frame.hashChild = await hashAndHex(ids[0].handler.getWhoAmI())
      }
      const { iv, key } = await ids[0].handler.getEnc()
      const pubKey = getPubkey()
      const permissions: IEditorsViewers = {}
      permissions[frame.account] = {
        iv: asymmetricEncrypt(iv, pubKey),
        key: asymmetricEncrypt(key, pubKey)
      }
      frame.editors = permissions
      frame.viewers = permissions
      frame.contents = fid
      frame.trackingNumber = ids[i].handler.getUUID()
      const msgPost: EncodeObject = await msgPostFile(JSON.stringify(frame))
      const msgSign: EncodeObject = await msgSignContract({
        creator, // tx initiator jkl address
        cid // cid from above
      })
      final.push(msgPost, msgSign)
    }
    const lastStep = await signAndBroadcast(final, { fee: finalizeGas(final), memo: '' })
    console.dir(lastStep)
  }
}

/** Helpers */
async function doUpload (url: string, file: File): Promise<IProviderModifiedResponse> {
  const fileFormData = new NodeFormData()
  fileFormData.set('file', file)
  return await fetch(url, { method: 'POST', body: fileFormData as FormData })
    .then((resp): Promise<IProviderResponse> => resp.json())
    .then((resp) => {
      return { fid: [resp.fid], cid: resp.cid }
    })
}
async function getProvider (queryClient: storageQueryApi<any>): Promise<IMiner[]> {
  const rawProviderReturn = await queryClient.queryMinersAll()

  if (!rawProviderReturn || !rawProviderReturn.data.miners) throw new Error('Unable to get Storage Provider list!')
  const rawProviderList = rawProviderReturn.data.miners as IMiner[]
  return rawProviderList.slice(0, 100)
}
async function getFileChainData (hexAddress: string, queryAddr1317: string) {
  const { queryFiles } = await filetreeQueryClient({ addr: queryAddr1317 })
  const filetreeQueryResults = await queryFiles(hexAddress)

  if (!filetreeQueryResults || !filetreeQueryResults.data.files) throw new Error('No address found!')
  const fileData = filetreeQueryResults.data.files
  const versions: string[] = JSON.parse(fileData.contents as string)
  return {
    version: versions[versions.length - 1],
    data: fileData
  }
}
