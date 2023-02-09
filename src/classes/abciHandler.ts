import { IProtoHandler, IABCIHandler } from '@/interfaces/classes';
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
} from 'jackal.js-protos'

export default class ABCIHandler implements IABCIHandler {
    async getEcho (message: string): Promise<string> {
		
	}
    /* async getFlush () {

    } */
    async getBlockInfo (versions: RequestInfo): Promise<ResponseInfo> {
		
	}
    async setOptionByKeyValue (key: string, value: string): Promise<ResponseSetOption> {
		
	}
    async initializeChain (object: RequestInitChain): Promise<ResponseInitChain> {
		
	}
    async getQuery (object: RequestQuery): Promise<ResponseQuery> {
		
	}
    async getBeginBlock (object: RequestBeginBlock): Promise<ResponseBeginBlock> {
		
	}
    async getCheckTx (tx: Uint8Array, type: number): Promise<ResponseCheckTx> {
		
	}
    async getDeliverTx (tx: Uint8Array): Promise<ResponseDeliverTx> {
		
	}
    async getEndBlock (height: number): Promise<ResponseEndBlock> {
		
	}
    async getCommit (): Promise<ResponseCommit> {
		
	}
    async getlistSnapshots (): Promise<ResponseListSnapshots> {
		
	}
    async getOfferSnapshot (object: RequestOfferSnapshot): Promise<ResponseOfferSnapshot> {
		
	}
    async getSnapshotChunk (height: number, format: number, chunk: number): Promise<Uint8Array> {
		
	}
    async putSnapshotChunk (index: number, chunk: Uint8Array, sender: string): Promise<ResponseApplySnapshotChunk> {
		
	}
}
