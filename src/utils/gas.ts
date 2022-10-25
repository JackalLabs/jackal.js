import { EncodeObject } from '@cosmjs/proto-signing'
import IGasHashMap from '../interfaces/IGasHashMap'
import IGasRate from '../interfaces/IGasRate'

const hashMap: IGasHashMap = {
  // filetree
  '/jackaldao.canine.filetree.MsgPostFile': 75,
  '/jackaldao.canine.filetree.MsgDeleteFile': 10,
  '/jackaldao.canine.filetree.MsgInitAll': 25,
  '/jackaldao.canine.filetree.MsgMakeRoot': 60,
  // storage
  '/jackaldao.canine.storage.MsgPostContract': 25,
  '/jackaldao.canine.storage.MsgSignContract': 65,
  '/jackaldao.canine.storage.MsgCancelContract': 20
}
const baseRate = 60

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
