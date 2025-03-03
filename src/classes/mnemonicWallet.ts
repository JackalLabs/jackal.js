import type { StdSignature } from '@cosmjs/amino'
import { Secp256k1HdWallet } from '@cosmjs/amino'
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import type { IMnemonicWallet } from '@/interfaces/classes'
import { TMergedSigner } from '@jackallabs/jackal.js-protos'
import { MnemonicSigner } from '@/classes/mnemonicSigner'

export class MnemonicWallet implements IMnemonicWallet {
  private readonly mergedSigner: TMergedSigner
  private readonly address: string

  /**
   * Receives properties from init() to instantiate MnemonicWallet for use in creating a CustomWallet instance.
   * @param {TMergedSigner} mergedSigner
   * @param {string} address
   * @private
   */
  private constructor (mergedSigner: TMergedSigner, address: string) {
    this.mergedSigner = mergedSigner
    this.address = address
  }

  /**
   * Async wrapper to create a MnemonicWallet instance.
   * @param {string} mnemonic - Seed phrase to use to generate the wallet session.
   * @returns {Promise<MnemonicWallet>} - Instance of MnemonicWallet.
   */
  static async init (mnemonic: string): Promise<MnemonicWallet> {
    let directWallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix: 'jkl',
    })
    let aminoWallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix: 'jkl',
    })

    /* Destroy mnemonic */
    mnemonic = ''

    const mergedSigner = new MnemonicSigner(directWallet, aminoWallet)
    const { address } = (await mergedSigner.getAccounts())[0]
    return new MnemonicWallet(mergedSigner, address)
  }

  /**
   * Expose Signer for use in ClientHandler.
   * @returns {TMergedSigner}
   */
  getOfflineSigner (): TMergedSigner {
    return this.mergedSigner
  }

  /**
   * Expose Signer's Jackal address.
   * @returns {string}
   */
  getAddress (): string {
    return this.address
  }

  /**
   * Generate signature used by ClientHandler to create session.
   * @param {string} message - Value to use as signature base.
   * @returns {Promise<StdSignature>} - Resulting AminoSignResponse.signature.
   */
  async signArbitrary (message: string): Promise<StdSignature> {
    let data
    if (typeof window !== 'undefined') {
      data = btoa(message)
    } else {
      data = Buffer.from(message).toString('base64')
    }
    const signed = await this.mergedSigner.signAmino(this.address, {
      chain_id: '',
      account_number: '0',
      sequence: '0',
      fee: {
        gas: '0',
        amount: [],
      },
      msgs: [
        {
          type: 'sign/MsgSignData',
          value: {
            signer: this.address,
            data,
          },
        },
      ],
      memo: '',
    })
    return signed.signature
  }
}