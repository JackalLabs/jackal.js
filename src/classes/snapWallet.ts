import {
  OfflineAminoSigner
} from '@cosmjs/amino'
import {
  OfflineDirectSigner
} from '@cosmjs/proto-signing'
import { connectSnap, CosmjsOfflineSigner, getSnap, suggestChain } from '@leapwallet/cosmos-snap-provider'
import { IBaseWallet } from '@/interfaces/classes'
import BaseWallet from '@/classes/basicWallet'
import { IChainConfig } from '@/interfaces'

export default class SnapWallet extends BaseWallet implements IBaseWallet {

  /**
   * Receives properties from create() to instantiate SnapWallet for use in creating WalletHandler instance.
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
   * Async wrapper to create a SnapWallet instance.
   * @param {string} chainId - Seed phrase to use to generate the wallet sessions.
   * @returns {Promise<SnapWallet>} - Instance of CustomWallet.
   */
  static async create(chainId: string) {
    const offlineSigner = new CosmjsOfflineSigner(chainId)

    const isSnap = await getSnap()
    const snapInstalled = !!isSnap
    if (!snapInstalled) {
      await connectSnap()
    }

    return new SnapWallet(offlineSigner as OfflineDirectSigner, offlineSigner as OfflineAminoSigner)
  }

  /**
   * Wrapper for Snap suggestChain().
   * @param {IChainConfig} cfg - Same config used by Leap and Keplr.
   * @returns {Promise<void>}
   */
  async experimentalSuggestChain(cfg: IChainConfig): Promise<void> {
    await suggestChain(cfg)
  }
}
