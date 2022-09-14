export default interface IOwnerConfig {
  owner: string
  viewers: {[key: string]: string}
  editors: {[key: string]: string}
}