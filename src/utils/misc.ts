import { PageResponse } from 'jackal.js-protos/dist/postgen/cosmos/base/query/v1beta1/pagination'

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
  let final = Math.floor(Number(base)) || 0
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
  let foundTotal = 0
  do {
    let data = await handler[queryTag]({
      ...additionalParams,
      pagination: {
        key: nextPage,
        limit: 1000
      }
    })
    raw.push(data.value)
    const { nextKey, total } = data.value.pagination as PageResponse
    nextPage = nextKey
    foundTotal = total
  } while (foundTotal === 1000)
  return raw
}
