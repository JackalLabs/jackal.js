import { IFileMeta } from '@/interfaces'

export interface IFileParticulars {
  fileMeta: IFileMeta
  merkle: Uint8Array
  merkleLocation: string
  providerIps: string[]
}
