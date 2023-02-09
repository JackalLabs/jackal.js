import { IProtoHandler } from '@/interfaces/classes'
import {
    IABCIInfo,
    ICommit,
    IEndBlock,
    IEvent,
    IInitChainRequest,
    IInitChainResponse,
    IPutSnapshotChunk,
    IQueryRequest,
    IQueryResponse,
    ISetOption,
    ISnapshot,
    ITx
} from '@/interfaces'

export default interface IABCIHandler {
    getEcho (message: string): Promise<string>
    // getFlush ()
    getBlockInfo (version: string, blockVersion: number, p2pVersion: number): Promise<IABCIInfo>
    setOptionByKeyValue (key: string, value: string): Promise<ISetOption>
    initializeChain (object: IInitChainRequest): Promise<IInitChainResponse>
    getQuery (object: IQueryRequest): Promise<IQueryResponse>
    getBeginBlock (): Promise<IEvent[]>
    getCheckTx (tx: Uint8Array, type: number): Promise<ITx>
    getDeliverTx (tx: Uint8Array): Promise<ITx>
    getEndBlock (height: number): Promise<IEndBlock>
    getCommit (): Promise<ICommit>
    getlistSnapshots (): Promise<ISnapshot[][]>
    getOfferSnapshot (snapshot: ISnapshot, appHash: Uint8Array): Promise<number>
    getSnapshotChunk (height: number, format: number, chunk: number): Promise<Uint8Array>
    putSnapshotChunk (index: number, chunk: Uint8Array, sender: string): Promise<IPutSnapshotChunk>
}
