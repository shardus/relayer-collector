import * as db from './sqlite3storage'
import { receiptDatabase } from '.'
import { config } from '../config'
import * as AccountDB from './account'
import * as TransactionDB from './transaction'
import * as AccountHistoryStateDB from './accountHistoryState'
import { Utils as StringUtils } from '@shardus/types'
import { AccountType, Transaction, TransactionType, Receipt, Account } from '../types'
import { extractValues, extractValuesFromArray } from './sqlite3storage'

type DbReceipt = Receipt & {
  tx: string
  beforeStates: string
  afterStates: string
  appReceiptData: string | null
  signedReceipt: string
}

export const receiptsMap: Map<string, number> = new Map()

export async function insertReceipt(receipt: Receipt): Promise<void> {
  try {
    const fields = Object.keys(receipt).join(', ')
    const placeholders = Object.keys(receipt).fill('?').join(', ')
    const values = extractValues(receipt)
    const sql = 'INSERT OR REPLACE INTO receipts (' + fields + ') VALUES (' + placeholders + ')'
    await db.run(receiptDatabase, sql, values)
    if (config.verbose) console.log('Successfully inserted Receipt', receipt.receiptId)
  } catch (e) {
    console.log(e)
    console.log('Unable to insert Receipt or it is already stored in to database', receipt.receiptId)
  }
}

export async function bulkInsertReceipts(receipts: Receipt[]): Promise<void> {
  try {
    const fields = Object.keys(receipts[0]).join(', ')
    const placeholders = Object.keys(receipts[0]).fill('?').join(', ')
    const values = extractValuesFromArray(receipts)
    let sql = 'INSERT OR REPLACE INTO receipts (' + fields + ') VALUES (' + placeholders + ')'
    for (let i = 1; i < receipts.length; i++) {
      sql = sql + ', (' + placeholders + ')'
    }
    await db.run(receiptDatabase, sql, values)
    console.log('Successfully bulk inserted receipts', receipts.length)
  } catch (e) {
    console.log(e)
    console.log('Unable to bulk insert receipts', receipts.length)
  }
}

