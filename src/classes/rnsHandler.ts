import { bech32 } from '@jackallabs/bech32'
import { signerNotEnabled } from '@/utils/misc'
import type {
  DBid,
  DCoin,
  DDeliverTxResponse,
  DEncodeObject,
  DForsale,
  DName,
  IJackalSigningStargateClient,
  TQueryAllBidsResponseStrict,
  TQueryAllForSaleResponseStrict,
  TQueryAllNamesResponseStrict,
  TQueryListOwnedNamesResponseStrict,
} from '@jackallabs/jackal.js-protos'
import type {
  IClientHandler,
  IRnsData,
  IPageRequest,
  IRnsHandler,
  IWrappedEncodeObject,
} from '@/interfaces'
import type { TAddressPrefix } from '@/types'

export class RnsHandler implements IRnsHandler {
  protected readonly jackalClient: IClientHandler
  protected readonly signingClient: IJackalSigningStargateClient | null

  protected constructor(client: IClientHandler) {
    this.jackalClient = client
    this.signingClient = client.getSigningClient()
  }

  /**
   *
   * @param {IClientHandler} client
   * @returns {Promise<RnsHandler>}
   */
  static async init(client: IClientHandler): Promise<IRnsHandler> {
    return new RnsHandler(client)
  }

  /**
   * Find a specific RNS bid by name.
   * @param {string} name - RNS name to search for.
   * @returns {Promise<DBid>}
   */
  async getBidForSingleName(name: string): Promise<DBid> {
    const result = await this.jackalClient
      .getQueries()
      .rns.bid({ name: this.sanitizeRns(name) })
      .catch((err) => {
        throw err
      })
    return result.bids
  }

  /**
   * List all outstanding bids on all names for all users.
   * @param {IPageRequest} [pagination] - Optional values to fetch more than first 100 results.
   * @returns {Promise<TQueryAllBidsResponseStrict>}
   */
  async getBidsForAllNames(
    pagination?: IPageRequest,
  ): Promise<TQueryAllBidsResponseStrict> {
    return await this.jackalClient
      .getQueries()
      .rns.allBids({ pagination })
      .catch((err) => {
        throw err
      })
  }

  /**
   * Get RNS market details for a single listed name.
   * @param {string} name - RNS name to find.
   * @returns {Promise<DForsale>}
   */
  async getNameForSale(name: string): Promise<DForsale> {
    const result = await this.jackalClient
      .getQueries()
      .rns.forSale({ name: this.sanitizeRns(name) })
      .catch((err) => {
        throw err
      })
    return result.forSale
  }

  /**
   * Finds all RNS names listed on market.
   * @param {IPageRequest} [pagination] - Optional values to fetch more than first 100 results.
   * @returns {Promise<TQueryAllForSaleResponseStrict>}
   */
  async getAllNamesForSale(
    pagination?: IPageRequest,
  ): Promise<TQueryAllForSaleResponseStrict> {
    return await this.jackalClient
      .getQueries()
      .rns.allForSale({ pagination })
      .catch((err) => {
        throw err
      })
  }

  /**
   * Finds all currently registered RNS names.
   * @param {IPageRequest} [pagination] - Optional values to fetch more than first 100 results.
   * @returns {Promise<TQueryAllNamesResponseStrict>}
   */
  async getAllNames(
    pagination?: IPageRequest,
  ): Promise<TQueryAllNamesResponseStrict> {
    return await this.jackalClient
      .getQueries()
      .rns.allNames({ pagination })
      .catch((err) => {
        throw err
      })
  }

  /**
   *
   * @param {IPageRequest} [pagination]
   * @returns {Promise<TQueryListOwnedNamesResponseStrict>}
   */
  async getAllMyNames(
    pagination?: IPageRequest,
  ): Promise<TQueryListOwnedNamesResponseStrict> {
    return await this.getAllNamesInWallet(
      this.jackalClient.getJackalAddress(),
      pagination,
    ).catch((err) => {
      throw err
    })
  }

  /**
   *
   * @param {string} address
   * @param {IPageRequest} [pagination]
   * @returns {Promise<TQueryListOwnedNamesResponseStrict>}
   */
  async getAllNamesInWallet(
    address: string,
    pagination?: IPageRequest,
  ): Promise<TQueryListOwnedNamesResponseStrict> {
    return await this.jackalClient
      .getQueries()
      .rns.listOwnedNames({ address, pagination })
      .catch((err) => {
        throw err
      })
  }

  /**
   *
   * @param {string} name
   * @returns {Promise<DName>}
   */
  async getNameDetails(name: string): Promise<DName> {
    const result = await this.jackalClient
      .getQueries()
      .rns.name({ name: this.sanitizeRns(name) })
      .catch((err) => {
        throw err
      })
    return result.name
  }

