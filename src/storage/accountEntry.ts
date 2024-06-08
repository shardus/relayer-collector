import { config } from '../config/index'
import { Account, AccountEntry } from '../types'
import * as db from './sqlite3storage'
import { Utils as StringUtils } from '@shardus/types'

export async function insertAccountEntry(account: Account): Promise<void> {
  try {
    const accountEntry: AccountEntry = {
      accountId: account.accountId,
      timestamp: account.timestamp,
      data: account.account,
    }
    const fields = Object.keys(accountEntry).join(', ')
    const placeholders = Object.keys(accountEntry).fill('?').join(', ')
    const values = db.extractValues(accountEntry)
    const sql = 'INSERT OR REPLACE INTO accountsEntry (' + fields + ') VALUES (' + placeholders + ')'
    await db.run(sql, values, 'shardeumIndexer')
    if (config.verbose)
      console.log(
        'ShardeumIndexer: Successfully inserted AccountEntry',
        account.ethAddress || account.accountId
      )
  } catch (e) {
    console.log(e)
    console.log(
      'ShardeumIndexer: Unable to insert AccountEntry or it is already stored in to database',
      account.accountId
    )
  }
}

export async function bulkInsertAccountEntries(accounts: Account[]): Promise<void> {
  try {
    const accountEntries: AccountEntry[] = []
    for (const account of accounts) {
      const accountEntry: AccountEntry = {
        accountId: account.accountId,
        timestamp: account.timestamp,
        data: account.account,
      }
      accountEntries.push(accountEntry)
    }
    const fields = Object.keys(accountEntries[0]).join(', ')
    const placeholders = Object.keys(accountEntries[0]).fill('?').join(', ')
    const values = db.extractValuesFromArray(accountEntries)
    let sql = 'INSERT OR REPLACE INTO accountsEntry (' + fields + ') VALUES (' + placeholders + ')'
    for (let i = 1; i < accountEntries.length; i++) {
      sql = sql + ', (' + placeholders + ')'
    }
    await db.run(sql, values, 'shardeumIndexer')
    console.log('ShardeumIndexer: Successfully bulk inserted AccountEntries', accountEntries.length)
  } catch (e) {
    console.log(e)
    console.log('ShardeumIndexer: Unable to bulk insert AccountEntries', accounts.length)
  }
}

export async function updateAccountEntry(_accountId: string, account: Partial<Account>): Promise<void> {
  try {
    const sql = `UPDATE accountsEntry SET timestamp = $timestamp, data = $account WHERE accountId = $accountId `
    await db.run(
      sql,
      {
        $timestamp: account.timestamp,
        $account: account.account && StringUtils.safeStringify(account.account),
        $accountId: account.accountId,
      },
      'shardeumIndexer'
    )
    if (config.verbose)
      console.log(
        'ShardeumIndexer: Successfully updated AccountEntry',
        account.ethAddress || account.accountId
      )
  } catch (e) {
    console.log(e)
    console.log('ShardeumIndexer: Unable to update AccountEntry', account)
  }
}

export async function queryAccountEntryCount(): Promise<number> {
  let accountEntries: { 'COUNT(*)': number } = { 'COUNT(*)': 0 }
  try {
    const sql = `SELECT COUNT(*) FROM accountsEntry`
    accountEntries = await db.get(sql, [], 'shardeumIndexer')
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('AccountEntry count', accountEntries)
  return accountEntries['COUNT(*)'] || 0
}
