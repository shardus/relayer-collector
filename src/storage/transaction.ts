import * as db from './sqlite3storage'
import { transactionDatabase } from '.'
import { config } from '../config/index'
import { Utils as StringUtils } from '@shardus/types'
import { Transaction, TransactionType, TransactionSearchType } from '../types'

type DbTransaction = Transaction & {
  data: string
  originalTxData: string
}

export async function insertTransaction(transaction: Transaction): Promise<void> {
  try {
    const fields = Object.keys(transaction).join(', ')
    const placeholders = Object.keys(transaction).fill('?').join(', ')
    const values = db.extractValues(transaction)
    const sql = 'INSERT OR REPLACE INTO transactions (' + fields + ') VALUES (' + placeholders + ')'
    await db.run(transactionDatabase, sql, values)
    if (config.verbose)
      console.log('Successfully inserted Transaction', transaction.txId, transaction.appReceiptId)
  } catch (e) {
    console.log(e)
    console.log('Unable to insert Transaction or it is already stored in to database', transaction.txId)
  }
}

export async function bulkInsertTransactions(transactions: Transaction[]): Promise<void> {
  try {
    const fields = Object.keys(transactions[0]).join(', ')
    const placeholders = Object.keys(transactions[0]).fill('?').join(', ')
    const values = db.extractValuesFromArray(transactions)
    let sql = 'INSERT OR REPLACE INTO transactions (' + fields + ') VALUES (' + placeholders + ')'
    for (let i = 1; i < transactions.length; i++) {
      sql = sql + ', (' + placeholders + ')'
    }
    await db.run(transactionDatabase, sql, values)
    console.log('Successfully bulk inserted transactions', transactions.length)
  } catch (e) {
    console.log(e)
    console.log('Unable to bulk insert transactions', transactions.length)
  }
}

export async function updateTransaction(_txId: string, transaction: Partial<Transaction>): Promise<void> {
  try {
    const sql = `UPDATE transactions SET result = $result, cycleNumber = $cycleNumber, data = $data, appReceiptId = $appReceiptId WHERE txId = $txId `
    await db.run(transactionDatabase, sql, {
      $cycleNumber: transaction.cycleNumber,
      $data: transaction.data && StringUtils.safeStringify(transaction.data),
      $appReceiptId: transaction.appReceiptId,
      $txId: transaction.txId,
    })
    if (config.verbose)
      console.log('Successfully Updated Transaction', transaction.txId, transaction.appReceiptId)
  } catch (e) {
    /* prettier-ignore */ if (config.verbose) console.log(e);
    console.log('Unable to update Transaction', transaction.txId, transaction.appReceiptId)
  }
}

export async function processTransactionData(transactions: Transaction[]): Promise<void> {
  console.log('transactions size', transactions.length)
  if (transactions && transactions.length <= 0) return
  const bucketSize = 1000
  let combineTransactions: Transaction[] = []
  for (const transaction of transactions) {
    const transactionType = transaction.data.transactionType as TransactionType // be sure to update with the correct field with the transaction type defined in the dapp
    const txFrom = transaction.data.from // be sure to update with the correct field of the tx sender
    const txTo = transaction.data.to // be sure to update with the correct field of the tx recipient
    const txObj: Transaction = {
      txId: transaction.data?.txId,
      cycleNumber: transaction.cycleNumber,
      timestamp: transaction.timestamp,
      appReceiptId: transaction.appReceiptId,
      transactionType,
      txFrom,
      txTo,
      data: transaction.data,
      originalTxData: transaction.originalTxData || {},
    }
    combineTransactions.push(txObj)
    if (combineTransactions.length >= bucketSize) {
      await bulkInsertTransactions(combineTransactions)
      combineTransactions = []
    }
  }
  if (combineTransactions.length > 0) await bulkInsertTransactions(combineTransactions)
}

export async function queryTransactionCount(
  accountId?: string,
  txType?: TransactionSearchType,
  startCycleNumber?: number,
  endCycleNumber?: number,
  beforeTimestamp?: number,
  afterTimestamp?: number
): Promise<number> {
  let transactions: { 'COUNT(*)': number } = { 'COUNT(*)': 0 }
  try {
    let sql = `SELECT COUNT(*) FROM transactions`
    const values: unknown[] = []
    if (accountId) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `txFrom=? OR txTo=?`
      values.push(accountId, accountId)
    }
    if (txType) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `transactionType=?`
      values.push(txType)
    }
    if (startCycleNumber || endCycleNumber) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `cycleNumber BETWEEN ? AND ?`
      values.push(startCycleNumber, endCycleNumber)
    }
    if (beforeTimestamp || afterTimestamp) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `timestamp BETWEEN ? AND ?`
      values.push(beforeTimestamp, afterTimestamp)
    }
    transactions = (await db.get(transactionDatabase, sql, values)) as { 'COUNT(*)': number }
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('transactions count', transactions)

  return transactions['COUNT(*)'] || 0
}

