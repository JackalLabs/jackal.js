import {
  OfflineAminoSigner,
  Secp256k1HdWallet,
  StdSignature
} from '@cosmjs/amino'
import {
  DirectSecp256k1HdWallet,
  OfflineDirectSigner
} from '@cosmjs/proto-signing'
import { stringToPath } from '@cosmjs/crypto'
import { IChainConfig } from '@/interfaces'
import { ICustomWallet } from '@/interfaces/classes'

export default class CustomWallet implements ICustomWallet {
  private directWallet: OfflineDirectSigner
  private aminoWallet: OfflineAminoSigner

  /**
   * Receives properties from create() to instantiate CustomWallet for us in creating WalletHandler instance.
   * @param {OfflineDirectSigner} directWallet
   * @param {OfflineAminoSigner} aminoWallet
   * @private
   */
  private constructor(
    directWallet: OfflineDirectSigner,
    aminoWallet: OfflineAminoSigner
  ) {
    this.directWallet = directWallet
    this.aminoWallet = aminoWallet
  }

  /**
   * Async wrapper to create a CustomWallet instance.
   * @param {string} mnemonic - Seed phrase to use to generate the wallet sessions.
   * @returns {Promise<CustomWallet>} - Instance of CustomWallet.
   */
  static async create(mnemonic: string) {
    let directWallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
      hdPaths: [stringToPath("m/44'/118'/0'/0/0")],
      prefix: 'jkl'
    })
    let aminoWallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, {
      hdPaths: [stringToPath("m/44'/118'/0'/0/0")],
      prefix: 'jkl'
    })
    /* Destroy mnemonic */
    mnemonic = ''

    return new CustomWallet(directWallet, aminoWallet)
  }

  /**
   * Placeholder for WalletHandler compatibility.
   * @param {string | string[]} _ - Not Used, typed for compatibility.
   * @returns {Promise<void>}
   */
  async enable(_: string | string[]): Promise<void> {
    /* Nothing to do */
  }

  /**
   * Placeholder for WalletHandler compatibility.
   * @param {string | string[]} _ - Not Used, typed for compatibility.
   * @returns {Promise<void>}
   */
  async experimentalSuggestChain(_: IChainConfig): Promise<void> {
    /* Nothing to do */
  }

  /**
   * Expose DirectSigner for use in WalletHandler.
   * @param {string} _ - Not Used, typed for compatibility.
   * @returns {Promise<OfflineDirectSigner>}
   */
  async getOfflineSignerAuto(_: string): Promise<OfflineDirectSigner> {
    return this.directWallet
  }

  /**
   * Generate signature used by WalletHandler to create session secret.
   * @param _ - Not Used, typed for compatibility.
   * @param {string} address - Jkl address to use for signature.
   * @param {string} message - Value to use as signature base.
   * @returns {Promise<StdSignature>} - Resulting AminoSignResponse.signature.
   */
  async signArbitrary(
    _: any,
    address: string,
    message: string
  ): Promise<StdSignature> {
    const signed = await this.aminoWallet.signAmino(address, {
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
            signer: address,
            data: btoa(message)
          }
        }
      ],
      memo: ''
    })
    return signed.signature
  }
}
