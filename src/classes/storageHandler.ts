import { IProtoHandler, IStorageHandler, IWalletHandler } from '@/interfaces/classes'
import { DeliverTxResponse } from '@cosmjs/stargate'
import { EncodeObject } from '@cosmjs/proto-signing'
import { IPayData, IStoragePaymentInfo } from '@/interfaces'

export default class StorageHandler implements IStorageHandler {
  private readonly walletRef: IWalletHandler
  private readonly pH: IProtoHandler

  private constructor (wallet: IWalletHandler) {
    this.walletRef = wallet
    this.pH = wallet.getProtoHandler()
  }

  static async trackStorage (wallet: IWalletHandler): Promise<IStorageHandler> {
    return new StorageHandler(wallet)
  }

  async buyStorage (forAddress: string, duration: string, bytes: string): Promise<DeliverTxResponse> {
    const msg: EncodeObject = this.pH.storageTx.msgBuyStorage({
      creator: this.walletRef.getJackalAddress(),
      forAddress,
      duration,
      bytes,
      paymentDenom: 'ujkl'
    })
    return await this.pH.broadcaster([msg])
  }
  createStorageInitMsg (): EncodeObject {
    return this.pH.fileTreeTx.msgPostkey({
      creator: this.walletRef.getJackalAddress(),
      key: this.walletRef.getPubkey()
    })
  }

  async getClientFreeSpace (address: string): Promise<number> {
    return (await this.pH.storageQuery.queryGetClientFreeSpace({ address })).bytesfree
  }
  async getPayData (address: string): Promise<IPayData> {
    return await this.pH.storageQuery.queryGetPayData({ address })
  }
  /** TODO - Complete placeholder */
  async getStoragePaymentInfo (address: string): Promise<IStoragePaymentInfo> {
    const result = (await this.pH.storageQuery.queryStoragePaymentInfo({ address })).storagePaymentInfo

    return (result) ? result : { spaceAvailable: 0, spaceUsed: 0, address: '' }
  }
}
