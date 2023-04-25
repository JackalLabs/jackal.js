import PLZSU from '@karnthis/plzsu'

const Plzsu = new PLZSU()

export function compressData (input: string): string {
  return `jklpc1${Plzsu.compress(input)}`
}
export function decompressData (input: string): string {
  if (!input.startsWith('jklpc1')) throw new Error('Invalid Decompression String')
  return Plzsu.decompress(input.substring(6))
}
