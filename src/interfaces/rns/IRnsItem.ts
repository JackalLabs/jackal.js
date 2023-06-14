export default interface IRnsItem {
  name: string
  expires: number
  value: string
  data: string
  subdomains: IRnsItem[]
  tld: string
  locked: number
}
