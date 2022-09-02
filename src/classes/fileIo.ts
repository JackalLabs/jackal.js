import { storageTxClient } from '@/raw'
import { OfflineSigner } from '@cosmjs/proto-signing'

const defaultQueryAddr1317 = 'http://localhost:1317'
const defaultTxAddr26657 = 'http://localhost:26657'

export default class FileIo {
  queryAddr1317: string

  private constructor (addr: string) {
    this.queryAddr1317 = addr
  }

  static async trackIo (txAddr: string, queryAddr: string, wallet: OfflineSigner): Promise<FileIo> {
    const addr = queryAddr || defaultQueryAddr1317
    const { msgBuyStorage } = await storageTxClient(wallet, { addr: txAddr })
    return new FileIo(addr)
  }


}

