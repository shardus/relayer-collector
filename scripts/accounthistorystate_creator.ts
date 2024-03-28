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
  const bucketSize = 1000
  for (let i = 0; i < receiptsCount; i += limit) {
    console.log(i, i + limit)
    const receipts = await ReceiptDB.queryReceipts(i, limit)
    let accountHistoryStateList: AccountHistoryStateDB.AccountHistoryState[] = []
    for (const receipt of receipts) {
      const { appliedReceipt, appReceiptData, globalModification, receiptId } = receipt
      const blockHash = appReceiptData.data?.readableReceipt?.blockHash
      if (!blockHash) {
        console.error(`Receipt ${receiptId} has no blockHash`)
        continue
      }
      const blockNumber = parseInt(appReceiptData.data?.readableReceipt?.blockNumber)
      if (
        globalModification === false &&
        appliedReceipt &&
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
            receiptId,
          }
          accountHistoryStateList.push(accountHistoryState)
        }
      } else {
        if (globalModification === true) {
          console.log(`Receipt ${receiptId} has globalModification as true`)
        }
        if (globalModification === false && !appliedReceipt) {
          console.error(`Receipt ${receiptId} has no appliedReceipt`)
        }
      }
      if (accountHistoryStateList.length >= bucketSize) {
        await AccountHistoryStateDB.bulkInsertAccountHistoryStates(accountHistoryStateList)
        accountHistoryStateList = []
      }
    }
    if (accountHistoryStateList.length > 0) {
      await AccountHistoryStateDB.bulkInsertAccountHistoryStates(accountHistoryStateList)
      accountHistoryStateList = []
    }
  }
  const accountHistoryStateCount = await AccountHistoryStateDB.queryAccountHistoryStateCount()
  console.log('accountHistoryStateCount', accountHistoryStateCount)
}

start()
