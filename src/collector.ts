import * as dotenv from 'dotenv'
dotenv.config()
import WebSocket from 'ws'
import { join } from 'path'
import * as Storage from './storage'
import * as Crypto from './utils/crypto'
import * as cycle from './storage/cycle'
import * as receipt from './storage/receipt'
import * as originalTxData from './storage/originalTxData'
import {
  downloadTxsDataAndCycles,
  compareWithOldReceiptsData,
  compareWithOldCyclesData,
  downloadAndSyncGenesisAccounts,
  needSyncing,
  toggleNeedSyncing,
  updateLastSyncedCycle,
  downloadReceiptsBetweenCycles,
  compareWithOldOriginalTxsData,
  downloadOriginalTxsDataBetweenCycles,
  queryFromDistributor,
  DataType,
} from './class/DataSync'
import { validateData } from './class/validateData'
import { initDataLogWriter } from './class/DataLogWriter'
import { setupCollectorSocketServer } from './logSubscription/CollectorSocketconnection'

// config variables
import { config as CONFIG, DISTRIBUTOR_URL, overrideDefaultConfig } from './config'
if (process.env.PORT) {
  CONFIG.port.collector = process.env.PORT
}

const DistributorFirehoseEvent = 'FIREHOSE'
let ws: WebSocket
let reconnecting = false
const NEW_CONNECTION_CODE = 3000

// Override default config params from config file, env vars, and cli args
const file = join(process.cwd(), 'config.json')
const env = process.env
const args = process.argv

export const checkAndSyncData = async (): Promise<void> => {
  let lastStoredReceiptCount = await receipt.queryReceiptCount()
  let lastStoredOriginalTxDataCount = await originalTxData.queryOriginalTxDataCount()
  let lastStoredCycleCount = await cycle.queryCycleCount()
  let totalReceiptsToSync = 0
  let totalCyclesToSync = 0
  let totalOriginalTxsToSync = 0
  let lastStoredReceiptCycle = 0
  let lastStoredOriginalTxDataCycle = 0
  const response = await queryFromDistributor(DataType.TOTALDATA, {})
  if (
    response.data &&
    response.data.totalReceipts >= 0 &&
    response.data.totalCycles >= 0 &&
    response.data.totalOriginalTxs >= 0
  ) {
    totalReceiptsToSync = response.data.totalReceipts
    totalCyclesToSync = response.data.totalCycles
    totalOriginalTxsToSync = response.data.totalOriginalTxs
    console.log(
      'totalReceiptsToSync',
      totalReceiptsToSync,
      'totalCyclesToSync',
      totalCyclesToSync,
      'totalOriginalTxsToSync',
      totalOriginalTxsToSync
    )
  }
  console.log(
    'lastStoredReceiptCount',
    lastStoredReceiptCount,
    'lastStoredCycleCount',
    lastStoredCycleCount,
    'lastStoredOriginalTxDataCount',
    lastStoredOriginalTxDataCount
  )
  const patchData = CONFIG.patchData
  // Make sure the data that saved are authentic by comparing receipts count of last 10 cycles for receipts data, originalTxs count of last 10 cycles for originalTxData data and 10 last cycles for cycles data
  if (patchData && totalReceiptsToSync > lastStoredReceiptCount && lastStoredReceiptCount > 10) {
    const lastStoredReceiptInfo = await receipt.queryLatestReceipts(1)
    if (lastStoredReceiptInfo && lastStoredReceiptInfo.length > 0)
      lastStoredReceiptCycle = lastStoredReceiptInfo[0].cycle
    const receiptResult = await compareWithOldReceiptsData(lastStoredReceiptCycle)
    if (!receiptResult.success) {
      throw Error(
        'The last saved receipts of last 10 cycles data do not match with the distributor data! Clear the DB and start the server again!'
      )
    }
    lastStoredReceiptCycle = receiptResult.matchedCycle
  }
  if (
    patchData &&
    totalOriginalTxsToSync > lastStoredOriginalTxDataCount &&
    lastStoredOriginalTxDataCount > 10
  ) {
    const lastStoredOriginalTxDataInfo = await originalTxData.queryOriginalTxsData(1)
    if (lastStoredOriginalTxDataInfo && lastStoredOriginalTxDataInfo.length > 0)
      lastStoredOriginalTxDataCycle = lastStoredOriginalTxDataInfo[0].cycle
    const originalTxResult = await compareWithOldOriginalTxsData(lastStoredOriginalTxDataCycle)
    if (!originalTxResult.success) {
      throw Error(
        'The last saved originalTxsData of last 10 cycles data do not match with the distributor data! Clear the DB and start the server again!'
      )
    }
    lastStoredOriginalTxDataCycle = originalTxResult.matchedCycle
  }
  if (totalCyclesToSync > lastStoredCycleCount && lastStoredCycleCount > 10) {
    const cycleResult = await compareWithOldCyclesData(lastStoredCycleCount)
    if (!cycleResult.success) {
      throw Error(
        'The last saved 10 cycles data does not match with the distributor data! Clear the DB and start the server again!'
      )
    }

    lastStoredCycleCount = cycleResult.cycle
  }
  if (patchData && (lastStoredReceiptCount > 0 || lastStoredOriginalTxDataCount > 0)) {
    if (lastStoredReceiptCount > totalReceiptsToSync) {
      throw Error(
        'The existing db has more receipts data than the network data! Clear the DB and start the server again!'
      )
    }
    if (lastStoredOriginalTxDataCount > totalOriginalTxsToSync) {
      throw Error(
        'The existing db has more originalTxsData data than the network data! Clear the DB and start the server again!'
      )
    }
  }
  if (patchData && totalReceiptsToSync > lastStoredReceiptCount) toggleNeedSyncing()
  if (patchData && totalOriginalTxsToSync > lastStoredOriginalTxDataCount) toggleNeedSyncing()
  if (!needSyncing && totalCyclesToSync > lastStoredCycleCount) toggleNeedSyncing()

  await downloadAndSyncGenesisAccounts() // To sync accounts data that are from genesis accounts/accounts data that the network start with

  if (needSyncing) {
    console.log(
      lastStoredReceiptCount,
      totalReceiptsToSync,
      lastStoredCycleCount,
      totalCyclesToSync,
      lastStoredOriginalTxDataCount,
      totalOriginalTxsToSync
    )
    // Sync receipts and originalTxsData data first if there is old data
    if (lastStoredReceiptCycle > 0 && totalCyclesToSync > lastStoredReceiptCycle) {
      await downloadReceiptsBetweenCycles(lastStoredReceiptCycle, totalCyclesToSync)
      lastStoredReceiptCount = await receipt.queryReceiptCount()
    }
    if (lastStoredOriginalTxDataCycle > 0 && totalCyclesToSync > lastStoredOriginalTxDataCycle) {
      await downloadOriginalTxsDataBetweenCycles(lastStoredOriginalTxDataCycle, totalCyclesToSync)
      lastStoredOriginalTxDataCount = await originalTxData.queryOriginalTxDataCount()
    }
    await downloadTxsDataAndCycles(
      totalReceiptsToSync,
      lastStoredReceiptCount,
      totalOriginalTxsToSync,
      lastStoredOriginalTxDataCount,
      totalCyclesToSync,
      lastStoredCycleCount
    )
    toggleNeedSyncing()
    let lastSyncedCycle = totalCyclesToSync - 5
    if (lastSyncedCycle < -1) lastSyncedCycle = 0
    updateLastSyncedCycle(lastSyncedCycle)
  }
}

