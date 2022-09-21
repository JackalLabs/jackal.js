import IFileConfigRaw from '../IFileConfigRaw'
import IFileMeta from '../IFileMeta'
import IFileHandlerCore from './IFileHandlerCore'

export default interface IFileHandler extends IFileHandlerCore {

  getFile (): Promise<File>
  setFile (file: File): void
  getName (): string
  getMetadata (): IFileMeta
  setConfig (config: IFileConfigRaw): void

}
