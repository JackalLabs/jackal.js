import type { StdSignature } from '@cosmjs/amino'
import type { TMergedSigner } from '@jackallabs/jackal.js-protos'

export interface IMnemonicWallet {
  getOfflineSigner(): TMergedSigner

  getAddress(): string

  signArbitrary(address: string, message: string): Promise<StdSignature>
}
