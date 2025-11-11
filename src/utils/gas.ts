import { IFinalGas, IWrappedEncodeObject } from '@/interfaces'
import { DEncodeObject } from '@jackallabs/jackal.js-protos'

const gasBaselineRate = 56
const gasFallbackTxCost = 142
const gasMap: Record<string, number> = {
  /** Filetree */
  '/canine_chain.filetree.MsgPostFile': 270,
  '/canine_chain.filetree.MsgPostKey': 12,
  '/canine_chain.filetree.MsgDeleteFile': 9,
  /** Notifications */
  /** Oracle */
  /** RNS */
  '/canine_chain.rns.MsgBid': 23,
  '/canine_chain.rns.MsgBuy': 35,
  '/canine_chain.rns.MsgInit': 15,
  '/canine_chain.rns.MsgList': 14,
  '/canine_chain.rns.MsgRegister': 37,
  /** Storage */
  /** Bank */
  /** Distribution */
  /** Gov */
  /** Slashing */
  /** Staking */
}

/*
USING MODIFIERS
/canine_chain.filetree.MsgProvisionFileTree
 */

/**
 * Generates gas total estimate from list of Tx instances.
 * @param {IWrappedEncodeObject[]} msgArray - Collection of Tx instances to calculate gas from.
 * @returns {number} - Adjusted number of gas units collection is expected to require.
 */
export function estimateGas (msgArray: IWrappedEncodeObject[]): number {
  return calculateGas(msgArray, 1)[0]
}

/**
 * Return a Gas object for use in a masterBroadcaster()-like call.
 * @param {IWrappedEncodeObject[]} msgArray - Collection of Tx instances to calculate gas from.
 * @param {number} gasMultiplier - Multiplier for calculating gas.
 * @param {number} [gasOverride] - Value to replace calculated gas value.
 * @param {string} payer - The Payer if using a feegrant
 * @returns {IFinalGas} - Gas object with best estimate based on input.
 * @private
 */
export function finalizeGas (
  msgArray: IWrappedEncodeObject[],
  gasMultiplier: number,
  gasOverride?: number,
  payer?: string,
): IFinalGas {
  const [gas, msgs] = calculateGas(msgArray, gasMultiplier)
  const totalGas = Number(gasOverride) || gas
  return {
    fee: {
      amount: [
        { denom: 'ujkl', amount: Math.ceil(totalGas * 0.002).toString() },
      ],
      gas: Math.ceil(totalGas).toString(),
      payer: payer,
    },
    msgs,
  }
}

/**
 * Calculate gas and unwrap msgs to prepare for broadcasting.
 * @param {IWrappedEncodeObject[]} msgArray - Collection of Tx instances to calculate gas from.
 * @param {number} gasMultiplier - Multiplier for calculating gas.
 * @returns {[number, DEncodeObject[]]} - Tuple of adjusted number of gas units collection is expected to require and unwrapped msg array.
 * @private
 */
function calculateGas (
  msgArray: IWrappedEncodeObject[],
  gasMultiplier: number,
): [number, DEncodeObject[]] {
  const objects: DEncodeObject[] = []
  let gas = gasBaselineRate
  for (let item of msgArray) {
    if (!isIWrappedEncodeObject(item)) {
      throw new Error('Only wrapped EncodeObjects are accepted')
    } else {
      switch (true) {
        case item.encodedObject.typeUrl.includes(
          'filetree.MsgProvisionFileTree',
        ):
          gas += calculateModifier(18, item.modifier)
          break
        default:
          gas += gasMap[item.encodedObject.typeUrl] || gasFallbackTxCost
      }
      objects.push(item.encodedObject)
    }
  }
  return [gas * gasMultiplier, objects]
}

/**
 * Check if an input is a wrapped or raw EncodeObject.
 * @param {any | IWrappedEncodeObject} toCheck - Source value.
 * @returns {toCheck is IWrappedEncodeObject} - Boolean indicating if source is a IWrappedEncodeObject.
 * @private
 */
function isIWrappedEncodeObject (
  toCheck: any | IWrappedEncodeObject,
): toCheck is IWrappedEncodeObject {
  return 'encodedObject' in toCheck
}

/**
 * Calculates gas from modifier.
 * @param {number} buffer - Base amount to use for msg gas calculation.
 * @param {number} modifier - Modifier to use for calculating gas.
 * @returns {number}
 * @private
 */
function calculateModifier (buffer: number, modifier: number): number {
  const sanitizedModifier = Number(modifier) || 0
  return buffer + sanitizedModifier * 0.04
}
