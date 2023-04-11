import { IStakingValidator } from '@/interfaces'

export default interface IStakingValidatorExtended extends IStakingValidator {
  stakedWith: boolean
}
