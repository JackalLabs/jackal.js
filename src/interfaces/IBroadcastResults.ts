import type { DDeliverTxResponse } from '@jackallabs/jackal.js-protos'
import type { TxEvent } from '@cosmjs/tendermint-rpc'

export interface IBroadcastResults {
  error: boolean
  errorText: string
  txResponse: DDeliverTxResponse
  txEvents: TxEvent[]
}
