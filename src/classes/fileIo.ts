import { EncodeObject } from '@cosmjs/proto-signing'
import { FormData as NodeFormData } from 'formdata-node'
import { storageQueryApi, storageQueryClient, storageTxClient, filetreeTxClient, filetreeQueryClient } from 'jackal.js-protos'
import FileHandler from '../classes/fileHandler'
import { finalizeGas } from '../utils/gas'
import { hashAndHex } from '../utils/hash'
import { defaultQueryAddr1317, defaultTxAddr26657 } from '../utils/globals'
import IFileHandler from '../interfaces/classes/IFileHandler'
import IWalletHandler from '../interfaces/classes/IWalletHandler'
import IEditorsViewers from '../interfaces/IEditorsViewers'
import IFileConfigRaw from '../interfaces/IFileConfigRaw'
import IFileIo from '../interfaces/classes/IFileIo'
import IProviderResponse from '../interfaces/IProviderResponse'
import IMiner from '../interfaces/IMiner'
import { TFileOrFFile } from '../types/TFoldersAndFiles'
import FolderHandler from './folderHandler'
import IFolderHandler from '../interfaces/classes/IFolderHandler'

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
    const providers = await this.getProvider(await storageQueryClient({ addr: queryAddr }))
    return new FileIo(wallet, txAddr, queryAddr, ftxClient, stxClient, providers)
  }

  static async getProvider (queryClient: storageQueryApi<any>): Promise<IMiner[]> {
    const rawProviderReturn = await queryClient.queryMinersAll()
    const rawProviderList = rawProviderReturn.data.miners as IMiner[] || []
    return rawProviderList.slice(0, 100)
  }
  async shuffle (): Promise<void> {
    this.availableProviders = await FileIo.getProvider(await storageQueryClient({ addr: this.queryAddr1317 }))
    this.currentProvider = this.availableProviders[Math.floor(Math.random() * this.availableProviders.length)]
  }
  forceProvider (toSet: IMiner): void {
    this.currentProvider = toSet
  }

  async uploadFiles (toUpload: TFileOrFFile[]): Promise<void> {
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
      const ids: TFileOrFFile[] = await Promise.all(toUpload.map(async (item: TFileOrFFile) => {
        const fileFormData = new NodeFormData()
        fileFormData.set('file', await item.getForUpload())
        const ret: IProviderResponse = await fetch(url, {method: 'POST', body: fileFormData as FormData})
          .then(resp => resp.json())
        item.setIds(ret)
        return item
      }))
      await this.afterUpload(ids)
    }
  }

  async downloadFile (fileAddress: string, isFolder?: boolean): Promise<IFileHandler | IFolderHandler> {
    /**
     * update to build fileAddress
     *
     * fid to /d/
     * process
     */

    const { queryFiles } = await filetreeQueryClient({ addr: this.queryAddr1317 })
    const { queryFindFile } = await storageQueryClient({ addr: this.queryAddr1317 })
    const filetreeQueryResults = await queryFiles(await hashAndHex(fileAddress))
    const fileData = filetreeQueryResults.data.files || {address: '', contents: '', owner: '', editAccess: '', viewingAccess: ''}
    const storageQueryResults = await queryFindFile(fileData.contents as string)

    const providers = storageQueryResults.data.minerIps || '[]'
    const targetProvider = JSON.parse(providers)
    if (targetProvider && targetProvider.length) {
      const url = `${targetProvider.endsWith('/') ? targetProvider.slice(0, -1) : targetProvider}/d/${fileData.contents as string}`
      return await fetch(url)
        .then(resp => resp.arrayBuffer())
        .then(async (resp): Promise<IFileHandler | IFolderHandler> => {
          const config: IFileConfigRaw = {
            creator: fileData.owner as string,
            hashpath: fileData.address as string,
            contents: fileData.contents as string,
            viewers: JSON.parse(fileData.viewingAccess as string) as IEditorsViewers,
            editors: JSON.parse(fileData.editAccess as string) as IEditorsViewers
          }
          const { key, iv } = config.editors[config.creator]
          const { asymmetricDecrypt } = this.walletRef
          if (isFolder) {
            return await FolderHandler.trackFolder(resp, config, asymmetricDecrypt(key), asymmetricDecrypt(iv))
          } else {
            return await FileHandler.trackFile(resp, config, fileAddress, asymmetricDecrypt(key), asymmetricDecrypt(iv))
          }
        })
    } else {
      throw new Error('No available providers!')
    }
  }
  private async afterUpload (ids: TFileOrFFile[]): Promise<void> {
    const { signAndBroadcast, msgPostFile } = await this.fileTxClient()
    const { msgSignContract } = await this.storageTxClient()
    const { getJackalAddress, asymmetricEncrypt, getPubkey } = this.walletRef

    const creator = await hashAndHex(getJackalAddress())
    const ready = await Promise.all(ids.flatMap(async (obj: TFileOrFFile) => {
      const crypt = await obj.getEnc()
      const partial = {
        iv: asymmetricEncrypt(crypt.iv, getPubkey()),
        key: asymmetricEncrypt(crypt.key, getPubkey())
      }
      const perms: any = {}
      perms[creator] = partial

      const msgPost: EncodeObject = await msgPostFile(JSON.stringify({
        creator,
        hashpath: await hashAndHex(obj.path),
        contents: obj.fid,
        viewers: perms,
        editors: perms
      }))

      const msgSign: EncodeObject = await msgSignContract({
        creator,      // owner jkl address
        cid: obj.cid  // cid from above
      })
      return [msgPost, msgSign]
    }))
    const lastStep = await signAndBroadcast(ready.flat(), {fee: finalizeGas(ready.flat()),memo: ''})
    console.dir(lastStep)
  }
}
