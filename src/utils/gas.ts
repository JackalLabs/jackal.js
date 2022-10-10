import { EncodeObject } from '@cosmjs/proto-signing'
import IGasHashMap from '../interfaces/IGasHashMap'
import IGasRate from '../interfaces/IGasRate'

const hashMap: IGasHashMap = {
  // filetree
  '/jackaldao.canine.filetree.MsgPostFile': 45,
  '/jackaldao.canine.filetree.MsgInitAll': 50,
  // storage
  '/jackaldao.canine.storage.MsgPostContract': 55
}
const baseRate = 60

export function estimateGas (msgArray: EncodeObject[]): number {
  const gas = msgArray.reduce((acc, curr) => {
    return acc + (hashMap[curr.typeUrl] || 0)
  }, 0)
  return (gas + baseRate) * 1000
}
/** @private */
export function finalizeGas (msgArray: EncodeObject[]): IGasRate {
  // const totalGas = estimateGas(msgArray)
  return {
    amount: [],
    gas: '100000'
    // gas: totalGas.toString()
  }
}
