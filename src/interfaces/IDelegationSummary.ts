import ICoin from '@/interfaces/ICoin'
import IDelegationDetails from '@/interfaces/IDelegationDetails'

export default interface IDelegationSummary {
  delegation: IDelegationDetails;
  balance: ICoin;
}
