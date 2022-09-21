import IFileConfigRaw from './interfaces/IFileConfigRaw'

export default interface IFolderDownload {
  data: ArrayBuffer,
  config: IFileConfigRaw,
  key: ArrayBuffer,
  iv: ArrayBuffer
}
