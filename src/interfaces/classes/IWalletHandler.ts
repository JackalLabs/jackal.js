import { AccountData, OfflineSigner } from '@cosmjs/proto-signing'
import { ICoin } from '@/interfaces'
import { IProtoHandler } from '@/interfaces/classes'

export default interface IWalletHandler {


  getRnsInitStatus (): boolean
  setRnsInitStatus (status: boolean): void
  getStorageInitStatus (): boolean
  setStorageInitStatus (status: boolean): void
  getProtoHandler (): IProtoHandler
  getAccounts (): Promise<readonly AccountData[]>
  getSigner (): OfflineSigner
  getJackalAddress (): string
  getHexJackalAddress (): Promise<string>
  getAllBalances (): Promise<ICoin[]>
  getJackalBalance (): Promise<ICoin>
  getPubkey (): string
  asymmetricEncrypt (toEncrypt: ArrayBuffer, pubKey: string): string
  asymmetricDecrypt (toDecrypt: string): ArrayBuffer

}
