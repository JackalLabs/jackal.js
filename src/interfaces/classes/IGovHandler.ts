import { IDelegationRewards, IStakingValidator } from '../'

export default interface IGovHandler {
  txAddr26657: string
  queryAddr1317: string
  distributionTxClient: any
  distributionQueryClient: any
  govTxClient: any
  govQueryClient: any
  stakingTxClient: any
  stakingQueryClient: any

  getTotalRewards (): Promise<IDelegationRewards>
  getMyValidatorDetails (validatorAddress: string): Promise<IStakingValidator>
  getValidatorDetails (validatorAddress: string): Promise<IStakingValidator>
  getAllValidatorDetails (): Promise<IStakingValidator[]>
  claimDelegatorRewards (validatorAddresses: string[]): Promise<void>

}
