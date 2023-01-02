import IFileConfigRelevant from '@/interfaces/IFileConfigRelevant'

export default interface IFolderDownload {
  data: ArrayBuffer,
  config: IFileConfigRelevant,
  key: ArrayBuffer,
  iv: ArrayBuffer
}
