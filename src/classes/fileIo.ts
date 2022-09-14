import { storageQueryClient, storageTxClient, filetreeTxClient } from '@/raw'
import { OfflineSigner } from '@cosmjs/proto-signing'
import { Api } from '@/protos/storage/rest'
import { Miners } from '@/protos/storage/types/storage/miners'
import { FormData } from 'formdata-node'

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

  async uploadFile (toUpload: File) {
    /**
     * http to provider
     * receive fid/cid
     * use cid to msgSignContract and also msgPostFile
     */

    const { ip } = this.currentProvider
    const url = `${ip.endsWith('/') ? ip.slice(0, -1) : ip}/u`
    const myFormData = new FormData()
    myFormData.set('file', toUpload)
    const data = await fetch(url, {method: 'POST'})
      .then(resp => resp.json())

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
  private async afterUpload () {

    const { msgPostFile } = await this.fileTxClient()
    const { signAndBroadcast, msgSignContract } = await this.storageTxClient()

    const msgPost = await msgPostFile({
      creator: '',  // hash owner
      hashpath: '', // hash SHA256 of file path
      contents: '', // file id hash
      viewers: '',  // stringified json of sha256:enc aes key
      editors: ''   // stringified json of sha256:enc aes key
    })

    const msgSign = await msgSignContract({
      creator: '',  // owner jkl address
      cid: ''       // cid from above
    })
  }

}

