import dotenv from 'dotenv'
dotenv.config()

import * as crypto from '@shardus/crypto-utils'
import * as Storage from '../src/storage'
import * as ReceiptDB from '../src/storage/receipt'
import * as AccountHistoryStateDB from '../src/storage/accountHistoryState'
import { config } from '../src/config'

crypto.init(config.hashKey)
const start = async (): Promise<void> => {
  await Storage.initializeDB()

  const receiptsCount = await ReceiptDB.queryReceiptCount()
  console.log('receiptsCount', receiptsCount)
  const limit = 100
  for (let i = 0; i < receiptsCount; i += limit) {
    const receipts = await ReceiptDB.queryReceipts(i, limit)
    console.log('receipts', receipts.length)
    let accountHistoryStateList: AccountHistoryStateDB.AccountHistoryState[] = []
    for (const receipt of receipts) {
      const { appliedReceipt, appReceiptData, globalModification, receiptId } = receipt
      const blockNumber = parseInt(appReceiptData.data?.readableReceipt?.blockNumber)
      const blockHash = appReceiptData.data?.readableReceipt?.blockHash
      if (
        globalModification === false &&
        appliedReceipt &&
        blockNumber &&
        blockHash &&
        appliedReceipt.appliedVote.account_id.length > 0
      ) {
        for (let i = 0; i < appliedReceipt.appliedVote.account_id.length; i++) {
          const accountHistoryState: AccountHistoryStateDB.AccountHistoryState = {
            accountId: appliedReceipt.appliedVote.account_id[i],
            beforeStateHash: appliedReceipt.appliedVote.account_state_hash_before[i],
            afterStateHash: appliedReceipt.appliedVote.account_state_hash_after[i],
            timestamp: receipt.timestamp,
            blockNumber,
            blockHash,
            receiptId: receiptId,
          }
          accountHistoryStateList.push(accountHistoryState)
        }
        AccountHistoryStateDB.bulkInsertAccountHistoryStates(accountHistoryStateList)
        accountHistoryStateList = []
      } else {
        console.log(
          `Transaction ${receiptId} has no appliedReceipt or blockNumber or blockHash or globalModification is true`
        )
        // console.dir(receipt, { depth: null })
      }
    }
  }
  const accountHistoryStateCount = await AccountHistoryStateDB.queryAccountHistoryStateCount()
  console.log('accountHistoryStateCount', accountHistoryStateCount)
}

start()
