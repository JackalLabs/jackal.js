export default interface IQueryResponse {
    code: number,
    log: string,
    info: string,
    index: number,
    key: Uint8Array,
    value: Uint8Array,
    proofOps: {
        type: string,
        key: Uint8Array,
        data: Uint8Array
    }[] | undefined,
    height: number,
    codespace: string,
    }
