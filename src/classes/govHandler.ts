import { IGovHandler, IProtoHandler, IWalletHandler } from '@/interfaces/classes'
import { ICoin, IDelegationRewards, IDelegationSummary, IStakingValidator } from '@/interfaces'
import { TValidatorStatus } from '@/types/TValidatorStatus'
import IStakingValidatorMap from '@/interfaces/IStakingValidatorMap'
import IStakingValidatorExtendedMap from '@/interfaces/IStakingValidatorExtendedMap'

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
  async getDelegatorValidatorDetails (validatorAddress: string): Promise<IStakingValidator> {
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
  async getAllDelegatorValidatorDetails (): Promise<IStakingValidator[]> {
    return (await this.pH.stakingQuery.queryDelegatorValidators({
      delegatorAddr: this.walletRef.getJackalAddress()
    })).value.validators as IStakingValidator[]
  }
  async getAllDelegatorValidatorDetailsMap (): Promise<IStakingValidatorMap> {
    const vals = await this.getAllDelegatorValidatorDetails()
    return vals
      .reduce((acc, curr) => {
        acc[curr.operatorAddress] = curr
        return acc
      }, {} as IStakingValidatorMap)
  }
  async getValidatorDetails (validatorAddress: string): Promise<IStakingValidator> {
    const result = (await this.pH.stakingQuery.queryValidator({
      validatorAddr: validatorAddress
    })).value.validator
    if (result) {
      return result as IStakingValidator
    } else {
      throw new Error('No Validator Details Found')
    }
  }
  async getAllValidatorDetails (status: TValidatorStatus): Promise<IStakingValidator[]> {
    return (await this.pH.stakingQuery.queryValidators({
      status: statusMap[status.toUpperCase()]
    })).value.validators as IStakingValidator[]
  }
  async getAllValidatorDetailsMap (status: TValidatorStatus): Promise<IStakingValidatorMap> {
    const vals = await this.getAllValidatorDetails(status)
    return vals
      .reduce((acc, curr) => {
        acc[curr.operatorAddress] = curr
        return acc
      }, {} as IStakingValidatorMap)
  }
  async getMergedValidatorDetailsMap (status: TValidatorStatus): Promise<IStakingValidatorExtendedMap> {
    const staked = await this.getAllDelegatorValidatorDetailsMap()
    const allOfStatus = await this.getAllValidatorDetailsMap(status)
    const complete: IStakingValidatorExtendedMap = {}
    for (let val in allOfStatus) {
      if (staked[val]) {
        complete[val] = { ...allOfStatus[val], stakedWith: true }
      } else {
        complete[val] = { ...allOfStatus[val], stakedWith: false }
      }
    }
    return complete
  }
  async getCompleteMergedValidatorDetailsMap (): Promise<IStakingValidatorExtendedMap> {
    const staked = await this.getAllDelegatorValidatorDetailsMap()
    const allUnbonding = this.getAllValidatorDetailsMap('UNBONDING')
    const allUnbonded = this.getAllValidatorDetailsMap('UNBONDED')
    const allActive = this.getAllValidatorDetailsMap('BONDED')
    const merged = { ...await allUnbonding, ...await allUnbonded, ...await allActive }
    const complete: IStakingValidatorExtendedMap = {}
    for (let val in merged) {
      if (staked[val]) {
        complete[val] = { ...merged[val], stakedWith: true }
      } else {
        complete[val] = { ...merged[val], stakedWith: false }
      }
    }
    return complete
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
    await this.pH.debugBroadcaster(msgs, {})
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
    await this.pH.debugBroadcaster([msg], {})
  }
}

const statusMap: { [key: string]: string } = {
  'UNSPECIFIED': 'BOND_STATUS_UNSPECIFIED',
  'UNBONDED': 'BOND_STATUS_UNBONDED',
  'UNBONDING': 'BOND_STATUS_UNBONDING',
  'BONDED': 'BOND_STATUS_BONDED'
}
