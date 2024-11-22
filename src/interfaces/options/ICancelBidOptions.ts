import type { IBroadcastOptions } from '@/interfaces'

/**
 *
 * @interface ICancelBidOptions
 * @property {string} rns - RNS to retract offer from.
 */
export interface ICancelBidOptions {
  rns: string
  chain?: true
  broadcastOptions?: IBroadcastOptions
}
