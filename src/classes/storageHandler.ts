import { IProtoHandler, IStorageHandler, IWalletHandler } from '@/interfaces/classes'
import { EncodeObject } from '@cosmjs/proto-signing'
import { IPayData, IStoragePaymentInfo } from '@/interfaces'
import { numToWholeTB } from '@/utils/misc'
import { DeliverTxResponse } from '@cosmjs/stargate'

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

  async buyStorage (forAddress: string, duration: number, space: number): Promise<DeliverTxResponse> {
    const msg: EncodeObject = this.pH.storageTx.msgBuyStorage({
      creator: this.walletRef.getJackalAddress(),
      forAddress,
      duration: `${(duration * 720) || 720}h`,
      bytes: numToWholeTB(space),
      paymentDenom: 'ujkl'
    })
    // await this.pH.debugBroadcaster([msg], true)
    return await this.pH.debugBroadcaster([msg], {}) as DeliverTxResponse
  }
  async upgradeStorage (forAddress: string, duration: number, space: number): Promise<DeliverTxResponse> {
    const msg: EncodeObject = this.pH.storageTx.msgUpgradeStorage({
      creator: this.walletRef.getJackalAddress(),
      forAddress,
      duration: `${(duration * 720) || 720}h`,
      bytes: numToWholeTB(space),
      paymentDenom: 'ujkl'
    })
    // await this.pH.debugBroadcaster([msg], true)
    return await this.pH.debugBroadcaster([msg], {}) as DeliverTxResponse
  }
  makeStorageInitMsg (): EncodeObject {
    return this.pH.fileTreeTx.msgPostkey({
      creator: this.walletRef.getJackalAddress(),
      key: this.walletRef.getPubkey()
    })
  }

  async getClientFreeSpace (address: string): Promise<number> {
    return (await this.pH.storageQuery.queryGetClientFreeSpace({ address })).value.bytesfree
  }
  async getStorageJklPrice (space: number, duration: number): Promise<number> {
    const request = {
      bytes: Number(numToWholeTB(space)),
      duration: `${(duration * 720) || 720}h`,
    }
    return (await this.pH.storageQuery.queryPriceCheck(request)).value.price
  }
  async getPayData (address: string): Promise<IPayData> {
    return (await this.pH.storageQuery.queryGetPayData({ address })).value
  }
  async getStoragePaymentInfo (address: string): Promise<IStoragePaymentInfo> {
    const result = (await this.pH.storageQuery.queryStoragePaymentInfo({ address })).value.storagePaymentInfo
    return (result) ? result : { spaceAvailable: 0, spaceUsed: 0, address: '' }
  }
}
