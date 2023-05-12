import { PageResponse } from 'jackal.js-protos/dist/postgen/cosmos/base/query/v1beta1/pagination'
import { IProtoHandler } from '@/interfaces/classes'
import { QueryFileResponse } from 'jackal.js-protos/dist/postgen/canine_chain/filetree/query'
import { hashAndHex, merkleMeBro } from '@/utils/hash'
import SuccessNoUndefined from 'jackal.js-protos/dist/types/TSuccessNoUndefined'

/**
 * Notify that function is deprecated and should no longer be used.
 * @param {string} thing - Name of deprecated item. Example: "[ParentContext] functionName()".
 * @param {string} version - First version with deprecated item. Example: "v1.1.1".
 * @param {{aggressive?: boolean, replacement?: string}} opts -
 * Aggressive: TRUE to trigger alert.
 * Replacement: the function name that should be used instead. Example: "replacementFunction()".
 */
export function deprecated (thing: string, version: string, opts?: { aggressive?: boolean, replacement?: string }) {
  let notice = `${thing} is deprecated as of: ${version}`
  if (opts?.replacement) {
    notice += ` - Please use ${opts.replacement} instead`
  }
  console.error(notice)
  if (opts?.aggressive) alert(notice)
}

/**
 * Sort array of strings in A-Z order.
 * @param {string[]} sortable - Array of string to organize.
 * @returns {string[]} - Array of sorted strings.
 */
export function orderStrings (sortable: string[]): string[] {
  return sortable.sort((a: string, b: string) => {
    const lowerA = a.toLowerCase()
    const lowerB = b.toLowerCase()
    if (lowerA < lowerB) {
      return -1
    } else if (lowerA > lowerB) {
      return 1
    } else {
      return 0
    }
  })
}

/**
 * Remove trailing slashes "/".
 * @param {string} value - Starting string.
 * @returns {string} - String without trailing slashes.
 */
export function stripper (value: string): string {
  return value.replace(/\/+/g, '')
}

/**
 * Check chain response for insufficient gas.
 * @param response - @cosmjs/stargate DeliverTxResponse.
 */
export function checkResults (response: any) {
  console.dir(response)
  if (response.gasUsed > response.gasWanted) {
    console.log('Out Of Gas')
    alert('Ran out of gas. Please refresh page and try again with fewer items.')
  }
}

/**
 * Round number to whole TB (See numTo3xTB().
 * @param {number | string} base - Accepts number or number-like string.
 * @returns {string} - Whole TB as string for Msg compatibility.
 */
export function numToWholeTB (base: number | string): string {
  return numTo3xTB(Math.floor(Number(base)) || 0)
}

/**
 * Round any number to TB.
 * @param {number | string} base - Accepts number or number-like string.
 * @returns {string} - Total TB as string for Msg compatibility.
 */
export function numTo3xTB (base: number | string): string {
  let final = Math.max(Number(base), 0)
  final *= 1000 /** KB */
  final *= 1000 /** MB */
  final *= 1000 /** GB */
  final *= 1000 /** TB */
  final *= 3 /** Redundancy */
  return final.toString()
}

/**
 * Forces string "null" or "undefined" to their proper types. Needed for handling some responses.
 * @param {string} value - String to check.
 * @returns {string | undefined | null} - Returns null or undefined if string matches, otherwise returns original string.
 */
export function bruteForceString (value: string): null | undefined | string {
  switch (value.toLowerCase()) {
    case 'null':
      return null
    case 'undefined':
      return undefined
    default:
      return value
  }
}

/**
 * TODO
 * @param handler
 * @param {string} queryTag
 * @param additionalParams
 * @returns {Promise<any[]>}
 */
export async function handlePagination (handler: any, queryTag: string, additionalParams?: any) {
  const raw: any[] = []
  let nextPage: Uint8Array = new Uint8Array()
  do {
    let data = await handler[queryTag]({
      ...additionalParams,
      pagination: {
        key: nextPage,
        limit: 1000
      }
    })
    raw.push(data.value)
    nextPage = (data.value.pagination as PageResponse).nextKey
  } while (nextPage.length)
  return raw
}

/**
 * Set a timer.
 * @param {number} amt - Duration of timeer in ms.
 * @returns {Promise<void>}
 */
export async function setDelay (amt: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, Number(amt)))
}

/**
 * Convert chain block height to UTC Date
 * TODO - add return statement
 * @param {string} rpcUrl - RPC node address to query.
 * @param {number} currentBlockHeight - Current chain height.
 * @param {number | string} targetBlockHeight - Number or number-like string of future chain height.
 * @returns {Promise<Date>} - Date object for future date matching input future chain height.
 */
export async function blockToDate (rpcUrl: string, currentBlockHeight: number, targetBlockHeight: number | string) {
  const targetHeight = Number(targetBlockHeight) || 0
  /** Block time in milliseconds */
  const blockTime = await getAvgBlockTime(rpcUrl, 20)
  const blockDiff = targetHeight - currentBlockHeight
  const diffMs = blockDiff * blockTime
  const now = Date.now()
  return new Date(now + diffMs)
}

/**
 * Fine average block time of recent blocks.
 * @param {string} rpc - RPC node address to query.
 * @param {number} blocks - Number of blocks to use for average.
 * @returns {Promise<number>} - Time in ms per block of submitted window.
 */
export async function getAvgBlockTime(
  rpc: string,
  blocks: number
): Promise<number> {
  const info = await fetch(`${rpc}/block`)
    .then((res) => res.text())
    .then((res) => {
      return res
    })
    .catch((err) => {
      console.warn('getAvgBlockTime() block fetch error:')
      console.error(err)
      return { result: { block: { header: { time: 0 } } } }
    })
  return 0
}

export function uint8ToString(buf: Uint8Array): string {
  return String.fromCharCode.apply(null, [...buf])
}

export function stringToUint8(str: string): Uint8Array {
  const uintView = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) {
    uintView[i] = str.charCodeAt(i)
  }
  return uintView
}
export function uint16ToString(buf: Uint16Array): string {
  return String.fromCharCode.apply(null, [...buf])
}

export function stringToUint16(str: string): Uint16Array {
  const uintView = new Uint16Array(str.length)
  for (let i = 0; i < str.length; i++) {
    uintView[i] = str.charCodeAt(i)
  }
  return uintView
}

export async function getFileTreeData(
  rawPath: string,
  owner: string,
  pH: IProtoHandler
): Promise<SuccessNoUndefined<QueryFileResponse>> {
  const hexAddress = await merkleMeBro(rawPath)
  const hexedOwner = await hashAndHex(
    `o${hexAddress}${await hashAndHex(owner)}`
  )
  return await pH.fileTreeQuery.queryFiles({
    address: hexAddress,
    ownerAddress: hexedOwner
  })
}
