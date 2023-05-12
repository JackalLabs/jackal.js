import { OfflineSigner } from '@cosmjs/proto-signing'

export default interface IProtoReqs {
  signer: OfflineSigner
  queryAddr1317: string
  txAddr26657: string
}
