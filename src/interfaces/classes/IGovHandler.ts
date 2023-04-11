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
import { EncodeObject } from '@cosmjs/proto-signing'

export default interface IGovHandler {

  getTotalRewards (): Promise<IDelegationRewards>
  getCondensedTotalRewards (): Promise<number>
  getRewards (validatorAddress: string): Promise<ICoin[]>
  getCondensedRewards (validatorAddress: string): Promise<number>
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
  getInactiveMergedValidatorDetailsStakedMap (): Promise<IStakingValidatorExtendedMap>
  getInactiveMergedValidatorDetailsMap (): Promise<IStakingValidatorExtendedMap>
  getCompleteMergedValidatorDetailsMap (): Promise<IStakingValidatorExtendedMap>
  claimDelegatorRewards (validatorAddresses: string[]): Promise<void>
  rawDelegateTokens (validatorAddress: string, amount: number): EncodeObject
  delegateTokens (validatorAddress: string, amount: number): Promise<void>
  rawUndelegateTokens (validatorAddress: string, amount: number | string): EncodeObject
  undelegateTokens (validatorAddress: string, amount: number | string): Promise<void>
  rawRedelegateTokens (fromAddress: string, toAddress: string, amount: number | string): EncodeObject
  redelegateTokens (fromAddress: string, toAddress: string, amount: number | string): Promise<void>

}
