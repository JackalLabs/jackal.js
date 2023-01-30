import { IFolderChildFiles } from '@/interfaces'

export default interface IFolderFileFrame {
  whoAmI: string,
  whereAmI: string,
  whoOwnsMe: string,
  dirChildren: string[],
  fileChildren: IFolderChildFiles
}
