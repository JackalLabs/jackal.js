import ICoin from './ICoin'
import IDelegationDetails from './IDelegationDetails'

export default interface IDelegationSummary {
  delegation: IDelegationDetails;
  balance: ICoin;
}
