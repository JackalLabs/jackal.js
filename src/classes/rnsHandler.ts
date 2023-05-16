import { EncodeObject } from '@cosmjs/proto-signing'
import { IQueryHandler, IRnsHandler, IWalletHandler } from '@/interfaces/classes'
import {
  IRnsBidHashMap,
  IRnsBidItem,
  IRnsExpandedForSaleHashMap,
  IRnsForSaleHashMap,
  IRnsForSaleItem,
  IRnsOwnedHashMap,
  IRnsOwnedItem,
  IRnsRecordItem,
  IRnsRegistrationItem
} from '@/interfaces'
import { handlePagination, signerNotEnabled } from '@/utils/misc'

/**
 * Class encompassing basic and advanced methods needed for interaction with RNS addresses on the chain.
 */
export default class RnsHandler implements IRnsHandler {
  private readonly walletRef: IWalletHandler
  private readonly qH: IQueryHandler

  /**
   * Create an RNS instance.
   * @param {IWalletHandler} wallet - Instance of WalletHandler from WalletHandler.trackWallet().
   * @private
   */
  private constructor (wallet: IWalletHandler) {
    this.walletRef = wallet
    this.qH = wallet.getQueryHandler()
  }

  /**
   * Async wrapper to create an RNS instance.
   * @param {IWalletHandler} wallet - Instance of WalletHandler from WalletHandler.trackWallet().
   * @returns {Promise<IRnsHandler>} - Instance of RnsHandler.
   */
  static async trackRns (wallet: IWalletHandler): Promise<IRnsHandler> {
    return new RnsHandler(wallet)
  }

