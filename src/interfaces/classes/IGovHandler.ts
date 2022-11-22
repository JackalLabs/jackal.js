import { IDelegationRewards, IStakingValidator } from '@/interfaces/'

export default interface IGovHandler {

  getTotalRewards (): Promise<IDelegationRewards>
  getRewards (): Promise<IDelegationRewards>
  getTotalStaked (): Promise<number>
  getMyValidatorDetails (validatorAddress: string): Promise<IStakingValidator>
  getValidatorDetails (validatorAddress: string): Promise<IStakingValidator>
  getAllValidatorDetails (): Promise<IStakingValidator[]>
  delegatedValidators (): Promise<IStakingValidator[]>
  claimDelegatorRewards (validatorAddresses: string[]): Promise<void>
  delegateTokens (delegator_address: string, validator_address: string, amount: number): Promise<void>

}
