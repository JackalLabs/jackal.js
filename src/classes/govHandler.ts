import { OfflineSigner } from '@cosmjs/proto-signing'
import { govTxClient, govQueryClient } from 'jackal.js-protos'
import { defaultQueryAddr1317, defaultTxAddr26657 } from '../utils/globals'
import { IGovHandler } from '../interfaces/classes'

export default class GovHandler implements IGovHandler {
  private walletRef: OfflineSigner
  txAddr26657: string
  queryAddr1317: string
  govTxClient: any
  govQueryClient: any

  private constructor (wallet: OfflineSigner, tAddr: string, qAddr: string, txClient: any, queryClient: any) {
    this.walletRef = wallet
    this.txAddr26657 = tAddr
    this.queryAddr1317 = qAddr
    this.govTxClient = txClient
    this.govQueryClient = queryClient
  }

  static async trackGov (wallet: OfflineSigner, txAddr?: string, queryAddr?: string): Promise<IGovHandler> {
    const tAddr = txAddr || defaultTxAddr26657
    const qAddr = queryAddr || defaultQueryAddr1317
    const txClient = await govTxClient(wallet, { addr: tAddr })
    const queryClient = await govQueryClient({ addr: qAddr })
    return new GovHandler(wallet, tAddr, qAddr, txClient, queryClient)
  }

}
