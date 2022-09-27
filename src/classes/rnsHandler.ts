import { OfflineSigner } from '@cosmjs/proto-signing'
import { rnsTxClient, rnsQueryApi, rnsQueryClient } from 'jackal.js-protos'
import { defaultQueryAddr1317, defaultTxAddr26657 } from '../utils/globals'
import { IRnsHandler } from '../interfaces/classes'

export default class RnsHandler implements IRnsHandler {
  private walletRef: OfflineSigner
  txAddr26657: string
  queryAddr1317: string
  rnsTxClient: any
  rnsQueryClient: any

  private constructor (signer: OfflineSigner, tAddr: string, qAddr: string, txClient: any, queryClient: any) {
    this.walletRef = signer
    this.txAddr26657 = tAddr
    this.queryAddr1317 = qAddr
    this.rnsTxClient = txClient
    this.rnsQueryClient = queryClient
  }

  static async trackRns (signer: OfflineSigner, txAddr?: string, queryAddr?: string): Promise<IRnsHandler> {
    const tAddr = txAddr || defaultTxAddr26657
    const qAddr = queryAddr || defaultQueryAddr1317
    const txClient = await rnsTxClient(signer, { addr: tAddr })
    const queryClient = await rnsQueryClient({ addr: qAddr })
    return new RnsHandler(signer, tAddr, qAddr, txClient, queryClient)
  }
  static async checkIfExists (rnsName: string, queryAddr?: string) {
    const qAddr = queryAddr || defaultQueryAddr1317
    const queryClient = await rnsQueryClient({ addr: qAddr })
    const result = await queryClient.queryNames(rnsName)
    return !!result.data.names
  }

}

async function checkIfExists (rnsName: string, queryAddr?: string) {
  const qAddr = queryAddr || defaultQueryAddr1317
  const queryClient = await rnsQueryClient({ addr: qAddr })
  const result = await queryClient.queryNames(rnsName)
  return !!result.data.names
}
