import {
  INotificationHandler,
  IQueryHandler,
  IWalletHandler
} from '@/interfaces/classes'
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
} from '@jackallabs/jackal.js-protos'
import { IReadableNoti } from '@/interfaces'

export default class NotificationHandler implements INotificationHandler {
  private readonly walletRef: IWalletHandler
  private readonly qH: IQueryHandler

  /**
   * Create a NotificationHandler instance.
   * @param {IWalletHandler} wallet - Instance of WalletHandler.
   * @private
   */
  private constructor(wallet: IWalletHandler) {
    this.walletRef = wallet
    this.qH = wallet.getQueryHandler()
  }

  /**
   * Async wrapper to create a NotificationHandler instance.
   * @param {IWalletHandler} wallet - Instance of WalletHandler.
   * @returns {Promise<INotificationHandler>} - Instance of NotificationHandler.
   */
  static async trackNotification(
    wallet: IWalletHandler
  ): Promise<INotificationHandler> {
    return new NotificationHandler(wallet)
  }

  /**
   * Create and send Notification to target user.
   * @param {string} notification - Notification content.
   * @param {string} address - Bech32 address of recipient.
   * @returns {EncodeObject}
   */
  makeNotification(notification: string, address: string): EncodeObject {
    if (!this.walletRef.traits)
      throw new Error(
        signerNotEnabled('NotificationHandler', 'makeNotification')
      )
    const pH = this.walletRef.getProtoHandler()
    return pH.notificationsTx.msgCreateNotifications({
      creator: this.walletRef.getJackalAddress(),
      notification,
      address
    })
  }

  /**
   * Modify previously sent Notification. Does not re-notify receiver.
   * @param {number} count - Index of Notification to update.
   * @param {string} notification - New Notification content.
   * @param {string} address - Bech32 address of recipient.
   * @returns {EncodeObject}
   */
  makeNotificationUpdate(
    count: number,
    notification: string,
    address: string
  ): EncodeObject {
    if (!this.walletRef.traits)
      throw new Error(
        signerNotEnabled('NotificationHandler', 'makeNotificationUpdate')
      )
    const pH = this.walletRef.getProtoHandler()
    return pH.notificationsTx.msgUpdateNotifications({
      creator: this.walletRef.getJackalAddress(),
      count,
      notification,
      address
    })
  }

  /**
   * Deletes all Notifications created by user.
   * @returns {EncodeObject}
   */
  makeNotificationDeletion(): EncodeObject {
    if (!this.walletRef.traits)
      throw new Error(
        signerNotEnabled('NotificationHandler', 'makeNotificationDeletion')
      )
    const pH = this.walletRef.getProtoHandler()
    return pH.notificationsTx.msgDeleteNotifications({
      creator: this.walletRef.getJackalAddress()
    })
  }

