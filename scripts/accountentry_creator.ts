import dotenv from 'dotenv'
dotenv.config()

import * as crypto from '@shardus/crypto-utils'
import * as Storage from '../src/storage'
import * as AccountEntryDB from '../src/storage/accountEntry'
import * as AccountDB from '../src/storage/account'
import { config } from '../src/config'
import { AccountSearchType } from '../src/types'

crypto.init(config.hashKey)
const start = async (): Promise<void> => {
  await Storage.initializeDB()

  const accountsCount = await AccountDB.queryAccountCount(AccountSearchType.All)
  console.log('accountsCount', accountsCount)
  const limit = 100
  for (let i = 0; i < accountsCount; i += limit) {
    const accounts = await AccountDB.queryAccounts(i, limit, AccountSearchType.All)
    console.log('accounts', accounts.length)
    await AccountEntryDB.bulkInsertAccountEntries(accounts)
  }
  const accountEntriesCount = await AccountEntryDB.queryAccountEntryCount()
  console.log('accountEntriesCount', accountEntriesCount)
}

start()
