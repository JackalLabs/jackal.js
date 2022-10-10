import IEditorsViewers from './IEditorsViewers'

export default interface IMsgPostFileBundle {
  creator: string, // just the users address (might rework to be the same as account)
  account: string, // the hashed (uuid + user account) (becomes owner)
  hashParent: string, // merkled parent
  hashChild: string, // hashed child
  contents: string[], // contents
  viewers: IEditorsViewers, // viewer list (to be discussed)
  editors: IEditorsViewers, // editor list (to be discussed )
  trackingNumber: number // uuid
}
