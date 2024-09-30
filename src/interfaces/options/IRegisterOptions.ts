import { IBroadcastOptions, IRnsData } from '@/interfaces'

/**
 *
 * @interface IRegisterOptions
 * @property {string} rns - RNS address to register.
 * @property {number} yearsToRegister - Duration to register for in years.
 * @property {IRnsData} [data] - Optional object to include in data field.
 * @property {boolean} [setAsPrimary] - Optional flag to set as primary RNS.
 */
export interface IRegisterOptions {
  rns: string
  yearsToRegister: number
  data?: IRnsData
  setAsPrimary?: boolean
  chain?: true
  broadcastOptions?: IBroadcastOptions
}