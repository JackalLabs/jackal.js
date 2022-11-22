import IFolderFileFrame from '@/interfaces/IFolderFileFrame'
import IFileMeta from '@/interfaces/IFileMeta'
import IFileHandlerCore from '@/interfaces/classes/IFileHandlerCore'
import IChildDirInfo from '@/interfaces/IChildDirInfo'

export default interface IFolderHandler extends IFileHandlerCore {

  getWhoOwnsMe (): string
  getMerklePath (): Promise<string>
  getFolderDetails (): IFolderFileFrame
  getChildDirs (): string[]
  getChildFiles (): { [name: string]: IFileMeta }
  addChildDirs (dirs: string[]): void

  makeChildDirInfo (childName: string): IChildDirInfo
  addChildFiles (newFiles: IFileMeta[]): void
  removeChildDirs (toRemove: string[]): void
  removeChildFiles (toRemove: string[]): void
  getFullMerkle (): Promise<string>
  getChildMerkle (child: string): Promise<string>

}
