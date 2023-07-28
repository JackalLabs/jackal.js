import {
  IGovHandler,
  IQueryHandler,
  IWalletHandler
} from '@/interfaces/classes'
import {
  ICoin,
  IDelegationRewards,
  IDelegationSummary,
  IDelegationSummaryMap,
  IPropDetails,
  IPropDetailsMap,
  IStakingValidator,
  IStakingValidatorExtendedMap,
  IStakingValidatorMap,
  IStakingValidatorStakedMap
} from '@/interfaces'
import { TValidatorStatus } from '@/types/TValidatorStatus'
import { EncodeObject } from '@cosmjs/proto-signing'
import { TPropStatus } from '@/types/TPropStatus'
import { signerNotEnabled } from '@/utils/misc'

export default class GovHandler implements IGovHandler {
  private readonly walletRef: IWalletHandler
  private readonly qH: IQueryHandler

  /**
   * Create a GovHandler instance.
   * @param {IWalletHandler} wallet - Instance of WalletHandler.
   * @private
   */
  private constructor(wallet: IWalletHandler) {
    this.walletRef = wallet
    this.qH = wallet.getQueryHandler()
  }

  /**
   * Async wrapper to create a GovHandler instance.
   * @param {IWalletHandler} wallet - Instance of WalletHandler.
   * @returns {Promise<IGovHandler>} - Instance of GovHandler.
   */
  static async trackGov(wallet: IWalletHandler): Promise<IGovHandler> {
    return new GovHandler(wallet)
  }

