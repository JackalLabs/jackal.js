import type { IFolderMetaHandler, IWrappedEncodeObject } from '@/interfaces'

export interface IConversionFolderBundle {
  msgs: IWrappedEncodeObject[]
  handler: IFolderMetaHandler
}
