import { EncodeObject, OfflineSigner } from '@cosmjs/proto-signing'
import { FormData } from 'formdata-node'
import { storageQueryApi, storageQueryClient, storageTxClient, filetreeTxClient, filetreeQueryClient } from 'jackal.js-protos'
import FileHandler from '@/classes/fileHandler'
import { finalizeGas } from '@/utils/gas'
import { hashAndHex } from '@/utils/hash'
import { defaultQueryAddr1317, defaultTxAddr26657 } from '@/utils/globals'
import IFileHandler from '@/interfaces/classes/IFileHandler'
import IWalletHandler from '@/interfaces/classes/IWalletHandler'
import IEditorsViewers from '@/interfaces/IEditorsViewers'
import IFileConfigRaw from '@/interfaces/IFileConfigRaw'
import IFileIo from '@/interfaces/classes/IFileIo'
import IFolderDownload from '@/interfaces/IFolderDownload'
import IProviderResponse from '@/interfaces/IProviderResponse'
import IMiner from '@/interfaces/IMiner'

export default class FileIo implements IFileIo {
  walletRef: OfflineSigner
  txAddr26657: string
  queryAddr1317: string
  fileTxClient: any
  storageTxClient: any
  availableProviders: IMiner[]
  currentProvider: IMiner

  private constructor (wallet: OfflineSigner, tAddr: string, qAddr: string, fTxClient: any, sTxClient: any, providers: IMiner[]) {
    this.walletRef = wallet
    this.txAddr26657 = tAddr
    this.queryAddr1317 = qAddr
    this.fileTxClient = fTxClient
    this.storageTxClient = sTxClient
    this.availableProviders = providers
    this.currentProvider = providers[Math.floor(Math.random() * providers.length)]
  }

  static async trackIo (wallet: OfflineSigner, txAddr?: string, queryAddr?: string): Promise<FileIo> {
    const tAddr = txAddr || defaultTxAddr26657
    const qAddr = queryAddr || defaultQueryAddr1317
    const ftxClient = await filetreeTxClient(wallet, { addr: tAddr })
    const stxClient = await storageTxClient(wallet, { addr: tAddr })
    const providers = await this.getProvider(await storageQueryClient({ addr: qAddr }))
    return new FileIo(wallet, tAddr, qAddr, ftxClient, stxClient, providers)
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

  async uploadFiles (toUpload: IFileHandler[], wallet: IWalletHandler) {
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
      const ids: IFileHandler[] = await Promise.all(toUpload.map(async (item: IFileHandler) => {
        const fileFormData = new FormData()
        fileFormData.set('file', await item.getForUpload())
        const ret: IProviderResponse = await fetch(url, {method: 'POST', body: fileFormData})
          .then(resp => resp.json())
        item.setIds(ret)
        return item
      }))
      await this.afterUpload(ids, wallet)
    }
  }
  async downloadFile (fileAddress: string, wallet: IWalletHandler, isFolder?: boolean): Promise<IFileHandler | IFolderDownload> {
    /**
     * update to build fileAddress
     *
     * fid to /d/
     * process
     */

    const { queryFiles } = await filetreeQueryClient({ addr: this.queryAddr1317 })
    const { queryFindFile } = await storageQueryClient({ addr: this.queryAddr1317 })
    const ftQueryResults = await queryFiles(await hashAndHex(fileAddress))
    const fileData = ftQueryResults.data.files || {address: '', contents: '', owner: '', editAccess: '', viewingAccess: ''}
    const sQueryResults = await queryFindFile(fileData.contents as string)

    const providers = sQueryResults.data.minerIps || '[]'
    const targetProvider = JSON.parse(providers)
    if (targetProvider && targetProvider.length) {
      const url = `${targetProvider.endsWith('/') ? targetProvider.slice(0, -1) : targetProvider}/d/${fileData.contents as string}`
      return await fetch(url)
        .then(resp => resp.arrayBuffer())
        .then(async (resp): Promise<IFileHandler | IFolderDownload> => {
          const config: IFileConfigRaw = {
            creator: fileData.owner as string,
            hashpath: fileData.address as string,
            contents: fileData.contents as string,
            viewers: JSON.parse(fileData.viewingAccess as string) as IEditorsViewers,
            editors: JSON.parse(fileData.editAccess as string) as IEditorsViewers
          }
          const { key, iv } = config.editors[config.creator]
          if (isFolder) {
            return {data: resp, config, key: wallet.asymmetricDecrypt(key), iv: wallet.asymmetricDecrypt(iv)}
          } else {
            return await FileHandler.trackFile(resp, config, fileAddress, wallet.asymmetricDecrypt(key), wallet.asymmetricDecrypt(iv))
          }
        })
    } else {
      throw new Error('No available providers!')
    }
  }
  private async afterUpload (ids: IFileHandler[], wallet: IWalletHandler) {
    const { signAndBroadcast, msgPostFile } = await this.fileTxClient()
    const { msgSignContract } = await this.storageTxClient()

    const creator = await hashAndHex(wallet.getJackalAddress())
    const ready = await Promise.all(ids.flatMap(async (obj: IFileHandler) => {
      const crypt = await obj.getEnc()
      const partial = {
        iv: wallet.asymmetricEncrypt(crypt.iv, wallet.getPubkey()),
        key: wallet.asymmetricEncrypt(crypt.key, wallet.getPubkey())
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
