import {
  DCoin,
  ITxLibrary,
  THostSigningClient,
  TJackalSigningClient,
  TQueryExtensions,
} from '@jackallabs/jackal.js-protos'
import {
  IBroadcastOptions,
  IBroadcastResults,
  IOracleHandler,
  IRnsHandler,
  IStorageHandler,
  IWalletDetails,
  IWasmDetails,
  IWrappedEncodeObject,
} from '@/interfaces'
import { Coin, DeliverTxResponse } from '@cosmjs/stargate'

export interface IClientHandler {
  createStorageHandler (): Promise<IStorageHandler>

  createWasmStorageHandler (details?: IWasmDetails): Promise<IStorageHandler>

  createEVMStorageHandler (details?: IWasmDetails): Promise<IStorageHandler>

  createRnsHandler (): Promise<IRnsHandler>

  createOracleHandler (): Promise<IOracleHandler>

  getChainId (): string

  getHostChainId (): string

  getIsLedger (): boolean

  getWalletDetails (): IWalletDetails

  getSelectedWallet (): string

  getProofWindow (): number

  getJackalBlockHeight (): Promise<number>

  getJackalSigner (): TJackalSigningClient | null

  getHostSigner (): THostSigningClient | null

  getQueries (): TQueryExtensions

  getTxs (): ITxLibrary

  getJklBalance (): Promise<DCoin>

  getJackalNetworkBalance (address: string): Promise<DCoin>

  getHostNetworkBalance (address: string, denom: string): Promise<DCoin>

  ibcSend (address: string, amount: Coin, sourceChannel: string): Promise<DeliverTxResponse>

  getJackalAddress (): string

  getHostAddress (): string

  getICAJackalAddress (): string

  wasmIsConnected (): boolean

  findPubKey (address: string): Promise<string>

  myPubKeyIsPublished (): Promise<boolean>

  broadcastAndMonitorMsgs (
    wrappedMsgs: IWrappedEncodeObject | IWrappedEncodeObject[],
    options?: IBroadcastOptions,
  ): Promise<IBroadcastResults>
}