  /** Staking Queries */
  /**
   * Query all individual rewards for all delegators on all validators.
   * @returns {Promise<IDelegationRewards>}
   */
  async getTotalRewards(): Promise<IDelegationRewards> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('GovHandler', 'getTotalRewards'))
    const ret = await this.qH.distributionQuery.queryDelegationTotalRewards({
      delegatorAddress: this.walletRef.getJackalAddress()
    })
    return ret.value
  }

  /**
   * Query total rewards for all delegators on all validators.
   * @returns {Promise<number>}
   */
  async getCondensedTotalRewards(): Promise<number> {
    if (!this.walletRef.traits)
      throw new Error(
        signerNotEnabled('GovHandler', 'getCondensedTotalRewards')
      )
    const ret = await this.qH.distributionQuery.queryDelegationTotalRewards({
      delegatorAddress: this.walletRef.getJackalAddress()
    })
    return ret.value.total.reduce((acc: number, coin: ICoin) => {
      acc += Number(coin.amount)
      return acc
    }, 0)
  }

  /**
   * Query all individual rewards for all delegators on target validator.
   * @param {string} validatorAddress - Bech32 address of validator.
   * @returns {Promise<ICoin[]>}
   */
  async getRewards(validatorAddress: string): Promise<ICoin[]> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('GovHandler', 'getRewards'))
    const ret = await this.qH.distributionQuery.queryDelegationRewards({
      delegatorAddress: this.walletRef.getJackalAddress(),
      validatorAddress
    })
    return ret.value.rewards
  }

  /**
   * Query total rewards for all delegators on target validator.
   * @param {string} validatorAddress - Bech32 address of validator.
   * @returns {Promise<number>}
   */
  async getCondensedRewards(validatorAddress: string): Promise<number> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('GovHandler', 'getCondensedRewards'))
    const ret = await this.qH.distributionQuery.queryDelegationRewards({
      delegatorAddress: this.walletRef.getJackalAddress(),
      validatorAddress
    })
    return ret.value.rewards.reduce((acc: number, coin: ICoin) => {
      acc += fixRewardsOffset(coin.amount)
      return acc
    }, 0)
  }

  /**
   * Query total $JKL staked for target delegator on all validators.
   * @returns {Promise<number>}
   */
  async getTotalStaked(): Promise<number> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('GovHandler', 'getTotalStaked'))
    const delegations = (
      await this.qH.stakingQuery.queryDelegatorDelegations({
        delegatorAddr: this.walletRef.getJackalAddress()
      })
    ).value.delegationResponses as IDelegationSummary[]
    return delegations.reduce((acc: number, del: IDelegationSummary) => {
      acc += Math.round(Number(del.balance.amount))
      return acc
    }, 0)
  }

  /**
   * Query $JKL staked for target delegator on all validators as map of validator Bech32 addresses.
   * @returns {Promise<IDelegationSummaryMap>}
   */
  async getStakedMap(): Promise<IDelegationSummaryMap> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('GovHandler', 'getStakedMap'))
    const delegations = (
      await this.qH.stakingQuery.queryDelegatorDelegations({
        delegatorAddr: this.walletRef.getJackalAddress()
      })
    ).value.delegationResponses as IDelegationSummary[]
    return delegations.reduce(
      (acc: IDelegationSummaryMap, del: IDelegationSummary) => {
        acc[del.delegation.validatorAddress] = del
        return acc
      },
      {}
    )
  }

  /**
   * Query details for only validators user delegates to and amount delegated.
   * @returns {Promise<IStakingValidatorStakedMap>}
   */
  async getStakedValidatorDetailsMap(): Promise<IStakingValidatorStakedMap> {
    const allVals = await this.getCompleteMergedValidatorDetailsMap()
    const staked = await this.getStakedMap()
    return await includeStaked(allVals, staked, true)
  }

  /**
   * Query details of target validator user is delegated to.
   * @param {string} validatorAddress - Bech32 address of validator.
   * @returns {Promise<IStakingValidator>}
   */
  async getDelegatorValidatorDetails(
    validatorAddress: string
  ): Promise<IStakingValidator> {
    if (!this.walletRef.traits)
      throw new Error(
        signerNotEnabled('GovHandler', 'getDelegatorValidatorDetails')
      )
    const result = (
      await this.qH.stakingQuery.queryDelegatorValidator({
        delegatorAddr: this.walletRef.getJackalAddress(),
        validatorAddr: validatorAddress
      })
    ).value.validator
    if (result) {
      return result as IStakingValidator
    } else {
      throw new Error('No Validator Details Found')
    }
  }

  /**
   * Query details for all validator details user is delegated to.
   * @returns {Promise<IStakingValidator[]>}
   */
  async getAllDelegatorValidatorDetails(): Promise<IStakingValidator[]> {
    if (!this.walletRef.traits)
      throw new Error(
        signerNotEnabled('GovHandler', 'getAllDelegatorValidatorDetails')
      )
    return (
      await this.qH.stakingQuery.queryDelegatorValidators({
        delegatorAddr: this.walletRef.getJackalAddress()
      })
    ).value.validators as IStakingValidator[]
  }

  /**
   * Query details for all validator details user is delegated to as a Map. Wraps getAllDelegatorValidatorDetails().
   * @returns {Promise<IStakingValidatorMap>}
   */
  async getAllDelegatorValidatorDetailsMap(): Promise<IStakingValidatorMap> {
    const vals = await this.getAllDelegatorValidatorDetails()
    return vals.reduce((acc: IStakingValidatorMap, curr: IStakingValidator) => {
      acc[curr.operatorAddress] = curr
      return acc
    }, {})
  }

  /**
   * Query details of target validator.
   * @param {string} validatorAddress - Bech32 address of validator.
   * @returns {Promise<IStakingValidator>}
   */
  async getValidatorDetails(
    validatorAddress: string
  ): Promise<IStakingValidator> {
    const result = (
      await this.qH.stakingQuery.queryValidator({
        validatorAddr: validatorAddress
      })
    ).value.validator
    if (result) {
      return result as IStakingValidator
    } else {
      throw new Error('No Validator Details Found')
    }
  }

  /**
   * Query details for all validators with target status.
   * @param {TValidatorStatus} status - String matching 1 of the 4 TValidatorStatus statuses.
   * @returns {Promise<IStakingValidator[]>}
   */
  async getAllValidatorDetails(
    status: TValidatorStatus
  ): Promise<IStakingValidator[]> {
    return (
      await this.qH.stakingQuery.queryValidators({
        status: validatorStatusMap[status.toUpperCase()]
      })
    ).value.validators as IStakingValidator[]
  }

  /**
   * Query details for all validators with target status as Map. Wraps getAllValidatorDetails().
   * @param {TValidatorStatus} status - String matching 1 of the 4 TValidatorStatus statuses.
   * @returns {Promise<IStakingValidatorMap>}
   */
  async getAllValidatorDetailsMap(
    status: TValidatorStatus
  ): Promise<IStakingValidatorMap> {
    const vals = await this.getAllValidatorDetails(status)
    return vals.reduce((acc, curr) => {
      acc[curr.operatorAddress] = curr
      return acc
    }, {} as IStakingValidatorMap)
  }

  /**
   * Query details for all validators with user delegation and all validators with target status as Map.
   * Wraps getAllDelegatorValidatorDetailsMap() and getAllValidatorDetailsMap().
   * @param {TValidatorStatus} status - String matching 1 of the 4 TValidatorStatus statuses.
   * @returns {Promise<IStakingValidatorExtendedMap>}
   */
  async getMergedValidatorDetailsMap(
    status: TValidatorStatus
  ): Promise<IStakingValidatorExtendedMap> {
    const staked = await this.getAllDelegatorValidatorDetailsMap()
    const allOfStatus = await this.getAllValidatorDetailsMap(status)
    return flagStaked(allOfStatus, staked)
  }

  /**
   * Query details including staking details for all validators with user delegation and all validators with target status as Map.
   * Wraps getAllDelegatorValidatorDetailsMap() and getAllValidatorDetailsMap().
   * @param {TValidatorStatus} status - String matching 1 of the 4 TValidatorStatus statuses.
   * @returns {Promise<IStakingValidatorStakedMap>}
   */
  async getMergedValidatorDetailsStakedMap(
    status: TValidatorStatus
  ): Promise<IStakingValidatorStakedMap> {
    const staked = await this.getAllDelegatorValidatorDetailsMap()
    const allOfStatus = await this.getAllValidatorDetailsMap(status)
    const flagged = flagStaked(allOfStatus, staked)
    const stakedMap = await this.getStakedMap()
    return await includeStaked(flagged, stakedMap)
  }

  /**
   * Query details including staking details for all validators with user delegation and all validators with an inactive status as Map.
   * Wraps getAllDelegatorValidatorDetailsMap() and getInactiveMergedValidatorDetailsMap().
   * @returns {Promise<IStakingValidatorExtendedMap>}
   */
  async getInactiveMergedValidatorDetailsStakedMap(): Promise<IStakingValidatorExtendedMap> {
    const staked = await this.getAllDelegatorValidatorDetailsMap()
    const allInactive = await this.getInactiveMergedValidatorDetailsMap()
    const flagged = flagStaked(allInactive, staked)
    const stakedMap = await this.getStakedMap()
    return await includeStaked(flagged, stakedMap)
  }

  /**
   * Query details for all validators with user delegation and all validators with an inactive status as Map.
   * Wraps getAllDelegatorValidatorDetailsMap() and getAllValidatorDetailsMap().
   * @returns {Promise<IStakingValidatorExtendedMap>}
   */
  async getInactiveMergedValidatorDetailsMap(): Promise<IStakingValidatorExtendedMap> {
    const staked = this.getAllDelegatorValidatorDetailsMap()
    const allUnbonding = this.getAllValidatorDetailsMap('UNBONDING')
    const allUnbonded = this.getAllValidatorDetailsMap('UNBONDED')
    const merged = { ...(await allUnbonding), ...(await allUnbonded) }
    return flagStaked(merged, await staked)
  }

  /**
   * Query details including staking details for all validators as Map.
   * Wraps getAllDelegatorValidatorDetailsMap() and getAllValidatorDetailsMap().
   * @returns {Promise<IStakingValidatorExtendedMap>}
   */
  async getCompleteMergedValidatorDetailsMap(): Promise<IStakingValidatorExtendedMap> {
    const staked = this.getAllDelegatorValidatorDetailsMap()
    const allUnbonding = this.getAllValidatorDetailsMap('UNBONDING')
    const allUnbonded = this.getAllValidatorDetailsMap('UNBONDED')
    const allActive = this.getAllValidatorDetailsMap('BONDED')
    const merged = {
      ...(await allUnbonding),
      ...(await allUnbonded),
      ...(await allActive)
    }
    return flagStaked(merged, await staked)
  }

  /**
   * Query details including public staking details for all validators as Map. Wraps getAllValidatorDetailsMap().
   * @param {TValidatorStatus} status - String matching 1 of the 4 TValidatorStatus statuses.
   * @returns {Promise<IStakingValidatorStakedMap>}
   */
  async getPublicMergedValidatorDetailsMap(
    status: TValidatorStatus
  ): Promise<IStakingValidatorStakedMap> {
    const allOfStatus = await this.getAllValidatorDetailsMap(status)
    return await includeStaked(flagStaked(allOfStatus, {}), {})
  }

  /**
   * Query details including public staking details for all inactive status validators as Map. Wraps getAllValidatorDetailsMap().
   * @returns {Promise<IStakingValidatorExtendedMap>}
   */
  async getPublicInactiveMergedValidatorDetailsStakedMap(): Promise<IStakingValidatorExtendedMap> {
    const allUnbonding = this.getAllValidatorDetailsMap('UNBONDING')
    const allUnbonded = this.getAllValidatorDetailsMap('UNBONDED')
    const merged = { ...(await allUnbonding), ...(await allUnbonded) }
    return flagStaked(merged, {})
  }
  /** End Staking Queries */
  /** Voting Queries */
  /**
   * Query details of target governance proposal.
   * @param {number} proposalId - Index of proposal.
   * @returns {Promise<IPropDetails>}
   */
  async getPropDetails(proposalId: number): Promise<IPropDetails> {
    const prop = await this.qH.govQuery.queryProposal({
      proposalId
    })
    return prop.value.proposal as IPropDetails
  }

  /**
   * Query details of all governance proposals with target status.
   * @param {TPropStatus} status - String matching 1 of the 7 TPropStatus statuses.
   * @returns {Promise<IPropDetails[]>}
   */
  async getAllPropDetailsInStatus(
    status: TPropStatus
  ): Promise<IPropDetails[]> {
    return (
      await this.qH.govQuery.queryProposals({
        proposalStatus: propStatusMap[status.toUpperCase()]
      })
    ).value.proposals as IPropDetails[]
  }

  /**
   * Query details of all governance proposals with target status as Map. Wraps getAllPropDetailsInStatus().
   * @param {TPropStatus} status - String matching 1 of the 7 TPropStatus statuses.
   * @returns {Promise<IPropDetailsMap>}
   */
  async getAllPropDetailsInStatusMap(
    status: TPropStatus
  ): Promise<IPropDetailsMap> {
    const props = await this.getAllPropDetailsInStatus(status)
    return props.reduce((acc, curr) => {
      acc[curr.proposalId] = curr
      return acc
    }, {} as IPropDetailsMap)
  }

  /**
   * Query details of all governance proposals with a completed status as Map. Wraps getAllPropDetailsInStatus().
   * @returns {Promise<IPropDetailsMap>}
   */
  async getAllCompletedPropDetailsMap(): Promise<IPropDetailsMap> {
    const allPassed = this.getAllPropDetailsInStatusMap('PASSED')
    const allVeto = this.getAllPropDetailsInStatusMap('VETO')
    const allFailed = this.getAllPropDetailsInStatusMap('FAILED')
    return { ...(await allVeto), ...(await allFailed), ...(await allPassed) }
  }
  /** End Voting Queries */
  /** Staking Msgs */
  /**
   * Claim user's staking rewards for target validator.
   * @param {string[]} validatorAddresses - Bech32 address of validator.
   * @returns {Promise<void>}
   */
  async claimDelegatorRewards(validatorAddresses: string[]): Promise<void> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('GovHandler', 'claimDelegatorRewards'))
    const pH = this.walletRef.getProtoHandler()
    const msgs = validatorAddresses.map((address: string) => {
      return pH.distributionTx.msgWithdrawDelegatorReward({
        delegatorAddress: this.walletRef.getJackalAddress(),
        validatorAddress: address
      })
    })
    await pH.debugBroadcaster(msgs, {})
  }

  /**
   * Creates and returns Staking EncodeObject instances for external consumption by a signAndBroadcast.
   * @param {string} validatorAddress - Bech32 address of validator.
   * @param {number | string} amount - Amount to delegate in ujkl.
   * @returns {EncodeObject}
   */
  rawDelegateTokens(
    validatorAddress: string,
    amount: number | string
  ): EncodeObject {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('GovHandler', 'rawDelegateTokens'))
    const pH = this.walletRef.getProtoHandler()
    return pH.stakingTx.msgDelegate({
      delegatorAddress: this.walletRef.getJackalAddress(),
      validatorAddress,
      amount: {
        denom: 'ujkl',
        amount: amount.toString()
      }
    })
  }

  /**
   * Delegates specified amount of tokens to target validator. Wraps rawDelegateTokens().
   * @param {string} validatorAddress - Bech32 address of validator.
   * @param {number | string} amount - Amount to delegate in ujkl.
   * @returns {Promise<void>}
   */
  async delegateTokens(
    validatorAddress: string,
    amount: number | string
  ): Promise<void> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('GovHandler', 'delegateTokens'))
    const pH = this.walletRef.getProtoHandler()
    const msg = this.rawDelegateTokens(validatorAddress, amount)
    await pH.debugBroadcaster([msg], {})
  }

  /**
   * Creates and returns Staking EncodeObject instances for external consumption by a signAndBroadcast.
   * @param {string} validatorAddress - Bech32 address of validator.
   * @param {number | string} amount - Amount to undelegate in ujkl.
   * @returns {EncodeObject}
   */
  rawUndelegateTokens(
    validatorAddress: string,
    amount: number | string
  ): EncodeObject {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('GovHandler', 'rawUndelegateTokens'))
    const pH = this.walletRef.getProtoHandler()
    return pH.stakingTx.msgUndelegate({
      delegatorAddress: this.walletRef.getJackalAddress(),
      validatorAddress,
      amount: {
        denom: 'ujkl',
        amount: amount.toString()
      }
    })
  }

  /**
   * Undelegates specified amount of tokens from target validator. Wraps rawUndelegateTokens().
   * @param {string} validatorAddress - Bech32 address of validator.
   * @param {number | string} amount - Amount to undelegate in ujkl.
   * @returns {Promise<void>}
   */
  async undelegateTokens(
    validatorAddress: string,
    amount: number | string
  ): Promise<void> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('GovHandler', 'undelegateTokens'))
    const pH = this.walletRef.getProtoHandler()
    const msg = this.rawUndelegateTokens(validatorAddress, amount)
    await pH.debugBroadcaster([msg], {})
  }

  /**
   * Creates and returns Staking EncodeObject instances for external consumption by a signAndBroadcast.
   * @param {string} fromAddress - Bech32 address of source validator.
   * @param {string} toAddress - Bech32 address of receiving validator.
   * @param {number | string} amount - Amount to undelegate in ujkl.
   * @returns {EncodeObject}
   */
  rawRedelegateTokens(
    fromAddress: string,
    toAddress: string,
    amount: number | string
  ): EncodeObject {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('GovHandler', 'rawRedelegateTokens'))
    const pH = this.walletRef.getProtoHandler()
    return pH.stakingTx.msgBeginRedelegate({
      delegatorAddress: this.walletRef.getJackalAddress(),
      validatorSrcAddress: fromAddress,
      validatorDstAddress: toAddress,
      amount: {
        denom: 'ujkl',
        amount: amount.toString()
      }
    })
  }

  /**
   * Redelegates specified amount of tokens between target validators. Wraps rawRedelegateTokens().
   * @param {string} fromAddress - Bech32 address of source validator.
   * @param {string} toAddress - Bech32 address of receiving validator.
   * @param {number | string} amount - Amount to undelegate in ujkl.
   * @returns {Promise<void>}
   */
  async redelegateTokens(
    fromAddress: string,
    toAddress: string,
    amount: number | string
  ): Promise<void> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('GovHandler', 'redelegateTokens'))
    const pH = this.walletRef.getProtoHandler()
    const msg = this.rawRedelegateTokens(fromAddress, toAddress, amount)
    await pH.debugBroadcaster([msg], {})
  }
  /** End Staking Msgs */
  /** Voting Msgs */

  /** End Voting Msgs */
}

