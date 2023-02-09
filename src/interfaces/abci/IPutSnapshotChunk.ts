export default interface IPutSnapshotChunk {
    result: number,
    refetchChunks: number[],
    rejectSenders: string[]
}
