import type { DCoin } from '@jackallabs/jackal.js-protos'
import type { IBroadcastOptions } from '@/interfaces'

/**
 *
 * @interface IBidOptions
 * @property {DCoin} bid - Value of offer as DCoin instance.
 * @property {string} rns - RNS to submit offer on.
 */
export interface IBidOptions {
  bid: DCoin
  rns: string
  chain?: true
  broadcastOptions?: IBroadcastOptions
}
