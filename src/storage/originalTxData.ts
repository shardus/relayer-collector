import * as db from './sqlite3storage'
import { originalTxDataDatabase } from '.'
import { config } from '../config/index'
import { TransactionType, OriginalTxData, TransactionSearchType } from '../types'
import { Utils as StringUtils } from '@shardus/types'

type DbOriginalTxData = OriginalTxData & {
  originalTxData: string
}

export const originalTxsMap: Map<string, number> = new Map()

export async function insertOriginalTxData(originalTxData: OriginalTxData): Promise<void> {
  try {
    const fields = Object.keys(originalTxData).join(', ')
    const placeholders = Object.keys(originalTxData).fill('?').join(', ')
    const values = db.extractValues(originalTxData)
    const sql = `INSERT OR REPLACE INTO originalTxsData (` + fields + ') VALUES (' + placeholders + ')'
    await db.run(originalTxDataDatabase, sql, values)
    if (config.verbose) console.log(`Successfully inserted OriginalTxData`, originalTxData.txId)
  } catch (e) {
    console.log(e)
    console.log(`Unable to insert originalTxsData or it is already stored in to database`, originalTxData)
  }
}

export async function bulkInsertOriginalTxsData(originalTxsData: OriginalTxData[]): Promise<void> {
  try {
    const fields = Object.keys(originalTxsData[0]).join(', ')
    const placeholders = Object.keys(originalTxsData[0]).fill('?').join(', ')
    const values = db.extractValuesFromArray(originalTxsData)
    let sql = `INSERT OR REPLACE INTO originalTxsData (` + fields + ') VALUES (' + placeholders + ')'
    for (let i = 1; i < originalTxsData.length; i++) {
      sql = sql + ', (' + placeholders + ')'
    }
    await db.run(originalTxDataDatabase, sql, values)
    console.log(`Successfully bulk inserted OriginalTxsData`, originalTxsData.length)
  } catch (e) {
    console.log(e)
    console.log(`Unable to bulk insert OriginalTxsData`, originalTxsData.length)
    throw e // check with Achal/Jai
  }
}

export async function processOriginalTxData(
  originalTxsData: OriginalTxData[],
  saveOnlyNewData = false
): Promise<void> {
  if (originalTxsData && originalTxsData.length <= 0) return
  const bucketSize = 1000
  let combineOriginalTxsData: OriginalTxData[] = []
  for (const originalTxData of originalTxsData) {
    const { txId, timestamp } = originalTxData
    if (originalTxsMap.has(txId) && originalTxsMap.get(txId) === timestamp) continue
    originalTxsMap.set(txId, timestamp)
    /* prettier-ignore */ if (config.verbose) console.log('originalTxData', originalTxData)
    if (saveOnlyNewData) {
      const originalTxDataExist = await queryOriginalTxDataByTxId(txId)
      if (originalTxDataExist) continue
    }
    if (!config.processData.indexOriginalTxData) combineOriginalTxsData.push(originalTxData)
    else {
      try {
        const transactionType = originalTxData.originalTxData.tx.transactionType as TransactionType // be sure to update with the correct field with the transaction type defined in the dapp
        const txFrom = originalTxData.originalTxData.tx.from // be sure to update with the correct field of the tx sender
        const txTo = originalTxData.originalTxData.tx.to // be sure to update with the correct field of the tx recipient
        combineOriginalTxsData.push({
          ...originalTxData,
          transactionType,
          txFrom,
          txTo,
        })
      } catch (e) {
        console.log('Error in processing original Tx data', originalTxData.txId, e)
      }
    }
    if (combineOriginalTxsData.length >= bucketSize) {
      await bulkInsertOriginalTxsData(combineOriginalTxsData)
      combineOriginalTxsData = []
    }
  }
  if (combineOriginalTxsData.length > 0) await bulkInsertOriginalTxsData(combineOriginalTxsData)
}

