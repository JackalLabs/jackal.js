import pkg from '@jackallabs/bech32'
const {bech32} = pkg;
import { signerNotEnabled, warnError } from '@/utils/misc'
import type {
  DBid,
  DCoin,
  DEncodeObject,
  DForsale,
  DName,
  TJackalSigningClient,
  TQueryAllBidsResponseStrict,
  TQueryAllForSaleResponseStrict,
  TQueryAllNamesResponseStrict,
  TQueryListOwnedNamesResponseStrict,
} from '@jackallabs/jackal.js-protos'
import {
  IAcceptBidOptions,
  IAddSubRnsOptions,
  IBidOptions,
  IBroadcastOrChainOptions,
  IBuyOptions,
  ICancelBidOptions,
  IClientHandler,
  IDelistOptions,
  IListOptions,
  IPageRequest,
  IRegisterOptions,
  IRemoveSubRnsOptions,
  IRnsHandler,
  IRnsMetaData,
  ISetNewPrimaryOptions,
  ITransferOptions,
  IUpdateOptions,
  IWrappedEncodeObject,
} from '@/interfaces'
import { INameWithMeta, TAddressPrefix } from '@/types'
import { RnsMetaHandler } from '@/classes/metaHandlers'

export class RnsHandler implements IRnsHandler {
  protected readonly jackalClient: IClientHandler
  protected readonly signingClient: TJackalSigningClient | null

  protected constructor (client: IClientHandler) {
    this.jackalClient = client
    this.signingClient = client.getJackalSigner()
  }

  /**
   * Initialize RNS handler.
   * @param {IClientHandler} client - Instance of ClientHandler.
   * @returns {Promise<RnsHandler>} - Instance of RnsHandler.
   */
  static async init (client: IClientHandler): Promise<IRnsHandler> {
    return new RnsHandler(client)
  }

  /**
   * Find a specific RNS bid by name.
   * @param {string} name - RNS name to search for.
   * @returns {Promise<DBid>}
   */
  async getBidForSingleName (name: string): Promise<DBid> {
    try {
      const result = await this.jackalClient
        .getQueries()
        .rns.bid({ name: this.sanitizeRns(name) })
      return result.bids
    } catch (err) {
      throw warnError('rnsHandler getBidForSingleName()', err)
    }
  }

  /**
   * List all outstanding bids on all names for all users.
   * @param {IPageRequest} [pagination] - Optional values to fetch more than first 100 results.
   * @returns {Promise<TQueryAllBidsResponseStrict>}
   */
  async getBidsForAllNames (
    pagination?: IPageRequest,
  ): Promise<TQueryAllBidsResponseStrict> {
    try {
      return await this.jackalClient.getQueries().rns.allBids({ pagination })
    } catch (err) {
      throw warnError('rnsHandler getBidsForAllNames()', err)
    }
  }

  /**
   * Get RNS market details for a single listed name.
   * @param {string} name - RNS name to find.
   * @returns {Promise<DForsale>}
   */
  async getNameForSale (name: string): Promise<DForsale> {
    try {
      const result = await this.jackalClient
        .getQueries()
        .rns.forSale({ name: this.sanitizeRns(name) })
      return result.forSale
    } catch (err) {
      throw warnError('rnsHandler getNameForSale()', err)
    }
  }

  /**
   * Finds all RNS names listed on market.
   * @param {IPageRequest} [pagination] - Optional values to fetch more than first 100 results.
   * @returns {Promise<TQueryAllForSaleResponseStrict>}
   */
  async getAllNamesForSale (
    pagination?: IPageRequest,
  ): Promise<TQueryAllForSaleResponseStrict> {
    try {
      return await this.jackalClient.getQueries().rns.allForSale({ pagination })
    } catch (err) {
      throw warnError('rnsHandler getAllNamesForSale()', err)
    }
  }

  /**
   * Finds all currently registered RNS names.
   * @param {IPageRequest} [pagination] - Optional values to fetch more than first 100 results.
   * @returns {Promise<TQueryAllNamesResponseStrict>} - Pagination and array of DName.
   */
  async getAllNames (
    pagination?: IPageRequest,
  ): Promise<TQueryAllNamesResponseStrict> {
    try {
      return await this.jackalClient.getQueries().rns.allNames({ pagination })
    } catch (err) {
      throw warnError('rnsHandler getAllNames()', err)
    }
  }

