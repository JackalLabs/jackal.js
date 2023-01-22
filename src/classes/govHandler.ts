import { IGovHandler, IProtoHandler, IWalletHandler } from '@/interfaces/classes'
import { ICoin, IDelegationRewards, IDelegationSummary, IStakingValidator } from '@/interfaces'
import { TValidatorStatus } from '@/types/TValidatorStatus'

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
    const ret = await this.pH.distributionQuery.queryDelegationTotalRewards({
      delegatorAddress: this.walletRef.getJackalAddress()
    })
    return ret.value
  }
  async getRewards (validatorAddress: string): Promise<ICoin[]> {
    return (await this.pH.distributionQuery.queryDelegationRewards({
      delegatorAddress: this.walletRef.getJackalAddress(),
      validatorAddress
    }))
      .value.rewards
  }
  async getTotalStaked (): Promise<number> {
    const delegations = (await this.pH.stakingQuery.queryDelegatorDelegations({
        delegatorAddr: this.walletRef.getJackalAddress()
      })).value.delegationResponses as IDelegationSummary[]
    return delegations.reduce((acc: number, del: IDelegationSummary) => {
      acc += Number(del.balance.amount)
      return acc
    }, 0)
  }
  async getMyValidators (): Promise<IStakingValidator[]> {
    return (await this.pH.stakingQuery.queryDelegatorValidators({
      delegatorAddr: this.walletRef.getJackalAddress()
    })).value.validators as IStakingValidator[]
  }
  async getMyValidatorDetails (validatorAddress: string): Promise<IStakingValidator> {
    const result = (await this.pH.stakingQuery.queryDelegatorValidator({
      delegatorAddr: this.walletRef.getJackalAddress(),
      validatorAddr: validatorAddress
    })).value.validator
    if (result) {
      return result as IStakingValidator
    } else {
      throw new Error('No Validator Details Found')
    }
  }
  async getValidatorDetails (validatorAddress: string): Promise<IStakingValidator> {
    const result = (await this.pH.stakingQuery.queryValidator({ validatorAddr: validatorAddress })).value.validator
    if (result) {
      return result as IStakingValidator
    } else {
      throw new Error('No Validator Details Found')
    }
  }
  async getAllValidatorDetails (status: TValidatorStatus): Promise<IStakingValidator[]> {
    return (await this.pH.stakingQuery.queryValidators({ status: statusMap[status.toUpperCase()] })).value.validators as IStakingValidator[]
  }
  async getDelegatedValidators (): Promise<IStakingValidator[]> {
    return (await this.pH.stakingQuery.queryDelegatorValidators({
      delegatorAddr: this.walletRef.getJackalAddress()
    })).value.validators as IStakingValidator[]
  }
  async claimDelegatorRewards (validatorAddresses: string[]): Promise<void> {
    const { msgWithdrawDelegatorReward } = await this.pH.distributionTx
    const msgs = validatorAddresses.map((address: string) => {
      return msgWithdrawDelegatorReward({
        delegatorAddress: this.walletRef.getJackalAddress(),
        validatorAddress: address
      })
    })
    // await this.pH.debugBroadcaster(msgs, true)
    await this.pH.debugBroadcaster(msgs)
  }
  async delegateTokens (validatorAddress: string, amount: number): Promise<void> {
    const { msgDelegate } = await this.pH.stakingTx
    const msg = msgDelegate({
      delegatorAddress: this.walletRef.getJackalAddress(),
      validatorAddress,
        amount: {
          denom: 'ujkl',
          amount: amount.toString()
        }
      })
    // await this.pH.debugBroadcaster([msg], true)
    await this.pH.debugBroadcaster([msg])
  }
}

const statusMap: { [key: string]: string } = {
  'ALL': '0',
  'UNSPECIFIED': '0',
  'UNBONDED': '1',
  'UNBONDING': '2',
  'BONDED': '3'
}
