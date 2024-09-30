import type { DCoin } from '@jackallabs/jackal.js-protos'
import type { IBroadcastOptions } from '@/interfaces'

/**
 *
 * @interface IListOptions
 * @property {DCoin} price - Value to buy as DCoin instance.
 * @property {string} rns - RNS to list on market.
 */
export interface IListOptions {
  price: DCoin
  rns: string
  chain?: true
  broadcastOptions?: IBroadcastOptions
}