import { IAesBundle, TViewerSetAll } from '@/interfaces'

/**
 *
 * @interface ICreateViewAccessOptions
 * @property {string} trackingNumber
 * @property {TViewerSetAll} viewers
 * @property {IAesBundle} [aes]
 * @property {string} [ulid]
 */
export interface ICreateViewAccessOptions {
  trackingNumber: string
  viewers: TViewerSetAll
  aes?: IAesBundle
  ulid?: string
}