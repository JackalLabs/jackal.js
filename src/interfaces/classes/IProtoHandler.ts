import {
  IQueryJklMint,
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
// TODO - Update this later
import IQueryFileTree from 'jackal.js-protos/dist/interfaces/classes/IQueryFileTree'
import { ITxFileTree } from 'jackal.js-protos/dist/snackages/tx/custom/fileTree'

export default interface IProtoHandler {

  /** General */
  broadcaster (msgs: EncodeObject[]): Promise<DeliverTxResponse>
  rawBroadcaster: TMasterBroadcaster

  /** Custom */
  fileTreeQuery: IQueryFileTree
  fileTreeTx: ITxFileTree
  jklMintQuery: IQueryJklMint
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
