import Plzsu from '@karnthis/plzsu'

const plzsu = new Plzsu()

export function compressData (input: string): string {
  return `jklpc1${plzsu.compress(input)}`
}
export function decompressData (input: string): string {
  if (!input.startsWith('jklpc1')) throw new Error('Invalid Decompression String')
  return plzsu.decompress(input.substring(6))
}
