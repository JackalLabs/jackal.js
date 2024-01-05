import { OfflineAminoSigner, Secp256k1HdWallet, StdSignature } from '@cosmjs/amino'
import { DirectSecp256k1HdWallet, OfflineDirectSigner } from '@cosmjs/proto-signing'
import { IMnemonicWallet } from '@/interfaces/classes'

export class MnemonicWallet implements IMnemonicWallet {
  private readonly mergedSigner: OfflineAminoSigner & OfflineDirectSigner
  private readonly address: string

  /**
   * Receives properties from init() to instantiate MnemonicWallet for use in creating a CustomWallet instance.
   * @param {OfflineAminoSigner & OfflineDirectSigner} mergedSigner
   * @param {string} address
   * @private
   */
  private constructor(
    mergedSigner: OfflineAminoSigner & OfflineDirectSigner,
    address: string
  ) {
    this.mergedSigner = mergedSigner
    this.address = address
  }

  /**
   * Async wrapper to create a MnemonicWallet instance.
   * @param {string} mnemonic - Seed phrase to use to generate the wallet session.
   * @returns {Promise<MnemonicWallet>} - Instance of MnemonicWallet.
   */
  static async init(mnemonic: string): Promise<MnemonicWallet> {
    let directWallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix: 'jkl'
    })
    let aminoWallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix: 'jkl'
    })

    /* Destroy mnemonic */
    mnemonic = ''

    const mergedSigner = {...aminoWallet, ...directWallet} as OfflineAminoSigner & OfflineDirectSigner
    const { address } = (await mergedSigner.getAccounts())[0]
    return new MnemonicWallet(mergedSigner, address)
  }

  /**
   * Expose Signer for use in ClientHandler.
   * @returns {OfflineAminoSigner & OfflineDirectSigner}
   */
  getOfflineSigner(): OfflineAminoSigner & OfflineDirectSigner {
    return this.mergedSigner
  }

  /**
   * Expose Signer's Jackal address.
   * @returns {string}
   */
  getAddress(): string {
    return this.address
  }

  /**
   * Generate signature used by ClientHandler to create session.
   * @param {string} message - Value to use as signature base.
   * @returns {Promise<StdSignature>} - Resulting AminoSignResponse.signature.
   */
  async signArbitrary(
    message: string
  ): Promise<StdSignature> {
    const signed = await this.mergedSigner.signAmino(this.address, {
      chain_id: '',
      account_number: '0',
      sequence: '0',
      fee: {
        gas: '0',
        amount: []
      },
      msgs: [
        {
          type: 'sign/MsgSignData',
          value: {
            signer: this.address,
            data: btoa(message)
          }
        }
      ],
      memo: ''
    })
    return signed.signature
  }
}
