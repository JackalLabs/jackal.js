import { IProtoHandler, IStorageHandler, IWalletHandler } from '@/interfaces/classes'
import { EncodeObject } from '@cosmjs/proto-signing'
import { IPayData, IRnsOwnedHashMap, IRnsOwnedItem, ISharedTracker, IStoragePaymentInfo, IStray } from '@/interfaces'
import { handlePagination, numTo3xTB } from '@/utils/misc'
import { DeliverTxResponse } from '@cosmjs/stargate'
import { readCompressedFileTree, removeCompressedFileTree, saveCompressedFileTree } from '@/utils/compression'

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
      bytes: numTo3xTB(space),
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
      bytes: numTo3xTB(space),
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

  async getAllStrays (): Promise<IStray[]> {
    return (await handlePagination(
      this.pH.storageQuery,
      'queryStraysAll',
      {}
    ))
      .reduce((acc: IStray[], curr: any) => {
        acc.push(...curr.strays)
        return acc
      }, [])
  }
  async getClientFreeSpace (address: string): Promise<number> {
    return (await this.pH.storageQuery.queryGetClientFreeSpace({ address })).value.bytesfree
  }
  async getStorageJklPrice (space: number, duration: number): Promise<number> {
    const request = {
      bytes: Number(numTo3xTB(space)),
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

  /** Manage FT Noti */
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
