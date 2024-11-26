import * as db from './sqlite3storage'
import { accountDatabase } from '.'
import { config } from '../config/index'
import { Account, AccountSearchType, AccountType, AccountsCopy } from '../types'
import { Utils as StringUtils } from '@shardus/types'

type DbAccount = Account & {
  data: string
}

export const EOA_CodeHash = '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'

export async function insertAccount(account: Account): Promise<void> {
  try {
    const fields = Object.keys(account).join(', ')
    const placeholders = Object.keys(account).fill('?').join(', ')
    const values = db.extractValues(account)
    const sql = 'INSERT OR REPLACE INTO accounts (' + fields + ') VALUES (' + placeholders + ')'
    await db.run(accountDatabase, sql, values)
    if (config.verbose) console.log('Successfully inserted Account', account.accountId)
  } catch (e) {
    console.log(e)
    console.log('Unable to insert Account or it is already stored in to database', account.accountId)
  }
}

export async function bulkInsertAccounts(accounts: Account[]): Promise<void> {
  try {
    const fields = Object.keys(accounts[0]).join(', ')
    const placeholders = Object.keys(accounts[0]).fill('?').join(', ')
    const values = db.extractValuesFromArray(accounts)
    let sql = 'INSERT OR REPLACE INTO accounts (' + fields + ') VALUES (' + placeholders + ')'
    for (let i = 1; i < accounts.length; i++) {
      sql = sql + ', (' + placeholders + ')'
    }
    await db.run(accountDatabase, sql, values)
    console.log('Successfully bulk inserted Accounts', accounts.length)
  } catch (e) {
    console.log(e)
    console.log('Unable to bulk insert Accounts', accounts.length)
  }
}

export async function updateAccount(_accountId: string, account: Partial<Account>): Promise<void> {
  try {
    const sql = `UPDATE accounts SET cycleNumber = $cycleNumber, timestamp = $timestamp, data = $data, hash = $hash WHERE accountId = $accountId `
    await db.run(accountDatabase, sql, {
      $cycleNumber: account.cycleNumber,
      $timestamp: account.timestamp,
      $data: account.data && StringUtils.safeStringify(account.data),
      $hash: account.hash,
      $accountId: account.accountId,
    })
    if (config.verbose) console.log('Successfully updated Account', account.accountId)
  } catch (e) {
    console.log(e)
    console.log('Unable to update Account', account)
  }
}

export async function queryAccountCount(
  startCycleNumber?: number,
  endCycleNumber?: number,
  type?: AccountSearchType
): Promise<number> {
  let accounts: { 'COUNT(*)': number } = { 'COUNT(*)': 0 }
  try {
    let sql = `SELECT COUNT(*) FROM accounts`
    const values: unknown[] = []
    if (type) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `accountType=?`
      values.push(type)
    }
    if (startCycleNumber || endCycleNumber) {
      console.log('before sql', sql)
      sql = db.updateSqlStatementClause(sql, values)
      console.log('after sql', sql)
      sql += `cycleNumber BETWEEN ? AND ?`
      values.push(startCycleNumber, endCycleNumber)
    }
    accounts = (await db.get(accountDatabase, sql, values)) as { 'COUNT(*)': number }
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('Account count', accounts)
  return accounts['COUNT(*)'] || 0
}

export async function queryAccounts(
  skip = 0,
  limit = 10,
  startCycleNumber?: number,
  endCycleNumber?: number,
  type?: AccountSearchType
): Promise<Account[]> {
  let accounts: DbAccount[] = []
  try {
    let sql = `SELECT * FROM accounts`
    const values: unknown[] = []
    if (type) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `accountType=?`
      values.push(type)
    }
    if (startCycleNumber || endCycleNumber) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `cycleNumber BETWEEN ? AND ?`
      values.push(startCycleNumber, endCycleNumber)
    }
    if (startCycleNumber || endCycleNumber) {
      sql += ` ORDER BY cycleNumber ASC, timestamp ASC LIMIT ${limit} OFFSET ${skip}`
    } else {
      sql += ` ORDER BY cycleNumber DESC, timestamp DESC LIMIT ${limit} OFFSET ${skip}`
    }
    accounts = (await db.all(accountDatabase, sql, values)) as DbAccount[]
    accounts.forEach((account: DbAccount) => {
      if (account.data) account.data = StringUtils.safeJsonParse(account.data)
    })
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('Accounts accounts', accounts)
  return accounts
}

export async function queryAccountByAccountId(accountId: string): Promise<Account | null> {
  try {
    const sql = `SELECT * FROM accounts WHERE accountId=?`
    const account = (await db.get(accountDatabase, sql, [accountId])) as DbAccount
    if (account) account.data = StringUtils.safeJsonParse(account.data)
    if (config.verbose) console.log('Account accountId', account)
    return account as Account
  } catch (e) {
    console.log(e)
  }
  return null
}

export async function processAccountData(accounts: AccountsCopy[]): Promise<Account[]> {
  console.log('accounts size', accounts.length)
  if (accounts && accounts.length <= 0) return []
  const bucketSize = 1000
  let combineAccounts: Account[] = []
  const transactions: Account[] = []

  for (const account of accounts) {
    try {
      if (typeof account.data === 'string') account.data = StringUtils.safeJsonParse(account.data)
    } catch (e) {
      console.log('Error in parsing account data', account.data)
      continue
    }
    const accountType = account.data.accountType as AccountType // be sure to update with the correct field with the account type defined in the dapp
    const accObj: Account = {
      accountId: account.accountId,
      cycleNumber: account.cycleNumber,
      timestamp: account.timestamp,
      data: account.data,
      hash: account.hash,
      accountType,
      isGlobal: account.isGlobal,
    }
    combineAccounts.push(accObj)
    // if tx receipt is saved as an account, create tx object from the account and save it
    // if (accountType === AccountType.Receipt) {
    //   const txObj = { ...accObj }
    //   transactions.push(txObj)
    // }
    if (combineAccounts.length >= bucketSize) {
      await bulkInsertAccounts(combineAccounts)
      combineAccounts = []
    }
  }
  if (combineAccounts.length > 0) await bulkInsertAccounts(combineAccounts)
  return transactions
}
