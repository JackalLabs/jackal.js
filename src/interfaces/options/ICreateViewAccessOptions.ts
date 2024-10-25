import { IAesBundle, TViewerSetAll } from '@/interfaces'
import { DFile } from '@jackallabs/jackal.js-protos'

/**
 *
 * @interface ICreateViewAccessOptions
 * @property {DFile} access
 * @property {string} trackingNumber
 * @property {TViewerSetAll} viewers
 * @property {IAesBundle} [aes]
 */
export interface ICreateViewAccessOptions {
  access: DFile
  trackingNumber: string
  viewers: TViewerSetAll
  aes?: IAesBundle
}