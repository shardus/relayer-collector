import WebSocket from 'ws'
import { Database } from 'sqlite3'
import { config } from '../config'
import { createDB, runCreate, close } from './sqlite3storage'
import { createDirectories } from '../utils'

export let cycleDatabase: Database
export let accountDatabase: Database
export let transactionDatabase: Database
export let receiptDatabase: Database
export let originalTxDataDatabase: Database
export let accountHistoryStateDatabase: Database

export const initializeDB = async (): Promise<void> => {
  createDirectories(config.COLLECTOR_DB_DIR_PATH)
  accountDatabase = await createDB(
    `${config.COLLECTOR_DB_DIR_PATH}/${config.COLLECTOR_DATA.accountDB}`,
    'Account'
  )
  cycleDatabase = await createDB(`${config.COLLECTOR_DB_DIR_PATH}/${config.COLLECTOR_DATA.cycleDB}`, 'Cycle')
  transactionDatabase = await createDB(
    `${config.COLLECTOR_DB_DIR_PATH}/${config.COLLECTOR_DATA.transactionDB}`,
    'Transaction'
  )
  receiptDatabase = await createDB(
    `${config.COLLECTOR_DB_DIR_PATH}/${config.COLLECTOR_DATA.receiptDB}`,
    'Receipt'
  )
  originalTxDataDatabase = await createDB(
    `${config.COLLECTOR_DB_DIR_PATH}/${config.COLLECTOR_DATA.originalTxDataDB}`,
    'OriginalTxData'
  )
  accountHistoryStateDatabase = await createDB(
    `${config.COLLECTOR_DB_DIR_PATH}/${config.COLLECTOR_DATA.accountHistoryStateDB}`,
    'AccountHistoryState'
  )
  await runCreate(
    cycleDatabase,
    'CREATE TABLE if not exists `cycles` (`cycleMarker` TEXT NOT NULL UNIQUE PRIMARY KEY, `counter` NUMBER NOT NULL, `cycleRecord` JSON NOT NULL)'
  )
  // await runCreate(cycleDatabase, 'Drop INDEX if exists `cycles_idx`');
  await runCreate(cycleDatabase, 'CREATE INDEX if not exists `cycles_idx` ON `cycles` (`counter` DESC)')
  await runCreate(
    accountDatabase,
    'CREATE TABLE if not exists `accounts` (`accountId` TEXT NOT NULL UNIQUE PRIMARY KEY, `data` JSON NOT NULL, `timestamp` BIGINT NOT NULL, `hash` TEXT NOT NULL, `cycleNumber` NUMBER NOT NULL, `isGlobal` BOOLEAN NOT NULL, `accountType` TEXT)'
  )
  await runCreate(
    accountDatabase,
    'CREATE INDEX if not exists `accounts_idx` ON `accounts` (`cycleNumber` DESC, `timestamp` DESC)'
  )
  // be sure to adjust the data types of `transactionType`, `txFrom`, `txTo` as needed
  await runCreate(
    transactionDatabase,
    'CREATE TABLE if not exists `transactions` (`txId` TEXT NOT NULL UNIQUE PRIMARY KEY, `appReceiptId` TEXT, `timestamp` BIGINT NOT NULL, `cycleNumber` NUMBER NOT NULL, `data` JSON NOT NULL, `originalTxData` JSON NOT NULL, `transactionType` TEXT, `txFrom` TEXT, `txTo` TEXT)'
  )
  await runCreate(
    transactionDatabase,
    'CREATE INDEX if not exists `transactions_timestamp` ON `transactions` (`timestamp` DESC)'
  )
  await runCreate(
    transactionDatabase,
    'CREATE INDEX if not exists `transactions_cycle` ON `transactions` (`cycleNumber` DESC)'
  )
  await runCreate(
    transactionDatabase,
    'CREATE INDEX if not exists `transactions_cycle_timestamp` ON `transactions` (`cycleNumber` DESC, `timestamp` DESC)'
  )
  await runCreate(
    transactionDatabase,
    'CREATE INDEX if not exists `transactions_txType` ON `transactions` (`transactionType`)'
  )
  await runCreate(
    transactionDatabase,
    'CREATE INDEX if not exists `transactions_txFrom` ON `transactions` (`txFrom`)'
  )
  await runCreate(
    transactionDatabase,
    'CREATE INDEX if not exists `transactions_txTo` ON `transactions` (`txTo`)'
  )
  await runCreate(
    receiptDatabase,
    'CREATE TABLE if not exists `receipts` (`receiptId` TEXT NOT NULL UNIQUE PRIMARY KEY, `tx` JSON NOT NULL, `cycle` NUMBER NOT NULL, `applyTimestamp` BIGINT NOT NULL, `timestamp` BIGINT NOT NULL, `signedReceipt` JSON NOT NULL, `afterStates` JSON, `beforeStates` JSON, `appReceiptData` JSON, `executionShardKey` TEXT NOT NULL, `globalModification` BOOLEAN NOT NULL)'
  )
  await runCreate(
    receiptDatabase,
    'CREATE INDEX if not exists `receipts_timestamp` ON `receipts` (`timestamp` DESC)'
  )
  await runCreate(receiptDatabase, 'CREATE INDEX if not exists `receipts_cycle` ON `receipts` (`cycle` DESC)')
  await runCreate(
    receiptDatabase,
    'CREATE INDEX if not exists `receipts_cycle_timestamp` ON `receipts` (`cycle` DESC, `timestamp` DESC)'
  )
  // be sure to adjust the data types of `transactionType`, `txFrom`, `txTo` as needed
  await runCreate(
    originalTxDataDatabase,
    'CREATE TABLE if not exists `originalTxsData` (`txId` TEXT NOT NULL, `timestamp` BIGINT NOT NULL, `cycle` NUMBER NOT NULL, `originalTxData` JSON NOT NULL, `transactionType` TEXT, `txFrom` TEXT, `txTo` TEXT, PRIMARY KEY (`txId`, `timestamp`))'
  )
  await runCreate(
    originalTxDataDatabase,
    'CREATE INDEX if not exists `originalTxsData_timestamp` ON `originalTxsData` (`timestamp` DESC)'
  )
  await runCreate(
    originalTxDataDatabase,
    'CREATE INDEX if not exists `originalTxsData_cycle` ON `originalTxsData` (`cycle` DESC)'
  )
  await runCreate(
    originalTxDataDatabase,
    'CREATE INDEX if not exists `originalTxsData_cycle_timestamp` ON `originalTxsData` (`cycle` DESC, `timestamp` DESC)'
  )
  await runCreate(
    originalTxDataDatabase,
    'CREATE INDEX if not exists `originalTxsData_txType` ON `originalTxsData` (`transactionType`)'
  )
  await runCreate(
    originalTxDataDatabase,
    'CREATE INDEX if not exists `originalTxsData_txFrom` ON `originalTxsData` (`txFrom`)'
  )
  await runCreate(
    originalTxDataDatabase,
    'CREATE INDEX if not exists `originalTxsData_txTo` ON `originalTxsData` (`txTo`)'
  )
  await runCreate(
    accountHistoryStateDatabase,
    'CREATE TABLE if not exists `accountHistoryState` (`accountId` TEXT NOT NULL, `beforeStateHash` TEXT NOT NULL, `afterStateHash` TEXT NOT NULL, `timestamp` BIGINT NOT NULL, `receiptId` TEXT NOT NULL, PRIMARY KEY (`accountId`, `timestamp`))'
  )
}

export const closeDatabase = async (): Promise<void> => {
  const promises = []
  promises.push(close(accountDatabase, 'Account'))
  promises.push(close(transactionDatabase, 'Transaction'))
  promises.push(close(cycleDatabase, 'Cycle'))
  promises.push(close(receiptDatabase, 'Receipt'))
  promises.push(close(originalTxDataDatabase, 'OriginalTxData'))
  promises.push(close(accountHistoryStateDatabase, 'AccountHistoryState'))
  await Promise.all(promises)
}

export const addExitListeners = (ws?: WebSocket) => {
  process.on('SIGINT', async () => {
    console.log('Exiting on SIGINT')
    if (ws) ws.close()
    await closeDatabase()
    process.exit(0)
  })
  process.on('SIGTERM', async () => {
    console.log('Exiting on SIGTERM')
    if (ws) ws.close()
    await closeDatabase()
    process.exit(0)
  })
}
