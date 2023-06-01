import { INotificationHandler, IQueryHandler, IWalletHandler } from '@/interfaces/classes'
import { EncodeObject } from '@cosmjs/proto-signing'
import { handlePagination, signerNotEnabled } from '@/utils/misc'
import {
  NotiCounter,
  Notifications,
  QueryAllNotiCounterResponse,
  QueryAllNotificationsByAddressResponse,
  QueryAllNotificationsResponse,
  QueryGetNotiCounterResponse,
  QueryGetNotificationsResponse
} from 'jackal.js-protos'
import { IReadableNoti } from '@/interfaces'

export default class NotificationHandler implements INotificationHandler {
  private readonly walletRef: IWalletHandler
  private readonly qH: IQueryHandler

  private constructor(wallet: IWalletHandler) {
    this.walletRef = wallet
    this.qH = wallet.getQueryHandler()
  }

  static async trackNotification(
    wallet: IWalletHandler
  ): Promise<INotificationHandler> {
    return new NotificationHandler(wallet)
  }

  makeNotification(notification: string, address: string): EncodeObject {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('NotificationHandler', 'makeNotification'))
    const pH = this.walletRef.getProtoHandler()
    return pH.notificationsTx.msgCreateNotifications({
      creator: this.walletRef.getJackalAddress(),
      notification,
      address
    })
  }
  makeNotificationUpdate(
    count: number,
    notification: string,
    address: string
  ): EncodeObject {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('NotificationHandler', 'makeNotificationUpdate'))
    const pH = this.walletRef.getProtoHandler()
    return pH.notificationsTx.msgUpdateNotifications({
      creator: this.walletRef.getJackalAddress(),
      count,
      notification,
      address
    })
  }
  makeNotificationDeletion(): EncodeObject {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('NotificationHandler', 'makeNotificationDeletion'))
    const pH = this.walletRef.getProtoHandler()
    return pH.notificationsTx.msgDeleteNotifications({
      creator: this.walletRef.getJackalAddress()
    })
  }
  makeCounter(): EncodeObject {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('NotificationHandler', 'makeCounter'))
    const pH = this.walletRef.getProtoHandler()
    return pH.notificationsTx.msgSetCounter({
      creator: this.walletRef.getJackalAddress()
    })
  }
  makeBlockedSender(sender: string): EncodeObject {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('NotificationHandler', 'makeBlockedSender'))
    const pH = this.walletRef.getProtoHandler()
    return pH.notificationsTx.msgBlockSenders({
      creator: this.walletRef.getJackalAddress(),
      senderIds: sender
    })
  }

  async broadcastMakeCounter(): Promise<void> {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('NotificationHandler', 'broadcastMakeCounter'))
    const msg = this.makeCounter()
    const pH = this.walletRef.getProtoHandler()
    pH.debugBroadcaster([msg], { memo: '', step: false })
      .catch((err) => {
        console.warn(err)
        throw err
      })
  }

  async getNotification(
    forAddress: string,
    index: number
  ): Promise<QueryGetNotificationsResponse> {
    return (
      await this.qH.notificationsQuery.queryNotifications({
        count: index,
        address: forAddress
      })
    ).value
  }
  async getAllNotifications(): Promise<QueryAllNotificationsResponse> {
    return (
      await handlePagination(
        this.qH.notificationsQuery,
        'queryNotificationsAll',
        {}
      )
    ).reduce((acc: Notifications[], curr: QueryAllNotificationsResponse) => {
      acc.push(...curr.notifications)
      return acc
    }, [])
  }
  async getSingleAddressNotifications(
    forAddress: string
  ): Promise<Notifications[]> {
    return (
      await handlePagination(
        this.qH.notificationsQuery,
        'queryNotificationsByAddress',
        { address: forAddress }
      )
    ).reduce(
      (acc: Notifications[], curr: QueryAllNotificationsByAddressResponse) => {
        acc.push(...curr.notifications)
        return acc
      },
      []
    )
  }
  async checkNotificationInit(forAddress: string): Promise<boolean> {
    return (await this.getBaseNotiCounter(forAddress)).success
  }
  async getNotificationCounter(
    forAddress: string
  ): Promise<QueryGetNotiCounterResponse> {
    return (await this.getBaseNotiCounter(forAddress)).value
  }
  async getAllNotificationCounters(): Promise<QueryAllNotiCounterResponse> {
    return (
      await handlePagination(
        this.qH.notificationsQuery,
        'queryNotificationsAll',
        {}
      )
    ).reduce((acc: NotiCounter[], curr: QueryAllNotiCounterResponse) => {
      acc.push(...curr.notiCounter)
      return acc
    }, [])
  }

  /** Standardized Messages */
  async makeStandardizedShareNotification(
    type: string,
    address: string
  ): Promise<EncodeObject> {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('NotificationHandler', 'makeStandardizedShareNotification'))
    const pubKey = await this.walletRef.findPubKey(address)
    const baseNoti = { type }
    const bufNoti = new TextEncoder().encode(JSON.stringify(baseNoti))
    return this.makeNotification(
      this.walletRef.asymmetricEncrypt(bufNoti, pubKey),
      address
    )
  }
  async makeAddShareNoti(address: string): Promise<EncodeObject> {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('NotificationHandler', 'makeAddShareNoti'))
    return await this.makeStandardizedShareNotification('dbfs-add', address)
  }
  async makeUpdateShareNoti(address: string): Promise<EncodeObject> {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('NotificationHandler', 'makeUpdateShareNoti'))
    return await this.makeStandardizedShareNotification('dbfs-update', address)
  }
  async makeRemoveShareNoti(address: string): Promise<EncodeObject> {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('NotificationHandler', 'makeRemoveShareNoti'))
    return await this.makeStandardizedShareNotification('dbfs-remove', address)
  }

  /** Read Encrypted Notifications */
  async readMyShareNoti(index: number): Promise<IReadableNoti> {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('NotificationHandler', 'readMyShareNoti'))
    const { notifications } = await this.getNotification(
      this.walletRef.getJackalAddress(),
      index
    )
    return processNotiRead(notifications as Notifications, this.walletRef)
  }
  async readAllMyShareNotis(): Promise<IReadableNoti[]> {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('NotificationHandler', 'readAllMyShareNotis'))
    const data = await this.getSingleAddressNotifications(
      this.walletRef.getJackalAddress()
    )
    return data.map((noti: Notifications) =>
      processNotiRead(noti, this.walletRef)
    )
  }

  /** Private Methods */
  async getBaseNotiCounter(
    forAddress: string
  ): Promise<IBaseNotiResponse> {
    return await this.qH.notificationsQuery.queryNotiCounter({
      address: forAddress
    })
  }
}

/** Helpers */
function processNotiRead(noti: Notifications, walletRef: IWalletHandler) {
  const contents = new TextDecoder().decode(
    walletRef.asymmetricDecrypt(noti.notification)
  )
  return { from: noti.sender, to: noti.address, contents }
}

interface IBaseNotiResponse {
  message: string
  success: boolean
  value: QueryGetNotiCounterResponse
}
