import type { DDeliverTxResponse, DEncodeObject } from '@jackallabs/jackal.js-protos'

export interface IWasmHandler {
  instantiateICA (
    connectionIdA: string,
    connectionIdB: string,
    codeId: number,
  ): Promise<DDeliverTxResponse>

  getICAContractAddress (index?: number): Promise<string>

  getICAJackalAddress (): Promise<string>

  getJackalAddressFromContract (contractAddress: string): Promise<string>

  wrapEncodeObjectsForBroadcast (contract: string, msgs: DEncodeObject[]): DEncodeObject[]
}
