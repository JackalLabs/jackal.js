import type { IBroadcastOptions } from '@/interfaces'

/**
 *
 * @interface IBuyOptions
 * @property {string} rns - RNS to purchase.
 */
export interface IBuyOptions {
  rns: string
  chain?: true
  broadcastOptions?: IBroadcastOptions
}
