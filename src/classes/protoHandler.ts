import { IProtoHandler } from '@/interfaces/classes'
import { IAllQuery, IAllTx, ProtoBuilder, TMasterBroadcaster } from 'jackal.js-protos'
import { EncodeObject } from '@cosmjs/proto-signing'
import { finalizeGas } from '@/utils/gas'
import { DeliverTxResponse } from '@cosmjs/stargate'
import { IProtoConfig } from '@/interfaces'
import QueryHandler from '@/classes/queryHandler'

export default class ProtoHandler extends QueryHandler implements IProtoHandler {
  private readonly masterBroadcaster: TMasterBroadcaster
  private readonly allTxClients: IAllTx

  private constructor(
    mb: TMasterBroadcaster,
    allTxClients: IAllTx,
    allQueryClients: IAllQuery
  ) {
    super(allQueryClients)
    this.masterBroadcaster = mb
    this.allTxClients = allTxClients
  }

  static async trackProto(cfg: IProtoConfig) {
    const builder = new ProtoBuilder(cfg.signer, cfg.rpcUrl, cfg.queryUrl)
    const mb = await builder.makeMasterBroadcaster()
    const allTxs = builder.makeAllTx()
    const allQueries = builder.makeAllQuery()
    return new ProtoHandler(mb.masterBroadcaster, allTxs, allQueries)
  }

  /** General */
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
  async debugBroadcaster(
    msgs: EncodeObject[],
    extra: { gas?: number | string; memo?: string; step?: boolean } = {
      memo: '',
      step: false
    }
  ): Promise<DeliverTxResponse> {
    if (msgs.length < 1) throw new Error('Empty EncodeObject[] passed to debugBroadcaster()')
    if (extra.step) {
      let resp
      for (let i = 0; i < msgs.length; i++) {
        console.log(msgs[i].typeUrl)
        resp = await this.broadcaster(
          [msgs[i]],
          extra.memo,
          extra.gas
        ).catch((err) => {
          throw err
        })
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
  get rawBroadcaster() {
    return this.masterBroadcaster
  }

  /** Custom */
  get fileTreeTx() {
    return this.allTxClients.fileTree
  }
  get notificationsTx() {
    return this.allTxClients.notifications
  }
  get oracleTx() {
    return this.allTxClients.oracle
  }
  get rnsTx() {
    return this.allTxClients.rns
  }
  get storageTx() {
    return this.allTxClients.storage
  }

  /** Static */
  get bankTx() {
    return this.allTxClients.bank
  }
  get distributionTx() {
    return this.allTxClients.distribution
  }
  get govTx() {
    return this.allTxClients.gov
  }
  get stakingTx() {
    return this.allTxClients.staking
  }
}
