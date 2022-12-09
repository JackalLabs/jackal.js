import {
  IQueryFileTree,
  ITxFileTree,
  IQueryJklMint,
  IQueryOracle,
  ITxOracle,
  IQueryRns,
  ITxRns,
  IQueryStorage,
  ITxStorage,
  IQueryBank,
  ITxBank,
  IQueryDistribution,
  ITxDistribution,
  IQueryGov,
  ITxGov,
  IQueryStaking,
  ITxStaking,
  TMasterBroadcaster
} from 'jackal.js-protos'
import { EncodeObject } from '@cosmjs/proto-signing'
import { DeliverTxResponse } from '@cosmjs/stargate'

export default interface IProtoHandler {

  /** General */
  broadcaster (msgs: EncodeObject[]): Promise<DeliverTxResponse>
  rawBroadcaster: TMasterBroadcaster

  /** Custom */
  fileTreeQuery: IQueryFileTree
  fileTreeTx: ITxFileTree
  jklMintQuery: IQueryJklMint
  oracleQuery: IQueryOracle
  oracleTx: ITxOracle
  rnsQuery: IQueryRns
  rnsTx: ITxRns
  storageQuery: IQueryStorage
  storageTx: ITxStorage



  /** Static */
  bankQuery: IQueryBank
  bankTx: ITxBank
  distributionQuery: IQueryDistribution
  distributionTx: ITxDistribution
  govQuery: IQueryGov
  govTx: ITxGov
  stakingQuery: IQueryStaking
  stakingTx: ITxStaking

}
