import { IConsensusParams, IValidatorUpdate } from "@/interfaces"

export default interface IInitChainRequest {
    time: Date | undefined,
    chainId: string,
    consensusParams: IConsensusParams | undefined,
    validators: IValidatorUpdate[],
    appStateBytes: Uint8Array,
    initialHeight: number,
}
