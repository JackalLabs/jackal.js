import type { IFileMeta } from '@/interfaces'

export interface IFolderFileFrame {
  whoAmI: string
  whereAmI: string
  whoOwnsMe: string
  dirChildren: string[]
  fileChildren: Record<string, IFileMeta>
}