export async function queryOriginalTxDataCount(
  accountId?: string,
  startCycle?: number,
  endCycle?: number,
  txType?: TransactionSearchType,
  afterTimestamp?: number
): Promise<number> {
  console.log('queryOriginalTxDataCount', accountId, startCycle, endCycle, txType, afterTimestamp)
  let originalTxsData: { 'COUNT(*)': number } = { 'COUNT(*)': 0 }
  try {
    let sql = `SELECT COUNT(*) FROM originalTxsData`
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
    if (startCycle || endCycle) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `cycleNumber BETWEEN ? AND ?`
      values.push(startCycle, endCycle)
    }
    if (afterTimestamp) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `timestamp>?`
      values.push(afterTimestamp)
    }
    originalTxsData = (await db.get(originalTxDataDatabase, sql, values)) as { 'COUNT(*)': number }
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('OriginalTxData count', originalTxsData)
  return originalTxsData['COUNT(*)'] || 0
}

export async function queryOriginalTxsData(
  skip = 0,
  limit = 10,
  accountId?: string,
  startCycle?: number,
  endCycle?: number,
  txType?: TransactionSearchType,
  afterTimestamp?: number
): Promise<OriginalTxData[]> {
  let originalTxsData: DbOriginalTxData[] = []
  try {
    let sql = `SELECT * FROM originalTxsData`
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
    if (startCycle || endCycle) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `cycleNumber BETWEEN ? AND ?`
      values.push(startCycle, endCycle)
    }
    if (afterTimestamp) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `timestamp>?`
      values.push(afterTimestamp)
    }
    if (startCycle || endCycle) {
      sql += ` ORDER BY cycle ASC, timestamp ASC LIMIT ${limit} OFFSET ${skip}`
    } else {
      sql += ` ORDER BY cycle DESC, timestamp DESC LIMIT ${limit} OFFSET ${skip}`
    }
    originalTxsData = (await db.all(originalTxDataDatabase, sql, values)) as DbOriginalTxData[]
    for (const originalTxData of originalTxsData) {
      originalTxData.originalTxData = StringUtils.safeJsonParse(originalTxData.originalTxData)
    }
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('OriginalTxData originalTxsData', originalTxsData)
  return originalTxsData as unknown as OriginalTxData[]
}

export async function queryOriginalTxDataByTxId(txId: string): Promise<OriginalTxData | null> {
  try {
    const sql = `SELECT * FROM originalTxsData WHERE txId=?`
    const originalTxData = (await db.get(originalTxDataDatabase, sql, [txId])) as DbOriginalTxData
    if (originalTxData && originalTxData.originalTxData) {
      originalTxData.originalTxData = StringUtils.safeJsonParse(originalTxData.originalTxData)
    }
    if (config.verbose) console.log('OriginalTxData txId', originalTxData)
    return originalTxData as unknown as OriginalTxData
  } catch (e) {
    console.log(e)
  }
  return null
}

export async function queryOriginalTxDataCountByCycles(
  start: number,
  end: number
): Promise<{ originalTxsData: number; cycle: number }[]> {
  let originalTxsData: { cycle: number; 'COUNT(*)': number }[] = []
  try {
    const sql = `SELECT cycle, COUNT(*) FROM originalTxsData GROUP BY cycle HAVING cycle BETWEEN ? AND ? ORDER BY cycle ASC`
    originalTxsData = (await db.all(originalTxDataDatabase, sql, [start, end])) as {
      cycle: number
      'COUNT(*)': number
    }[]
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('OriginalTxData count by cycles', originalTxsData)

  return originalTxsData.map((originalTxData) => {
    return {
      originalTxsData: originalTxData['COUNT(*)'],
      cycle: originalTxData.cycle,
    }
  })
}

export function cleanOldOriginalTxsMap(timestamp: number): void {
  for (const [key, value] of originalTxsMap) {
    if (value < timestamp) {
      originalTxsMap.delete(key)
    }
  }
  if (config.verbose) console.log('Clean Old OriginalTxs map!', timestamp, originalTxsMap)
}
