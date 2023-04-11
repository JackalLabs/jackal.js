import { IDelegationRewards, IDelegationSummaryMap, IStakingValidator } from '@/interfaces/'
import ICoin from '@/interfaces/ICoin'
import IStakingValidatorExtendedMap from '@/interfaces/IStakingValidatorExtendedMap'
import { TValidatorStatus } from '@/types/TValidatorStatus'
import IStakingValidatorMap from '@/interfaces/IStakingValidatorMap'

export default interface IGovHandler {

  getTotalRewards (): Promise<IDelegationRewards>
  getRewards (validatorAddress: string): Promise<ICoin[]>
  getTotalStaked (): Promise<number>
  getStakedMap (): Promise<IDelegationSummaryMap>
  getDelegatorValidatorDetails (validatorAddress: string): Promise<IStakingValidator>
  getAllDelegatorValidatorDetails (): Promise<IStakingValidator[]>
  getAllDelegatorValidatorDetailsMap (): Promise<IStakingValidatorMap>
  getValidatorDetails (validatorAddress: string): Promise<IStakingValidator>
  getAllValidatorDetails (status: string): Promise<IStakingValidator[]>
  getAllValidatorDetailsMap (status: TValidatorStatus): Promise<IStakingValidatorMap>
  getMergedValidatorDetailsMap (status: TValidatorStatus): Promise<IStakingValidatorExtendedMap>
  getCompleteMergedValidatorDetailsMap (): Promise<IStakingValidatorExtendedMap>
  claimDelegatorRewards (validatorAddresses: string[]): Promise<void>
  delegateTokens (validatorAddress: string, amount: number): Promise<void>

}
