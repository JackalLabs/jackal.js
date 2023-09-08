import { PageResponse, QueryFileResponse } from '@jackallabs/jackal.js-protos'
import { IQueryHandler } from '@/interfaces/classes'
import { hashAndHex, merkleMeBro } from '@/utils/hash'

/**
 * Notify that function is deprecated and should no longer be used.
 * @param {string} thing - Name of deprecated item. Example: "[ParentContext] functionName()".
 * @param {string} version - First version with deprecated item. Example: "v1.1.1".
 * @param {{aggressive?: boolean, replacement?: string}} opts -
 * Aggressive: TRUE to trigger alert.
 * Replacement: the function name that should be used instead. Example: "replacementFunction()".
 */
export function deprecated(
  thing: string,
  version: string,
  opts?: { aggressive?: boolean; replacement?: string }
) {
  let notice = `${thing} is deprecated as of: ${version}`
  if (opts?.replacement) {
    notice += ` - Please use ${opts.replacement} instead`
  }
  console.error(notice)
  if (opts?.aggressive) alert(notice)
}

export function getRandomIndex(limit: number) {
  return Math.floor(Math.random() * Number(limit) || 0)
}

/**
 * Accepts object and 1 or more keys to extract to create new object.
 * @param {T} source - Object to extract from.
 * @param {K} keys - N keys passed as individual parameters.
 * @returns {Pick<T, K>} - New object with only specified keys.
 */
export function pluckFromObject<T extends {}, K extends keyof T>(source: T, ...keys: K[]) {
  return Object.fromEntries(
    keys
      .filter(key => key in source)
      .map(key => [key, source[key]])
  ) as Pick<T, K>
}

/**
 * Notify that Signer has not been enabled.
 * @param {string} module - Name of parent Module.
 * @param {string} func - Name of function error occured in.
 * @returns {string} - String containing error message.
 */
export function signerNotEnabled(module: string, func: string) {
  let notice = `[${module}] ${func}() - Signer has not been enabled. Please init ProtoHandler`
  console.error(notice)
  return notice
}

/**
 * Sort array of strings in A-Z order.
 * @param {string[]} sortable - Array of string to organize.
 * @returns {string[]} - Array of sorted strings.
 */
