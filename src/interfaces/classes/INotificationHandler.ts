import { EncodeObject } from '@cosmjs/proto-signing'
import {
  QueryAllNotiCounterResponse,
  QueryAllNotificationsByAddressResponse,
  QueryAllNotificationsResponse,
  QueryGetNotiCounterResponse,
  QueryGetNotificationsResponse
} from 'jackal.js-protos/dist/postgen/canine_chain/notifications/query'
import { IReadableNoti } from '@/interfaces'

export default interface INotificationHandler {
  makeNotification (notification: string, address: string): EncodeObject
  makeNotificationUpdate (count: number, notification: string, address: string): EncodeObject
  makeNotificationDeletion (): EncodeObject
  makeCounter (): EncodeObject
  makeBlockedSender (sender: string): EncodeObject

  getNotification (forAddress: string, index: number): Promise<QueryGetNotificationsResponse>
  getAllNotifications (): Promise<QueryAllNotificationsResponse>
  getSingleAddressNotifications (forAddress: string): Promise<QueryAllNotificationsByAddressResponse>
  checkNotificationInit (forAddress: string): Promise<boolean>
  getNotificationCounter (forAddress: string): Promise<QueryGetNotiCounterResponse>
  getAllNotificationCounters (): Promise<QueryAllNotiCounterResponse>

  /** Standardized Messages */
  makeStandardizedShareNotification (type: string, address: string): Promise<EncodeObject>
  makeAddShareNoti (address: string): Promise<EncodeObject>
  makeUpdateShareNoti (address: string): Promise<EncodeObject>
  makeRemoveShareNoti (address: string): Promise<EncodeObject>

  readMyShareNoti (index: number): Promise<IReadableNoti>
  readAllMyShareNotis (): Promise<IReadableNoti[]>
}
