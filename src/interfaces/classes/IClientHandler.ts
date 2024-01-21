import type {
  DDeliverTxResponse,
  IJackalSigningStargateClient,
  ITxLibrary,
  TQueryExtensions,
} from '@jackallabs/jackal.js-protos'
import type {
  IOracleHandler,
  IRnsHandler,
  IStorageHandler,
  IWrappedEncodeObject,
} from '@/interfaces'

export interface IClientHandler {
  createStorageHandler(): Promise<IStorageHandler>
  createRnsHandler(): Promise<IRnsHandler>
  createOracleHandler(): Promise<IOracleHandler>

  getChainId(): string
  getIsLedger(): boolean
  getSelectedWallet(): string
  getProofWindow(): number
  getLatestBlockHeight(): Promise<number>
  getSigningClient(): IJackalSigningStargateClient | null
  getQueries(): TQueryExtensions
  getTxs(): ITxLibrary

  getJackalAddress(): string
  findPubKey(address: string): Promise<string>
  broadcastsMsgs(
    wrappedMsgs: IWrappedEncodeObject | IWrappedEncodeObject[],
  ): Promise<DDeliverTxResponse>
}