export function orderStrings(sortable: string[]): string[] {
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
 * Remove all slashes "/".
 * @param {string} value - Starting string.
 * @returns {string} - String without slashes.
 */
export function stripper(value: string): string {
  return value.replace(/\/+/g, '')
}

/**
 * Check chain response for insufficient gas.
 * @param response - @cosmjs/stargate DeliverTxResponse.
 */
export function checkResults(response: any) {
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
export function numToWholeTB(base: number | string): string {
  return numTo3xTB(Math.floor(Number(base)) || 0)
}

/**
 * Round any number to TB.
 * @param {number | string} base - Accepts number or number-like string.
 * @returns {string} - Total TB as string for Msg compatibility.
 */
export function numTo3xTB(base: number | string): string {
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
export function bruteForceString(value: string): string | undefined | null {
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
 * Cycle through pagination results and merge into single result.
 * @param handler - QueryHandler to use for function source.
 * @param {string} queryTag - Query function to use.
 * @param additionalParams - Non-pagination parameters required by queryTag function.
 * @returns {Promise<any[]>} - Merged pagination results.
 */
export async function handlePagination(
  handler: any,
  queryTag: string,
  additionalParams?: any
): Promise<any[]> {
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
 * @param {number} duration - Duration of timer in ms.
 * @returns {Promise<void>}
 */
export async function setDelay(duration: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, Number(duration)))
}

/**
 * Converts chain block height to UTC Date using getAverageBlockTime().
 * @param {IBlockTimeOptions} options - Values to use for calculating UTC date.
 * @returns {Promise<Date>} - Date object for future date matching input future chain height.
 */
export async function blockToDate(options: IBlockTimeOptions): Promise<Date> {
  if (!options.rpcUrl) throw new Error('RPC URL is required!')
  /** Block time in milliseconds */
  const blockTime = await getAverageBlockTime(options.rpcUrl, 20)
  return blockToDateFixed({ ...options, blockTime })
}

/**
 * Converts chain block height to UTC Date using provided block time value.
 * @param {IBlockTimeOptions} options - Values to use for calculating UTC date.
 * @returns {Date} - Date object for future date matching input future chain height.
 */
export function blockToDateFixed(options: IBlockTimeOptions): Date {
  if (!options.blockTime) throw new Error('Block Time is required!')
  const targetHeight = Number(options.targetBlockHeight) || 0
  const blockDiff = targetHeight - options.currentBlockHeight
  const diffMs = blockDiff * options.blockTime
  const now = Date.now()
  return new Date(now + diffMs)
}

/**
 * Fine average block time of recent blocks.
 * @param {string} rpc - RPC node address to query.
 * @param {number} blocks - Number of blocks to use for average.
 * @returns {Promise<number>} - Time in ms per block of submitted window.
 */
export async function getAverageBlockTime(
  rpc: string,
  blocks: number
): Promise<number> {
  const latestBlockInfo = await fetch(`${rpc}/block`)
    .then((res) => res.json())
    .catch((err) => {
      console.warn('getAvgBlockTime() latestBlockInfo fetch error:')
      console.error(err)
      return { result: { block: { header: { height: blocks, time: 0 } } } }
    })
  const blockOffset =
    Number(latestBlockInfo.result.block.header.height - blocks) || 0
  const pastBlockInfo = await fetch(`${rpc}/block?height=${blockOffset}`)
    .then((res) => res.json())
    .catch((err) => {
      console.warn('getAvgBlockTime() pastBlockInfo fetch error:')
      console.error(err)
      return { result: { block: { header: { time: 0 } } } }
    })
  const latest = Date.parse(latestBlockInfo.result.block.header.time)
  const past = Date.parse(pastBlockInfo.result.block.header.time)
  return Math.round((latest - past) / blocks)
}

/**
 * Converts Uint8Array to string.
 * @param {Uint8Array} buf - Uint8Array to convert.
 * @returns {string} - Converted result.
 */
export function uint8ToString(buf: Uint8Array): string {
  return String.fromCharCode.apply(null, [...buf])
}

/**
 * Converts string to Uint8Array.
 * @param {string} str - String to convert.
 * @returns {Uint8Array} - Converted result.
 */
export function stringToUint8(str: string): Uint8Array {
  const uintView = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) {
    uintView[i] = str.charCodeAt(i)
  }
  return uintView
}

/**
 * Converts Uint16Array to string.
 * @param {Uint16Array} buf - Uint16Array to convert.
 * @returns {string} - Converted result.
 */
export function uint16ToString(buf: Uint16Array): string {
  return String.fromCharCode.apply(null, [...buf])
}

/**
 * Converts string to Uint16Array.
 * @param {string} str - String to convert.
 * @returns {Uint16Array} - Converted result.
 */
export function stringToUint16(str: string): Uint16Array {
  const uintView = new Uint16Array(str.length)
  for (let i = 0; i < str.length; i++) {
    uintView[i] = str.charCodeAt(i)
  }
  return uintView
}

/**
 * Retrieve data from FileTree path.
 * @param {string} rawPath - FileTree path to retrieve from.
 * @param {string} owner - Jkl address of path owner.
 * @param {IQueryHandler} qH - QueryHandler instance.
 * @returns {Promise<IFileResponse>} - Raw query response.
 */
export async function getFileTreeData(
  rawPath: string,
  owner: string,
  qH: IQueryHandler
): Promise<IFileResponse> {
  console.log('rawPath')
  console.log(rawPath)
  const hexAddress = await merkleMeBro(rawPath)
  const hexedOwner = await hashAndHex(
    `o${hexAddress}${await hashAndHex(owner)}`
  )
  return await qH.fileTreeQuery.queryFiles({
    address: hexAddress,
    ownerAddress: hexedOwner
  })
}

interface IFileResponse {
  message: string
  success: boolean
  value: QueryFileResponse
}
interface IBlockTimeOptions {
  blockTime?: number
  rpcUrl?: string
  currentBlockHeight: number
  targetBlockHeight: number | string
}
