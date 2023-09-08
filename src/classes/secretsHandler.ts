import { ISecretsHandler, IWalletHandler } from '@/interfaces/classes'
import { ISharedTracker } from '@/interfaces'
import { EncodeObject } from '@cosmjs/proto-signing'
import {
  readFileTreeEntry,
  removeFileTreeEntry,
  saveFileTreeEntry
} from '@/utils/compression'

import { signerNotEnabled } from '@/utils/misc'

export default class SecretsHandler implements ISecretsHandler {
  private readonly walletRef: IWalletHandler
  // private readonly qH: IQueryHandler
  /**
   * Create a SecretsHandler instance.
   * @param {IWalletHandler} wallet - Instance of WalletHandler.
   * @private
   */
  private constructor(wallet: IWalletHandler) {
    this.walletRef = wallet
    // this.qH = wallet.getQueryHandler()
  }

  /**
   * Async wrapper to create a SecretsHandler instance.
   * @param {IWalletHandler} wallet - Instance of WalletHandler.
   * @returns {Promise<ISecretsHandler>} - Instance of SecretsHandler.
   */
  static async trackSecrets(
    wallet: IWalletHandler
    // enable: IEnabledSecrets
  ): Promise<ISecretsHandler> {
    return new SecretsHandler(wallet)
  }

  /**
   * Save a Sharing record to FileTree.
   * @param {string} toAddress - Bech23 address to share to.
   * @param {ISharedTracker} shared - Share details.
   * @returns {Promise<EncodeObject>}
   */
  async saveSharing(
    toAddress: string,
    shared: ISharedTracker
  ): Promise<EncodeObject> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('SecretsHandler', 'saveSharing'))
    return await saveFileTreeEntry(
      toAddress,
      `s/Sharing`,
      toAddress,
      shared,
      this.walletRef,
      true
    )
  }

  /**
   * Query Sharing record from FileTree.
   * @param {string} owner - Bech23 address sharing the record.
   * @param {string} rawPath - Full path to sharing record.
   * @returns {Promise<ISharedTracker>}
   */
  async readSharing(owner: string, rawPath: string): Promise<ISharedTracker> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('SecretsHandler', 'readSharing'))
    const shared = await readFileTreeEntry(
      owner,
      rawPath,
      this.walletRef,
      true
    ).catch((err) => {
      throw new Error(
        `Storage.Handler - readSharing() JSON Parse Failed: ${err.message}`
      )
    })
    return shared as ISharedTracker
  }

  /**
   * Remove Sharing record.
   * @param {string} rawPath - Full path to sharing record.
   * @returns {Promise<EncodeObject>}
   */
  async stopSharing(rawPath: string): Promise<EncodeObject> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('SecretsHandler', 'stopSharing'))
    return await removeFileTreeEntry(rawPath, this.walletRef)
  }
}
