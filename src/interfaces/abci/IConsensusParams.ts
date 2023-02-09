import { 
    IBlockParams,
    IEvidenceParams,
    IValidatorParams,
    IVersionParams
 } from "@/interfaces"

export default interface IConsensusParams {
    block: IBlockParams | undefined,
    evidence: IEvidenceParams | undefined,
    validator: IValidatorParams | undefined,
    version: IVersionParams | undefined
}