  /**
   * Get all RNS names registered to user.
   * @param {IPageRequest} [pagination] - Optional values to fetch more than first 100 results.
   * @returns {Promise<TQueryListOwnedNamesResponseStrict>} - Pagination and array of DName.
   */
  async getAllMyNames (
    pagination?: IPageRequest,
  ): Promise<TQueryListOwnedNamesResponseStrict> {
    try {
      return await this.getAllNamesInWallet(
        this.jackalClient.getJackalAddress(),
        pagination,
      )
    } catch (err) {
      throw warnError('rnsHandler getAllMyNames()', err)
    }
  }

  /**
   * Get all RNS names registered to target address.
   * @param {string} address - Jackal address to check.
   * @param {IPageRequest} [pagination] - Optional values to fetch more than first 100 results.
   * @returns {Promise<TQueryListOwnedNamesResponseStrict>} - Pagination and array of DName.
   */
  async getAllNamesInWallet (
    address: string,
    pagination?: IPageRequest,
  ): Promise<TQueryListOwnedNamesResponseStrict> {
    try {
      return await this.jackalClient
        .getQueries()
        .rns.listOwnedNames({ address, pagination })
    } catch (err) {
      throw warnError('rnsHandler getAllNamesInWallet()', err)
    }
  }

  /**
   * Get specifics on target RNS name.
   * @param {string} name - RNS name to check.
   * @returns {Promise<DName>}
   */
  async getNameDetails (name: string): Promise<DName> {
    try {
      const result = await this.jackalClient
        .getQueries()
        .rns.name({ name: this.sanitizeRns(name) })
      return result.name
    } catch (err) {
      throw warnError('rnsHandler getNameDetails()', err)
    }
  }

  /**
   * Get specifics on target RNS name with parsed meta data.
   * @param {string} name - RNS name to check.
   * @returns {Promise<INameWithMeta>}
   */
  async getNameMetaDetails (name: string): Promise<INameWithMeta> {
    try {
      const result = await this.jackalClient
        .getQueries()
        .rns.name({ name: this.sanitizeRns(name) })
      const subdomains = []
      for (let one of result.name.subdomains) {
        const meta = await RnsMetaHandler.create({ clone: one.data })
        const loop: INameWithMeta = {
          ...result.name,
          data: meta.export(),
          subdomains: [],
        }
        subdomains.push(loop)
      }
      const meta = await RnsMetaHandler.create({ clone: result.name.data })
      const final: INameWithMeta = {
        ...result.name,
        data: meta.export(),
        subdomains,
      }
      return final
    } catch (err) {
      throw warnError('rnsHandler getNameDetails()', err)
    }
  }

  /**
   * Find primary RNS for target wallet address. Defaults to own jkl address.
   * @param {string} address - Jackal Bech32 address to check.
   * @returns {Promise<DName>}
   */
  async getPrimaryName (address?: string): Promise<DName> {
    try {
      const owner = address || this.jackalClient.getJackalAddress()
      const result = await this.jackalClient
        .getQueries()
        .rns.primaryName({ owner })
      return result.name
    } catch (err) {
      throw warnError('rnsHandler getPrimaryName()', err)
    }
  }

  /**
   *
   * @param {string} name
   * @returns {Promise<string>}
   */
  async possibleRnsToJklAddress (name: string): Promise<string> {
    try {
      if (bech32.checkIfValid(name)) {
        return name
      } else {
        return await this.rnsToAddress(name)
      }
    } catch (err) {
      throw warnError('rnsHandler possibleRnsToJklAddress()', err)
    }
  }

  /**
   * Convert RNS address to wallet address.
   * @param {string} name - RNS name to convert.
   * @param {TAddressPrefix} prefix - Optional wallet prefix, defaults to jkl.
   * @returns {Promise<string>} - Wallet address of RNS owner.
   */
  async rnsToAddress (name: string, prefix?: TAddressPrefix): Promise<string> {
    try {
      const details = await this.getNameDetails(name)
      if (prefix) {
        return bech32.swapPrefixAsync(prefix, details.value)
      } else {
        return details.value
      }
    } catch (err) {
      throw warnError('rnsHandler rnsToAddress()', err)
    }
  }

