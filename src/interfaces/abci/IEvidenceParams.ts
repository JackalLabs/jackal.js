export default interface IEvidenceParams {
    maxAgeNumBlocks: number,
    maxAgeDuration: {
        seconds: number,
        nanos: number
    } | undefined,
    maxBytes: number
}