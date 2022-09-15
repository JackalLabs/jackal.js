import { storageQueryClient, storageTxClient, filetreeTxClient } from '@/raw'
import { EncodeObject, OfflineSigner } from '@cosmjs/proto-signing'
import { Api } from '@/protos/storage/rest'
import { Miners } from '@/protos/storage/types/storage/miners'
import { File, FormData } from 'formdata-node'
import { estimateGas, finalizeGas } from '@/utils/gas'
import IProviderResponse from '@/interfaces/IProviderResponse'
import FileHandler from '@/classes/fileHandler'
import IFileHandler from '@/interfaces/classes/IFileHandler'
import IWalletHandler from '@/interfaces/classes/IWalletHandler'

const defaultTxAddr26657 = 'http://localhost:26657'
const defaultQueryAddr1317 = 'http://localhost:1317'

export default class FileIo {
  walletRef: OfflineSigner
  txAddr26657: string
  queryAddr1317: string
  fileTxClient: any
  storageTxClient: any
  storageQueryClient: Api<any>
  availableProviders: Miners[]
  currentProvider: Miners

  private constructor (wallet: OfflineSigner, tAddr: string, qAddr: string, fTxClient: any, sTxClient: any, queryClient: Api<any>, providers: Miners[]) {
    this.walletRef = wallet
    this.txAddr26657 = tAddr
    this.queryAddr1317 = qAddr
    this.fileTxClient = fTxClient
    this.storageTxClient = sTxClient
    this.storageQueryClient = queryClient
    this.availableProviders = providers
    this.currentProvider = providers[Math.floor(Math.random() * providers.length)]
  }

  static async trackIo (wallet: OfflineSigner, txAddr?: string, queryAddr?: string): Promise<FileIo> {
    const tAddr = txAddr || defaultTxAddr26657
    const qAddr = queryAddr || defaultQueryAddr1317
    const ftxClient = await filetreeTxClient(wallet, { addr: tAddr })
    const stxClient = await storageTxClient(wallet, { addr: tAddr })
    const queryClient: Api<any> = await storageQueryClient({ addr: qAddr })
    const providers = await this.getProvider(queryClient)
    return new FileIo(wallet, tAddr, qAddr, ftxClient, stxClient, queryClient, providers)
  }

  static async getProvider (queryClient: Api<any>): Promise<Miners[]> {
    const rawProviderReturn = await queryClient.queryMinersAll()
    const rawProviderList = rawProviderReturn.data.miners as Miners[] || []
    return rawProviderList.slice(0, 100)
  }
  async shuffle (): Promise<void> {
    this.availableProviders = await FileIo.getProvider(this.storageQueryClient)
    this.currentProvider = this.availableProviders[Math.floor(Math.random() * this.availableProviders.length)]
  }
  forceProvider (toSet: Miners): void {
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
        fileFormData.set('file', await item.getUpload())
        const ret = await fetch(url, {method: 'POST', body: fileFormData})
          .then(resp => resp.json())
        item.setIds(ret)
        return item
      }))
      await this.afterUpload(ids, wallet)
    }

  }
  async downloadFile (fid: string) {
    /**
     * fid to /d/
     * process
     */
    const queryResults = await this.storageQueryClient.queryFindFile(fid)
    const providers = queryResults.data.minerIps || '[]'
    const targetProvider = JSON.parse(providers)
    if (targetProvider && targetProvider.length) {
      const url = `${targetProvider.endsWith('/') ? targetProvider.slice(0, -1) : targetProvider}/d/${fid}`
      return await fetch(url)
        .then(resp => resp.arrayBuffer())
    } else {
      throw new Error('No available providers!')
    }
  }
  private async afterUpload (ids: IFileHandler[], wallet: IWalletHandler) {
    const { signAndBroadcast, msgPostFile } = await this.fileTxClient()
    const { msgSignContract } = await this.storageTxClient()

    const { digest } = crypto.subtle
    const algo = 'SHA-256'

    const creator = (new TextDecoder()).decode(await digest(algo, (new TextEncoder()).encode(wallet.getJackalAddress())))



    const ready = await Promise.all(ids.flatMap(async (obj: IFileHandler) => {
      const crypt = await obj.getEnc()
      const partial = {
        iv: wallet.asymmetricEncrypt(crypt.iv, (new TextDecoder()).decode(wallet.getPubkey())),
        key: wallet.asymmetricEncrypt(crypt.key, (new TextDecoder()).decode(wallet.getPubkey()))
      }
      const perms: any = {}
      perms[creator] = partial

      const msgPost: EncodeObject = await msgPostFile(JSON.stringify({
        creator,
        hashpath: (new TextDecoder()).decode(await digest(algo, (new TextEncoder()).encode(obj.path))),
        contents: (new TextDecoder()).decode(await digest(algo, (new TextEncoder()).encode(obj.fid))),
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

  }

}
