import { TransactionType } from './transaction'

export interface OriginalTxData {
  txId: string
  timestamp: number
  cycle: number
  originalTxData: any // eslint-disable-line @typescript-eslint/no-explicit-any
  transactionType?: TransactionType
  txFrom: string
  txTo: string
}
