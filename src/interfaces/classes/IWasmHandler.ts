import type { DDeliverTxResponse, DEncodeObject } from '@jackallabs/jackal.js-protos'

export interface IWasmHandler {
  instantiateICA(): Promise<DDeliverTxResponse>
  getICAContractAddress(): Promise<string>
  getICAJackalAddress(): Promise<string>
  getJackalAddressFromContract(contractAddress: string): Promise<string>
  wrapEncodeObjectsForBroadcast(contract: string, msgs: DEncodeObject[]): DEncodeObject[]
}
