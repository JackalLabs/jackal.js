import IFileConfigRaw from '@/interfaces/IFileConfigRaw'
import IFileMeta from '@/interfaces/IFileMeta'
import IFileHandlerCore from '@/interfaces/classes/IFileHandlerCore'

export default interface IFileHandler extends IFileHandlerCore {

  getFile (): Promise<File>
  setFile (file: File): void
  getName (): string
  getMetadata (): IFileMeta
  setConfig (config: IFileConfigRaw): void

}
