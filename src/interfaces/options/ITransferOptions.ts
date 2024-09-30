import { IBroadcastOptions } from '@/interfaces'

/**
 *
 * @interface ITransferOptions
 * @property {string} receiver - Jackal address to transfer to.
 * @property {string} rns - RNS to transfer.
 */
export interface ITransferOptions {
  receiver: string
  rns: string
  chain?: true
  broadcastOptions?: IBroadcastOptions
}
