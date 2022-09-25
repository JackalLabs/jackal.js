import IFileConfigRelevant from './IFileConfigRelevant'

export default interface IFolderDownload {
  data: ArrayBuffer,
  config: IFileConfigRelevant,
  key: ArrayBuffer,
  iv: ArrayBuffer
}
