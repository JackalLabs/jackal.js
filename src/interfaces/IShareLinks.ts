import { IShareLinkDetails, IWrappedEncodeObject } from '@/interfaces'

export interface IShareLinks {
  links: Record<string, IShareLinkDetails>
  msgs: IWrappedEncodeObject[]
}
