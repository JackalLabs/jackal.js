import type { TMetaDataSets } from '@/types'
import type { ILegacyMetaData } from '@/interfaces/IMetaData'

export interface IConversionNeededBundle {
  requiresConversion: true
  metaData: ILegacyMetaData
}
export interface IConversionNotNeededBundle {
  requiresConversion: false
  metaData: TMetaDataSets
}

export type TConversionStatusBundle = IConversionNeededBundle | IConversionNotNeededBundle
