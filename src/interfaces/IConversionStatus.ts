import { IFolderMetaData, ILegacyFolderMetaData } from '@/interfaces/IMetaData'

export interface IConversionNeededBundle {
  requiresConversion: true
  metaData: ILegacyFolderMetaData
}

export interface IConversionNotNeededBundle {
  requiresConversion: false
  metaData: IFolderMetaData
}

export type TConversionStatusBundle = IConversionNeededBundle | IConversionNotNeededBundle