  async rnsToAddress(name: string, prefix?: TAddressPrefix): Promise<string> {
    const details = await this.getNameDetails(name)
    if (prefix) {
      return bech32.swapPrefixAsync(prefix, details.value).catch((err) => {
        throw err
      })
    } else {
      return details.value
    }
  }

  /**
   * Create Msg for submitting an offer on another user's RNS.
   * @param {string} rns - RNS to submit offer on.
   * @param {DCoin} bid - Value of offer as DCoin instance.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeBidMsg(rns: string, bid: DCoin): DEncodeObject {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'makeBidMsg'))
    }
    return this.signingClient.txLibrary.rns.msgBid({
      creator: this.jackalClient.getJackalAddress(),
      name: this.sanitizeRns(rns),
      bid,
    })
  }

  /**
   * Submit an offer on another user's RNS.
   * @param {string} rns - RNS to submit offer on.
   * @param {DCoin} bid - Value of offer as DCoin instance.
   * @returns {Promise<DDeliverTxResponse>}
   */
  async bid(rns: string, bid: DCoin): Promise<DDeliverTxResponse> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'bid'))
    }
    const wrapped: IWrappedEncodeObject = {
      encodedObject: this.makeBidMsg(rns, bid),
      modifier: 0,
    }
    return await this.jackalClient.broadcastsMsgs(wrapped).catch((err) => {
      throw err
    })
  }

  /**
   * Create Msg for accepting a bid on the user's RNS.
   * @param {string} rns -  The RNS to accept the bid for.
   * @param {string} from - The Jackal address to accept the bid from.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeAcceptBidMsg(rns: string, from: string): DEncodeObject {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'makeAcceptBidMsg'))
    }
    return this.signingClient.txLibrary.rns.msgAcceptBid({
      creator: this.jackalClient.getJackalAddress(),
      name: this.sanitizeRns(rns),
      from,
    })
  }

  /**
   * Accept a bid on the user's RNS.
   * @param {string} rns -  The RNS to accept the bid for.
   * @param {string} from - The Jackal address to accept the bid from.
   * @returns {Promise<DDeliverTxResponse>}
   */
  async acceptBid(rns: string, from: string): Promise<DDeliverTxResponse> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'acceptBid'))
    }
    const wrapped: IWrappedEncodeObject = {
      encodedObject: this.makeAcceptBidMsg(rns, from),
      modifier: 0,
    }
    return await this.jackalClient.broadcastsMsgs(wrapped).catch((err) => {
      throw err
    })
  }

  /**
   * Create Msg to retract offer on another user's RNS.
   * @param {string} rns - RNS to retract offer from.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeCancelBidMsg(rns: string): DEncodeObject {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'makeCancelBidMsg'))
    }
    return this.signingClient.txLibrary.rns.msgCancelBid({
      creator: this.jackalClient.getJackalAddress(),
      name: this.sanitizeRns(rns),
    })
  }

  /**
   * Retract offer on another user's RNS.
   * @param {string} rns - RNS to retract offer from.
   * @returns {Promise<DDeliverTxResponse>}
   */
  async cancelBid(rns: string): Promise<DDeliverTxResponse> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'cancelBid'))
    }
    const wrapped: IWrappedEncodeObject = {
      encodedObject: this.makeCancelBidMsg(rns),
      modifier: 0,
    }
    return await this.jackalClient.broadcastsMsgs(wrapped).catch((err) => {
      throw err
    })
  }

  /**
   * Create Msg to add user's RNS to the market.
   * @param {string} rns - RNS to list on market.
   * @param {DCoin} price - Value to buy as DCoin instance.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeListMsg(rns: string, price: DCoin): DEncodeObject {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'makeListMsg'))
    }
    return this.signingClient.txLibrary.rns.msgList({
      creator: this.jackalClient.getJackalAddress(),
      name: this.sanitizeRns(rns),
      price,
    })
  }

  /**
   * Add user's RNS to the market.
   * @param {string} rns - RNS to list on market.
   * @param {DCoin} price - Value to buy as DCoin instance.
   * @returns {Promise<DDeliverTxResponse>}
   */
  async list(rns: string, price: DCoin): Promise<DDeliverTxResponse> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'list'))
    }
    const wrapped: IWrappedEncodeObject = {
      encodedObject: this.makeListMsg(rns, price),
      modifier: 0,
    }
    return await this.jackalClient.broadcastsMsgs(wrapped).catch((err) => {
      throw err
    })
  }

  /**
   * Create Msg to remove user's RNS from the market.
   * @param {string} rns - RNS to remove.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeDelistMsg(rns: string): DEncodeObject {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'makeDelistMsg'))
    }
    return this.signingClient.txLibrary.rns.msgDelist({
      creator: this.jackalClient.getJackalAddress(),
      name: this.sanitizeRns(rns),
    })
  }

  /**
   * Remove user's RNS from the market.
   * @param {string} rns - RNS to remove.
   * @returns {Promise<DDeliverTxResponse>}
   */
  async delist(rns: string): Promise<DDeliverTxResponse> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'delist'))
    }
    const wrapped: IWrappedEncodeObject = {
      encodedObject: this.makeDelistMsg(rns),
      modifier: 0,
    }
    return await this.jackalClient.broadcastsMsgs(wrapped).catch((err) => {
      throw err
    })
  }

  /**
   * Create Msg for purchasing RNS listed on market.
   * @param {string} rns - RNS to purchase.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeBuyMsg(rns: string): DEncodeObject {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'makeBuyMsg'))
    }
    return this.signingClient.txLibrary.rns.msgBuy({
      creator: this.jackalClient.getJackalAddress(),
      name: this.sanitizeRns(rns),
    })
  }

  /**
   * Purchase RNS listed on market.
   * @param {string} rns
   * @returns {Promise<DDeliverTxResponse>}
   */
  async buy(rns: string): Promise<DDeliverTxResponse> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'buy'))
    }
    const wrapped: IWrappedEncodeObject = {
      encodedObject: this.makeBuyMsg(rns),
      modifier: 0,
    }
    return await this.jackalClient.broadcastsMsgs(wrapped).catch((err) => {
      throw err
    })
  }

  /**
   * Create Msg to activate user in the RNS system and to generate free account RNS.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeInitMsg(): DEncodeObject {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'makeInitMsg'))
    }
    return this.signingClient.txLibrary.rns.msgInit({
      creator: this.jackalClient.getJackalAddress(),
    })
  }

  /**
   * Activate user in the RNS system and to generate free account RNS.
   * @returns {Promise<DDeliverTxResponse>}
   */
  async init(): Promise<DDeliverTxResponse> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'init'))
    }
    const wrapped: IWrappedEncodeObject = {
      encodedObject: this.makeInitMsg(),
      modifier: 0,
    }
    return await this.jackalClient.broadcastsMsgs(wrapped).catch((err) => {
      throw err
    })
  }

  /**
   * Create Msg to register new RNS.
   * @param {string} rns - RNS address to register.
   * @param {number} yearsToRegister - Duration to register for in years.
   * @param {IRnsData} [data] - Optional object to include in data field.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeRegisterMsg(
    rns: string,
    yearsToRegister: number,
    data?: IRnsData,
  ): DEncodeObject {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'makeRegisterMsg'))
    }
    return this.signingClient.txLibrary.rns.msgRegister({
      creator: this.jackalClient.getJackalAddress(),
      name: this.sanitizeRns(rns),
      years: Number(yearsToRegister) || 1,
      data: this.standardizeDataContents(data),
    })
  }

  /**
   * Register new RNS.
   * @param {string} rns - RNS address to register.
   * @param {number} yearsToRegister - Duration to register for in years.
   * @param {IRnsData} [data] - Optional object to include in data field.
   * @returns {Promise<DDeliverTxResponse>}
   */
  async register(
    rns: string,
    yearsToRegister: number,
    data?: IRnsData,
  ): Promise<DDeliverTxResponse> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'register'))
    }
    const wrapped: IWrappedEncodeObject = {
      encodedObject: this.makeRegisterMsg(rns, yearsToRegister, data),
      modifier: 0,
    }
    return await this.jackalClient.broadcastsMsgs(wrapped).catch((err) => {
      throw err
    })
  }

  /**
   * Create Msg to update RNS metadata.
   * @param {string} rns - RNS address to update.
   * @param {IRnsData} [data] - Optional object to replace existing contents of data field.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeUpdateMsg(rns: string, data?: IRnsData): DEncodeObject {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'makeUpdateMsg'))
    }
    return this.signingClient.txLibrary.rns.msgUpdate({
      creator: this.jackalClient.getJackalAddress(),
      name: this.sanitizeRns(rns),
      data: this.standardizeDataContents(data),
    })
  }

  /**
   * Update RNS metadata.
   * @param {string} rns - RNS address to update.
   * @param {IRnsData} [data] - Optional object to replace existing contents of data field.
   * @returns {Promise<DDeliverTxResponse>}
   */
  async update(rns: string, data?: IRnsData): Promise<DDeliverTxResponse> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'update'))
    }
    const wrapped: IWrappedEncodeObject = {
      encodedObject: this.makeUpdateMsg(rns, data),
      modifier: 0,
    }
    return await this.jackalClient.broadcastsMsgs(wrapped).catch((err) => {
      throw err
    })
  }

  /**
   * Create Msg to transfer user's RNS to another user.
   * @param {string} rns - RNS to transfer.
   * @param {string} receiver - Jackal address to transfer to.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeTransferMsg(rns: string, receiver: string): DEncodeObject {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'makeTransferMsg'))
    }
    return this.signingClient.txLibrary.rns.msgTransfer({
      creator: this.jackalClient.getJackalAddress(),
      name: this.sanitizeRns(rns),
      receiver,
    })
  }

  /**
   * Transfer user's RNS to another user.
   * @param {string} rns - RNS to transfer.
   * @param {string} receiver - Jackal address to transfer to.
   * @returns {Promise<DDeliverTxResponse>}
   */
  async transfer(rns: string, receiver: string): Promise<DDeliverTxResponse> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'transfer'))
    }
    const wrapped: IWrappedEncodeObject = {
      encodedObject: this.makeTransferMsg(rns, receiver),
      modifier: 0,
    }
    return await this.jackalClient.broadcastsMsgs(wrapped).catch((err) => {
      throw err
    })
  }

  /**
   * Create Msg for adding a subdomain entry to an RNS.
   * @param {string} rns - RNS to transfer.
   * @param {string} linkedWallet - Jackal address to link new sub RNS to.
   * @param {string} subRns - Sub RNS to create.
   * @param {IRnsData} [data] - Optional object to include in sub RNS data field.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeAddRecordMsg(
    rns: string,
    linkedWallet: string,
    subRns: string,
    data?: IRnsData,
  ): DEncodeObject {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'makeAddRecordMsg'))
    }
    return this.signingClient.txLibrary.rns.msgAddRecord({
      creator: this.jackalClient.getJackalAddress(),
      name: this.sanitizeRns(rns),
      value: linkedWallet,
      data: this.standardizeDataContents(data),
      record: subRns,
    })
  }

  /**
   * Add a subdomain entry to an RNS.
   * @param {string} rns - RNS to transfer.
   * @param {string} linkedWallet - Jackal address to link new sub RNS to.
   * @param {string} subRns - Sub RNS to create.
   * @param {IRnsData} [data] - Optional object to include in sub RNS data field.
   * @returns {Promise<DDeliverTxResponse>}
   */
  async addSubRns(
    rns: string,
    linkedWallet: string,
    subRns: string,
    data?: IRnsData,
  ): Promise<DDeliverTxResponse> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'addSubRns'))
    }
    const wrapped: IWrappedEncodeObject = {
      encodedObject: this.makeAddRecordMsg(rns, linkedWallet, subRns, data),
      modifier: 0,
    }
    return await this.jackalClient.broadcastsMsgs(wrapped).catch((err) => {
      throw err
    })
  }

  /**
   * Create Msg to delete an RNS subdomain entry.
   * @param {string} rns - Full RNS to remove.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeDelRecordMsg(rns: string): DEncodeObject {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'makeDelRecordMsg'))
    }
    return this.signingClient.txLibrary.rns.msgDelRecord({
      creator: this.jackalClient.getJackalAddress(),
      name: this.sanitizeRns(rns),
    })
  }

  /**
   * Delete an RNS subdomain entry.
   * @param {string} rns - Full RNS to remove.
   * @returns {Promise<DDeliverTxResponse>}
   */
  async removeSubRns(rns: string): Promise<DDeliverTxResponse> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'removeSubRns'))
    }
    const wrapped: IWrappedEncodeObject = {
      encodedObject: this.makeDelRecordMsg(rns),
      modifier: 0,
    }
    return await this.jackalClient.broadcastsMsgs(wrapped).catch((err) => {
      throw err
    })
  }

  /**
   * Ensures RNS address ends with ".jkl".
   * @param {string} name - RNS address to process.
   * @returns {string} - Source RNS address with ".jkl" included.
   * @protected
   */
  protected sanitizeRns(name: string): string {
    return name.endsWith('.jkl') ? name : `${name}.jkl`
  }

  /**
   * Enforces data field is valid JSON with fallback of '{}'. Used by:
   * - makeRegisterMsg()
   * - makeUpdateMsg()
   * - makeAddRecordMsg()
   * @param {IRnsData} [data]
   * @returns {string}
   * @protected
   */
  protected standardizeDataContents(data: IRnsData = {}): string {
    try {
      return JSON.stringify(data)
    } catch (err) {
      console.error('standardizeDataContents() failed')
      console.log('data')
      console.log(data)
      console.error(err)
      return '{}'
    }
  }
}
