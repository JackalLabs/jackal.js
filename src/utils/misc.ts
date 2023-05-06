import { PageResponse } from 'jackal.js-protos/dist/postgen/cosmos/base/query/v1beta1/pagination'
import { IProtoHandler } from '@/interfaces/classes'
import { QueryFileResponse } from 'jackal.js-protos/dist/postgen/canine_chain/filetree/query'
import { hashAndHex, merkleMeBro } from '@/utils/hash'
import SuccessNoUndefined from 'jackal.js-protos/dist/types/TSuccessNoUndefined'

export function deprecated (thing: string, version: string, opts?: { aggressive?: boolean, replacement?: string }) {
  let notice = `${thing} is deprecated as of: ${version}`
  if (opts?.replacement) {
    notice += ` - Please use ${opts.replacement} instead`
  }
  console.error(notice)
  if (opts?.aggressive) alert(notice)
}
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

export function stripper (value: string): string {
  return value.replace(/\/+/g, '')
}

export function checkResults (response: any) {
  console.dir(response)
  if (response.gasUsed > response.gasWanted) {
    console.log('Out Of Gas')
    alert('Ran out of gas. Please refresh page and try again with fewer items.')
  }
}

export function numToWholeTB (base: number | string): string {
  return numTo3xTB(Math.floor(Number(base)) || 0)
}

export function numTo3xTB (base: number | string): string {
  let final = Math.max(Number(base), 0)
  final *= 1000 /** KB */
  final *= 1000 /** MB */
  final *= 1000 /** GB */
  final *= 1000 /** TB */
  final *= 3    /** Redundancy */
  console.info(final)
  return final.toString()
}

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

export async function setDelay (amt: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, Number(amt)))
}

export async function blockToDate (rpcUrl: string, currentBlockHeight: number, targetBlockHeight: number | string) {
  const targetHeight = Number(targetBlockHeight) || 0
  /** Block time in milliseconds */
  const blockTime = await getAvgBlockTime(rpcUrl, 20)
  const blockDiff = targetHeight - currentBlockHeight
  const diffMs = blockDiff * blockTime
  const now = Date.now()
  return new Date(now + diffMs)
}

export async function getAvgBlockTime (rpc: string, blocks: number): Promise<number> {
    const info = await fetch(rpc+"/block").then(res => res.json());
    const blockTime = fetch(rpc+`/block?height=${info.result.block.header.height-blocks}`).then(res => res.json());

    return blockTime.then(data => {
        const old = Date.parse(data.result.block.header.time);
        const now = Date.parse(info.result.block.header.time);
        return Math.round((now-old)/blocks);
    });
}

export function uint8ToString (buf: Uint8Array): string {
  return String.fromCharCode.apply(null, [...buf])
}

export function stringToUint8 (str: string): Uint8Array {
  const uintView = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) {
    uintView[i] = str.charCodeAt(i)
  }
  return uintView
}
export function uint16ToString (buf: Uint16Array): string {
  return String.fromCharCode.apply(null, [...buf])
}

export function stringToUint16 (str: string): Uint16Array {
  const uintView = new Uint16Array(str.length)
  for (let i = 0; i < str.length; i++) {
    uintView[i] = str.charCodeAt(i)
  }
  return uintView
}

export async function getFileTreeData (
  rawPath: string,
  owner: string,
  pH: IProtoHandler
): Promise<SuccessNoUndefined<QueryFileResponse>> {
  const hexAddress = await merkleMeBro(rawPath)
  const hexedOwner = await hashAndHex(`o${hexAddress}${await hashAndHex(owner)}`)
  return await pH.fileTreeQuery.queryFiles({ address: hexAddress, ownerAddress: hexedOwner })
}
