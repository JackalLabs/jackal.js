import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing/build/directsecp256k1hdwallet'
import { AccountData, OfflineSigner } from '@cosmjs/proto-signing'
import { Decoded } from 'bech32'
import IChainDetails from '@/interfaces/IChainDetails'

export default interface IWalletHandler {
  jackalAccount: AccountData
  deconstructedAccount: Decoded

  getAccounts (): Promise<readonly AccountData[]>
  getSigner (): OfflineSigner
  getJackalAddress (): string
  getPubkey (): string
  asymmetricEncrypt (toEncrypt: ArrayBuffer, pubKey: string): string
  asymmetricDecrypt (toDecrypt: string): ArrayBuffer


}