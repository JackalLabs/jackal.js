import { EncodeObject } from '@cosmjs/proto-signing'
import IGasHashMap from '@/interfaces/IGasHashMap'
import IGasRate from '@/interfaces/IGasRate'

const hashMap: IGasHashMap = {
  /** Filetree */
  /** RNS */
  '/jackaldao.canine.rns.MsgAcceptBid': 142,
  '/jackaldao.canine.rns.MsgAddRecord': 142,
  '/jackaldao.canine.rns.MsgBid': 142,
  '/jackaldao.canine.rns.MsgBuy': 142,
  '/jackaldao.canine.rns.MsgCancelBid': 142,
  '/jackaldao.canine.rns.MsgDelist': 142,
  '/jackaldao.canine.rns.MsgDelRecord': 142,
  '/jackaldao.canine.rns.MsgInit': 142,
  '/jackaldao.canine.rns.MsgList': 142,
  '/jackaldao.canine.rns.MsgRegister': 142,
  '/jackaldao.canine.rns.MsgTransfer': 142,
  /** Storage */
  '/jackaldao.canine.storage.MsgPostContract': 142,
  '/jackaldao.canine.storage.MsgPostproof': 142,
  '/jackaldao.canine.storage.MsgSignContract': 142,
  '/jackaldao.canine.storage.MsgSetProviderIP': 142,
  '/jackaldao.canine.storage.MsgSetProviderKeybase': 142,
  '/jackaldao.canine.storage.MsgSetProviderTotalspace': 142,
  '/jackaldao.canine.storage.MsgInitProvider': 142,
  '/jackaldao.canine.storage.MsgCancelContract': 142,
  '/jackaldao.canine.storage.MsgBuyStorage': 142,
  '/jackaldao.canine.storage.MsgClaimStray': 142,
  /** Bank */
  '/cosmos.bank.v1beta1.MsgMultiSend': 142,
  '/cosmos.bank.v1beta1.MsgSend': 142,
  /** Distribution */
  '/cosmos.distribution.v1beta1.MsgFundCommunityPool': 142,
  '/cosmos.distribution.v1beta1.MsgSetWithdrawAddress': 142,
  '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward': 142,
  '/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission': 142,
  /** Gov */
  '/cosmos.gov.v1beta1.MsgDeposit': 142,
  '/cosmos.gov.v1beta1.MsgSubmitProposal': 142,
  '/cosmos.gov.v1beta1.MsgVote': 142,
  '/cosmos.gov.v1beta1.MsgVoteWeighted': 142,
  /** Staking */
  '/cosmos.staking.v1beta1.MsgBeginRedelegate': 142,
  '/cosmos.staking.v1beta1.MsgCreateValidator': 142,
  '/cosmos.staking.v1beta1.MsgDelegate': 142,
  '/cosmos.staking.v1beta1.MsgEditValidator': 142,
  '/cosmos.staking.v1beta1.MsgUndelegate': 142
}
const baseRate = 142

export function estimateGas (msgArray: EncodeObject[]): number {
  const gas = msgArray.reduce((acc, curr) => {
    console.log(`${curr.typeUrl} : ${hashMap[curr.typeUrl]}`)
    return acc + (hashMap[curr.typeUrl] || 0)
  }, 0)
  return (gas + baseRate) * 1000
}
/** @private */
export function finalizeGas (msgArray: EncodeObject[]): IGasRate {
  const totalGas = estimateGas(msgArray)
  return {
    amount: [],
    // gas: '2000000'
    gas: totalGas.toString()
  }
}
