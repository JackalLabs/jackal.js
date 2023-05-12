export default interface IMsgPartialPostFileBundle {
  creator: string // just the users address (might rework to be the same as account)
  account: string // the hashed (uuid + user account) (becomes owner)
  hashParent: string // merkled parent
  hashChild: string // hashed child
  contents: string // contents
  viewers: string // stringify IEditorsViewers
  editors: string // stringify IEditorsViewers
  trackingNumber: string // uuid
}