  /**
   * Create Msg for accepting a bid on the user's RNS.
   * @param {string} rns -  The RNS to accept the bid for.
   * @param {string} from - The Jackal address to accept the bid from.
   * @returns {EncodeObject} - The Msg for processing by the chain.
   */
  makeAcceptBidMsg (rns: string, from: string): EncodeObject {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('RnsHandler', 'makeAcceptBidMsg'))
    const pH = this.walletRef.getProtoHandler()
    const trueRns = sanitizeRns(rns)
    return pH.rnsTx.msgAcceptBid({
      creator: this.walletRef.getJackalAddress(),
      name: trueRns,
      from
    })
  }

  /**
   * Create Msg for adding a subdomain entry on the user's RNS.
   * @param {IRnsRecordItem} recordValues - New subdomain's values.
   * @returns {EncodeObject} - The Msg for processing by the chain.
   */
  makeAddRecordMsg (recordValues: IRnsRecordItem): EncodeObject {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('RnsHandler', 'makeAddRecordMsg'))
    const pH = this.walletRef.getProtoHandler()
    const trueRns = sanitizeRns(recordValues.name)
    return pH.rnsTx.msgAddRecord({
      creator: this.walletRef.getJackalAddress(),
      name: trueRns,
      value: recordValues.value,
      data: sanitizeRnsData(recordValues.data, 'makeAddRecordMsg'),
      record: recordValues.record
    })
  }

  /**
   * Create Msg for submitting an offer on another user's RNS.
   * @param {string} rns - RNS to submit offer on.
   * @param {string} bid - Value of offer in ujkl. Example: "1000000ujkl" (1 $JKL).
   * @returns {EncodeObject} - The Msg for processing by the chain.
   */
  makeBidMsg (rns: string, bid: string): EncodeObject {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('RnsHandler', 'makeBidMsg'))
    const pH = this.walletRef.getProtoHandler()
    const trueRns = sanitizeRns(rns)
    return pH.rnsTx.msgBid({
      creator: this.walletRef.getJackalAddress(),
      name: trueRns,
      bid
    })
  }

  /**
   * Create Msg for purchasing RNS listed on market.
   * @param {string} rns - RNS to purchase.
   * @returns {EncodeObject} - The Msg for processing by the chain.
   */
  makeBuyMsg (rns: string): EncodeObject {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('RnsHandler', 'makeBuyMsg'))
    const pH = this.walletRef.getProtoHandler()
    const trueRns = sanitizeRns(rns)
    return pH.rnsTx.msgBuy({
      creator: this.walletRef.getJackalAddress(),
      name: trueRns
    })
  }

  /**
   * Create Msg to retract offer on another user's RNS.
   * @param {string} rns - RNS to retract offer from.
   * @returns {EncodeObject} - The Msg for processing by the chain.
   */
  makeCancelBidMsg (rns: string): EncodeObject {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('RnsHandler', 'makeCancelBidMsg'))
    const pH = this.walletRef.getProtoHandler()
    const trueRns = sanitizeRns(rns)
    return pH.rnsTx.msgCancelBid({
      creator: this.walletRef.getJackalAddress(),
      name: trueRns
    })
  }

  /**
   * Create Msg to remove user's RNS from the market.
   * @param {string} rns - RNS to remove.
   * @returns {EncodeObject} - The Msg for processing by the chain.
   */
  makeDelistMsg (rns: string): EncodeObject {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('RnsHandler', 'makeDelistMsg'))
    const pH = this.walletRef.getProtoHandler()
    const trueRns = sanitizeRns(rns)
    return pH.rnsTx.msgDelist({
      creator: this.walletRef.getJackalAddress(),
      name: trueRns
    })
  }

  /**
   * Create Msg to delete user's RNS.
   * @param {string} rns - RNS to delete.
   * @returns {EncodeObject} - The Msg for processing by the chain.
   */
  makeDelRecordMsg (rns: string): EncodeObject {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('RnsHandler', 'makeDelRecordMsg'))
    const pH = this.walletRef.getProtoHandler()
    const trueRns = sanitizeRns(rns)
    return pH.rnsTx.msgDelRecord({
      creator: this.walletRef.getJackalAddress(),
      name: trueRns
    })
  }

  /**
   * Create Msg to activate user in the RNS system and to generate free account RNS.
   * @returns {EncodeObject} - The Msg for processing by the chain.
   */
  makeRnsInitMsg (): EncodeObject {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('RnsHandler', 'makeRnsInitMsg'))
    const pH = this.walletRef.getProtoHandler()
    return pH.rnsTx.msgInit({
      creator: this.walletRef.getJackalAddress()
    })
  }

  /**
   * Create Msg to add user's RNS to the market.
   * @param {string} rns - RNS to list on market.
   * @param {string} price - Price of offer in ujkl. Example: "1000000ujkl" (1 $JKL).
   * @returns {EncodeObject} - The Msg for processing by the chain.
   */
  makeListMsg (rns: string, price: string): EncodeObject {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('RnsHandler', 'makeListMsg'))
    const pH = this.walletRef.getProtoHandler()
    const trueRns = sanitizeRns(rns)
    return pH.rnsTx.msgList({
      creator: this.walletRef.getJackalAddress(),
      name: trueRns,
      price
    })
  }

  /**
   * Create Msg to register new RNS.
   * @param {IRnsRegistrationItem} registrationValues - Bundle containing RNS name, duration in years, and JSON.stringified metadata.
   * @returns {EncodeObject} - The Msg for processing by the chain.
   */
  makeNewRegistrationMsg (registrationValues: IRnsRegistrationItem): EncodeObject {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('RnsHandler', 'makeNewRegistrationMsg'))
    const pH = this.walletRef.getProtoHandler()
    const trueRns = sanitizeRns(registrationValues.nameToRegister)
    return pH.rnsTx.msgRegister({
      creator: this.walletRef.getJackalAddress(),
      name: trueRns,
      years: (Number(registrationValues.yearsToRegister) || 1).toString(),
      data: sanitizeRnsData(registrationValues.data, 'makeNewRegistrationMsg')
    })
  }

  /**
   * Create Msg to transfer user's RNS to another user.
   * @param {string} rns - RNS to transfer.
   * @param {string} receiver - Jackal address to transfer to.
   * @returns {EncodeObject} - The Msg for processing by the chain.
   */
  makeTransferMsg (rns: string, receiver: string): EncodeObject {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('RnsHandler', 'makeTransferMsg'))
    const pH = this.walletRef.getProtoHandler()
    const trueRns = sanitizeRns(rns)
    return pH.rnsTx.msgTransfer({
      creator: this.walletRef.getJackalAddress(),
      name: trueRns,
      receiver
    })
  }

  /**
   * Create Msg to update RNS metadata.
   * @param {string} rns - User's RNS to update.
   * @param {string} data - JSON.stringified new metadata to replace existing data.
   * @returns {EncodeObject} - The Msg for processing by the chain.
   */
  makeUpdateMsg (rns: string, data: string): EncodeObject {
    if (!this.walletRef.traits) throw new Error(signerNotEnabled('RnsHandler', 'makeUpdateMsg'))
    const pH = this.walletRef.getProtoHandler()
    const trueRns = sanitizeRns(rns)
    return pH.rnsTx.msgUpdate({
      creator: this.walletRef.getJackalAddress(),
      name: trueRns,
      data: sanitizeRnsData(data, 'makeUpdateMsg')
    })
  }

  /**
   * Find a specific RNS bid by global index.
   * @param {string} index - Index to find.
   * @returns {Promise<IRnsBidItem>} - Bid if found, defaults to bid item with empty values if no match found.
   */
  async findSingleBid (index: string): Promise<IRnsBidItem> {
    const trueIndex = sanitizeRns(index)
    return (await this.qH.rnsQuery.queryBids({ index: trueIndex })).value
      .bids as IRnsBidItem
  }

  /**
   * List all outstanding bids for all users.
   * @returns {Promise<IRnsBidHashMap>} - Object map of bid arrays by RNS name.
   */
  async findAllBids (): Promise<IRnsBidHashMap> {
    const data: IRnsBidItem[] = (await handlePagination(
      this.qH.rnsQuery,
      'queryBidsAll',
      {}
    ))
      .reduce((acc: IRnsBidItem[], curr: any) => {
        acc.push(...curr.bids)
        return acc
      }, [])

    return data.reduce((acc: IRnsBidHashMap, curr: IRnsBidItem) => {
      if (!acc[curr.name]?.length) {
        acc[curr.name] = [curr]
      } else {
        acc[curr.name].push(curr)
      }
      return acc
    }, {})
  }

  /**
   * Get RNS market details for a single listed RNS.
   * @param {string} rns - RNS address to find.
   * @returns {Promise<IRnsForSaleItem>} - Listing if found, defaults to list item with empty values if no match found.
   */
  async findSingleForSaleName (rns: string): Promise<IRnsForSaleItem> {
    const trueRns = sanitizeRns(rns)
    return (await this.qH.rnsQuery.queryForsale({ name: trueRns })).value
      .forsale as IRnsForSaleItem
  }
  async findAllForSaleNames(): Promise<IRnsForSaleHashMap> {
    const data: IRnsForSaleItem[] = (
      await handlePagination(this.qH.rnsQuery, 'queryForsaleAll', {})
    ).reduce((acc: IRnsForSaleItem[], curr: any) => {
      acc.push(...curr.forsale)
      return acc
    }, [])

    return data.reduce((acc: IRnsForSaleHashMap, curr: IRnsForSaleItem) => {
      acc[curr.name] = curr
      return acc
    }, {})
  }

  /**
   * Finds all RNS listed on market and flags "mine" boolean if the user owns the RNS.
   * @returns {Promise<IRnsExpandedForSaleHashMap>} - Object map of list items by RNS name.
   */
  async findExpandedForSaleNames (): Promise<IRnsExpandedForSaleHashMap> {
    const rawOwned = await this.findExistingNames()

    const data: IRnsForSaleItem[] = (
      await handlePagination(this.qH.rnsQuery, 'queryForsaleAll', {})
    ).reduce((acc: IRnsForSaleItem[], curr: any) => {
      acc.push(...curr.forsale)
      return acc
    }, [])

    return data.reduce(
      (acc: IRnsExpandedForSaleHashMap, curr: IRnsForSaleItem) => {
        acc[curr.name] = {
          ...curr,
          mine: !!rawOwned[reverseSanitizeRns(curr.name)]
        }
        return acc
      },
      {}
    )
  }

  /**
   * Finds all RNS the user owns.
   * @returns {Promise<IRnsOwnedHashMap>} - Object map of entries by RNS name, locked RNS is stored as "free" instead.
   */
  async findExistingNames (): Promise<IRnsOwnedHashMap> {
    const address = this.walletRef.getJackalAddress()

    const data: IRnsOwnedItem[] = (
      await handlePagination(this.qH.rnsQuery, 'queryListOwnedNames', {
        address
      })
    ).reduce((acc: IRnsOwnedItem[], curr: any) => {
      acc.push(...curr.names)
      return acc
    }, [])

    return data.reduce((acc: IRnsOwnedHashMap, curr: IRnsOwnedItem) => {
      if (curr.locked) {
        acc.free = curr
      } else {
        acc[curr.name] = curr
      }
      return acc
    }, {})
  }

  /**
   * Find RNS details using RNS address.
   * @param {string} rns - RNS address to search.
   * @returns {Promise<IRnsOwnedItem>} - Data if found, defaults to item with empty values if no match found.
   */
  async findSingleRns (rns: string): Promise<IRnsOwnedItem> {
    const trueRns = sanitizeRns(rns)
    return (await this.qH.rnsQuery.queryNames({ index: trueRns })).value
      .names as IRnsOwnedItem
  }

  /**
   * Find owner's address using RNS address.
   * @param {string} rns - RNS address to search.
   * @returns {Promise<string>} - Owner's address if found, defaults to empty string if no match found.
   */
  async findMatchingAddress (rns: string): Promise<string> {
    return (await this.findSingleRns(rns)).value || ''
  }
}

