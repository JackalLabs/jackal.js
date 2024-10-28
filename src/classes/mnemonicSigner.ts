import { AccountData, DirectSignResponse, OfflineDirectSigner } from '@cosmjs/proto-signing'
import { AminoSignResponse, StdSignDoc, OfflineAminoSigner } from '@cosmjs/amino'
import { TMergedSigner } from '@jackallabs/jackal.js-protos'



interface SignDoc {
  bodyBytes: Uint8Array;
  authInfoBytes: Uint8Array;
  chainId: string;
  accountNumber: bigint;
}

export class MnemonicSigner implements TMergedSigner {
  private readonly directSigner: OfflineDirectSigner
  private readonly aminoSigner: OfflineAminoSigner

  constructor (directSigner: OfflineDirectSigner, aminoSigner: OfflineAminoSigner) {
    this.directSigner = directSigner
    this.aminoSigner = aminoSigner
  }

  signAmino (signerAddress: string, signDoc: StdSignDoc): Promise<AminoSignResponse> {
    return this.aminoSigner.signAmino(signerAddress, signDoc)
  }

  signDirect (signerAddress: string, signDoc: SignDoc): Promise<DirectSignResponse> {
    return this.directSigner.signDirect(signerAddress, signDoc)
  }

  getAccounts (): Promise<readonly AccountData[]> {
    return this.directSigner.getAccounts()
  }


}