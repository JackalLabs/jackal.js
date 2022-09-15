import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing/build/directsecp256k1hdwallet'
import { AccountData } from '@cosmjs/proto-signing'
import { Decoded } from 'bech32'
import IChainDetails from '@/interfaces/IChainDetails'

export default interface IWalletHandler {
  jackalAccount: AccountData
  deconstructedAccount: Decoded
  enabledChains: AccountData[]

  getAccounts (): Promise<readonly AccountData[]>
  getJackalAddress (): string
  getChains (): AccountData[]
  getPubkey (): Uint8Array
  asymmetricEncrypt (toEncrypt: ArrayBuffer, pubKey: string): string
  asymmetricDecrypt (toDecrypt: string): ArrayBuffer

  processStockChains (): AccountData[]
  addSupportedChain (chainDetails: IChainDetails): void
  mutate (prefix: string): Promise<DirectSecp256k1HdWallet>

}