import { IDelegationRewards, IStakingValidator } from '@/interfaces/'
import ICoin from '@/interfaces/ICoin'

export default interface IGovHandler {

  getTotalRewards (): Promise<IDelegationRewards>
  getRewards (validatorAddress: string): Promise<ICoin[]>
  getTotalStaked (): Promise<number>
  getMyValidators (): Promise<IStakingValidator[]>
  getMyValidatorDetails (validatorAddress: string): Promise<IStakingValidator>
  getValidatorDetails (validatorAddress: string): Promise<IStakingValidator>
  getAllValidatorDetails (status: string): Promise<IStakingValidator[]>
  getDelegatedValidators (): Promise<IStakingValidator[]>
  claimDelegatorRewards (validatorAddresses: string[]): Promise<void>
  delegateTokens (validatorAddress: string, amount: number): Promise<void>

}
