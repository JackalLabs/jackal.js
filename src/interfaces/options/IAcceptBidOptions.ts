import type { IBroadcastOptions } from '@/interfaces'

/**
 *
 * @interface IAcceptBidOptions
 * @property {string} from - The Jackal address to accept the bid from.
 * @property {string} rns - RNS to accept offer on.
 */
export interface IAcceptBidOptions {
  from: string
  rns: string
  chain?: true
  broadcastOptions?: IBroadcastOptions
}