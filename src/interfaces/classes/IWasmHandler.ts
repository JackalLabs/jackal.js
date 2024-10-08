import type { DDeliverTxResponse, DEncodeObject } from '@jackallabs/jackal.js-protos'

export interface IWasmHandler {
  instantiateICA (
    contractAddress: string,
    connectionIdA: string,
    connectionIdB: string
  ): Promise<DDeliverTxResponse>

  getICAContractAddress (contractAddress: string): Promise<string>

  getICAJackalAddress (contractAddress: string): Promise<string>

  getJackalAddressFromContract (contractAddress: string): Promise<string>

  wrapEncodeObjectsForBroadcast (contract: string, msgs: DEncodeObject[]): DEncodeObject[]
}
