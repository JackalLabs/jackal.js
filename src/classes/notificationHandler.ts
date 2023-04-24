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
import SuccessIncluded from 'jackal.js-protos/dist/types/TSuccessIncluded'
import { aesToString, encryptString, genIv, genKey } from '@/utils/crypt'
import { Pubkey } from 'jackal.js-protos/dist/postgen/canine_chain/filetree/pubkey'
import { hashAndHex, merkleMeBro } from '@/utils/hash'
import { IEditorsViewers } from '@/interfaces'

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
  async checkNotificationInit (forAddress: string): Promise<boolean> {
    return (await this.getBaseNotiCounter(forAddress)).success
  }
  async getNotificationCounter (forAddress: string): Promise<QueryGetNotiCounterResponse> {
    return (await this.getBaseNotiCounter(forAddress)).value
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

  /** Standardized Messages */
  async makeStandardizedShareNotification (type: string, address: string): Promise<EncodeObject> {
    const pubKey = await this.walletRef.findPubKey(address)
    const baseNoti = { type }
    const bufNoti = new TextEncoder().encode(JSON.stringify(baseNoti))
    return this.makeNotification(this.walletRef.asymmetricEncrypt(bufNoti, pubKey), address)
  }
  async makeAddShareNoti (address: string): Promise<EncodeObject> {
    return await this.makeStandardizedShareNotification('dbfs-update', address)
  }
  async makeUpdateShareNoti (address: string): Promise<EncodeObject> {
    return await this.makeStandardizedShareNotification('dbfs-update', address)
  }
  async makeRemoveShareNoti (address: string): Promise<EncodeObject> {
    return await this.makeStandardizedShareNotification('dbfs-remove', address)
  }

  /** Private Methods */
  async getBaseNotiCounter (forAddress: string): Promise<SuccessIncluded<QueryGetNotiCounterResponse>> {
    return (await this.pH.notificationsQuery.queryNotiCounter({
      address: forAddress
    }))
  }
}
