import { IProtoHandler } from '../interfaces/classes'
import { IProtoReqs } from '../interfaces'

import {
  makeMasterBroadcaster,
  bankQueryClient,
  bankTxClient,
  distributionQueryClient,
  distributionTxClient,
  filetreeQueryClient,
  filetreeTxClient,
  govQueryClient,
  govTxClient,
  rnsQueryClient,
  rnsTxClient,
  stakingQueryClient,
  stakingTxClient,
  storageQueryClient,
  storageTxClient
} from 'jackal.js-protos'

export default class ProtoHandler implements IProtoHandler {
  private readonly masterBroadcaster: any
  private readonly allQueryClients: any
  private readonly allTxClients: any

  private constructor (mb: any, query: any, tx: any) {
    this.masterBroadcaster = mb
    this.allQueryClients = query
    this.allTxClients = tx
  }

  static async trackProto (wallet: IProtoReqs): Promise<IProtoHandler> {
    const { signer, queryAddr1317, txAddr26657 } = wallet

    const query: any = {}
    const tx: any = {}
    const mb = await makeMasterBroadcaster(signer, { addr: txAddr26657 })

    query.bank = await bankQueryClient({ addr: queryAddr1317 })
    tx.bank = await bankTxClient(signer, { addr: txAddr26657 })

    query.distribution = await distributionQueryClient({ addr: queryAddr1317 })
    tx.distribution = await distributionTxClient(signer, { addr: txAddr26657 })

    query.filetree = await filetreeQueryClient({ addr: queryAddr1317 })
    tx.filetree = await filetreeTxClient(signer, { addr: txAddr26657 })

    query.gov = await govQueryClient({ addr: queryAddr1317 })
    tx.gov = await govTxClient(signer, { addr: txAddr26657 })

    query.rns = await rnsQueryClient({ addr: queryAddr1317 })
    tx.rns = await rnsTxClient(signer, { addr: txAddr26657 })

    query.staking = await stakingQueryClient({ addr: queryAddr1317 })
    tx.staking = await stakingTxClient(signer, { addr: txAddr26657 })

    query.storage = await storageQueryClient({ addr: queryAddr1317 })
    tx.storage = await storageTxClient(signer, { addr: txAddr26657 })

    return new ProtoHandler(mb, query, tx)
  }

  get broadcaster () {
    return this.masterBroadcaster
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
  get filetreeQuery () {
    return this.allQueryClients.filetree
  }
  get filetreeTx () {
    return this.allTxClients.filetree
  }
  get govQuery () {
    return this.allQueryClients.gov
  }
  get govTx () {
    return this.allTxClients.gov
  }
  get rnsQuery () {
    return this.allQueryClients.rns
  }
  get rnsTx () {
    return this.allTxClients.rns
  }
  get stakingQuery () {
    return this.allQueryClients.staking
  }
  get stakingTx () {
    return this.allTxClients.staking
  }
  get storageQuery () {
    return this.allQueryClients.storage
  }
  get storageTx () {
    return this.allTxClients.storage
  }
}

