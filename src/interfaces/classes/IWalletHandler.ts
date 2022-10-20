import { AccountData, OfflineSigner } from '@cosmjs/proto-signing'
import { ICoin } from '../'

export default interface IWalletHandler {
  txAddr26657: string
  queryAddr1317: string
  jackalAccount: AccountData

  initAccount (): Promise<void>
  checkIfInit (): boolean

  getAccounts (): Promise<readonly AccountData[]>
  getSigner (): OfflineSigner
  getJackalAddress (): string
  getHexJackalAddress (): Promise<string>
  getAllBalances (): Promise<ICoin[]>
  getJackalBalance (): Promise<ICoin>
  getJewelBalance (): Promise<ICoin>
  getPubkey (): string
  asymmetricEncrypt (toEncrypt: ArrayBuffer, pubKey: string): string
  asymmetricDecrypt (toDecrypt: string): ArrayBuffer

}
