import {
  IDelegationRewards,
  IDelegationSummaryMap,
  IStakingValidator,
  IStakingValidatorExtendedMap,
  IStakingValidatorMap,
  IStakingValidatorStakedMap
} from '@/interfaces/'
import ICoin from '@/interfaces/ICoin'
import { TValidatorStatus } from '@/types/TValidatorStatus'

export default interface IGovHandler {

  getTotalRewards (): Promise<IDelegationRewards>
  getRewards (validatorAddress: string): Promise<ICoin[]>
  getTotalStaked (): Promise<number>
  getStakedMap (): Promise<IDelegationSummaryMap>
  getStakedValidatorDetailsMap (): Promise<IStakingValidatorStakedMap>
  getDelegatorValidatorDetails (validatorAddress: string): Promise<IStakingValidator>
  getAllDelegatorValidatorDetails (): Promise<IStakingValidator[]>
  getAllDelegatorValidatorDetailsMap (): Promise<IStakingValidatorMap>
  getValidatorDetails (validatorAddress: string): Promise<IStakingValidator>
  getAllValidatorDetails (status: string): Promise<IStakingValidator[]>
  getAllValidatorDetailsMap (status: TValidatorStatus): Promise<IStakingValidatorMap>
  getMergedValidatorDetailsMap (status: TValidatorStatus): Promise<IStakingValidatorExtendedMap>
  getMergedValidatorDetailsStakedMap (status: TValidatorStatus): Promise<IStakingValidatorStakedMap>
  getInactiveMergedValidatorDetailsMap (): Promise<IStakingValidatorExtendedMap>
  getCompleteMergedValidatorDetailsMap (): Promise<IStakingValidatorExtendedMap>
  claimDelegatorRewards (validatorAddresses: string[]): Promise<void>
  delegateTokens (validatorAddress: string, amount: number): Promise<void>

}
