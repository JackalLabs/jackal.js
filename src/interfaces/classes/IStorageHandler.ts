import { DeliverTxResponse } from '@cosmjs/stargate'
import { IPayBlock, IPayData, IStorageClientUsage } from '@/interfaces'

export default interface IStorageHandler {
  buyStorage (forAddress: string, duration: string, bytes: string): Promise<DeliverTxResponse>
  getClientFreeSpace (address: string): Promise<string>
  getPayData (address: string): Promise<IPayData>
  getStoragePaymentInfo (): Promise<true>
}
