import { EncodeObject } from '@cosmjs/proto-signing'
import IGasHashMap from '@/interfaces/IGasHashMap'

const hashMap: IGasHashMap = {
  // filetree
  '/jackaldao.canine.filetree.MsgPostFile': 45,
  // storage
  '/jackaldao.canine.storage.MsgPostContract': 55
}

/** @private */
export function estimateGas (msgArray: EncodeObject[]) {
  const gas = msgArray.reduce((acc, curr) => {
    return acc + hashMap[curr.typeUrl]
  }, 0)
  return (gas + 60) * 1000
}