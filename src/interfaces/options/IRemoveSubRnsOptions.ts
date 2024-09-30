import type { IBroadcastOptions } from '@/interfaces'

/**
 *
 * @interface IRemoveSubRnsOptions
 * @property {string} rns - Full RNS to remove.
 */
export interface IRemoveSubRnsOptions {
  rns: string
  chain?: true
  broadcastOptions?: IBroadcastOptions
}