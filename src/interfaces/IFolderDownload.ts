import IFileConfigRelevant from '@/interfaces/file/IFileConfigRelevant'

export default interface IFolderDownload {
  data: ArrayBuffer,
  config: IFileConfigRelevant,
  key: ArrayBuffer,
  iv: ArrayBuffer
}
