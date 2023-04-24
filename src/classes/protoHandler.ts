import { IProtoHandler } from '@/interfaces/classes'

import ProtoBuilder, { IAllQuery, IAllTx, TMasterBroadcaster } from 'jackal.js-protos'
import { EncodeObject, OfflineSigner } from '@cosmjs/proto-signing'
import { finalizeGas } from '@/utils/gas'
import { DeliverTxResponse } from '@cosmjs/stargate'

export default class ProtoHandler implements IProtoHandler {
  private readonly masterBroadcaster: TMasterBroadcaster
  private readonly allQueryClients: IAllQuery
  private readonly allTxClients: IAllTx

  private constructor (mb: any, allQueryClients: IAllQuery, allTxClients: IAllTx) {
    this.masterBroadcaster = mb
    this.allQueryClients = allQueryClients
    this.allTxClients = allTxClients
  }

  static async trackProto (signer: OfflineSigner, txUrl?: string, queryUrl?: string) {
    const builder = new ProtoBuilder(signer, txUrl, queryUrl)
    const mb = await builder.makeMasterBroadcaster()
    const allQueries = builder.makeAllQuery()
    const allTxs = builder.makeAllTx()
    return new ProtoHandler(mb.masterBroadcaster, allQueries, allTxs)
  }

  /** General */
  broadcaster (msgs: EncodeObject[], memo = '', gas?: string): Promise<DeliverTxResponse> {
    return this.masterBroadcaster(msgs, { fee: gas ? { amount: [], gas } : finalizeGas(msgs), memo })
      .catch(err => {
        throw err
      })
  }
  async debugBroadcaster (
    msgs: EncodeObject[],
    extra: { gas?: string, memo?: string, step?: boolean } = { gas: '', memo: '', step: false }
  ): Promise<DeliverTxResponse | null> {
    if (extra.step) {
      for (let i = 0; i < msgs.length; i++) {
        console.log(msgs[i].typeUrl)
        const resp = await this.broadcaster([msgs[i]], extra.memo, extra.gas)
          .catch(err => {
            throw err
          })
        console.dir(resp)
      }
      return null
    } else {
      const resp = await this.broadcaster(msgs, extra.memo, extra.gas)
        .catch(err => {
          throw err
        })
      console.dir(resp)
      return resp
    }
  }
  get rawBroadcaster () {
    return this.masterBroadcaster
  }

  /** Custom */
  get fileTreeQuery () {
    return this.allQueryClients.fileTree
  }
  get fileTreeTx () {
    return this.allTxClients.fileTree
  }
  get jklMintQuery () {
    return this.allQueryClients.jklMint
  }
  get notificationsQuery () {
    return this.allQueryClients.notifications
  }
  get notificationsTx () {
    return this.allTxClients.notifications
  }
  get oracleQuery () {
    return this.allQueryClients.oracle
  }
  get oracleTx () {
    return this.allTxClients.oracle
  }
  get rnsQuery () {
    return this.allQueryClients.rns
  }
  get rnsTx () {
    return this.allTxClients.rns
  }
  get storageQuery () {
    return this.allQueryClients.storage
  }
  get storageTx () {
    return this.allTxClients.storage
  }



  /** Static */
  get ABCIQuery () {
    return this.allQueryClients.abci
  }
  get bankQuery () {
    return this.allQueryClients.bank
  }
  get bankTx () {
    return this.allTxClients.bank
  }
  get distributionQuery () {
    return this.allQueryClients.distribution
  }
  get distributionTx () {
    return this.allTxClients.distribution
  }
  get govQuery () {
    return this.allQueryClients.gov
  }
  get govTx () {
    return this.allTxClients.gov
  }
  get stakingQuery () {
    return this.allQueryClients.staking
  }
  get stakingTx () {
    return this.allTxClients.staking
  }
}
