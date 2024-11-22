import type { IBroadcastOptions } from '@/interfaces'

/**
 *
 * @interface IDelistOptions
 * @property {string} rns - RNS to remove.
 */
export interface IDelistOptions {
  rns: string
  chain?: true
  broadcastOptions?: IBroadcastOptions
}
