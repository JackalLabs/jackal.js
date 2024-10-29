import {
  IFileMetaData,
  IFolderMetaData,
  INullMetaData,
  INullRefMetaData,
  IRefMetaData,
  IShareMetaData,
  ISharerMetaData,
  ISharerRefMetaData,
} from '@/interfaces'

export interface IRefMetaHandler {
  setRefIndex (refIndex: number): void

  getRefIndex (): number

  getRefString (): string
}

export interface INullMetaHandler extends IRefMetaHandler {
  getLocation (): string

  getSelf (): string

  export (): INullMetaData

  exportRef (): INullRefMetaData
}

export interface IFolderMetaHandler extends IRefMetaHandler {
  addAndReturnCount (value: number): number

  setCount (count: number): void

  getCount (): number

  addAndReturnSharerCount (value: number): number

  setSharerCount (count: number): void

  getSharerCount (): number

  getUlid (): string

  setLocation (location: string): void

  getLocation (): string

  export (): IFolderMetaData

  exportRef (): IRefMetaData
}

export interface IFileMetaHandler extends IRefMetaHandler {
  addAndReturnSharerCount (value: number): number

  setSharerCount (count: number): void

  getSharerCount (): number

  getUlid (): string

  setLocation (location: string): void

  getLocation (): string

  export (): IFileMetaData

  exportRef (): IRefMetaData
}

export interface IShareMetaHandler extends IRefMetaHandler {
  getIsFile (): boolean

  getUlid (): string

  getLocation (): string

  export (): IShareMetaData

  exportRef (): IRefMetaData
}

export interface ISharerMetaHandler extends IRefMetaHandler {
  getUlid (): string

  getLocation (): string

  export (): ISharerMetaData

  exportRef (): ISharerRefMetaData
}
