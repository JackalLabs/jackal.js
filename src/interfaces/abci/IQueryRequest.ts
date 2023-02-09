export default interface IQueryRequest {
    data: Uint8Array,
    path: string,
    height: number,
    prove: boolean
}
