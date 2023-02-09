import { IConsensusParams, IValidatorUpdate } from "@/interfaces"

export default interface IInitChainResponse {
    consensusParams: IConsensusParams | undefined,
    validators: IValidatorUpdate[],
    appHash: Uint8Array
}
