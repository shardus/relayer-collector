/** Same as type AccountsCopy in the shardus core */
export type AccountsCopy = {
  accountId: string
  data: any // eslint-disable-line @typescript-eslint/no-explicit-any
  timestamp: number
  hash: string
  cycleNumber: number
  isGlobal: boolean
}

export interface Account extends AccountsCopy {
  accountType?: AccountType
}

// AccountEntry: is the model used by shardeum-indexer
export interface AccountEntry {
  accountId: string
  timestamp: number
  data: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

export enum AccountType {}

export enum AccountSearchType {
  All, // All Accounts Type
  // e.g UserAndNodeAccounts for User and Node Accounts
}
