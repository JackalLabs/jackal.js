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
export function addPadding (original: ArrayBuffer): ArrayBuffer {
  let padSize = 16 - (original.byteLength % 16)
  if (padSize === 0) {
    padSize = 16
  } else {
    // do nothing
  }
  const padArray = Array(padSize).fill(padSize)
  const originalAsArray = Array.from(new Uint8Array(original))
  return new Uint8Array([...originalAsArray, ...padArray]).buffer
}
export function removePadding (chunk: ArrayBuffer): ArrayBuffer {
  const workingChunk = new Uint8Array(chunk)
  const padCount = workingChunk[workingChunk.byteLength - 1]
  return workingChunk.slice(0, workingChunk.byteLength - padCount).buffer
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
