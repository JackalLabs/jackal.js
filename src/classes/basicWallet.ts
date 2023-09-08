import {
  OfflineAminoSigner,
  StdSignature
} from '@cosmjs/amino'
import {
  OfflineDirectSigner
} from '@cosmjs/proto-signing'
import { IChainConfig } from '@/interfaces'
import { IBaseWallet } from '@/interfaces/classes'

export default class BaseWallet implements IBaseWallet {
  protected readonly directWallet: OfflineDirectSigner
  protected readonly aminoWallet: OfflineAminoSigner

  /**
   * Receives properties from extended Wallet's create() to instantiate for use in creating WalletHandler instance.
   * @param {OfflineDirectSigner} directWallet
   * @param {OfflineAminoSigner} aminoWallet
   * @protected
   */
  protected constructor(
    directWallet: OfflineDirectSigner,
    aminoWallet: OfflineAminoSigner
  ) {
    this.directWallet = directWallet
    this.aminoWallet = aminoWallet
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
