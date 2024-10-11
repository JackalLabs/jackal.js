import { FileMetaHandler, FolderMetaHandler, NullMetaHandler } from '@/classes/metaHandlers'

export type TConversionFile = ['file', FileMetaHandler]
export type TConversionNull = ['null', NullMetaHandler]
export type TConversionRoot = ['rootlookup', FolderMetaHandler]
export type TConversionFolder = ['folder', FolderMetaHandler]

export type TConversionPair = TConversionFile | TConversionNull | TConversionRoot | TConversionFolder
