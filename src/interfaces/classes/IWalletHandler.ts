import { AccountData, OfflineSigner } from '@cosmjs/proto-signing'
import { ICoin, IEnabledSecrets, IWalletConfig, IWalletHandlerPublicProperties } from '@/interfaces'
import {
  IAbciHandler,
  IFileIo,
  IGovHandler,
  INotificationHandler,
  IOracleHandler,
  IProtoHandler,
  IQueryHandler,
  IRnsHandler,
  ISecretsHandler,
  IStorageHandler
} from '@/interfaces/classes'

export default interface IWalletHandler {
  traits: IWalletHandlerPublicProperties | null
  convertToFullWallet (config: IWalletConfig): Promise<void>
  voidFullWallet (): void

  getRnsInitStatus(): boolean
  setRnsInitStatus(status: boolean): void
  getStorageInitStatus(): boolean
  setStorageInitStatus(status: boolean): void
  getProtoHandler(): IProtoHandler
  getQueryHandler(): IQueryHandler
  getAccounts(): Promise<readonly AccountData[]>
  getSigner(): OfflineSigner
  getJackalAddress(): string
  getHexJackalAddress(): Promise<string>
  getAllBalances(): Promise<ICoin[]>
  getJackalBalance(): Promise<ICoin>
  getPubkey(): string
  asymmetricEncrypt(toEncrypt: ArrayBuffer, pubKey: string): string
  asymmetricDecrypt(toDecrypt: string): ArrayBuffer
  findPubKey(address: string): Promise<string>

  /**
   * Handler Factories
   */
  makeAbciHandler (): Promise<IAbciHandler>
  makeFileIoHandler (versionFilter?: string | string[]): Promise<IFileIo>
  makeGovHandler (): Promise<IGovHandler>
  makeNotificationHandler (): Promise<INotificationHandler>
  makeOracleHandler (): Promise<IOracleHandler>
  makeRnsHandler (): Promise<IRnsHandler>
  makeSecretsHandler (enable: IEnabledSecrets): Promise<ISecretsHandler>
  makeStorageHandler (): Promise<IStorageHandler>
}
