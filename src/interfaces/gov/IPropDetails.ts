import { ProposalStatus } from 'jackal.js-protos'
import { ICoin } from '@/interfaces'

export default interface IPropDetails {
  proposalId: number
  content: { typeUrl: string; value: Uint8Array } | undefined
  status: ProposalStatus
  finalTallyResult:
    | { yes: string; abstain: string; no: string; noWithVeto: string }
    | undefined
  submitTime: Date | undefined
  depositEndTime: Date | undefined
  totalDeposit: ICoin[]
  votingStartTime: Date | undefined
  votingEndTime: Date | undefined
}