  /**
   * Submit an offer on another user's RNS.
   * @param {IBidOptions} options
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async bid (options: IBidOptions): Promise<IWrappedEncodeObject[]> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'bid'))
    }
    try {
      const msgs: IWrappedEncodeObject[] = [{
        encodedObject: this.makeBidMsg(options.rns, options.bid),
        modifier: 0,
      }]
      if (options?.chain) {
        return msgs
      } else {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
        console.log('bid:', postBroadcast)
        return []
      }
    } catch (err) {
      throw warnError('rnsHandler bid()', err)
    }
  }

  /**
   * Accept a bid on the user's RNS.
   * @param {IAcceptBidOptions} options
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async acceptBid (options: IAcceptBidOptions): Promise<IWrappedEncodeObject[]> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'acceptBid'))
    }
    try {
      const msgs: IWrappedEncodeObject[] = [{
        encodedObject: this.makeAcceptBidMsg(options.rns, options.from),
        modifier: 0,
      }]
      if (options?.chain) {
        return msgs
      } else {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
        console.log('acceptBid:', postBroadcast)
        return []
      }
    } catch (err) {
      throw warnError('rnsHandler acceptBid()', err)
    }
  }

  /**
   * Retract offer on another user's RNS.
   * @param {ICancelBidOptions} options
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async cancelBid (options: ICancelBidOptions): Promise<IWrappedEncodeObject[]> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'cancelBid'))
    }
    try {
      const msgs: IWrappedEncodeObject[] = [{
        encodedObject: this.makeCancelBidMsg(options.rns),
        modifier: 0,
      }]
      if (options?.chain) {
        return msgs
      } else {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
        console.log('cancelBid:', postBroadcast)
        return []
      }
    } catch (err) {
      throw warnError('rnsHandler cancelBid()', err)
    }
  }

  /**
   * Add user's RNS to the market.
   * @param {IListOptions} options
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async list (options: IListOptions): Promise<IWrappedEncodeObject[]> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'list'))
    }
    try {
      const msgs: IWrappedEncodeObject[] = [{
        encodedObject: this.makeListMsg(options.rns, options.price),
        modifier: 0,
      }]
      if (options?.chain) {
        return msgs
      } else {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
        console.log('list:', postBroadcast)
        return []
      }
    } catch (err) {
      throw warnError('rnsHandler list()', err)
    }
  }

  /**
   * Remove user's RNS from the market.
   * @param {IDelistOptions} options
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async delist (options: IDelistOptions): Promise<IWrappedEncodeObject[]> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'delist'))
    }
    try {
      const msgs: IWrappedEncodeObject[] = [{
        encodedObject: this.makeDelistMsg(options.rns),
        modifier: 0,
      }]
      if (options?.chain) {
        return msgs
      } else {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
        console.log('delist:', postBroadcast)
        return []
      }
    } catch (err) {
      throw warnError('rnsHandler delist()', err)
    }
  }

  /**
   * Purchase RNS listed on market.
   * @param {IBuyOptions} options
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async buy (options: IBuyOptions): Promise<IWrappedEncodeObject[]> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'buy'))
    }
    try {
      const msgs: IWrappedEncodeObject[] = [{
        encodedObject: this.makeBuyMsg(options.rns),
        modifier: 0,
      }]
      if (options?.chain) {
        return msgs
      } else {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
        console.log('buy:', postBroadcast)
        return []
      }
    } catch (err) {
      throw warnError('rnsHandler buy()', err)
    }
  }

  /**
   * Activate user in the RNS system and to generate free account RNS.
   * @param {IBroadcastOrChainOptions} [options]
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async activate (options?: IBroadcastOrChainOptions): Promise<IWrappedEncodeObject[]> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'activate'))
    }
    try {
      const msgs: IWrappedEncodeObject[] = [{
        encodedObject: this.makeInitMsg(),
        modifier: 0,
      }]
      if (options?.chain) {
        return msgs
      } else {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
        console.log('activate:', postBroadcast)
        return []
      }
    } catch (err) {
      throw warnError('rnsHandler activate()', err)
    }
  }

  /**
   * Register new RNS.
   * @param {IRegisterOptions} options
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async register (options: IRegisterOptions): Promise<IWrappedEncodeObject[]> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'register'))
    }
    try {
      const meta = await RnsMetaHandler.create(options.data)
      const msgs: IWrappedEncodeObject[] = [{
        encodedObject: this.makeRegisterMsg(options.rns, !!options.setAsPrimary, options.yearsToRegister, meta.export()),
        modifier: 0,
      }]
      if (options?.chain) {
        return msgs
      } else {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
        console.log('register:', postBroadcast)
        return []
      }
    } catch (err) {
      throw warnError('rnsHandler register()', err)
    }
  }

  /**
   * Update RNS metadata.
   * @param {IUpdateOptions} options
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async update (options: IUpdateOptions): Promise<IWrappedEncodeObject[]> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'update'))
    }
    try {
      const meta = await RnsMetaHandler.create(options.data)
      const msgs: IWrappedEncodeObject[] = [{
        encodedObject: this.makeUpdateMsg(options.rns, meta.export()),
        modifier: 0,
      }]
      if (options?.chain) {
        return msgs
      } else {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
        console.log('update:', postBroadcast)
        return []
      }
    } catch (err) {
      throw warnError('rnsHandler update()', err)
    }
  }

  /**
   * Transfer user's RNS to another user.
   * @param {ITransferOptions} options
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async transfer (options: ITransferOptions): Promise<IWrappedEncodeObject[]> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'transfer'))
    }
    try {
      const msgs: IWrappedEncodeObject[] = [{
        encodedObject: this.makeTransferMsg(options.rns, options.receiver),
        modifier: 0,
      }]
      if (options?.chain) {
        return msgs
      } else {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
        console.log('transfer:', postBroadcast)
        return []
      }
    } catch (err) {
      throw warnError('rnsHandler transfer()', err)
    }
  }

  /**
   * Add a subdomain entry to an RNS.
   * @param {IAddSubRnsOptions} options
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async addSubRns (options: IAddSubRnsOptions): Promise<IWrappedEncodeObject[]> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'addSubRns'))
    }
    try {
      const meta = await RnsMetaHandler.create(options.data)
      const msgs: IWrappedEncodeObject[] = [{
        encodedObject: this.makeAddRecordMsg(options.rns, options.linkedWallet, options.subRns, meta.export()),
        modifier: 0,
      }]
      if (options?.chain) {
        return msgs
      } else {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
        console.log('addSubRns:', postBroadcast)
        return []
      }
    } catch (err) {
      throw warnError('rnsHandler addSubRns()', err)
    }
  }

  /**
   * Delete an RNS subdomain entry.
   * @param {IRemoveSubRnsOptions} options
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async removeSubRns (options: IRemoveSubRnsOptions): Promise<IWrappedEncodeObject[]> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'removeSubRns'))
    }
    try {
      const msgs: IWrappedEncodeObject[] = [{
        encodedObject: this.makeDelRecordMsg(options.rns),
        modifier: 0,
      }]
      if (options?.chain) {
        return msgs
      } else {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
        console.log('removeSubRns:', postBroadcast)
        return []
      }
    } catch (err) {
      throw warnError('rnsHandler removeSubRns()', err)
    }
  }

  /**
   * Set new primary RNS for wallet.
   * @param {ISetNewPrimaryOptions} options
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async setNewPrimary (options: ISetNewPrimaryOptions): Promise<IWrappedEncodeObject[]> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'setNewPrimary'))
    }
    try {
      const msgs: IWrappedEncodeObject[] = [{
        encodedObject: this.makeMakePrimaryMsg(options.rns),
        modifier: 0,
      }]
      if (options?.chain) {
        return msgs
      } else {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
        console.log('setNewPrimary:', postBroadcast)
        return []
      }
    } catch (err) {
      throw warnError('rnsHandler setNewPrimary()', err)
    }
  }

  /**
   * Create Msg for submitting an offer on another user's RNS.
   * @param {string} rns - RNS to submit offer on.
   * @param {DCoin} bid - Value of offer as DCoin instance.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeBidMsg (rns: string, bid: DCoin): DEncodeObject {
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
   * Create Msg for accepting a bid on the user's RNS.
   * @param {string} rns -  The RNS to accept the bid for.
   * @param {string} from - The Jackal address to accept the bid from.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeAcceptBidMsg (rns: string, from: string): DEncodeObject {
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
   * Create Msg to retract offer on another user's RNS.
   * @param {string} rns - RNS to retract offer from.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeCancelBidMsg (rns: string): DEncodeObject {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'makeCancelBidMsg'))
    }
    return this.signingClient.txLibrary.rns.msgCancelBid({
      creator: this.jackalClient.getJackalAddress(),
      name: this.sanitizeRns(rns),
    })
  }

  /**
   * Create Msg to add user's RNS to the market.
   * @param {string} rns - RNS to list on market.
   * @param {DCoin} price - Value to buy as DCoin instance.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeListMsg (rns: string, price: DCoin): DEncodeObject {
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
   * Create Msg to remove user's RNS from the market.
   * @param {string} rns - RNS to remove.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeDelistMsg (rns: string): DEncodeObject {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'makeDelistMsg'))
    }
    return this.signingClient.txLibrary.rns.msgDelist({
      creator: this.jackalClient.getJackalAddress(),
      name: this.sanitizeRns(rns),
    })
  }

  /**
   * Create Msg for purchasing RNS listed on market.
   * @param {string} rns - RNS to purchase.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeBuyMsg (rns: string): DEncodeObject {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'makeBuyMsg'))
    }
    return this.signingClient.txLibrary.rns.msgBuy({
      creator: this.jackalClient.getJackalAddress(),
      name: this.sanitizeRns(rns),
    })
  }

  /**
   * Create Msg to activate user in the RNS system and to generate free account RNS.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeInitMsg (): DEncodeObject {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'makeInitMsg'))
    }
    return this.signingClient.txLibrary.rns.msgInit({
      creator: this.jackalClient.getJackalAddress(),
    })
  }

  /**
   * Create Msg to register new RNS.
   * @param {string} rns - RNS address to register.
   * @param {boolean} primary - If RNS should be set as primary.
   * @param {number} yearsToRegister - Duration to register for in years.
   * @param {IRnsMetaData} data - Metadata object to include in data field.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeRegisterMsg (
    rns: string,
    primary: boolean,
    yearsToRegister: number,
    data: IRnsMetaData,
  ): DEncodeObject {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'makeRegisterMsg'))
    }
    try {
      return this.signingClient.txLibrary.rns.msgRegisterName({
        creator: this.jackalClient.getJackalAddress(),
        name: this.sanitizeRns(rns),
        years: Number(yearsToRegister) || 1,
        data: this.standardizeDataContents(data),
        setPrimary: primary,
      })
    } catch (err) {
      throw warnError('rnsHandler makeRegisterMsg()', err)
    }
  }

  /**
   * Create Msg to update RNS metadata.
   * @param {string} rns - RNS address to update.
   * @param {IRnsMetaData} data - Optional object to replace existing contents of data field.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeUpdateMsg (rns: string, data: IRnsMetaData): DEncodeObject {
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
   * Create Msg to transfer user's RNS to another user.
   * @param {string} rns - RNS to transfer.
   * @param {string} receiver - Jackal address to transfer to.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeTransferMsg (rns: string, receiver: string): DEncodeObject {
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
   * Create Msg for adding a subdomain entry to an RNS.
   * @param {string} rns - RNS to transfer.
   * @param {string} linkedWallet - Jackal address to link new sub RNS to.
   * @param {string} subRns - Sub RNS to create.
   * @param {IRnsMetaData} data - Optional object to include in sub RNS data field.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeAddRecordMsg (
    rns: string,
    linkedWallet: string,
    subRns: string,
    data: IRnsMetaData,
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
   * Create Msg to delete an RNS subdomain entry.
   * @param {string} rns - Full RNS to remove.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeDelRecordMsg (rns: string): DEncodeObject {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'makeDelRecordMsg'))
    }
    return this.signingClient.txLibrary.rns.msgDelRecord({
      creator: this.jackalClient.getJackalAddress(),
      name: this.sanitizeRns(rns),
    })
  }

  /**
   * Create Msg to set new primary RNS.
   * @param {string} rns - RNS to make primary for wallet address.
   * @returns {DEncodeObject}
   * @protected
   */
  protected makeMakePrimaryMsg (rns: string): DEncodeObject {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('RnsHandler', 'makeMakePrimaryMsg'))
    }
    return this.signingClient.txLibrary.rns.msgMakePrimary({
      creator: this.jackalClient.getJackalAddress(),
      name: this.sanitizeRns(rns),
    })
  }

  /**
   * Ensures RNS address ends with ".jkl".
   * @param {string} name - RNS address to process.
   * @returns {string} - Source RNS address with ".jkl" included.
   * @protected
   */
  protected sanitizeRns (name: string): string {
    return name.endsWith('.jkl') ? name : `${name}.jkl`
  }

  /**
   * Enforces data field is valid JSON. Used by:
   * - makeRegisterMsg()
   * - makeUpdateMsg()
   * - makeAddRecordMsg()
   * @param {IRnsMetaData} data
   * @returns {string}
   * @protected
   */
  protected standardizeDataContents (data: IRnsMetaData): string {
    try {
      return JSON.stringify(data)
    } catch (err) {
      console.error('standardizeDataContents() failed')
      console.log('data')
      console.log(data)
      throw err
    }
  }
}
