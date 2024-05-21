import { signerNotEnabled } from '@/utils/misc'
import type {
  DDeliverTxResponse, DEncodeObject,
  DQuerySmartContractStateRequest,
  THostSigningClient,
  TJackalSigningClient,
} from '@jackallabs/jackal.js-protos'
import type { IClientHandler, IWrappedEncodeObject } from '@/interfaces'
import { IWasmHandler } from '@/interfaces/classes'
import { stringToUint8Array, uintArrayToString } from '@/utils/converters'
import { EncodingHandler } from '@/classes/encodingHandler'

export class WasmHandler extends EncodingHandler implements IWasmHandler {
  protected constructor(
    client: IClientHandler,
    jackalSigner: TJackalSigningClient,
    hostSigner: THostSigningClient,
  ) {
    super(client, jackalSigner, hostSigner)
  }

  /**
   *
   * @param {IClientHandler} client
   * @returns {Promise<RnsHandler>}
   */
  static async init(client: IClientHandler): Promise<IWasmHandler> {
    const jackalSigner = client.getJackalSigner()
    if (!jackalSigner) {
      throw new Error(signerNotEnabled('WasmHandler', 'init'))
    }
    const hostSigner = client.getHostSigner()
    if (!hostSigner) {
      throw new Error(signerNotEnabled('WasmHandler', 'init'))
    }
    return new WasmHandler(client, jackalSigner, hostSigner)
  }

  /**
   * Instantiate a CosmWasm contract.
   * @returns {Promise<DDeliverTxResponse>}
   */
  async instantiateICA(): Promise<DDeliverTxResponse> {
    try {
      const wrapped: IWrappedEncodeObject[] = this.instantiateToMsgs(
        'connection-0',
        'connection-0',
        1
      )
      const postBroadcast =
        await this.jackalClient.broadcastAndMonitorMsgs(wrapped)
      return postBroadcast.txResponse
    } catch (err) {
      throw err
    }
  }

  async getICAContractAddress(): Promise<string> {
    const contractsByCreator =
      await this.hostSigner.queries.cosmwasm.contractsByCreator({
        creatorAddress: this.hostAddress,
      })

    const contracts = contractsByCreator.contractAddresses

    return contracts[0] || ''
  }

  async getICAJackalAddress(): Promise<string> {
    const address = await this.getICAContractAddress()

    return this.getJackalAddressFromContract(address)
  }

  async getJackalAddressFromContract(contractAddress: string): Promise<string> {
    try {
      const q = { get_contract_state: {} }

      const req: DQuerySmartContractStateRequest = {
        address: contractAddress,
        queryData: stringToUint8Array(JSON.stringify(q)),
      }

      const res = await this.hostSigner.queries.cosmwasm.smartContractState(req)
      const str = uintArrayToString(res.data as Uint8Array)
      const data = JSON.parse(str)

      return data.ica_info.ica_address
    } catch (err) {
      throw err
    }
  }

  wrapEncodeObjectsForBroadcast(contract: string, msgs: DEncodeObject[]): DEncodeObject[] {
    return this.executeToSpecialMsgs(contract, msgs)
  }
}
