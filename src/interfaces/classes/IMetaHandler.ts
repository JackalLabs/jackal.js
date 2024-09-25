import type {
  IFileMetaData,
  IFolderMetaData,
  INullMetaData,
  IRefMetaData,
  IShareFolderMetaData,
  IShareMetaData,
  IShareRefMetaData,
} from '@/interfaces'

export interface IRefMetaHandler {
  setRefIndex (refIndex: number): void

  getRefIndex (): number

  getRefString (): string
}

export interface INullMetaHandler extends IRefMetaHandler {
  getLocation (): string

  export (): INullMetaData
}

export interface IFolderMetaHandler extends IRefMetaHandler {
  addAndReturnCount (value: number): number

  setCount (count: number): void

  getCount (): number

  getUlid (): string

  setLocation (location: string): void

  getLocation (): string

  export (): IFolderMetaData

  exportRef (): IRefMetaData
}

export interface IFileMetaHandler extends IRefMetaHandler {
  getUlid (): string

  setLocation (location: string): void

  getLocation (): string

  export (): IFileMetaData

  exportRef (): IRefMetaData
}

export interface IShareFolderMetaHandler extends IRefMetaHandler {
  addAndReturnCount (value: number): number

  getCount (): number

  getUlid (): string

  getLocation (): string

  export (): IShareFolderMetaData
}

export interface IShareMetaHandler extends IRefMetaHandler {
  setLabel (label: string): void

  getLabel (): string

  getLocation (): string

  getUlid (): string

  export (): IShareMetaData

  exportRef (): IShareRefMetaData
}
