import { ISecretsHandler, IWalletHandler } from '@/interfaces/classes'
import { ISharedTracker } from '@/interfaces'
import { EncodeObject } from '@cosmjs/proto-signing'
import { readCompressedFileTree, removeCompressedFileTree, saveCompressedFileTree } from '@/utils/compression'
import { signerNotEnabled } from '@/utils/misc'

export default class SecretsHandler implements ISecretsHandler {
  private readonly walletRef: IWalletHandler
  // private readonly qH: IQueryHandler

  private constructor(wallet: IWalletHandler) {
    this.walletRef = wallet
    // this.qH = wallet.getQueryHandler()
  }

  static async trackSecrets(
    wallet: IWalletHandler,
    // enable: IEnabledSecrets
  ): Promise<ISecretsHandler> {
    return new SecretsHandler(wallet)
  }

  /** TODO - finish all of this */
  async saveSharing(
    toAddress: string,
    shared: ISharedTracker
  ): Promise<EncodeObject> {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('SecretsHandler', 'saveSharing'))
    return await saveCompressedFileTree(
      toAddress,
      `s/Sharing`,
      toAddress,
      shared,
      this.walletRef
    )
  }
  async readSharing(owner: string, rawPath: string): Promise<ISharedTracker> {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('SecretsHandler', 'readSharing'))
    const shared = await readCompressedFileTree(
      owner,
      rawPath,
      this.walletRef
    ).catch((err) => {
      throw new Error(
        `Storage.Handler - readSharing() JSON Parse Failed: ${err.message}`
      )
    })
    return shared as ISharedTracker
  }
  async stopSharing(rawPath: string): Promise<EncodeObject> {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('SecretsHandler', 'stopSharing'))
    return await removeCompressedFileTree(rawPath, this.walletRef)
  }
}
