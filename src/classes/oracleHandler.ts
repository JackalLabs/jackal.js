import { IOracleHandler, IQueryHandler, IWalletHandler } from '@/interfaces/classes'
import { IOracleFeed } from '@/interfaces'

export default class OracleHandler implements IOracleHandler {
  private readonly qH: IQueryHandler

  /**
   * Receives properties from trackOracle() to instantiate OracleHandler.
   * @param {IWalletHandler} wallet - Query or signing WalletHandler instance.
   * @private
   */
  private constructor(wallet: IWalletHandler) {
    this.qH = wallet.getQueryHandler()
  }

  /**
   * Creates OracleHandler instance.
   * @param {IWalletHandler} wallet - Query or signing WalletHandler instance.
   * @returns {Promise<IOracleHandler>} - OracleHandler instance linked to provided WalletHandler instance.
   */
  static async trackOracle(wallet: IWalletHandler): Promise<IOracleHandler> {
    return new OracleHandler(wallet)
  }

  /**
   * Retrieve data of specified on-chain oracle.
   * @param {string} name - Name of oracle.
   * @returns {Promise<IOracleFeed>}
   */
  async getFeed(name: string): Promise<IOracleFeed> {
    const result = (await this.qH.oracleQuery.queryFeed({ name })).value.feed
    return result ? result : { owner: 'na', data: 'na', name: 'na' }
  }

  /**
   * Retrieve data of all on-chain oracles.
   * @returns {Promise<IOracleFeed[]>}
   */
  async getAllFeeds(): Promise<IOracleFeed[]> {
    return (await this.qH.oracleQuery.queryAllFeeds({})).value.feed
  }
}
