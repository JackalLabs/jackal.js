import IFolderFileFrame from '../IFolderFileFrame'
import IFileMeta from '../IFileMeta'
import IFileHandlerCore from './IFileHandlerCore'

export default interface IFolderFileHandler extends IFileHandlerCore {

  getWhoAmI (): string
  getWhereAmI (): string
  merkleMeBro (): string[]
  getFolderDetails (): IFolderFileFrame
  getChildDirs (): string[]
  getChildFiles (): {[name: string]: IFileMeta}

  addChildDirs (newDirs: string[]): void
  addChildFiles (newFiles: IFileMeta[]): void
  removeChildDirs (toRemove: string[]): void
  removeChildFiles (toRemove: string[]): void

}
