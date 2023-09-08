import { OfflineAminoSigner, Secp256k1HdWallet } from '@cosmjs/amino'
import {
  DirectSecp256k1HdWallet,
  OfflineDirectSigner
} from '@cosmjs/proto-signing'
import { IBaseWallet } from '@/interfaces/classes'
import BaseWallet from '@/classes/basicWallet'

export default class MnemonicWallet extends BaseWallet implements IBaseWallet {
  /**
   * Receives properties from create() to instantiate MnemonicWallet for use in creating WalletHandler instance.
   * @param {OfflineDirectSigner} directWallet
   * @param {OfflineAminoSigner} aminoWallet
   * @protected
   */
  protected constructor(
    directWallet: OfflineDirectSigner,
    aminoWallet: OfflineAminoSigner
  ) {
    super(directWallet, aminoWallet)
  }

  /**
   * Async wrapper to create a MnemonicWallet instance.
   * @param {string} mnemonic - Seed phrase to use to generate the wallet sessions.
   * @returns {Promise<MnemonicWallet>} - Instance of CustomWallet.
   */
  static async create(mnemonic: string) {
    let directWallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix: 'jkl'
    })
    let aminoWallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix: 'jkl'
    })
    /* Destroy mnemonic */
    mnemonic = ''

    return new MnemonicWallet(directWallet, aminoWallet)
  }
}
