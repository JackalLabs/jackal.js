import { IQueryHandler } from '@/interfaces/classes'
import {
  IAllQuery,
  IQueryABCI,
  IQueryBank,
  IQueryDistribution,
  IQueryFileTree,
  IQueryGov,
  IQueryJklMint,
  IQueryNotifications,
  IQueryOracle,
  IQueryRns,
  IQueryStaking,
  IQueryStorage,
  QueryBuilder
} from 'jackal.js-protos'

export default class QueryHandler implements IQueryHandler {
  protected readonly allQueryClients: IAllQuery

  /**
   * Receives properties from trackQuery() to instantiate QueryHandler. May be linked to WalletHandler instance.
   * @param {IAllQuery} allQueryClients
   * @protected
   */
  protected constructor(allQueryClients: IAllQuery) {
    this.allQueryClients = allQueryClients
  }

  /**
   * Async wrapper to create a QueryHandler instance.
   * @param {string} queryUrl - URL to API query node to use for requests.
   * @returns {Promise<QueryHandler>} - Instance of QueryHandler.
   */
  static async trackQuery(queryUrl?: string) {
    const builder = new QueryBuilder(queryUrl)
    const allQueries = builder.makeAllQuery()
    return new QueryHandler(allQueries)
  }

  /** Custom */

  /**
   * Expose FileTree query client instance.
   * @returns {IQueryFileTree}
   */
  get fileTreeQuery(): IQueryFileTree {
    return this.allQueryClients.fileTree
  }

  /**
   * Expose JklMint query client instance.
   * @returns {IQueryJklMint}
   */
  get jklMintQuery(): IQueryJklMint {
    return this.allQueryClients.jklMint
  }

  /**
   * Expose Notifications query client instance.
   * @returns {IQueryNotifications}
   */
  get notificationsQuery(): IQueryNotifications {
    return this.allQueryClients.notifications
  }

  /**
   * Expose Oracle query client instance.
   * @returns {IQueryOracle}
   */
  get oracleQuery(): IQueryOracle {
    return this.allQueryClients.oracle
  }

  /**
   * Expose Rns query client instance.
   * @returns {IQueryRns}
   */
  get rnsQuery(): IQueryRns {
    return this.allQueryClients.rns
  }

  /**
   * Expose Storage query client instance.
   * @returns {IQueryStorage}
   */
  get storageQuery(): IQueryStorage {
    return this.allQueryClients.storage
  }

  /** Static */

  /**
   * Expose ABCI query client instance.
   * @returns {IQueryABCI}
   * @constructor
   */
  get ABCIQuery(): IQueryABCI {
    return this.allQueryClients.abci
  }

  /**
   * Expose Bank query client instance.
   * @returns {IQueryBank}
   */
  get bankQuery(): IQueryBank {
    return this.allQueryClients.bank
  }

  /**
   * Expose Distribution query client instance.
   * @returns {IQueryDistribution}
   */
  get distributionQuery(): IQueryDistribution {
    return this.allQueryClients.distribution
  }

  /**
   * Expose Gov query client instance.
   * @returns {IQueryGov}
   */
  get govQuery(): IQueryGov {
    return this.allQueryClients.gov
  }

  /**
   * Expose Staking query client instance.
   * @returns {IQueryStaking}
   */
  get stakingQuery(): IQueryStaking {
    return this.allQueryClients.staking
  }
}
