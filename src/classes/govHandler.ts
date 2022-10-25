import {
  makeMasterBroadcaster,
  distributionQueryApi,
  distributionTxClient,
  distributionQueryClient,
  govQueryApi,
  govTxClient,
  govQueryClient,
  stakingQueryApi,
  stakingTxClient,
  stakingQueryClient
} from 'jackal.js-protos'
import { IGovHandler, IWalletHandler } from '../interfaces/classes'
import {
  IDelegationRewards,
  IStakingValidator
} from '../interfaces'
import { finalizeGas } from '../utils/gas'

export default class GovHandler implements IGovHandler {
  private walletRef: IWalletHandler
  txAddr26657: string
  queryAddr1317: string
  distributionTxClient: any
  distributionQueryClient: any
  govTxClient: any
  govQueryClient: any
  stakingTxClient: any
  stakingQueryClient: any

  private constructor (wallet: IWalletHandler, tAddr: string, qAddr: string, dTxClient: any, dQueryClient: any, gTxClient: any, gQueryClient: any, sTxClient: any, sQueryClient: any) {
    this.walletRef = wallet
    this.txAddr26657 = tAddr
    this.queryAddr1317 = qAddr
    this.distributionTxClient = dTxClient
    this.distributionQueryClient = dQueryClient
    this.govTxClient = gTxClient
    this.govQueryClient = gQueryClient
    this.stakingTxClient = sTxClient
    this.stakingQueryClient = sQueryClient
  }

  static async trackGov (wallet: IWalletHandler): Promise<IGovHandler> {
    const tAddr = wallet.txAddr26657
    const qAddr = wallet.queryAddr1317
    const dTxClient = await distributionTxClient(wallet.getSigner(), { addr: tAddr })
    const dQueryClient: distributionQueryApi<any> = await distributionQueryClient({ addr: qAddr })
    const gTxClient = await govTxClient(wallet.getSigner(), { addr: tAddr })
    const gQueryClient: govQueryApi<any> = await govQueryClient({ addr: qAddr })
    const sTxClient = await stakingTxClient(wallet.getSigner(), { addr: tAddr })
    const sQueryClient: stakingQueryApi<any> = await stakingQueryClient({ addr: qAddr })
    return new GovHandler(wallet, tAddr, qAddr, dTxClient, dQueryClient, gTxClient, gQueryClient, sTxClient, sQueryClient)
  }

  async getTotalRewards (): Promise<IDelegationRewards> {
    return await this.distributionQueryClient.queryDelegationTotalRewards(this.walletRef.getJackalAddress())
  }
  async getMyValidatorDetails (validatorAddress: string): Promise<IStakingValidator> {
    return (await this.stakingQueryClient.queryDelegatorValidator(this.walletRef.getJackalAddress(), validatorAddress)).validator
  }
  async getValidatorDetails (validatorAddress: string): Promise<IStakingValidator> {
    return (await this.stakingQueryClient.queryValidator(validatorAddress)).validator
  }
  async getAllValidatorDetails (): Promise<IStakingValidator[]> {
    return (await this.stakingQueryClient.queryValidators()).validator
  }
  async claimDelegatorRewards (validatorAddresses: string[]): Promise<void> {
    const { masterBroadcaster } = await makeMasterBroadcaster(this.walletRef.getSigner(), { addr: this.txAddr26657 })
    const { msgWithdrawDelegatorReward } = await this.distributionTxClient
    const msgs = validatorAddresses.map((address: string) => {
      return msgWithdrawDelegatorReward({
        delegator_address: this.walletRef.getJackalAddress(),
        validator_address: address
      })
    })
    console.dir(await masterBroadcaster(msgs, { fee: finalizeGas(msgs), memo: '' }))
  }
  async delegateTokens (delegator_address: string, validator_address: string, amount: number): Promise<void> {
    const { masterBroadcaster } = await makeMasterBroadcaster(this.walletRef.getSigner(), { addr: this.txAddr26657 })
    const { msgDelegate } = await this.stakingTxClient
    const msgs = msgDelegate({
        delegator_address: this.walletRef.getJackalAddress(),
        validator_address,
        amount: {
          denom: 'ujkl',
          amount: amount.toString()
        }
      })
    console.dir(await masterBroadcaster([msgs], { fee: finalizeGas([msgs]), memo: '' }))
  }
}
