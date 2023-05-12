export default interface IRnsOwnedItem {
  name: string
  expires: number
  value: string
  data: string
  subdomains: IRnsOwnedItem[]
  tld: string
  locked: number
}
