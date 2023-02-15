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
// export function addPadding (original: Blob): Blob {
//   let padSize = (16 - (original.size % 16)) || 16
//   const padArray = Array(padSize).fill(padSize)
//   return (new Blob([original, new Uint8Array(padArray)]))
// }
// export async function removePadding (chunk: Blob): Promise<Blob> {
//   const index = chunk.slice(-1)
//   const padCount = Number(index)
//   return chunk.slice(0, chunk.size - padCount)
// }
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