/** Helpers */
const validatorStatusMap: { [key: string]: string } = {
  UNSPECIFIED: 'BOND_STATUS_UNSPECIFIED',
  UNBONDED: 'BOND_STATUS_UNBONDED',
  UNBONDING: 'BOND_STATUS_UNBONDING',
  BONDED: 'BOND_STATUS_BONDED'
}
const propStatusMap: { [key: string]: number } = {
  UNSPECIFIED: 0,
  DEPOSIT: 1,
  VOTING: 2,
  PASSED: 3,
  VETO: 4,
  FAILED: 5,
  UNRECOGNIZED: -1
}

/**
 * Flags members of the base Map as stakedWith: true if the member is in the staked Map.
 * @param {IStakingValidatorMap} base - Map of validators to check.
 * @param {IStakingValidatorMap} staked - Map of user's staked validators to check against.
 * @returns {IStakingValidatorExtendedMap}
 * @private
 */
function flagStaked(
  base: IStakingValidatorMap,
  staked: IStakingValidatorMap
): IStakingValidatorExtendedMap {
  const final: IStakingValidatorExtendedMap = {}
  for (let val in base) {
    if (staked[val]) {
      final[val] = { ...base[val], stakedWith: true }
    } else {
      final[val] = { ...base[val], stakedWith: false }
    }
  }
  return final
}

