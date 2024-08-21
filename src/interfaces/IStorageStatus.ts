import type { DStoragePaymentInfo } from '@jackallabs/jackal.js-protos'

export interface IStorageStatus {
  active: boolean
  info: DStoragePaymentInfo
}
