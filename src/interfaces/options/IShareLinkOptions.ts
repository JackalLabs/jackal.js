import { IBroadcastOptions } from '@/interfaces'

/**
 *
 * @interface IShareLinkOptions
 * @property {string | string[]} paths - Paths of files to create sharing links for.
 */
export interface IShareLinkOptions {
  paths: string | string[]
  chain?: true
  broadcastOptions?: IBroadcastOptions
}
