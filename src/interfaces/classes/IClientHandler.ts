import type {
  DDeliverTxResponse,
  IJackalSigningStargateClient,
  ITxLibrary,
  TQueryExtensions,
} from '@jackallabs/jackal.js-protos'
import type { IStorageHandler, IWrappedEncodeObject } from '@/interfaces'

export interface IClientHandler {
  createStorageHandler(): Promise<IStorageHandler>
  getProofWindow(): number
  getLatestBlockHeight(): Promise<number>
  getSigningClient(): IJackalSigningStargateClient
  getQueries(): TQueryExtensions
  getTxs(): ITxLibrary

  getJackalAddress(): string
  getPubKey(): string
  getPrivateKey(): string
  findPubKey(address: string): Promise<string>
  broadcastsMsgs(
    wrappedMsgs: IWrappedEncodeObject[],
  ): Promise<DDeliverTxResponse>
}