export async function processReceiptData(receipts: Receipt[], saveOnlyNewData = false): Promise<void> {
  if (receipts && receipts.length <= 0) return
  const bucketSize = 1000
  let combineReceipts: Receipt[] = []
  let combineAccounts: Account[] = []
  let combineTransactions: Transaction[] = []
  let accountHistoryStateList: AccountHistoryStateDB.AccountHistoryState[] = []
  for (const receiptObj of receipts) {
    const { afterStates, cycle, appReceiptData, tx, timestamp, signedReceipt } = receiptObj
    if (receiptsMap.has(tx.txId) && receiptsMap.get(tx.txId) === timestamp) {
      continue
    }
    let modifiedReceiptObj = {
      ...receiptObj,
      beforeStates: config.storeReceiptBeforeStates ? receiptObj.beforeStates : [],
    }
    if (saveOnlyNewData) {
      const receiptExist = await queryReceiptByReceiptId(tx.txId)
      if (!receiptExist) combineReceipts.push(modifiedReceiptObj as unknown as Receipt)
    } else combineReceipts.push(modifiedReceiptObj as unknown as Receipt)
    let txReceipt = appReceiptData
    receiptsMap.set(tx.txId, tx.timestamp)

    // Receipts size can be big, better to save per 100
    if (combineReceipts.length >= 100) {
      await bulkInsertReceipts(combineReceipts)
      combineReceipts = []
    }
    if (!config.processData.indexReceipt) continue
    for (const account of afterStates) {
      const accountType = account.data.accountType as AccountType // be sure to update with the correct field with the account type defined in the dapp
      const accObj: Account = {
        accountId: account.accountId,
        cycleNumber: cycle,
        timestamp: account.timestamp,
        data: account.data,
        hash: account.hash,
        accountType,
        isGlobal: account.isGlobal,
      }
      const index = combineAccounts.findIndex((a) => {
        return a.accountId === accObj.accountId
      })
      if (index > -1) {
        // eslint-disable-next-line security/detect-object-injection
        const accountExist = combineAccounts[index]
        if (accountExist.timestamp < accObj.timestamp) {
          combineAccounts.splice(index, 1)
          combineAccounts.push(accObj)
        }
      } else {
        const accountExist = await AccountDB.queryAccountByAccountId(accObj.accountId)
        if (config.verbose) console.log('accountExist', accountExist)
        if (!accountExist) {
          combineAccounts.push(accObj)
        } else {
          if (accountExist.timestamp < accObj.timestamp) {
            await AccountDB.updateAccount(accObj.accountId, accObj)
          }
        }
      }

      // if tx receipt is saved as an account, create tx object from the account and save it
      // if (accountType === AccountType.Receipt) {
      //   txReceipt = { ...accObj }
      // }
    }

    if (txReceipt) {
      console.log('txReceipt', txReceipt)
      const transactionType = txReceipt.transactionType as TransactionType // be sure to update with the correct field with the transaction type defined in the dapp
      const txFrom = txReceipt.from // be sure to update with the correct field of the tx sender
      const txTo = txReceipt.to // be sure to update with the correct field of the tx recipient
      const txObj: Transaction = {
        txId: tx.txId,
        cycleNumber: cycle,
        timestamp: tx.timestamp,
        data: txReceipt,
        transactionType,
        txFrom,
        txTo,
        originalTxData: tx.originalTxData || {},
      }
      const transactionExist = await TransactionDB.queryTransactionByTxId(tx.txId)
      if (config.verbose) console.log('transactionExist', transactionExist)
      if (!transactionExist) {
        combineTransactions.push(txObj)
      } else {
        if (transactionExist.timestamp < txObj.timestamp) {
          await TransactionDB.insertTransaction(txObj)
        }
      }
    }
    if (config.saveAccountHistoryState) {
      // Note: This has to be changed once we change the way the global modification tx consensus is updated
      if (
        receiptObj.globalModification === false &&
        signedReceipt &&
        signedReceipt.proposal.accountIDs.length > 0
      ) {
        for (let i = 0; i < signedReceipt.proposal.accountIDs.length; i++) {
          const accountHistoryState = {
            accountId: signedReceipt.proposal.accountIDs[i],
            beforeStateHash: signedReceipt.proposal.beforeStateHashes[i],
            afterStateHash: signedReceipt.proposal.afterStateHashes[i],
            timestamp,
            receiptId: tx.txId,
          }
          accountHistoryStateList.push(accountHistoryState)
        }
      } else {
        if (receiptObj.globalModification === true) {
          console.log(`Receipt ${tx.txId} with timestamp ${timestamp} has globalModification as true`)
        }
        if (receiptObj.globalModification === false && !signedReceipt) {
          console.error(`Receipt ${tx.txId} with timestamp ${timestamp} has no signedReceipt`)
        }
      }
    }
    if (combineAccounts.length >= bucketSize) {
      await AccountDB.bulkInsertAccounts(combineAccounts)
      combineAccounts = []
    }
    if (combineTransactions.length >= bucketSize) {
      await TransactionDB.bulkInsertTransactions(combineTransactions)
      combineTransactions = []
    }
    if (accountHistoryStateList.length > bucketSize) {
      await AccountHistoryStateDB.bulkInsertAccountHistoryStates(accountHistoryStateList)
      accountHistoryStateList = []
    }
  }
  if (combineReceipts.length > 0) await bulkInsertReceipts(combineReceipts)
  if (combineAccounts.length > 0) await AccountDB.bulkInsertAccounts(combineAccounts)
  if (combineTransactions.length > 0) await TransactionDB.bulkInsertTransactions(combineTransactions)
  if (accountHistoryStateList.length > 0)
    await AccountHistoryStateDB.bulkInsertAccountHistoryStates(accountHistoryStateList)
}

