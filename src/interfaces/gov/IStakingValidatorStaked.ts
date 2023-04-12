import { IDelegationSummary, IStakingValidatorExtended } from '@/interfaces'

export default interface IStakingValidatorStaked extends IStakingValidatorExtended {
  stakedDetails?: IDelegationSummary
}
