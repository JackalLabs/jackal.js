import { signerNotEnabled, warnError } from '@/utils/misc'
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
  protected constructor (
    client: IClientHandler,
    jackalSigner: TJackalSigningClient,
    hostSigner: THostSigningClient,
    keyPair: PrivateKey,
  ) {
    super(client, jackalSigner, hostSigner, keyPair)
  }

  /**
   * Initialize wasm handler.
   * @param {IClientHandler} client - Instance of ClientHandler.
   * @returns {Promise<IWasmHandler>} - Instance of WasmHandler.
   */
  static async init (client: IClientHandler): Promise<IWasmHandler> {
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
   * Instantiate an outpost contract.
   * @param {string} contractAddress
   * @param {string} connectionIdA
   * @param {string} connectionIdB
   * @returns {Promise<DDeliverTxResponse>}
   */
  async instantiateICA (
    contractAddress: string,
    connectionIdA: string,
    connectionIdB: string
  ): Promise<DDeliverTxResponse> {
    try {

      const msg = {
        create_outpost: {
          channel_open_init_options: {
            connection_id: connectionIdA,
            counterparty_connection_id: connectionIdB,
            tx_encoding: "proto3"
          }
        }
      }

      const eo = this.jackalClient.getTxs().cosmwasm.msgExecuteContract({
        contract: contractAddress,
        msg: stringToUint8Array(JSON.stringify(msg)),
        funds: [],
        sender: this.jackalClient.getHostAddress(),
      })
      const wrapped: IWrappedEncodeObject = { encodedObject: eo, modifier: 0 }

      const postBroadcast =
        await this.jackalClient.broadcastAndMonitorMsgs(wrapped)
      return postBroadcast.txResponse
    } catch (err) {
      throw warnError('wasmHandler instantiateICA()', err)
    }
  }

  /**
   * Get Interchain wasm contract address.
   * @param {string} contractAddress - Contract to query from
   * @returns {Promise<string>} - Contract address.
   */
  async getICAContractAddress (contractAddress: string): Promise<string> {
    try {

      const query = {
        get_user_outpost_address: {
          user_address: this.hostAddress,
        },
      }

      const q = stringToUint8Array(JSON.stringify(query))

      console.log("Query : ", query, q)

      const req: DQuerySmartContractStateRequest = {
        address: contractAddress,
        queryData: q,
      }

      console.log(req)
      const state =
        await this.hostSigner.queries.cosmwasm.smartContractState(req)
      console.log(state)

      return ''


    } catch (err) {
      throw warnError('wasmHandler getICAContractAddress()', err)
    }
  }

  /**
   * Get jkl address from unknown Interchain contract.
   * @param {string} contractAddress - Contract to query from
   * @returns {Promise<string>}
   */
  async getICAJackalAddress (contractAddress: string): Promise<string> {
    try {
      const address = await this.getICAContractAddress(contractAddress)
      return this.getJackalAddressFromContract(address)
    } catch (err) {
      throw warnError('wasmHandler getICAJackalAddress()', err)
    }
  }

  /**
   * Get jkl address from known Interchain contract.
   * @param {string} contractAddress - Target Interchain contract.
   * @returns {Promise<string>} - Jkl address.
   */
  async getJackalAddressFromContract (contractAddress: string): Promise<string> {
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
      throw warnError('wasmHandler getJackalAddressFromContract()', err)
    }
  }

  /**
   * Prep DEncodeObject array for processing by Interchain Accounts.
   * @param {string} contract - Target contract.
   * @param {DEncodeObject[]} msgs - Array of messages.
   * @returns {DEncodeObject[]} - Processed array of wrapped messages.
   */
  wrapEncodeObjectsForBroadcast (
    contract: string,
    msgs: DEncodeObject[],
  ): DEncodeObject[] {
    return this.executeToSpecialMsgs(contract, msgs)
  }
}
