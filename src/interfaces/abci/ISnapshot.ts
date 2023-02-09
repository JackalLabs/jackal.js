export default interface ISnapshot {
    height: number,
    format: number,
    chunks: number,
    hash: Uint8Array,
    metadata: Uint8Array
}