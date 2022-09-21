import IFileConfigRaw from './IFileConfigRaw'

export default interface IFolderDownload {
  data: ArrayBuffer,
  config: IFileConfigRaw,
  key: ArrayBuffer,
  iv: ArrayBuffer
}
