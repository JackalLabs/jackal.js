export default interface IMsgFinalPostFileBundle {
  creator: string, // just the users address (might rework to be the same as account)
  account: string, // the hashed (uuid + user account) (becomes owner)
  hashParent: string, // merkled parent
  hashChild: string, // hashed child
  contents: string, // contents array stringified
  viewers: string, // viewer IEditorsViewers stringified
  editors: string, // editor IEditorsViewers stringified
  trackingNumber: string, // uuid
}
