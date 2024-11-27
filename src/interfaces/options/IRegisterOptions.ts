import { IBroadcastOptions, INoCloneRnsMetaDataSource } from '@/interfaces'

/**
 *
 * @interface IRegisterOptions
 * @property {string} rns - RNS address to register.
 * @property {number} yearsToRegister - Duration to register for in years.
 * @property {INoCloneRnsMetaDataSource} [data] - Optional object to include in data field.
 * @property {boolean} [setAsPrimary] - Optional flag to set as primary RNS.
 */
export interface IRegisterOptions {
  rns: string
  yearsToRegister: number
  data?: INoCloneRnsMetaDataSource
  setAsPrimary?: boolean
  chain?: true
  broadcastOptions?: IBroadcastOptions
}
