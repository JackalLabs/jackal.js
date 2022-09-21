import IFolderFileFrame from '@/interfaces/IFolderFileFrame'
import IFileMeta from '@/interfaces/IFileMeta'
import IFileHandlerCore from '@/interfaces/classes/IFileHandlerCore'

export default interface IFolderFileHandler extends IFileHandlerCore {

  getWhoAmI (): string
  getFolderDetails (): IFolderFileFrame
  getChildDirs (): string[]
  getChildFiles (): {[name: string]: IFileMeta}

  addChildDirs (newDirs: string[]): void
  addChildFiles (newFiles: IFileMeta[]): void
  removeChildDirs (toRemove: string[]): void
  removeChildFiles (toRemove: string[]): void

}
