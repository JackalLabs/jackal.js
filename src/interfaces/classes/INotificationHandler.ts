import { EncodeObject } from '@cosmjs/proto-signing'
import {
  QueryAllNotiCounterResponse,
  QueryAllNotificationsByAddressResponse,
  QueryAllNotificationsResponse,
  QueryGetNotiCounterResponse,
  QueryGetNotificationsResponse
} from 'jackal.js-protos/dist/postgen/canine_chain/notifications/query'

export default interface INotificationHandler {
  makeNotification (notification: string, address: string): EncodeObject
  makeNotificationUpdate (count: number, notification: string, address: string): EncodeObject
  makeNotificationDeletion (): EncodeObject
  makeCounter (): EncodeObject
  makeBlockedSender (sender: string): EncodeObject

  getNotification (forAddress: string, index: number): Promise<QueryGetNotificationsResponse>
  getAllNotifications (): Promise<QueryAllNotificationsResponse>
  getSingleAddressNotifications (forAddress: string): Promise<QueryAllNotificationsByAddressResponse>
  getNotificationCounter (forAddress: string): Promise<QueryGetNotiCounterResponse>
  getAllNotificationCounters (): Promise<QueryAllNotiCounterResponse>
}
