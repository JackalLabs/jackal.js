import IStakingValidator from '@/interfaces/IStakingValidator'

export default interface IStakingValidatorExtended extends IStakingValidator {
  stakedWith: boolean
}
