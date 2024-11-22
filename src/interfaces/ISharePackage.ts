export interface IShareDirectPackage {
  isFile: boolean
  isPrivate: boolean
  path: string
  receiver: string
}

export interface IShareLinkPackage {
  isFile: boolean
  link: string
  path: string
}

export type TSharePackage = IShareDirectPackage | IShareLinkPackage
