import IFolderFileFrame from '../IFolderFileFrame'
import IFileMeta from '../IFileMeta'
import IFileHandlerCore from './IFileHandlerCore'
import IChildDirInfo from '../IChildDirInfo'

export default interface IFolderHandler extends IFileHandlerCore {

  getWhoAmI (): string
  getWhereAmI (): string
  getMerklePath (): Promise<string>
  getFolderDetails (): IFolderFileFrame
  getChildDirs (): string[]
  getChildFiles (): { [name: string]: IFileMeta }
  addChildDirs (dirs: string[]): void

  makeChildDirInfo (childName: string): IChildDirInfo
  addChildFiles (newFiles: IFileMeta[]): void
  removeChildDirs (toRemove: string[]): void
  removeChildFiles (toRemove: string[]): void

}
