import { secondToMS } from '@/utils/converters'
import type { TTidyStringModes } from '@/types'

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
  opts?: { aggressive?: boolean; replacement?: string }
): void {
  let notice = `SAMPLE | ${thing} is deprecated as of: ${version}`
  if (opts?.replacement) {
    notice += ` - Please use ${opts.replacement} instead`
  }
  console.error(notice)
  if (opts?.aggressive) alert(notice)
}

/**
 * Generic warning handler.
 * @param {string} thing - Name of code block with error. Example: "[ParentContext] functionName()".
 * @param {any} err - Error to warn.
 * @returns {any}
 * @private
 */
export function warnError(
  thing: string,
  err: any
): any {
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
export function tidyString(source: string, toTidy: string, mode: TTidyStringModes = 'both'): string {
  let startIndex = 0
  let endIndex = source.length

  if (mode === 'start' || mode === 'both') {
    while(startIndex < endIndex && source[startIndex] === toTidy) {
      startIndex++
    }
  }
  if (mode === 'end' || mode === 'both') {
    while(startIndex < endIndex && source[endIndex - 1] === toTidy) {
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
