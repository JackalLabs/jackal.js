import IFileHandlerCore from './IFileHandlerCore'
import { IFileMeta } from '../'

export default interface IFileUploadHandler extends IFileHandlerCore {
  getMeta (): IFileMeta
}