export async function queryReceiptByReceiptId(receiptId: string): Promise<Receipt | null> {
  try {
    const sql = `SELECT * FROM receipts WHERE receiptId=?`
    const receipt = (await db.get(receiptDatabase, sql, [receiptId])) as DbReceipt
    if (receipt) deserializeDbReceipt(receipt)
    if (config.verbose) console.log('Receipt receiptId', receipt)
    return receipt as Receipt
  } catch (e) {
    console.log(e)
  }

  return null
}

export async function queryReceipts(
  skip = 0,
  limit = 100,
  startCycleNumber?: number,
  endCycleNumber?: number
): Promise<Receipt[]> {
  let receipts: DbReceipt[] = []
  try {
    let sql = `SELECT * FROM receipts`
    const values: unknown[] = []
    if (startCycleNumber || endCycleNumber) {
      sql += ` WHERE cycle BETWEEN ? AND ?`
      values.push(startCycleNumber, endCycleNumber)
    }
    if (startCycleNumber || endCycleNumber) {
      sql += ` ORDER BY cycle ASC, timestamp ASC LIMIT ${limit} OFFSET ${skip}`
    } else {
      sql += ` ORDER BY cycle DESC, timestamp DESC LIMIT ${limit} OFFSET ${skip}`
    }
    receipts = (await db.all(receiptDatabase, sql, values)) as DbReceipt[]
    receipts.forEach((receipt: DbReceipt) => deserializeDbReceipt(receipt))
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('Receipt receipts', receipts ? receipts.length : receipts, 'skip', skip)

  return receipts
}

export async function queryReceiptCount(startCycle?: number, endCycle?: number): Promise<number> {
  let receipts: { 'COUNT(*)': number } = { 'COUNT(*)': 0 }
  try {
    let sql = `SELECT COUNT(*) FROM receipts`
    const values: unknown[] = []
    if (startCycle || endCycle) {
      sql += ` WHERE cycle BETWEEN ? AND ?`
      values.push(startCycle, endCycle)
    }
    receipts = (await db.get(receiptDatabase, sql, values)) as { 'COUNT(*)': number }
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('Receipt count', receipts)

  return receipts['COUNT(*)'] || 0
}

export async function queryReceiptCountByCycles(
  start: number,
  end: number
): Promise<{ receipts: number; cycle: number }[]> {
  let receipts: { cycle: number; 'COUNT(*)': number }[] = []
  try {
    const sql = `SELECT cycle, COUNT(*) FROM receipts GROUP BY cycle HAVING cycle BETWEEN ? AND ? ORDER BY cycle ASC`
    receipts = (await db.all(receiptDatabase, sql, [start, end])) as { cycle: number; 'COUNT(*)': number }[]
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('Receipt count by cycles', receipts)

  return receipts.map((receipt) => {
    return {
      receipts: receipt['COUNT(*)'],
      cycle: receipt.cycle,
    }
  })
}

function deserializeDbReceipt(receipt: DbReceipt): void {
  receipt.tx &&= StringUtils.safeJsonParse(receipt.tx)
  receipt.beforeStates &&= StringUtils.safeJsonParse(receipt.beforeStates)
  receipt.afterStates &&= StringUtils.safeJsonParse(receipt.afterStates)
  receipt.appReceiptData &&= StringUtils.safeJsonParse(receipt.appReceiptData)
  receipt.signedReceipt &&= StringUtils.safeJsonParse(receipt.signedReceipt)

  // globalModification is stored as 0 or 1 in the database, convert it to boolean
  receipt.globalModification = (receipt.globalModification as unknown as number) === 1
}

export function cleanOldReceiptsMap(timestamp: number): void {
  for (const [key, value] of receiptsMap) {
    if (value < timestamp) receiptsMap.delete(key)
  }
  if (config.verbose) console.log('Clean Old Receipts Map', timestamp, receiptsMap)
}
