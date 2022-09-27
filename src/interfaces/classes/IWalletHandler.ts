import { AccountData, OfflineSigner } from '@cosmjs/proto-signing'
import { Decoded } from 'bech32'

export default interface IWalletHandler {
  txAddr26657: string
  queryAddr1317: string
  jackalAccount: AccountData
  deconstructedAccount: Decoded

  getAccounts (): Promise<readonly AccountData[]>
  getSigner (): OfflineSigner
  getJackalAddress (): string
  getAllBalances (): Promise<any>
  getJackalBalance (): Promise<any>
  getJewelBalance (): Promise<any>
  getPubkey (): string
  asymmetricEncrypt (toEncrypt: ArrayBuffer, pubKey: string): string
  asymmetricDecrypt (toDecrypt: string): ArrayBuffer

}
