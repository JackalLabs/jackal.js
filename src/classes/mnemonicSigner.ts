import { AccountData, DirectSignResponse, OfflineDirectSigner } from '@cosmjs/proto-signing'
import { AminoSignResponse, OfflineAminoSigner, StdSignDoc } from '@cosmjs/amino'
import { IMnemonicSigner, ISignDoc } from '@/interfaces'

export class MnemonicSigner implements IMnemonicSigner {
  private readonly directSigner: OfflineDirectSigner
  private readonly aminoSigner: OfflineAminoSigner

  constructor (directSigner: OfflineDirectSigner, aminoSigner: OfflineAminoSigner) {
    this.directSigner = directSigner
    this.aminoSigner = aminoSigner
  }

  signAmino (signerAddress: string, signDoc: StdSignDoc): Promise<AminoSignResponse> {
    return this.aminoSigner.signAmino(signerAddress, signDoc)
  }

  signDirect (signerAddress: string, signDoc: ISignDoc): Promise<DirectSignResponse> {
    return this.directSigner.signDirect(signerAddress, signDoc)
  }

  getAccounts (): Promise<readonly AccountData[]> {
    return this.directSigner.getAccounts()
  }
}
