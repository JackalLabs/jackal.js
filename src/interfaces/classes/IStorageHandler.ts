import { DeliverTxResponse } from '@cosmjs/stargate'
import { IPayBlock, IPayData, IStorageClientUsage } from '@/interfaces'

export default interface IStorageHandler {
  buyStorage (forAddress: string, duration: string, bytes: string): Promise<DeliverTxResponse>
  getClientUsage (address: string): Promise<IStorageClientUsage>
  getGetPayData (address: string): Promise<IPayData>
  getPayBlocks (blockid: string): Promise<IPayBlock>
}
