import IFileMeta from './IFileMeta'

export default interface IFolderFileFrame {
  whoAmI: string,
  whereAmI: string,
  dirChildren: string[],
  fileChildren: { [name: string]: IFileMeta }
}
