import { IQueryHandler } from '@/interfaces/classes'
import { IAllQuery, QueryBuilder } from 'jackal.js-protos'

export default class QueryHandler implements IQueryHandler {
  protected readonly allQueryClients: IAllQuery

  protected constructor(
    allQueryClients: IAllQuery
  ) {
    this.allQueryClients = allQueryClients
  }

  static async trackQuery(queryUrl?: string) {
    const builder = new QueryBuilder(queryUrl)
    const allQueries = builder.makeAllQuery()
    return new QueryHandler(allQueries)
  }

  /** Custom */
  get fileTreeQuery() {
    return this.allQueryClients.fileTree
  }
  get jklMintQuery() {
    return this.allQueryClients.jklMint
  }
  get notificationsQuery() {
    return this.allQueryClients.notifications
  }
  get oracleQuery() {
    return this.allQueryClients.oracle
  }
  get rnsQuery() {
    return this.allQueryClients.rns
  }
  get storageQuery() {
    return this.allQueryClients.storage
  }

  /** Static */
  get ABCIQuery() {
    return this.allQueryClients.abci
  }
  get bankQuery() {
    return this.allQueryClients.bank
  }
  get distributionQuery() {
    return this.allQueryClients.distribution
  }
  get govQuery() {
    return this.allQueryClients.gov
  }
  get stakingQuery() {
    return this.allQueryClients.staking
  }
}
