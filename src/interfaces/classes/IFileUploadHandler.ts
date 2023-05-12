import IFileHandlerCore from '@/interfaces/classes/IFileHandlerCore'
import { IFileMeta } from '@/interfaces/'

export default interface IFileUploadHandler extends IFileHandlerCore {
  getMeta(): IFileMeta
  getFullMerkle(): Promise<string>
}
