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
    async getBlockInfo (version: string, blockVersion: number, p2pVersion: number): Promise<IABCIInfo> {
		
	}
    async setOptionByKeyValue (key: string, value: string): Promise<ISetOption> {
		
	}
    async initializeChain (object: IInitChainRequest): Promise<IInitChainResponse> {
		
	}
    async getQuery (object: IQueryRequest): Promise<IQueryResponse> {
		
	}
    async getBeginBlock (): Promise<IEvent[]> {
		
	}
    async getCheckTx (tx: Uint8Array, type: number): Promise<ITx> {
		
	}
    async getDeliverTx (tx: Uint8Array): Promise<ITx> {
		
	}
    async getEndBlock (height: number): Promise<IEndBlock> {
		
	}
    async getCommit (): Promise<ICommit> {
		
	}
    async getlistSnapshots (): Promise<ISnapshot[][]> {
		
	}
    async getOfferSnapshot (snapshot: ISnapshot, appHash: Uint8Array): Promise<number> {
		
	}
    async getSnapshotChunk (height: number, format: number, chunk: number): Promise<Uint8Array> {
		
	}
    async putSnapshotChunk (index: number, chunk: Uint8Array, sender: string): Promise<IPutSnapshotChunk> {
		
	}
}async 
async 