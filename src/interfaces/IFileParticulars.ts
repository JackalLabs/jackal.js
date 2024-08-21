import { IFileMeta } from '@/interfaces/IMetaData'

export interface IFileParticulars {
  fileMeta: IFileMeta
  merkle: Uint8Array
  merkleLocation: string
  providerIps: string[]
}
