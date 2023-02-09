import { IConsensusParams, IEvent, IValidatorUpdate } from "@/interfaces"

export default interface IEndBlock {
    validatorUpdates: IValidatorUpdate[],
    consensusParamUpdates: IConsensusParams | undefined,
    events: IEvent[]
}
