import { IGovHandler, IWalletHandler } from '../interfaces/classes'
import {
  IDelegationRewards,
  IDelegationSummary,
  IStakingValidator
} from '../interfaces'
import { finalizeGas } from '../utils/gas'

export default class GovHandler implements IGovHandler {
  private readonly walletRef: IWalletHandler
  private readonly pH: any

  private constructor (wallet: IWalletHandler) {
    this.walletRef = wallet
    this.pH = wallet.pH
  }

  static async trackGov (wallet: IWalletHandler): Promise<IGovHandler> {
    return new GovHandler(wallet)
  }

  async getTotalRewards (): Promise<IDelegationRewards> {
    return await this.pH.distributionQuery.queryDelegationTotalRewards(this.walletRef.getJackalAddress())
  }
  async getRewards (): Promise<IDelegationRewards> {
    return await this.pH.distributionQuery.queryDelegation(this.walletRef.getJackalAddress())
  }
  async getTotalStaked (): Promise<number> {
    const delegations: IDelegationSummary[] = (await this.pH.stakingQuery.queryDelegatorDelegations(this.walletRef.getJackalAddress())).data.delegation_responses
    return delegations.reduce((acc: number, del: IDelegationSummary) => {
      acc += Number(del.balance.amount)
      return acc
    }, 0)
  }

  async getMyValidatorDetails (validatorAddress: string): Promise<IStakingValidator> {
    return (await this.pH.stakingQuery.queryDelegatorValidator(this.walletRef.getJackalAddress(), validatorAddress)).validator
  }
  async getValidatorDetails (validatorAddress: string): Promise<IStakingValidator> {
    return (await this.pH.stakingQuery.queryValidator(validatorAddress)).validator
  }
  async getAllValidatorDetails (): Promise<IStakingValidator[]> {
    return (await this.pH.stakingQuery.queryValidators()).validator
  }
  async delegatedValidators (): Promise<IStakingValidator[]> {
    return (await this.pH.stakingQuery.queryDelegatorValidators(this.walletRef.getJackalAddress())).validators
  }
  async claimDelegatorRewards (validatorAddresses: string[]): Promise<void> {
    const { msgWithdrawDelegatorReward } = await this.pH.distributionTx
    const msgs = validatorAddresses.map((address: string) => {
      return msgWithdrawDelegatorReward({
        delegator_address: this.walletRef.getJackalAddress(),
        validator_address: address
      })
    })
    console.dir(await this.pH.broadcaster(msgs, { fee: finalizeGas(msgs), memo: '' }))
  }
  async delegateTokens (delegator_address: string, validator_address: string, amount: number): Promise<void> {
    const { msgDelegate } = await this.pH.stakingTx
    const msgs = msgDelegate({
        delegator_address: this.walletRef.getJackalAddress(),
        validator_address,
        amount: {
          denom: 'ujkl',
          amount: amount.toString()
        }
      })
    console.dir(await this.pH.broadcaster([msgs], { fee: finalizeGas([msgs]), memo: '' }))
  }
}
