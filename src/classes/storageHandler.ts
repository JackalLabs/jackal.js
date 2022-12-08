import { IProtoHandler, IStorageHandler, IWalletHandler } from '@/interfaces/classes'
import { DeliverTxResponse } from '@cosmjs/stargate'
import { EncodeObject } from '@cosmjs/proto-signing'
import { finalizeGas } from '@/utils/gas'
import { IPayBlock, IPayData, IStorageClientUsage } from '@/interfaces'

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
    const { msgBuyStorage } = this.pH.storageTx

    const msg: EncodeObject = msgBuyStorage({
      creator: this.walletRef.getJackalAddress(),
      forAddress,
      duration,
      bytes,
      paymentDenom: 'ujkl'
    })
    return await this.pH.broadcaster([msg])
  }

  async getClientFreeSpace (address: string): Promise<string> {
    const result = await this.pH.storageQuery.queryGetClientFreeSpace({ address })
    return (result) ? result.bytesfree as string : ''
  }
  async getPayData (address: string): Promise<IPayData> {
    const result = await this.pH.storageQuery.queryGetPayData({ address })
    return (result) ? result as IPayData : { blocksRemaining: 0, bytes: 0 }
  }
  /** TODO - Complete placeholder */
  async getStoragePaymentInfo (): Promise<true> {
    return true
  }
}
