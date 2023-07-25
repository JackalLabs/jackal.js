import {
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
  IQueryStorage
} from '@jackallabs/jackal.js-protos'

export default interface IQueryHandler {
  /** Custom */
  fileTreeQuery: IQueryFileTree
  jklMintQuery: IQueryJklMint
  notificationsQuery: IQueryNotifications
  oracleQuery: IQueryOracle
  rnsQuery: IQueryRns
  storageQuery: IQueryStorage

  /** Static */
  ABCIQuery: IQueryABCI
  bankQuery: IQueryBank
  distributionQuery: IQueryDistribution
  govQuery: IQueryGov
  stakingQuery: IQueryStaking
}
