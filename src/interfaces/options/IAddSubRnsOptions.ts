import { IBroadcastOptions, IRnsData } from '@/interfaces'

/**
 *
 * @interface IAddSubRnsOptions
 * @property {string} rns - RNS to transfer.
 * @property {string} linkedWallet - Jackal address to link new sub RNS to.
 * @property {string} subRns - Sub RNS to create.
 * @property {IRnsData} [data] - Optional object to include in sub RNS data field.
 */
export interface IAddSubRnsOptions {
  rns: string
  linkedWallet: string
  subRns: string
  data?: IRnsData
  chain?: true
  broadcastOptions?: IBroadcastOptions
}
