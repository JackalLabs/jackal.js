import { DeliverTxResponse } from '@cosmjs/stargate'
import { IPayData, IStoragePaymentInfo } from '@/interfaces'
import { EncodeObject } from '@cosmjs/proto-signing'

export default interface IStorageHandler {
  buyStorage (forAddress: string, duration: string, space: number): Promise<void>
  makeStorageInitMsg (): EncodeObject
  getClientFreeSpace (address: string): Promise<number>
  getPayData (address: string): Promise<IPayData>
  getStoragePaymentInfo (address: string): Promise<IStoragePaymentInfo>
}
