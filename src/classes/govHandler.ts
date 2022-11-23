import { IGovHandler, IProtoHandler, IWalletHandler } from '@/interfaces/classes'
import { ICoin, IDelegationRewards, IDelegationSummary, IStakingValidator } from '@/interfaces'
import { finalizeGas } from '@/utils/gas'

export default class GovHandler implements IGovHandler {
  private readonly walletRef: IWalletHandler
  private readonly pH: IProtoHandler

  private constructor (wallet: IWalletHandler) {
    this.walletRef = wallet
    this.pH = wallet.getProtoHandler()
  }

  static async trackGov (wallet: IWalletHandler): Promise<IGovHandler> {
    return new GovHandler(wallet)
  }

  async getTotalRewards (): Promise<IDelegationRewards> {
    return await this.pH.distributionQuery.queryDelegationTotalRewards({
      delegatorAddress: this.walletRef.getJackalAddress()
    })
  }
  async getRewards (validatorAddress: string): Promise<ICoin[]> {
    return (await this.pH.distributionQuery.queryDelegationRewards({
      delegatorAddress: this.walletRef.getJackalAddress(),
      validatorAddress
    }))
      .rewards
  }
  async getTotalStaked (): Promise<number> {
    const delegations = (await this.pH.stakingQuery.queryDelegatorDelegations({
        delegatorAddr: this.walletRef.getJackalAddress()
      })).delegationResponses as IDelegationSummary[]
    return delegations.reduce((acc: number, del: IDelegationSummary) => {
      acc += Number(del.balance.amount)
      return acc
    }, 0)
  }
  async getMyValidators (): Promise<IStakingValidator[]> {
    return (await this.pH.stakingQuery.queryDelegatorValidators({
      delegatorAddr: this.walletRef.getJackalAddress()
    })).validators as IStakingValidator[]
  }
  async getMyValidatorDetails (validatorAddress: string): Promise<IStakingValidator> {
    const result = (await this.pH.stakingQuery.queryDelegatorValidator({
      delegatorAddr: this.walletRef.getJackalAddress(),
      validatorAddr: validatorAddress
    })).validator
    if (result) {
      return result as IStakingValidator
    } else {
      throw new Error('No Validator Details Found')
    }
  }
  async getValidatorDetails (validatorAddress: string): Promise<IStakingValidator> {
    const result = (await this.pH.stakingQuery.queryValidator({ validatorAddr: validatorAddress })).validator
    if (result) {
      return result as IStakingValidator
    } else {
      throw new Error('No Validator Details Found')
    }
  }
  async getAllValidatorDetails (status: string): Promise<IStakingValidator[]> {
    return (await this.pH.stakingQuery.queryValidators({ status })).validators as IStakingValidator[]
  }
  async getDelegatedValidators (): Promise<IStakingValidator[]> {
    return (await this.pH.stakingQuery.queryDelegatorValidators({
      delegatorAddr: this.walletRef.getJackalAddress()
    })).validators as IStakingValidator[]
  }
  async claimDelegatorRewards (validatorAddresses: string[]): Promise<void> {
    const { msgWithdrawDelegatorReward } = await this.pH.distributionTx
    const msgs = validatorAddresses.map((address: string) => {
      return msgWithdrawDelegatorReward({
        delegatorAddress: this.walletRef.getJackalAddress(),
        validatorAddress: address
      })
    })
    console.dir(await this.pH.broadcaster(msgs, { fee: finalizeGas(msgs), memo: '' }))
  }
  async delegateTokens (validatorAddress: string, amount: number): Promise<void> {
    const { msgDelegate } = await this.pH.stakingTx
    const msgs = msgDelegate({
      delegatorAddress: this.walletRef.getJackalAddress(),
      validatorAddress,
        amount: {
          denom: 'ujkl',
          amount: amount.toString()
        }
      })
    console.dir(await this.pH.broadcaster([msgs], { fee: finalizeGas([msgs]), memo: '' }))
  }
}
