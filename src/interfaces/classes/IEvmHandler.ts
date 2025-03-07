import type { DEncodeObject } from '@jackallabs/jackal.js-protos'
import { DeliverTxResponse } from '@cosmjs/stargate'

export interface IEvmHandler {
  getEVMJackalAddress (contractAddress: string): Promise<string>

  getJackalAddressFromContract (contractAddress: string): Promise<string>

  signAndBroadcast (msgs: DEncodeObject[]): Promise<DeliverTxResponse>
}