  /**
   * Initializes Notification system for user.
   * @returns {EncodeObject}
   */
  makeCounter(): EncodeObject {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('NotificationHandler', 'makeCounter'))
    const pH = this.walletRef.getProtoHandler()
    return pH.notificationsTx.msgSetCounter({
      creator: this.walletRef.getJackalAddress()
    })
  }

  /**
   * Blocks target address from sending Notifications to user.
   * @param {string} sender - Bech32 address to block.
   * @returns {EncodeObject}
   */
  makeBlockedSender(sender: string): EncodeObject {
    if (!this.walletRef.traits)
      throw new Error(
        signerNotEnabled('NotificationHandler', 'makeBlockedSender')
      )
    const pH = this.walletRef.getProtoHandler()
    return pH.notificationsTx.msgBlockSenders({
      creator: this.walletRef.getJackalAddress(),
      senderIds: sender
    })
  }

  /**
   * Initializes Notification system for user. Wraps makeCounter().
   * @returns {Promise<void>}
   */
  async broadcastMakeCounter(): Promise<void> {
    if (!this.walletRef.traits)
      throw new Error(
        signerNotEnabled('NotificationHandler', 'broadcastMakeCounter')
      )
    const msg = this.makeCounter()
    const pH = this.walletRef.getProtoHandler()
    pH.debugBroadcaster([msg], { memo: '', step: false }).catch((err) => {
      console.warn(err)
      throw err
    })
  }

  /**
   * Get target Notification for target receiver.
   * @param {string} forAddress - Bech32 address of receiver of Notification.
   * @param {number} index - Index of Notification to retrieve.
   * @returns {Promise<QueryGetNotificationsResponse>}
   */
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

  /**
   * Get all Notifications.
   * @returns {Promise<QueryAllNotificationsResponse>}
   */
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

  /**
   * Get all Notifications for target receiver.
   * @param {string} forAddress - Bech32 address of receiver of Notification.
   * @returns {Promise<Notifications[]>}
   */
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

  /**
   * Check if makeCounter() or broadcastMakeCounter() has been run for target address.
   * @param {string} forAddress - Bech32 address to check.
   * @returns {Promise<boolean>}
   */
  async checkNotificationInit(forAddress: string): Promise<boolean> {
    return (await this.getBaseNotiCounter(forAddress)).success
  }

  /**
   * Check Notification count for target address. Wrapper for getBaseNotiCounter().
   * @param {string} forAddress - Bech32 address to check.
   * @returns {Promise<QueryGetNotiCounterResponse>}
   */
  async getNotificationCounter(
    forAddress: string
  ): Promise<QueryGetNotiCounterResponse> {
    return (await this.getBaseNotiCounter(forAddress)).value
  }

  /**
   * Check Notification count for all addresses.
   * @returns {Promise<QueryAllNotiCounterResponse>}
   */
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
  /**
   * Standardized general-purpose Notification Msg creator.
   * @param {string} type - Notification identification code.
   * @param {string} address - Bech32 address of Notification target.
   * @returns {Promise<EncodeObject>}
   */
  async makeStandardizedShareNotification(
    type: string,
    address: string
  ): Promise<EncodeObject> {
    if (!this.walletRef.traits)
      throw new Error(
        signerNotEnabled(
          'NotificationHandler',
          'makeStandardizedShareNotification'
        )
      )
    const pubKey = await this.walletRef.findPubKey(address)
    const baseNoti = { type }
    const bufNoti = new TextEncoder().encode(JSON.stringify(baseNoti))
    return this.makeNotification(
      this.walletRef.asymmetricEncrypt(bufNoti, pubKey),
      address
    )
  }

  /**
   * Create sharing added Notification entry. Wraps makeStandardizedShareNotification().
   * @param {string} address - Bech32 address of Notification target.
   * @returns {Promise<EncodeObject>}
   */
  async makeAddShareNoti(address: string): Promise<EncodeObject> {
    if (!this.walletRef.traits)
      throw new Error(
        signerNotEnabled('NotificationHandler', 'makeAddShareNoti')
      )
    return await this.makeStandardizedShareNotification('dbfs-add', address)
  }

  /**
   * Create sharing updated Notification entry. Wraps makeStandardizedShareNotification().
   * @param {string} address - Bech32 address of Notification target.
   * @returns {Promise<EncodeObject>}
   */
  async makeUpdateShareNoti(address: string): Promise<EncodeObject> {
    if (!this.walletRef.traits)
      throw new Error(
        signerNotEnabled('NotificationHandler', 'makeUpdateShareNoti')
      )
    return await this.makeStandardizedShareNotification('dbfs-update', address)
  }

  /**
   * Create sharing cancelled Notification entry. Wraps makeStandardizedShareNotification().
   * @param {string} address - Bech32 address of Notification target.
   * @returns {Promise<EncodeObject>}
   */
  async makeRemoveShareNoti(address: string): Promise<EncodeObject> {
    if (!this.walletRef.traits)
      throw new Error(
        signerNotEnabled('NotificationHandler', 'makeRemoveShareNoti')
      )
    return await this.makeStandardizedShareNotification('dbfs-remove', address)
  }

  /** Read Encrypted Notifications */
  /**
   * Query user's Notification by index
   * @param {number} index - Index of Notification to retrieve.
   * @returns {Promise<IReadableNoti>}
   */
  async readMyShareNoti(index: number): Promise<IReadableNoti> {
    if (!this.walletRef.traits)
      throw new Error(
        signerNotEnabled('NotificationHandler', 'readMyShareNoti')
      )
    const { notifications } = await this.getNotification(
      this.walletRef.getJackalAddress(),
      index
    )
    return processNotiRead(notifications as Notifications, this.walletRef)
  }

  /**
   * Query all of user's Notifications.
   * @returns {Promise<IReadableNoti[]>}
   */
  async readAllMyShareNotis(): Promise<IReadableNoti[]> {
    if (!this.walletRef.traits)
      throw new Error(
        signerNotEnabled('NotificationHandler', 'readAllMyShareNotis')
      )
    const data = await this.getSingleAddressNotifications(
      this.walletRef.getJackalAddress()
    )
    return data.map((noti: Notifications) =>
      processNotiRead(noti, this.walletRef)
    )
  }

  /** Private Methods */
  /**
   * Check Notification count for target address.
   * @param {string} forAddress - Bech32 address for target.
   * @returns {Promise<IBaseNotiResponse>}
   * @private
   */
  private async getBaseNotiCounter(
    forAddress: string
  ): Promise<IBaseNotiResponse> {
    return await this.qH.notificationsQuery.queryNotiCounter({
      address: forAddress
    })
  }
}

/** Helpers */
/**
 * Decrypt encrypted Notification contents.
 * @param {Notifications} noti - Contents to decrypt.
 * @param {IWalletHandler} walletRef - WalletHandler instance for decryption methods.
 * @returns {{contents: string, from: string, to: string}}
 * @private
 */
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
