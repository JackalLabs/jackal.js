import { DEncodeObject, findQueryKey, IIbcEngageBundle, TxEvent } from '@jackallabs/jackal.js-protos'
import { secondToMS } from '@/utils/converters'
import { sockets } from '@/utils/globalDefaults'
import type { TSockets, TTidyStringModes } from '@/types'
import type { ISharedMetaDataMap } from '@/interfaces'

/**
 * Notify that function is deprecated and should no longer be used.
 * @param {string} thing - Name of deprecated item. Example: "[ParentContext] functionName()".
 * @param {string} version - First version with deprecated item. Example: "v1.1.1".
 * @param {{aggressive?: boolean, replacement?: string}} opts
 * - Aggressive: TRUE to trigger alert.
 * - Replacement: the function name that should be used instead. Example: "replacementFunction()".
 * @returns {void}
 * @private
 */
export function deprecated(
  thing: string,
  version: string,
  opts?: { aggressive?: boolean; replacement?: string },
): void {
  let notice = `SAMPLE | ${thing} is deprecated as of: ${version}`
  if (opts?.replacement) {
    notice += ` - Please use ${opts.replacement} instead`
  }
  console.error(notice)
  if (opts?.aggressive) {
    alert(notice)
  }
}

/**
 * Generic warning handler.
 * @param {string} thing - Name of code block with error. Example: "[ParentContext] functionName()".
 * @param {any} err - Error to warn.
 * @returns {any}
 * @private
 */
export function warnError(thing: string, err: any): any {
  const notice = `Jackal.js | ${thing}: ${err}`
  console.warn(notice)
  return err
}

/**
 *
 * @param {string} source
 * @param {string} toTidy
 * @param {TTidyStringModes} mode
 * @returns {string}
 */
export function tidyString(
  source: string,
  toTidy: string,
  mode: TTidyStringModes = 'both',
): string {
  let startIndex = 0
  let endIndex = source.length

  if (mode === 'start' || mode === 'both') {
    while (startIndex < endIndex && source[startIndex] === toTidy) {
      startIndex++
    }
  }
  if (mode === 'end' || mode === 'both') {
    while (startIndex < endIndex && source[endIndex - 1] === toTidy) {
      endIndex--
    }
  }
  return source.slice(startIndex, endIndex)
}

/**
 * Set a timer.
 * @param {number} seconds - Duration of timer in ms.
 * @returns {Promise<void>}
 */
export async function setDelay(seconds: number): Promise<void> {
  const delay = secondToMS(Number(seconds))
  await new Promise((resolve) => setTimeout(resolve, delay))
}

/**
 *
 * @param {ISharedMetaDataMap} obj
 * @param {string[]} path
 * @returns {number}
 */
export function findNestedSharedDepth(
  obj: ISharedMetaDataMap,
  path: string[],
): number {
  let findings = 0
  const first = path.shift() as string
  if (first in obj) {
    findings++
    if (path.length > 0) {
      findings += findNestedSharedDepth(obj[first] as ISharedMetaDataMap, path)
    }
  }
  return findings
}

/**
 *
 * @param {ISharedMetaDataMap} obj
 * @param {string[]} path
 * @returns {number}
 */
export function findNestedContentsCount(
  obj: ISharedMetaDataMap,
  path: string[],
): number {
  if (path.length > 0) {
    const first = path.shift() as string
    return findNestedContentsCount(obj[first] as ISharedMetaDataMap, path)
  } else {
    return Object.keys(obj).length
  }
}

/**
 * Notify that Signer has not been enabled.
 * @param {string} module - Name of parent Module.
 * @param {string} func - Name of function error occurred in.
 * @returns {string} - String containing error message.
 * @private
 */
export function signerNotEnabled(module: string, func: string): string {
  let notice = `Jackal.js | [${module}] ${func}() - Signer has not been enabled. Please init with valid signer`
  console.error(notice)
  return notice
}

/**
 *
 * @param {number} target
 * @returns {boolean}
 */
export function isItPast(target: number): boolean {
  const dd = Date.now()
  return dd > target
}

/**
 *
 * @param {Date} target
 * @returns {boolean}
 */
export function isItPastDate(target: Date): boolean {
  return isItPast(target.getTime())
}

/**
 *
 * @param {T[]} source
 * @returns {T[]}
 */
export function shuffleArray<T>(source: T[]): T[] {
  const final: T[] = []
  for (let i = source.length; i > -1; --i) {
    final.push(source[Math.floor(Math.random() * i)])
  }
  return final
}

/**
 *
 * @param {TSockets[]} networks
 * @param {TxEvent[]} feed
 * @param {DEncodeObject[]} msgs
 * @param {string} addr
 * @returns {IIbcEngageBundle<TxEvent>[]}
 */
export function makeConnectionBundles(
  networks: TSockets[],
  feed: TxEvent[],
  msgs: DEncodeObject[],
  addr: string,
): IIbcEngageBundle<TxEvent>[] {
  const bundles: IIbcEngageBundle<TxEvent>[] = []

  const allUrls: string[] = []
  for (let msg of msgs) {
    allUrls.push(msg.typeUrl)
  }
  const uniqueUrls = [...new Set(allUrls)]

  for (let url of uniqueUrls) {
    function parser(resp: any) {
      try {
        // return parseMsgResponse(url, resp)
        return resp
      } catch {
        console.log('url failed:', url)
        // return null
        return resp
      }
    }

    const query = `${findQueryKey(url)} = '${addr}'`
    for (let id of networks) {
      const { chainId, endpoint } = sockets[id]
      console.log('makeConnectionBundles')
      console.log('chainId:', chainId)
      console.log('endpoint:', endpoint)

      bundles.push({
        chainId,
        endpoint,
        feed,
        parser,
        query,
      })
    }
  }
  return bundles
}
