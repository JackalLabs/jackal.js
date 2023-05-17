import { IAbciHandler, IQueryHandler, IWalletHandler } from '@/interfaces/classes'
import {
  RequestBeginBlock,
  RequestInfo,
  RequestInitChain,
  RequestOfferSnapshot,
  RequestQuery,
  ResponseApplySnapshotChunk,
  ResponseBeginBlock,
  ResponseCheckTx,
  ResponseCommit,
  ResponseDeliverTx,
  ResponseEndBlock,
  ResponseInfo,
  ResponseInitChain,
  ResponseListSnapshots,
  ResponseOfferSnapshot,
  ResponseQuery,
  ResponseSetOption
} from 'jackal.js-protos'

export default class AbciHandler implements IAbciHandler {
  private readonly walletRef: IWalletHandler
  private readonly qH: IQueryHandler

  private constructor(wallet: IWalletHandler) {
    this.walletRef = wallet
    this.qH = wallet.getQueryHandler()
  }

  static async trackAbci(wallet: IWalletHandler): Promise<IAbciHandler> {
    return new AbciHandler(wallet)
  }

  async getEcho(message: string): Promise<string> {
    return (await this.qH.ABCIQuery.echo({ message })).value.message || ''
  }
  async getBlockInfo(versions: RequestInfo): Promise<ResponseInfo> {
    return (await this.qH.ABCIQuery.info(versions)).value
  }
  async setOptionByKeyValue(
    key: string,
    value: string
  ): Promise<ResponseSetOption> {
    return (await this.qH.ABCIQuery.setOption({ key, value })).value
  }
  async initializeChain(object: RequestInitChain): Promise<ResponseInitChain> {
    return (await this.qH.ABCIQuery.initChain(object)).value
  }
  async getQuery(object: RequestQuery): Promise<ResponseQuery> {
    return (await this.qH.ABCIQuery.query(object)).value
  }
  async getBeginBlock(object: RequestBeginBlock): Promise<ResponseBeginBlock> {
    return (await this.qH.ABCIQuery.beginBlock(object)).value
  }
  async getCheckTx(tx: Uint8Array, type: number): Promise<ResponseCheckTx> {
    return (await this.qH.ABCIQuery.checkTx({ tx, type })).value
  }
  async getDeliverTx(tx: Uint8Array): Promise<ResponseDeliverTx> {
    return (await this.qH.ABCIQuery.deliverTx({ tx })).value
  }
  async getEndBlock(height: number): Promise<ResponseEndBlock> {
    return (await this.qH.ABCIQuery.endBlock({ height })).value
  }
  async getCommit(): Promise<ResponseCommit> {
    return (await this.qH.ABCIQuery.commit({})).value
  }
  async getListSnapshots(): Promise<ResponseListSnapshots> {
    return (await this.qH.ABCIQuery.listSnapshots({})).value
  }
  async getOfferSnapshot(
    object: RequestOfferSnapshot
  ): Promise<ResponseOfferSnapshot> {
    return (await this.qH.ABCIQuery.offerSnapshot(object)).value
  }
  async getSnapshotChunk(
    height: number,
    format: number,
    chunk: number
  ): Promise<Uint8Array> {
    return (
      (await this.qH.ABCIQuery.loadSnapshotChunk({ height, format, chunk }))
        .value.chunk || new Uint8Array(0)
    )
  }
  async putSnapshotChunk(
    index: number,
    chunk: Uint8Array,
    sender: string
  ): Promise<ResponseApplySnapshotChunk> {
    return (
      await this.qH.ABCIQuery.applySnapshotChunk({ index, chunk, sender })
    ).value
  }
}