export async function queryTransactions(
  skip = 0,
  limit = 10,
  accountId?: string,
  txType?: TransactionSearchType,
  startCycleNumber?: number,
  endCycleNumber?: number,
  beforeTimestamp?: number,
  afterTimestamp?: number
): Promise<DbTransaction[]> {
  let transactions: DbTransaction[] = []
  try {
    let sql = `SELECT * FROM transactions`
    const values: unknown[] = []
    if (accountId) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `txFrom=? OR txTo=?`
      values.push(accountId, accountId)
    }
    if (txType) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `transactionType=?`
      values.push(txType)
    }
    if (startCycleNumber || endCycleNumber) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `cycleNumber BETWEEN ? AND ?`
      values.push(startCycleNumber, endCycleNumber)
    }
    if (beforeTimestamp || afterTimestamp) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `timestamp BETWEEN ? AND ?`
      values.push(beforeTimestamp, afterTimestamp)
    }
    if (startCycleNumber || endCycleNumber) {
      sql += ` ORDER BY cycleNumber ASC, timestamp ASC LIMIT ${limit} OFFSET ${skip}`
    } else {
      sql += ` ORDER BY cycleNumber DESC, timestamp DESC LIMIT ${limit} OFFSET ${skip}`
    }
    transactions = (await db.all(transactionDatabase, sql, values)) as DbTransaction[]
    if (transactions.length > 0) {
      transactions.forEach((transaction: DbTransaction) => {
        deserializeDbTransaction(transaction)
      })
    }

    if (config.verbose) console.log('transactions', transactions)
  } catch (e) {
    console.log(e)
  }

  return transactions
}

export async function queryTransactionByTxId(txId: string): Promise<Transaction | null> {
  try {
    const sql = `SELECT * FROM transactions WHERE txId=?`
    const transaction = (await db.get(transactionDatabase, sql, [txId])) as DbTransaction
    if (transaction) {
      deserializeDbTransaction(transaction)
    }
    if (config.verbose) console.log('transaction txId', transaction)
    return transaction
  } catch (e) {
    console.log(e)
  }
  return null
}

export async function queryTransactionByAppReceiptId(appReceiptId: string): Promise<Transaction[] | null> {
  try {
    const sql = `SELECT * FROM transactions WHERE appReceiptId=? ORDER BY cycle DESC, timestamp DESC`
    const transactions = (await db.all(transactionDatabase, sql, [appReceiptId])) as DbTransaction[]
    if (transactions.length > 0) {
      for (const transaction of transactions) {
        deserializeDbTransaction(transaction)
      }
    }
    if (config.verbose) console.log('transaction hash', transactions)
    return transactions
  } catch (e) {
    console.log(e)
  }
  return null
}

export async function queryTransactionCountByCycles(
  start: number,
  end: number,
  txType?: TransactionSearchType
): Promise<{ cycle: number; transactions: number }[]> {
  let transactions: { cycle: number; 'COUNT(*)': number }[] = []
  try {
    let sql = `SELECT cycle, COUNT(*) FROM transactions`
    const values: unknown[] = []
    if (txType) {
      sql += ` WHERE transactionType=?`
      values.push(txType)
    }
    sql += ` GROUP BY cycle HAVING cycle BETWEEN ? AND ? ORDER BY cycle ASC`
    values.push(start, end)
    transactions = (await db.all(transactionDatabase, sql, values)) as { cycle: number; 'COUNT(*)': number }[]
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('Transaction count by cycles', transactions)

  return transactions.map((receipt) => {
    return {
      cycle: receipt.cycle,
      transactions: receipt['COUNT(*)'],
    }
  })
}

function deserializeDbTransaction(transaction: DbTransaction): void {
  transaction.data = StringUtils.safeJsonParse(transaction.data)
  transaction.originalTxData = StringUtils.safeJsonParse(transaction.originalTxData)
}
