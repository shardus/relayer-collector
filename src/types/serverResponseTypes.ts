import { OriginalTxData } from './originalTxData'

export type ErrorResponse = {
  success: boolean
  error: string
}

export type ReceiptResponse = {
  success: boolean
  receipts?: unknown
  totalPages?: number
  totalReceipts?: number
}

export type OriginalTxResponse = {
  success: boolean
  originalTxs?: OriginalTxData[] | number
  totalPages?: number
  totalOriginalTxs?: number
}

export type TransactionResponse = {
  success: boolean
  transactions?: Array<unknown>
  totalPages?: number
  totalTransactions?: number
}

export type AddressResponse = {
  success: boolean
  accounts?: unknown
}

export type AccountResponse = {
  success: boolean
  accounts?: unknown
  totalPages?: number
  totalAccounts?: number
}
