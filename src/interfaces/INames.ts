export default interface INames {
  name: string;
  expires: number;
  value: string;
  data: string;
  subdomains: INames[];
  tld: string;
  locked: number;
}
