import { TMergedSigner } from '@jackallabs/jackal.js-protos'
import { AccountData } from '@cosmjs/proto-signing'

export interface IMnemonicSigner extends TMergedSigner {
  getAccounts (): Promise<readonly AccountData[]>
}