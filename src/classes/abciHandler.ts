import { IAbciHandler, IProtoHandler, IWalletHandler } from '@/interfaces/classes';
import {
  RequestInfo, ResponseInfo,
  ResponseSetOption,
  RequestInitChain, ResponseInitChain,
  RequestQuery, ResponseQuery,
  RequestBeginBlock, ResponseBeginBlock,
  ResponseCheckTx,
  ResponseDeliverTx,
  ResponseEndBlock,
  ResponseCommit,
  ResponseListSnapshots,
  RequestOfferSnapshot, ResponseOfferSnapshot,
  ResponseApplySnapshotChunk
} from 'jackal.js-protos/dist/postgen/tendermint/abci/types'

export default class AbciHandler implements IAbciHandler {
  private readonly walletRef: IWalletHandler
  private readonly pH: IProtoHandler

  private constructor (wallet: IWalletHandler) {
    this.walletRef = wallet
    this.pH = wallet.getProtoHandler()
  }

  async getEcho (message: string): Promise<string> {
		return (await this.pH.ABCIQuery.echo({ message })).value.message || ''
	}
  async getBlockInfo (versions: RequestInfo): Promise<ResponseInfo> {
    return (await this.pH.ABCIQuery.info(versions)).value
	}
  async setOptionByKeyValue (key: string, value: string): Promise<ResponseSetOption> {
		return (await this.pH.ABCIQuery.setOption({ key, value })).value
	}
  async initializeChain (object: RequestInitChain): Promise<ResponseInitChain> {
		return (await this.pH.ABCIQuery.initChain(object)).value
	}
  async getQuery (object: RequestQuery): Promise<ResponseQuery> {
		return (await this.pH.ABCIQuery.query(object)).value
	}
  async getBeginBlock (object: RequestBeginBlock): Promise<ResponseBeginBlock> {
		return (await this.pH.ABCIQuery.beginBlock(object)).value
	}
  async getCheckTx (tx: Uint8Array, type: number): Promise<ResponseCheckTx> {
		return (await this.pH.ABCIQuery.checkTx({ tx, type })).value
	}
  async getDeliverTx (tx: Uint8Array): Promise<ResponseDeliverTx> {
		return (await this.pH.ABCIQuery.deliverTx({ tx })).value
	}
  async getEndBlock (height: number): Promise<ResponseEndBlock> {
		return (await this.pH.ABCIQuery.endBlock({ height })).value
	}
  async getCommit (): Promise<ResponseCommit> {
		return (await this.pH.ABCIQuery.commit({})).value
	}
  async getlistSnapshots (): Promise<ResponseListSnapshots> {
		return (await this.pH.ABCIQuery.listSnapshots({})).value
	}
  async getOfferSnapshot (object: RequestOfferSnapshot): Promise<ResponseOfferSnapshot> {
		return (await this.pH.ABCIQuery.offerSnapshot(object)).value
	}
  async getSnapshotChunk (height: number, format: number, chunk: number): Promise<Uint8Array> {
		return (await this.pH.ABCIQuery.loadSnapshotChunk({ height, format, chunk })).value.chunk || new Uint8Array(0)
	}
  async putSnapshotChunk (index: number, chunk: Uint8Array, sender: string): Promise<ResponseApplySnapshotChunk> {
		return (await this.pH.ABCIQuery.applySnapshotChunk({ index, chunk, sender })).value
	}
}
