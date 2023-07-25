import { IProtoHandler } from '@/interfaces/classes'
import {
  IAllQuery,
  IAllTx,
  ITxBank,
  ITxDistribution,
  ITxFileTree,
  ITxGov,
  ITxNotifications,
  ITxOracle,
  ITxRns,
  ITxStaking,
  ITxStorage,
  ProtoBuilder,
  TMasterBroadcaster
} from '@jackallabs/jackal.js-protos'
import { EncodeObject } from '@cosmjs/proto-signing'
import { finalizeGas } from '@/utils/gas'
import { DeliverTxResponse } from '@cosmjs/stargate'
import { IProtoConfig } from '@/interfaces'
import QueryHandler from '@/classes/queryHandler'

export default class ProtoHandler
  extends QueryHandler
  implements IProtoHandler
{
  private readonly masterBroadcaster: TMasterBroadcaster
  private readonly allTxClients: IAllTx

  /**
   * Receives properties from trackProto() to instantiate ProtoHandler. Linked to WalletHandler instance.
   * @param {TMasterBroadcaster} mb - Master broadcaster to use for all SignAndBroadcast sessions.
   * @param {IAllTx} allTxClients
   * @param {IAllQuery} allQueryClients
   * @private
   */
  private constructor(
    mb: TMasterBroadcaster,
    allTxClients: IAllTx,
    allQueryClients: IAllQuery
  ) {
    super(allQueryClients)
    this.masterBroadcaster = mb
    this.allTxClients = allTxClients
  }

  /**
   * Async wrapper to create a ProtoHandler instance.
   * @param {IProtoConfig} cfg - All settings needed to generate the ProtoHandler instance.
   * @returns {Promise<ProtoHandler>} - Instance of ProtoHandler.
   */
  static async trackProto(cfg: IProtoConfig) {
    const builder = new ProtoBuilder(cfg.signer, cfg.rpcUrl, cfg.queryUrl)
    const mb = await builder.makeMasterBroadcaster()
    const allTxs = builder.makeAllTx()
    const allQueries = builder.makeAllQuery()
    return new ProtoHandler(mb.masterBroadcaster, allTxs, allQueries)
  }

  /** General */

  /**
   * SignAndBroadcast group of 1 or more msgs to chain. Generally debugBroadcaster() is preferred.
   * @param {EncodeObject[]} msgs - Msgs to broadcast.
   * @param {string} memo - Optional memo to include in broadcast.
   * @param {number | string} gasOverride - Optional fixed gas amount to override calculated gas.
   * @returns {Promise<DeliverTxResponse>} - Result of broadcast.
   */
  async broadcaster(
    msgs: EncodeObject[],
    memo: string = '',
    gasOverride?: number | string
  ): Promise<DeliverTxResponse> {
    return this.masterBroadcaster(msgs, {
      fee: finalizeGas(msgs, gasOverride),
      memo
    }).catch((err) => {
      throw err
    })
  }

  /**
   * SignAndBroadcast group of 1 or more msgs to chain. Generally debugBroadcaster() is preferred.
   * @param {EncodeObject[]} msgs - Msgs to broadcast.
   * @param {{gas?: number | string, memo?: string, step?: boolean}} extra
   * - Optional fixed gas amount to override calculated gas.
   * - Optional memo to include in broadcast.
   * - Optional flag to process msgs one at a time if true.
   * @returns {Promise<DeliverTxResponse>} - Result of broadcast.
   */
  async debugBroadcaster(
    msgs: EncodeObject[],
    extra: { gas?: number | string; memo?: string; step?: boolean } = {
      memo: '',
      step: false
    }
  ): Promise<DeliverTxResponse> {
    if (msgs.length < 1)
      throw new Error('Empty EncodeObject[] passed to debugBroadcaster()')
    if (extra.step) {
      let resp
      for (let i = 0; i < msgs.length; i++) {
        console.log(msgs[i].typeUrl)
        resp = await this.broadcaster([msgs[i]], extra.memo, extra.gas).catch(
          (err) => {
            throw err
          }
        )
        console.dir(resp)
      }
      return resp as DeliverTxResponse
    } else {
      const resp = await this.broadcaster(msgs, extra.memo, extra.gas).catch(
        (err) => {
          throw err
        }
      )
      console.dir(resp)
      return resp
    }
  }

  /**
   * Advanced use only. Expose base broadcaster for creating custom SignAndBroadcast process.
   * @returns {TMasterBroadcaster}
   */
  get rawBroadcaster() {
    return this.masterBroadcaster
  }

  /** Custom */

  /**
   * Expose FileTree Tx client instance.
   * @returns {ITxFileTree}
   */
  get fileTreeTx(): ITxFileTree {
    return this.allTxClients.fileTree
  }

  /**
   * Expose FileTree Tx client instance.
   * @returns {ITxNotifications}
   */
  get notificationsTx(): ITxNotifications {
    return this.allTxClients.notifications
  }

  /**
   * Expose FileTree Tx client instance.
   * @returns {ITxOracle}
   */
  get oracleTx(): ITxOracle {
    return this.allTxClients.oracle
  }

  /**
   * Expose FileTree Tx client instance.
   * @returns {ITxRns}
   */
  get rnsTx(): ITxRns {
    return this.allTxClients.rns
  }

  /**
   * Expose FileTree Tx client instance.
   * @returns {ITxStorage}
   */
  get storageTx(): ITxStorage {
    return this.allTxClients.storage
  }

  /** Static */

  /**
   * Expose FileTree Tx client instance.
   * @returns {ITxBank}
   */
  get bankTx(): ITxBank {
    return this.allTxClients.bank
  }

  /**
   * Expose FileTree Tx client instance.
   * @returns {ITxDistribution}
   */
  get distributionTx(): ITxDistribution {
    return this.allTxClients.distribution
  }

  /**
   * Expose FileTree Tx client instance.
   * @returns {ITxGov}
   */
  get govTx(): ITxGov {
    return this.allTxClients.gov
  }

  /**
   * Expose FileTree Tx client instance.
   * @returns {ITxStaking}
   */
  get stakingTx(): ITxStaking {
    return this.allTxClients.staking
  }
}
