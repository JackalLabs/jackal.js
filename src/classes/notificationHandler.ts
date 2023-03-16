import { IProtoHandler, IWalletHandler, INotificationHandler } from '@/interfaces/classes'
import { EncodeObject } from '@cosmjs/proto-signing'
import { handlePagination } from '@/utils/misc'
import {
  QueryAllNotiCounterResponse,
  QueryAllNotificationsByAddressResponse,
  QueryAllNotificationsResponse,
  QueryGetNotiCounterResponse,
  QueryGetNotificationsResponse
} from 'jackal.js-protos/dist/postgen/canine_chain/notifications/query'
import { Notifications } from 'jackal.js-protos/dist/postgen/canine_chain/notifications/notifications'
import { NotiCounter } from 'jackal.js-protos/dist/postgen/canine_chain/notifications/noti_counter'

export default class OracleHandler implements INotificationHandler {
  private readonly walletRef: IWalletHandler
  private readonly pH: IProtoHandler

  private constructor (wallet: IWalletHandler) {
    this.walletRef = wallet
    this.pH = wallet.getProtoHandler()
  }

  static async trackOracle (wallet: IWalletHandler): Promise<INotificationHandler> {
    return new OracleHandler(wallet)
  }

  makeNotification (notification: string, address: string): EncodeObject {
    return this.pH.notificationsTx.msgCreateNotifications({
      creator: this.walletRef.getJackalAddress(),
      notification,
      address
    })
  }
  makeNotificationUpdate (count: number, notification: string, address: string): EncodeObject {
    return this.pH.notificationsTx.msgUpdateNotifications({
      creator: this.walletRef.getJackalAddress(),
      count,
      notification,
      address
    })
  }
  makeNotificationDeletion (): EncodeObject {
    return this.pH.notificationsTx.msgDeleteNotifications({
      creator: this.walletRef.getJackalAddress()
    })
  }
  makeCounter (): EncodeObject {
    return this.pH.notificationsTx.msgSetCounter({
      creator: this.walletRef.getJackalAddress()
    })
  }
  makeBlockedSender (sender: string): EncodeObject {
    return this.pH.notificationsTx.msgBlockSenders({
      creator: this.walletRef.getJackalAddress(),
      senderIds: sender
    })
  }

  async getNotification (forAddress: string, index: number): Promise<QueryGetNotificationsResponse> {
    return (await this.pH.notificationsQuery.queryNotifications({
      count: index,
      address: forAddress
    })).value
  }
  async getAllNotifications (): Promise<QueryAllNotificationsResponse> {
    return (await handlePagination(
      this.pH.notificationsQuery,
      'queryNotificationsAll',
      {}
    ))
      .reduce((acc: Notifications[], curr: QueryAllNotificationsResponse) => {
        acc.push(...curr.notifications)
        return acc
      }, [])
  }
  async getSingleAddressNotifications (forAddress: string): Promise<QueryAllNotificationsByAddressResponse> {
    return (await handlePagination(
      this.pH.notificationsQuery,
      'queryNotificationsByAddress',
      { address: forAddress }
    ))
      .reduce((acc: Notifications[], curr: QueryAllNotificationsByAddressResponse) => {
        acc.push(...curr.notifications)
        return acc
      }, [])
  }
  async getNotificationCounter (forAddress: string): Promise<QueryGetNotiCounterResponse> {
    return (await this.pH.notificationsQuery.queryNotiCounter({
      address: forAddress
    })).value
  }
  async getAllNotificationCounters (): Promise<QueryAllNotiCounterResponse> {
    return (await handlePagination(
      this.pH.notificationsQuery,
      'queryNotificationsAll',
      {}
    ))
      .reduce((acc: NotiCounter[], curr: QueryAllNotiCounterResponse) => {
        acc.push(...curr.notiCounter)
        return acc
      }, [])
  }
}
