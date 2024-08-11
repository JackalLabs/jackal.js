import { signerNotEnabled } from '@/utils/misc'
import type {
  DDeliverTxResponse,
  DEncodeObject,
  DQuerySmartContractStateRequest,
  THostSigningClient,
  TJackalSigningClient,
} from '@jackallabs/jackal.js-protos'
import type { IClientHandler, IWrappedEncodeObject } from '@/interfaces'
import { IWasmHandler } from '@/interfaces/classes'
import { stringToUint8Array, uintArrayToString } from '@/utils/converters'
import { EncodingHandler } from '@/classes/encodingHandler'
import { PrivateKey } from 'eciesjs'
import { stringToShaHex } from '@/utils/hash'

export class WasmHandler extends EncodingHandler implements IWasmHandler {
  protected constructor(
    client: IClientHandler,
    jackalSigner: TJackalSigningClient,
    hostSigner: THostSigningClient,
    keyPair: PrivateKey,
  ) {
    super(client, jackalSigner, hostSigner, keyPair)
  }

  /**
   *
   * @param {IClientHandler} client
   * @returns {Promise<IWasmHandler>}
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
    let dummyKey = await stringToShaHex('')
    const keyPair = PrivateKey.fromHex(dummyKey)
    return new WasmHandler(client, jackalSigner, hostSigner, keyPair)
  }

  /**
   * Instantiate a CosmWasm contract.
   * @param {string} connectionIdA
   * @param {string} connectionIdB
   * @param {number} codeId
   * @returns {Promise<DDeliverTxResponse>}
   */
  async instantiateICA(
    connectionIdA: string,
    connectionIdB: string,
    codeId: number,
  ): Promise<DDeliverTxResponse> {
    try {
      const wrapped: IWrappedEncodeObject[] = this.instantiateToMsgs(
        connectionIdA,
        connectionIdB,
        codeId,
      )
      const postBroadcast =
        await this.jackalClient.broadcastAndMonitorMsgs(wrapped)
      return postBroadcast.txResponse
    } catch (err) {
      throw err
    }
  }

  /**
   *
   * @param {number} [index]
   * @returns {Promise<string>}
   */
  async getICAContractAddress(index: number = 0): Promise<string> {
    const contractsByCreator =
      await this.hostSigner.queries.cosmwasm.contractsByCreator({
        creatorAddress: this.hostAddress,
      })

    const contracts = contractsByCreator.contractAddresses

    return contracts[index] || ''
  }

  /**
   *
   * @returns {Promise<string>}
   */
  async getICAJackalAddress(): Promise<string> {
    const address = await this.getICAContractAddress()

    return this.getJackalAddressFromContract(address)
  }

  /**
   *
   * @param {string} contractAddress
   * @returns {Promise<string>}
   */
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

  /**
   *
   * @param {string} contract
   * @param {DEncodeObject[]} msgs
   * @returns {DEncodeObject[]}
   */
  wrapEncodeObjectsForBroadcast(
    contract: string,
    msgs: DEncodeObject[],
  ): DEncodeObject[] {
    return this.executeToSpecialMsgs(contract, msgs)
  }
}
