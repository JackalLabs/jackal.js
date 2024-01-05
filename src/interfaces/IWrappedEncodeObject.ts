import type { DEncodeObject } from '@jackallabs/jackal.js-protos'

export interface IWrappedEncodeObject {
  encodedObject: DEncodeObject
  modifier: number
  file?: File
  merkle?: string
}