const attemptReconnection = (): void => {
  console.log(`Re-connecting Distributor in ${CONFIG.RECONNECT_INTERVAL_MS / 1000}s...`)
  reconnecting = true
  setTimeout(connectToDistributor, CONFIG.RECONNECT_INTERVAL_MS)
}

const connectToDistributor = (): void => {
  const collectorInfo = {
    subscriptionType: DistributorFirehoseEvent,
    timestamp: Date.now(),
  }
  const queryString = encodeURIComponent(
    JSON.stringify(Crypto.sign({ collectorInfo, sender: CONFIG.collectorInfo.publicKey }))
  )
  const URL = `${DISTRIBUTOR_URL}?data=${queryString}`
  ws = new WebSocket(URL)
  ws.onopen = () => {
    console.log(
      `✅ Socket connected to the Distributor @ ${CONFIG.distributorInfo.ip}:${CONFIG.distributorInfo.port}}`
    )
    reconnecting = false
  }

  // Listening to messages from the server (child process)
  ws.on('message', (data: any) => {
    try {
      validateData(JSON.parse(data))
      // forwardReceiptData(JSON.parse(data))
    } catch (e) {
      console.log('Error in processing received data!', e)
    }
  })
  ws.onerror = (error) => {
    console.error('Distributor WebSocket error:', error.message)
    reconnecting = false
  }

  // Listening to close event from the child process
  ws.onclose = (closeEvent: WebSocket.CloseEvent) => {
    console.log('❌ Connection with Server Terminated!.')
    if (closeEvent.code === NEW_CONNECTION_CODE) {
      console.log('❌ New connection detected from another location. Closing old connection...')
      reconnecting = false
    }
    if (reconnecting) attemptReconnection()
  }
}

// Setup Log Directory
const start = async (): Promise<void> => {
  addSigListeners()
  overrideDefaultConfig(file, env, args)
  // Set crypto hash keys from config
  Crypto.setCryptoHashKey(CONFIG.haskKey)

  await Storage.initializeDB()
  // setupCollectorSocketServer()
  if (CONFIG.dataLogWrite) await initDataLogWriter()
  try {
    connectToDistributor()
    await checkAndSyncData()
  } catch (e) {
    console.log(e)
  }
}

const addSigListeners = (): void => {
  process.on('SIGUSR1', async () => {
    console.log('DETECTED SIGUSR1 SIGNAL')
    // Reload the config.json
    overrideDefaultConfig(file, env, args)
    console.log('Config reloaded', CONFIG)
  })
  console.log('Registerd signal listeners.')
}

start()

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in Distributor: ', error)
})

process.on('SIGINT', () => {
  console.log('Received SIGINT signal. Closing all connections gracefully...')
  ws?.close()
  process.exit(0)
})
