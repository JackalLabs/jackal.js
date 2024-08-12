import {
  DCoin,
  ITxLibrary, THostSigningClient,
  TJackalSigningClient,
  TQueryExtensions,
} from '@jackallabs/jackal.js-protos'
import {
  IBroadcastOptions,
  IBroadcastResults,
  IOracleHandler,
  IRnsHandler,
  IStorageHandler, IWalletDetails,
  IWrappedEncodeObject,
} from '@/interfaces'

export interface IClientHandler {
  createStorageHandler(): Promise<IStorageHandler>

  createWasmStorageHandler(): Promise<IStorageHandler>

  createRnsHandler(): Promise<IRnsHandler>

  createOracleHandler(): Promise<IOracleHandler>

  getChainId(): string

  getHostChainId(): string

  getIsLedger(): boolean

  getWalletDetails(): IWalletDetails

  getSelectedWallet(): string

  getProofWindow(): number

  getJackalBlockHeight(): Promise<number>

  getJackalSigner(): TJackalSigningClient | null

  getHostSigner(): THostSigningClient | null

  getQueries(): TQueryExtensions

  getTxs(): ITxLibrary

  getJklBalance(): Promise<DCoin>

  getJackalAddress(): string

  getHostAddress(): string

  getICAJackalAddress(): string

  findPubKey(address: string): Promise<string>

  myPubKeyIsPublished(): Promise<boolean>

  broadcastAndMonitorMsgs(
    wrappedMsgs: IWrappedEncodeObject | IWrappedEncodeObject[],
    options?: IBroadcastOptions,
  ): Promise<IBroadcastResults>
}