/**
 * Ensures RNS address ends with ".jkl".
 * @param {string} rns - RNS address to process.
 * @returns {string} - Source RNS address with ".jkl" included.
 */
function sanitizeRns (rns: string): string {
  const allowedExtensions = /\.(jkl|ibc)$/
  return rns.match(allowedExtensions) ? rns : `${rns}.jkl`
}

/**
 * Strip ".jkl" and ".ibc" endings from RNS address.
 * @param {string} rns - RNS address to process.
 * @returns {string} - Source RNS address with ".jkl" and ".ibc" excluded.
 */
function reverseSanitizeRns (rns: string): string {
  const strippedExtensions = /\.(jkl|ibc)$/
  return rns.replace(strippedExtensions, '')
}

/**
 * Enforces JSON.stringify on data. Used by: makeUpdateMsg(), makeNewRegistrationMsg(), and makeAddRecordMsg().
 * @param {string} data - Data to force to JSON.stringify compliant string.
 * @param {string} caller - Function calling sanitizeRnsData() in case error is logged.
 * @returns {string} - JSON.stringify safe string.
 */
function sanitizeRnsData (data: string, caller: string) {
  try {
    return typeof data === 'string'
      ? JSON.stringify(JSON.parse(data))
      : JSON.stringify(data)
  } catch (err) {
    console.error(`sanitizeRnsData() failed for ${caller}`)
    console.error(err)
    return '{}'
  }
}
