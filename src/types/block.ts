import { ShardeumBlockOverride } from '../storage/block'

export interface BlockResponse {
  success: boolean
  number: number
  hash: string
  timestamp: number
  cycle: number
  readableBlock: ShardeumBlockOverride
}
