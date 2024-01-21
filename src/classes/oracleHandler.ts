import { signerNotEnabled, warnError } from '@/utils/misc'
import type {
  DDeliverTxResponse,
  DEncodeObject,
  DFeed,
  IJackalSigningStargateClient,
  TQueryAllFeedsResponseStrict,
} from '@jackallabs/jackal.js-protos'
import type { IClientHandler, IOracleHandler } from '@/interfaces/classes'
import type { IPageRequest, IWrappedEncodeObject } from '@/interfaces'

export class OracleHandler implements IOracleHandler {
  protected readonly jackalClient: IClientHandler
  protected readonly signingClient: IJackalSigningStargateClient | null

  protected constructor(client: IClientHandler) {
    this.jackalClient = client
    this.signingClient = client.getSigningClient()
  }

  /**
   *
   * @param {IClientHandler} client
   * @returns {Promise<IOracleHandler>}
   */
  static async init(client: IClientHandler): Promise<IOracleHandler> {
    return new OracleHandler(client)
  }

  /**
   * Retrieve data of specified on-chain oracle.
   * @param {string} name - Name of oracle.
   * @returns {Promise<DFeed>}
   */
  async getFeed(name: string): Promise<DFeed> {
    const result = await this.jackalClient
      .getQueries()
      .oracle.feed({ name })
      .catch((err) => {
        throw err
      })
    return result.feed
  }

  /**
   * Retrieve data of all on-chain oracles.
   * @param {IPageRequest} [pagination] - Optional values to fetch more than first 100 results.
   * @returns {Promise<TQueryAllFeedsResponseStrict>}
   */
  async getAllFeeds(
    pagination?: IPageRequest,
  ): Promise<TQueryAllFeedsResponseStrict> {
    return await this.jackalClient
      .getQueries()
      .oracle.allFeeds({ pagination })
      .catch((err) => {
        throw err
      })
  }

  /**
   * Create Msg to create new oracle feed.
   * @param {string} oracleName - Unique name of Oracle feed to create.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeCreateFeedMsg(oracleName: string): DEncodeObject {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('OracleHandler', 'makeCreateFeedMsg'))
    }
    return this.signingClient.txLibrary.oracle.msgCreateFeed({
      creator: this.jackalClient.getJackalAddress(),
      name: oracleName,
    })
  }

  /**
   * Create new oracle feed.
   * @param {string} oracleName - Unique name of Oracle feed to create.
   * @returns {Promise<DDeliverTxResponse>}
   */
  async createFeed(oracleName: string): Promise<DDeliverTxResponse> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('OracleHandler', 'createFeed'))
    }
    const wrapped: IWrappedEncodeObject = {
      encodedObject: this.makeCreateFeedMsg(oracleName),
      modifier: 0,
    }
    return await this.jackalClient.broadcastsMsgs(wrapped).catch((err) => {
      throw err
    })
  }

  /**
   * Create Msg to update existing oracle feed.
   * @param {string} oracleName - Name of Oracle feed to update.
   * @param {Record<string, any>} data - JSON-ready object of arbitrary data.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeUpdateFeedMsg(
    oracleName: string,
    data: Record<string, any>,
  ): DEncodeObject {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('OracleHandler', 'makeUpdateFeedMsg'))
    }
    return this.signingClient.txLibrary.oracle.msgUpdateFeed({
      creator: this.jackalClient.getJackalAddress(),
      name: oracleName,
      data: this.stringifyDataContents(data),
    })
  }

  /**
   * Update data of existing oracle feed.
   * @param {string} oracleName - Name of Oracle feed to update.
   * @param {string} data - Stringified JSON object of arbitrary data.
   * @returns {Promise<DDeliverTxResponse>}
   */
  async pushToFeed(
    oracleName: string,
    data: Record<string, any>,
  ): Promise<DDeliverTxResponse> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('OracleHandler', 'updateFeed'))
    }
    const wrapped: IWrappedEncodeObject = {
      encodedObject: this.makeUpdateFeedMsg(oracleName, data),
      modifier: 0,
    }
    return await this.jackalClient.broadcastsMsgs(wrapped).catch((err) => {
      throw err
    })
  }

  protected stringifyDataContents(data: Record<string, any> = {}): string {
    try {
      return JSON.stringify(data)
    } catch (err) {
      console.log('data:', data)
      throw new Error(warnError('OracleHandler.stringifyDataContents()', err))
    }
  }
}
