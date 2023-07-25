import {
  ITxBank,
  ITxDistribution,
  ITxFileTree,
  ITxGov,
  ITxNotifications,
  ITxOracle,
  ITxRns,
  ITxStaking,
  ITxStorage,
  TMasterBroadcaster
} from '@jackallabs/jackal.js-protos'
import { EncodeObject } from '@cosmjs/proto-signing'
import { DeliverTxResponse } from '@cosmjs/stargate'
import IQueryHandler from '@/interfaces/classes/IQueryHandler'

export default interface IProtoHandler extends IQueryHandler {
  /** General */
  broadcaster(
    msgs: EncodeObject[],
    memo?: string,
    gasOverride?: number | string
  ): Promise<DeliverTxResponse>
  debugBroadcaster(
    msgs: EncodeObject[],
    extra: { gas?: number | string; memo?: string; step?: boolean }
  ): Promise<DeliverTxResponse>
  rawBroadcaster: TMasterBroadcaster

  /** Custom */
  fileTreeTx: ITxFileTree
  notificationsTx: ITxNotifications
  oracleTx: ITxOracle
  rnsTx: ITxRns
  storageTx: ITxStorage

  /** Static */
  bankTx: ITxBank
  distributionTx: ITxDistribution
  govTx: ITxGov
  stakingTx: ITxStaking
}
