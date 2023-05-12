import { IProtoHandler, ISecretsHandler, IWalletHandler } from '@/interfaces/classes'
import { IEnableSecrets, ISharedTracker } from '@/interfaces'
import { EncodeObject } from '@cosmjs/proto-signing'
import { readCompressedFileTree, removeCompressedFileTree, saveCompressedFileTree } from '@/utils/compression'

export default class SecretsHandler implements ISecretsHandler {
  private readonly walletRef: IWalletHandler
  private readonly pH: IProtoHandler

  private constructor (wallet: IWalletHandler) {
    this.walletRef = wallet
    this.pH = wallet.getProtoHandler()
  }

  static async trackSecrets (wallet: IWalletHandler, enable: IEnableSecrets): Promise<ISecretsHandler> {
    return new SecretsHandler(wallet)
  }

  /** TODO - finish all of this */
  async saveSharing (toAddress: string, shared: ISharedTracker): Promise<EncodeObject> {
    return await saveCompressedFileTree(toAddress, `s/Sharing`, toAddress, shared, this.walletRef)
  }
  async readSharing (owner: string, rawPath: string): Promise<ISharedTracker> {
    const shared = await readCompressedFileTree(owner, rawPath, this.walletRef)
      .catch(err => {
        throw new Error(`Storage.Handler - readSharing() JSON Parse Failed: ${err.message}`)
      })
    return shared as ISharedTracker
  }
  async stopSharing (rawPath: string): Promise<EncodeObject> {
    return await removeCompressedFileTree(rawPath, this.walletRef)
  }





}
