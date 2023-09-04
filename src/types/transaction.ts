import { WrappedEVMAccount, Token } from './account'

export interface Transaction {
  txId: string
  result: Result
  cycle: number
  partition: number
  timestamp: number
  wrappedEVMAccount: WrappedEVMAccount
  accountId: string
  transactionType: TransactionType
  txHash: string
  txFrom: string
  txTo: string
  nominee?: string
  originTxData: unknown // This has to be originalTxData; there is also a fix MR for it. // The lower one has to be removed when the fix is merged.
  originalTxData?: any
  tokenTxs?: TokenTx[]
  contractInfo?: ContractInfo
  txStatus?: TxStatus
  data?: unknown
}

export interface Result {
  txIdShort: string
  txResult: string
}

export type TxStatus = 'Pending' | 'Expired'

export enum TransactionType {
  Receipt = 0, // EVM Receipt
  NodeRewardReceipt = 1,
  StakeReceipt = 2,
  UnstakeReceipt = 3,
  EVM_Internal = 4,
  ERC_20 = 5,
  ERC_721 = 6,
  ERC_1155 = 7,
  InternalTxReceipt = 8,
}

export interface ContractInfo {
  totalSupply: number
  decimals: string
  name: string
  symbol: string
}

export interface TokenTx<C = object> {
  cycle: number
  timestamp: number
  contractAddress: string
  contractInfo?: C
  tokenFrom: string
  tokenTo: string
  tokenValue: string
  tokenType: TransactionType
  tokenEvent: string
  tokenOperator?: string | null
  transactionFee: string

  // references another tx
  txId?: string
  txHash: string
}

export enum InternalTXType {
  SetGlobalCodeBytes = 0,
  InitNetwork = 1,
  NodeReward = 2,
  ChangeConfig = 3,
  ApplyChangeConfig = 4,
  SetCertTime = 5,
  Stake = 6,
  Unstake = 7,
  InitRewardTimes = 8,
  ClaimReward = 9,
  ChangeNetworkParam = 10,
  ApplyNetworkParam = 11,
  Penalty = 12,
}

/**
 * InternalTx is a non EVM TX that shardeum can use for utility task such as global changes
 *
 */
export interface InternalTxBase {
  isInternalTx: boolean
  internalTXType: InternalTXType
}

export interface InternalTx extends InternalTxBase {
  timestamp: number
  from?: string
  to?: string
  accountData?: WrappedEVMAccount
  network?: string // Network Account
  nodeId?: string // Node Account
}

export interface DecodeTxResult {
  txs: TokenTx[]
  accs: string[] // ethAddress[]
  tokens: Token[]
}

export enum TransactionSearchType {
  All = 0, // Receipt + NodeRewardReceipt + StakeReceipt + UnstakeReceipt + InternalTxReceipt
  Receipt = 1,
  NodeRewardReceipt = 2,
  StakeReceipt = 3,
  UnstakeReceipt = 4,
  EVM_Internal = 5,
  ERC_20 = 6,
  ERC_721 = 7,
  ERC_1155 = 8,
  TokenTransfer = 9, // token txs of a contract
  InternalTxReceipt = 10,
  AllExceptInternalTx = 11, // Receipt + NodeRewardReceipt + StakeReceipt + UnstakeReceipt (exclude InternalTxReceipt)
  Pending = 12, // Pending Txs (AllExceptInternalTx) from originTxsData
}