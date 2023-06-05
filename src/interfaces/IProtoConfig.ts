import { OfflineSigner } from '@cosmjs/proto-signing'

export default interface IProtoConfig {
  signer: OfflineSigner
  queryUrl?: string
  rpcUrl?: string
}