/**
 * Checks members of the flagged Map and includes staking details if the member is in the stakedMap Map.
 * @param {IStakingValidatorExtendedMap} flagged - Map of validators to check.
 * @param {IDelegationSummaryMap} stakedMap - Map of user's staked validators to check against.
 * @param {boolean} ignore - True to discard all flagged members not in stakedMap from results.
 * @returns {Promise<IStakingValidatorStakedMap>}
 * @private
 */
async function includeStaked(
  flagged: IStakingValidatorExtendedMap,
  stakedMap: IDelegationSummaryMap,
  ignore?: boolean
): Promise<IStakingValidatorStakedMap> {
  const final: IStakingValidatorStakedMap = {}
  for (let val in flagged) {
    if (stakedMap[val]) {
      final[val] = { ...flagged[val], stakedDetails: stakedMap[val] }
    } else if (ignore) {
      // do nothing
    } else {
      final[val] = { ...flagged[val] }
    }
  }
  return final
}

/**
 * Adjust staking rewards decimal to match ujkl.
 * @param {string | number} reward - Value to adjust.
 * @returns {number}
 * @private
 */
function fixRewardsOffset(reward: string | number) {
  const num = Number(reward) || 0
  const shifted = num / 10000000000000000 /** 1e+16 */
  return Math.round(shifted) / 100 /** Total Shift 1e+18 */
}
