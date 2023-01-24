import { IDelegationRewards, IStakingValidator } from '@/interfaces/'
import ICoin from '@/interfaces/ICoin'

export default interface IGovHandler {

  getTotalRewards (): Promise<IDelegationRewards>
  getRewards (validatorAddress: string): Promise<ICoin[]>
  getTotalStaked (): Promise<number>
  getDelegatorValidatorDetails (validatorAddress: string): Promise<IStakingValidator>
  getAllDelegatorValidatorDetails (): Promise<IStakingValidator[]>
  getValidatorDetails (validatorAddress: string): Promise<IStakingValidator>
  getAllValidatorDetails (status: string): Promise<IStakingValidator[]>
  claimDelegatorRewards (validatorAddresses: string[]): Promise<void>
  delegateTokens (validatorAddress: string, amount: number): Promise<void>

}
