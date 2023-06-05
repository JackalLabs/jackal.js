import { IQueryHandler, IStorageHandler, IWalletHandler } from '@/interfaces/classes'
import { EncodeObject } from '@cosmjs/proto-signing'
import { IPayData, ISharedTracker, IStoragePaymentInfo, IStray } from '@/interfaces'
import { handlePagination, numTo3xTB, signerNotEnabled } from '@/utils/misc'
import { DeliverTxResponse } from '@cosmjs/stargate'
import { readFileTreeEntry, removeFileTreeEntry, saveFileTreeEntry } from '@/utils/compression'

export default class StorageHandler implements IStorageHandler {
  private readonly walletRef: IWalletHandler
  private readonly qH: IQueryHandler

  private constructor(wallet: IWalletHandler) {
    this.walletRef = wallet
    this.qH = wallet.getQueryHandler()
  }

  static async trackStorage(wallet: IWalletHandler): Promise<IStorageHandler> {
    return new StorageHandler(wallet)
  }

  async buyStorage(
    forAddress: string,
    duration: number,
    space: number
  ): Promise<DeliverTxResponse> {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('StorageHandler', 'buyStorage'))
    const pH = this.walletRef.getProtoHandler()
    const msg: EncodeObject = pH.storageTx.msgBuyStorage({
      creator: this.walletRef.getJackalAddress(),
      forAddress,
      duration: `${duration * 720 || 720}h`,
      bytes: numTo3xTB(space),
      paymentDenom: 'ujkl'
    })
    return (await pH.debugBroadcaster([msg], {}))
  }
  async upgradeStorage(
    forAddress: string,
    duration: number,
    space: number
  ): Promise<DeliverTxResponse> {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('StorageHandler', 'upgradeStorage'))
    const pH = this.walletRef.getProtoHandler()
    const msg: EncodeObject = pH.storageTx.msgUpgradeStorage({
      creator: this.walletRef.getJackalAddress(),
      forAddress,
      duration: `${duration * 720 || 720}h`,
      bytes: numTo3xTB(space),
      paymentDenom: 'ujkl'
    })
    return (await pH.debugBroadcaster([msg], {}))
  }
  makeStorageInitMsg(): EncodeObject {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('StorageHandler', 'makeStorageInitMsg'))
    const pH = this.walletRef.getProtoHandler()
    return pH.fileTreeTx.msgPostkey({
      creator: this.walletRef.getJackalAddress(),
      key: this.walletRef.getPubkey()
    })
  }

  async getAllStrays(): Promise<IStray[]> {
    return (
      await handlePagination(this.qH.storageQuery, 'queryStraysAll', {})
    ).reduce((acc: IStray[], curr: any) => {
      acc.push(...curr.strays)
      return acc
    }, [])
  }
  async getClientFreeSpace(address: string): Promise<number> {
    return (await this.qH.storageQuery.queryGetClientFreeSpace({ address }))
      .value.bytesfree
  }
  async getStorageJklPrice(space: number, duration: number): Promise<number> {
    const request = {
      bytes: Number(numTo3xTB(space)),
      duration: `${duration * 720 || 720}h`
    }
    return (await this.qH.storageQuery.queryPriceCheck(request)).value.price
  }
  async getPayData(address: string): Promise<IPayData> {
    return (await this.qH.storageQuery.queryGetPayData({ address })).value
  }
  async getStoragePaymentInfo(address: string): Promise<IStoragePaymentInfo> {
    const result = (
      await this.qH.storageQuery.queryStoragePaymentInfo({ address })
    ).value.storagePaymentInfo
    return result ? result : { spaceAvailable: 0, spaceUsed: 0, address: '' }
  }

  /** Manage FT Noti */
  async saveSharing(
    toAddress: string,
    shared: ISharedTracker
  ): Promise<EncodeObject> {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('StorageHandler', 'saveSharing'))
    return await saveFileTreeEntry(
      toAddress,
      `s/Sharing`,
      toAddress,
      shared,
      this.walletRef
    )
  }
  async readSharing(owner: string, rawPath: string): Promise<ISharedTracker> {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('StorageHandler', 'readSharing'))
    const shared = await readFileTreeEntry(
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
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('StorageHandler', 'stopSharing'))
    return await removeFileTreeEntry(rawPath, this.walletRef)
  }
}
