import { EncodeObject } from '@cosmjs/proto-signing'

export default interface IWrappedEncodeObject {
  encodedObject: EncodeObject
  modifier?: number
}
