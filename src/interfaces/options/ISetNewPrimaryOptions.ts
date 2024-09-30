import type { IBroadcastOptions } from '@/interfaces'

/**
 *
 * @interface ISetNewPrimaryOptions
 * @property {string} rns - RNS to set as primary.
 */
export interface ISetNewPrimaryOptions {
  rns: string
  chain?: true
  broadcastOptions?: IBroadcastOptions
}