import { OfflineDirectSigner } from '@cosmjs/proto-signing'
import { OfflineAminoSigner, StdSignature } from '@cosmjs/amino'

export interface IMnemonicWallet {
  getOfflineSigner(): OfflineAminoSigner & OfflineDirectSigner
  getAddress(): string
  signArbitrary(address: string, message: string): Promise<StdSignature>
}
