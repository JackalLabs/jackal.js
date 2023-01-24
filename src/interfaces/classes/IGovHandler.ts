import { IDelegationRewards, IStakingValidator } from '@/interfaces/'
import ICoin from '@/interfaces/ICoin'

export default interface IGovHandler {

  getTotalRewards (): Promise<IDelegationRewards>
  getRewards (validatorAddress: string): Promise<ICoin[]>
  getTotalStaked (): Promise<number>
  getMyValidatorDetails (validatorAddress: string): Promise<IStakingValidator>
  getAllMyValidatorDetails (): Promise<IStakingValidator[]>
  getValidatorDetails (validatorAddress: string): Promise<IStakingValidator>
  getAllValidatorDetails (status: string): Promise<IStakingValidator[]>
  claimDelegatorRewards (validatorAddresses: string[]): Promise<void>
  delegateTokens (validatorAddress: string, amount: number): Promise<void>

}
