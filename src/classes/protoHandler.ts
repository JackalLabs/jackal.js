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
  broadcaster (msgs: EncodeObject[]): Promise<DeliverTxResponse> {
    return this.masterBroadcaster(msgs, { fee: finalizeGas(msgs), memo: '' })
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
