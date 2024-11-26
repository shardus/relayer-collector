// require("dotenv").config();

import fastifyCors from '@fastify/cors'
import fastifyRateLimit from '@fastify/rate-limit'
import FastifyWebsocket from '@fastify/websocket'
import * as crypto from '@shardus/crypto-utils'
import Fastify, { FastifyRequest } from 'fastify'
import * as usage from './middleware/usage'
import * as Storage from './storage'
import * as AccountDB from './storage/account'
import * as CycleDB from './storage/cycle'
import * as ReceiptDB from './storage/receipt'
import * as TransactionDB from './storage/transaction'
import * as OriginalTxDataDB from './storage/originalTxData'
import { Account, AccountSearchType, OriginalTxResponse, Transaction, TransactionSearchType } from './types'
// config variables
import { AccountResponse, ReceiptResponse, TransactionResponse } from './types'
import * as utils from './utils'
// config variables
import { config as CONFIG, config, envEnum } from './config'
import path from 'path'
import fs from 'fs'
import { Utils as StringUtils } from '@shardus/types'
import { healthCheckRouter } from './routes/healthCheck'

if (config.env == envEnum.DEV) {
  //default debug mode keys
  //  pragma: allowlist nextline secret
  config.USAGE_ENDPOINTS_KEY = 'ceba96f6eafd2ea59e68a0b0d754a939'
  config.collectorInfo.secretKey =
    //  pragma: allowlist nextline secret
    '7d8819b6fac8ba2fbac7363aaeb5c517e52e615f95e1a161d635521d5e4969739426b64e675cad739d69526bf7e27f3f304a8a03dca508a9180f01e9269ce447'
} else {
  // Pull in secrets
  const secretsPath = path.join(__dirname, '../../.secrets')
  const secrets = {}

  if (fs.existsSync(secretsPath)) {
    const lines = fs.readFileSync(secretsPath, 'utf-8').split('\n').filter(Boolean)

    lines.forEach((line) => {
      const [key, value] = line.split('=')
      secrets[key.trim()] = value.trim()
    })
  }
}

crypto.init(CONFIG.hashKey)
crypto.setCustomStringifier(StringUtils.safeStringify, 'shardus_safeStringify')

if (process.env.PORT) {
  CONFIG.port.server = process.env.PORT
}

console.log(process.argv)
const port = process.argv[2]
if (port) {
  CONFIG.port.server = port
}
console.log('Port', CONFIG.port.server)

// commented interface b/c it was never used; caused linting error
/*
interface RequestParams {
  counter: string
}
*/

interface RequestQuery {
  page: string
  count: string
  from: string
  to: string
  cycleNumber: string
  txId: string
  txHash: string
  address: string
  contractAddress: string
  token: string
  filterAddress: string
  txType: string
  startCycle: string
  endCycle: string
  start: string
  end: string
  marker: string
  type: string //contract accounts list query
  accountType: string
  accountId: string
  topics: string
  responseType: string
  fromBlock: string
  toBlock: string
  totalStakeData: string
  beforeTimestamp: string
  afterTimestamp: string
  blockNumber: string
  blockHash: string
  decode: string // For originalTxsData, reply the query result by decoding the data
  pending: string // For pending txs (AllExceptInternalTx) for pending txs page
  countOnly: string // true to return only the count of the transactions
}

// Setup Log Directory
const start = async (): Promise<void> => {
  await Storage.initializeDB()
  Storage.addExitListeners()

  const server = Fastify({
    logger: CONFIG.fastifyDebugLog,
  })

  await server.register(FastifyWebsocket)
  await server.register(fastifyCors)
  await server.register(fastifyRateLimit, {
    max: CONFIG.rateLimit,
    timeWindow: '1 minute',
    allowList: ['127.0.0.1', 'localhost'],
  })
  await server.register(healthCheckRouter)
  server.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      const jsonString = typeof body === 'string' ? body : body.toString('utf8')
      done(null, StringUtils.safeJsonParse(jsonString))
    } catch (err) {
      err.statusCode = 400
      done(err, undefined)
    }
  })

  server.setReplySerializer((payload) => {
    return StringUtils.safeStringify(payload)
  })

  // await server.register(fastifyMiddie)
  server.addHook('preHandler', usage.usageMiddleware)
  server.addHook('onError', usage.usageErrorMiddleware)
  server.post('/usage/enable', usage.usageEnableHandler)
  server.post('/usage/disable', usage.usageDisableHandler)
  server.get('/usage/metrics', usage.usageMetricsHandler)

  server.get('/port', (req, reply) => {
    reply.send({ port: CONFIG.port.server })
  })

  type CycleDataRequest = FastifyRequest<{
    Querystring: {
      count: string
      cycleNumber: string
      start: string
      end: string
      marker: string
    }
  }>

  server.get('/api/cycleinfo', async (_request: CycleDataRequest, reply) => {
    const err = utils.validateTypes(_request.query, {
      count: 's?',
      cycleNumber: 's?',
      start: 's?',
      end: 's?',
      marker: 's?',
    })
    if (err) {
      reply.send({ success: false, error: err })
      return
    }
    const query = _request.query
    // Check at least one of the query parameters is present
    if (!query.count && !query.cycleNumber && !query.start && !query.end && !query.marker) {
      reply.send({
        success: false,
        error: 'not specified which cycleinfo to query',
      })
    }
    let cycles = []
    if (query.count) {
      let count: number = parseInt(query.count)
      if (count <= 0 || Number.isNaN(count)) {
        reply.send({ success: false, error: 'Invalid count' })
        return
      }
      if (count > 100) {
        reply.send({ success: false, error: 'Maximum count is 100' })
        return
      }
      cycles = await CycleDB.queryLatestCycleRecords(count)
    } else if (query.cycleNumber) {
      const cycleNumber: number = parseInt(query.cycleNumber)
      if (cycleNumber < 0 || Number.isNaN(cycleNumber)) {
        reply.send({ success: false, error: 'Invalid cycleNumber' })
        return
      }
      const cycle = await CycleDB.queryCycleByCounter(cycleNumber)
      if (cycle) cycles = [cycle]
    } else if (query.start && query.end) {
      const from = parseInt(query.start)
      const to = parseInt(query.end)
      if (!(from >= 0 && to >= from) || Number.isNaN(from) || Number.isNaN(to)) {
        console.log('Invalid start and end counters for cycleinfo')
        reply.send({
          success: false,
          error: 'Invalid from and to counter for cycleinfo',
        })
        return
      }
      cycles = await CycleDB.queryCycleRecordsBetween(from, to)
      /* prettier-ignore */ if (CONFIG.verbose) console.log('cycles', cycles);
    } else if (query.marker) {
      const cycle = await CycleDB.queryCycleByMarker(query.marker)
      if (cycle) {
        cycles.push(cycle)
      }
    }
    const res = {
      success: true,
      cycles,
    }
    reply.send(res)
  })

  type AccountDataRequest = FastifyRequest<{
    Querystring: {
      count: string
      page: string
      accountSearchType: AccountSearchType
      startCycle: string
      endCycle: string
      accountId: string
    }
  }>

  server.get('/api/account', async (_request: AccountDataRequest, reply) => {
    const err = utils.validateTypes(_request.query, {
      count: 's?',
      page: 's?',
      accountSearchType: 's?',
      startCycle: 's?',
      endCycle: 's?',
      accountId: 's?',
    })
    if (err) {
      reply.send({ success: false, error: err })
      return
    }
    const query = _request.query
    // Check at least one of the query parameters is present
    if (
      !query.count &&
      !query.page &&
      !query.accountSearchType &&
      !query.startCycle &&
      !query.endCycle &&
      !query.accountId
    ) {
      reply.send({
        success: false,
        error: 'not specified which account to query',
      })
      return
    }
    const itemsPerPage = 10
    let totalPages = 0
    let totalAccounts = 0
    let accountSearchType: AccountSearchType
    let startCycle = 0
    let endCycle = 0
    let page = 0
    const res: AccountResponse = {
      success: true,
      accounts: [] as Account[],
    }
    if (query.accountSearchType) {
      accountSearchType = parseInt(query.accountSearchType)
      // Check if the parsed value is a valid enum value
      if (!Object.values(AccountSearchType).includes(accountSearchType)) {
        reply.send({ success: false, error: 'Invalid account search type' })
        return
      }
    }
    if (query.count) {
      const count: number = parseInt(query.count)
      if (count <= 0 || Number.isNaN(count)) {
        reply.send({ success: false, error: 'Invalid count' })
        return
      }
      if (count > 100) {
        reply.send({ success: false, error: 'Maximum count is 100' })
        return
      }
      res.accounts = await AccountDB.queryAccounts(0, count, null, null, accountSearchType)
      res.totalAccounts = await AccountDB.queryAccountCount(null, null, accountSearchType)
      reply.send(res)
      return
    } else if (query.accountId) {
      if (query.accountId.length !== 64) {
        reply.send({ success: false, error: 'Invalid account id' })
        return
      }
      const accountId = query.accountId.toLowerCase()
      const account = await AccountDB.queryAccountByAccountId(accountId)
      if (account) res.accounts = [account]
      reply.send(res)
      return
    }
    if (query.startCycle) {
      startCycle = parseInt(query.startCycle)
      if (startCycle < 0 || Number.isNaN(startCycle)) {
        reply.send({ success: false, error: 'Invalid start cycle number' })
        return
      }
      endCycle = startCycle
      if (query.endCycle) {
        endCycle = parseInt(query.endCycle)
        if (endCycle < 0 || Number.isNaN(endCycle) || endCycle < startCycle) {
          reply.send({ success: false, error: 'Invalid end cycle number' })
          return
        }
        if (endCycle - startCycle > 100) {
          reply.send({ success: false, error: 'The cycle range is too big. Max cycle range is 100 cycles.' })
          return
        }
      }
    }
    if (query.page) {
      page = parseInt(query.page)
      if (page <= 1 || Number.isNaN(page)) {
        reply.send({ success: false, error: 'Invalid page number' })
        return
      }
    }
    if (startCycle > 0 || endCycle > 0 || page > 0) {
      totalAccounts = await AccountDB.queryAccountCount(startCycle, endCycle, accountSearchType)
      res.totalAccounts = totalAccounts
    }
    if (page > 0) {
      totalPages = Math.ceil(totalAccounts / itemsPerPage)
      if (page > totalPages) {
        reply.send({
          success: false,
          error: 'Page no is greater than the totalPage',
        })
      }
      res.totalPages = totalPages
    }
    if (totalAccounts > 0) {
      if ((page = 0)) page = 1
      res.accounts = await AccountDB.queryAccounts(
        (page - 1) * itemsPerPage,
        itemsPerPage,
        null,
        null,
        accountSearchType
      )
    }
    reply.send(res)
  })

  type TransactionDataRequest = FastifyRequest<{
    Querystring: {
      count: string
      page: string
      txSearchType: string
      startCycle: string
      endCycle: string
      accountId: string
      txId: string
      beforeTimestamp: string
      afterTimestamp: string
    }
  }>

  server.get('/api/transaction', async (_request: TransactionDataRequest, reply) => {
    const err = utils.validateTypes(_request.query, {
      count: 's?',
      page: 's?',
      accountId: 's?',
      txSearchType: 's?',
      startCycle: 's?',
      endCycle: 's?',
      txId: 's?',
      beforeTimestamp: 's?',
      afterTimestamp: 's?',
    })
    if (err) {
      reply.send({ success: false, error: err })
      return
    }
    /* prettier-ignore */ if (CONFIG.verbose) console.log('Request', _request.query);
    const query = _request.query
    // Check at least one of the query parameters is present
    if (
      !query.count &&
      !query.page &&
      !query.accountId &&
      !query.txSearchType &&
      !query.startCycle &&
      !query.endCycle &&
      !query.txId &&
      !query.beforeTimestamp &&
      !query.afterTimestamp
    ) {
      reply.send({
        success: false,
        reason: 'Not specified which transaction to query',
      })
      return
    }
    const itemsPerPage = 10
    let totalPages = 0
    let totalTransactions = 0
    let txSearchType: TransactionSearchType
    let startCycle = 0
    let endCycle = 0
    let page = 0
    let accountId = ''
    const res: TransactionResponse = {
      success: true,
      transactions: [] as Transaction[],
    }
    if (query.txSearchType) {
      txSearchType = parseInt(query.txSearchType)
      // Check if the parsed value is a valid enum value
      if (!Object.values(TransactionSearchType).includes(txSearchType)) {
        reply.send({ success: false, error: 'Invalid transaction search type' })
        return
      }
    }
    if (query.count) {
      const count: number = parseInt(query.count)
      if (count <= 0 || Number.isNaN(count)) {
        reply.send({ success: false, error: 'Invalid count' })
        return
      }
      if (count > 100) {
        reply.send({ success: false, error: 'Maximum count is 100' })
        return
      }
      res.transactions = await TransactionDB.queryTransactions(0, count, null, txSearchType)
      res.totalTransactions = await TransactionDB.queryTransactionCount(null, txSearchType)
      reply.send(res)
      return
    } else if (query.txId) {
      const txId = query.txId.toLowerCase()
      if (txId.length !== 64) {
        reply.send({ success: false, error: 'Invalid transaction id' })
        return
      }
      const transactions = await TransactionDB.queryTransactionByTxId(txId)
      if (transactions) res.transactions = [transactions]
      reply.send(res)
      return
    }
    if (query.accountId) {
      accountId = query.accountId.toLowerCase()
      if (accountId.length !== 64) {
        reply.send({ success: false, error: 'Invalid account id' })
        return
      }
    }
    if (query.startCycle) {
      startCycle = parseInt(query.startCycle)
      if (startCycle < 0 || Number.isNaN(startCycle)) {
        reply.send({ success: false, error: 'Invalid start cycle number' })
        return
      }
      endCycle = startCycle
      if (query.endCycle) {
        endCycle = parseInt(query.endCycle)
        if (endCycle < 0 || Number.isNaN(endCycle) || endCycle < startCycle) {
          reply.send({ success: false, error: 'Invalid end cycle number' })
          return
        }
        if (endCycle - startCycle > 100) {
          reply.send({ success: false, error: 'The cycle range is too big. Max cycle range is 100 cycles.' })
          return
        }
      }
    }
    if (query.page) {
      page = parseInt(query.page)
      if (page <= 1 || Number.isNaN(page)) {
        reply.send({ success: false, error: 'Invalid page number' })
        return
      }
    }
    if (accountId || startCycle > 0 || endCycle > 0 || page > 0) {
      totalTransactions = await TransactionDB.queryTransactionCount(
        accountId,
        txSearchType,
        startCycle,
        endCycle
      )
      res.totalTransactions = totalTransactions
    }
    if (page > 0) {
      totalPages = Math.ceil(totalTransactions / itemsPerPage)
      if (page > totalPages) {
        reply.send({
          success: false,
          error: 'Page no is greater than the totalPage',
        })
      }
      res.totalPages = totalPages
    }
    if (totalTransactions > 0) {
      if (page === 0) page = 1
      res.transactions = await TransactionDB.queryTransactions(
        (page - 1) * itemsPerPage,
        itemsPerPage,
        accountId,
        txSearchType,
        startCycle,
        endCycle
      )
    }
    reply.send(res)
  })

  type ReceiptDataRequest = FastifyRequest<{
    Querystring: {
      count: string
      page: string
      txId: string
      startCycle: string
      endCycle: string
    }
  }>

  server.get('/api/receipt', async (_request: ReceiptDataRequest, reply) => {
    const err = utils.validateTypes(_request.query, {
      count: 's?',
      page: 's?',
      txId: 's?',
      startCycle: 's?',
      endCycle: 's?',
    })
    if (err) {
      reply.send({ success: false, error: err })
      return
    }
    /* prettier-ignore */ if (CONFIG.verbose) console.log('Request', _request.query);
    const query = _request.query
    // Check at least one of the query parameters is present
    if (!query.count && !query.txId && !query.startCycle && !query.endCycle) {
      reply.send({
        success: false,
        reason: 'Not specified which receipt to query',
      })
      return
    }
    const itemsPerPage = 10
    let totalPages = 0
    let totalReceipts = 0
    let page = 0
    let startCycle = 0
    let endCycle = 0
    const res: ReceiptResponse = {
      success: true,
      receipts: [],
    }
    if (query.count) {
      const count: number = parseInt(query.count)
      if (count <= 0 || Number.isNaN(count)) {
        reply.send({ success: false, error: 'Invalid count' })
        return
      }
      if (count > 100) {
        reply.send({ success: false, error: 'Maximum count is 100' })
        return
      }
      res.receipts = await ReceiptDB.queryReceipts(0, count)
      res.totalReceipts = await ReceiptDB.queryReceiptCount()
      reply.send(res)
      return
    } else if (query.txId) {
      const txId: string = query.txId.toLowerCase()
      if (txId.length !== 64) {
        reply.send({ success: false, error: 'Invalid txId' })
        return
      }
      const receipts = await ReceiptDB.queryReceiptByReceiptId(txId)
      if (receipts) res.receipts = [receipts]
      reply.send(res)
      return
    }
    if (query.startCycle) {
      startCycle = parseInt(query.startCycle)
      if (startCycle < 0 || Number.isNaN(startCycle)) {
        reply.send({ success: false, error: 'Invalid start cycle number' })
        return
      }
      endCycle = startCycle
      if (query.endCycle) {
        endCycle = parseInt(query.endCycle)
        if (endCycle < 0 || Number.isNaN(endCycle) || endCycle < startCycle) {
          reply.send({ success: false, error: 'Invalid end cycle number' })
          return
        }
        if (endCycle - startCycle > 100) {
          reply.send({ success: false, error: 'The cycle range is too big. Max cycle range is 100 cycles.' })
          return
        }
      }
    }
    if (query.page) {
      page = parseInt(query.page)
      if (page <= 1 || Number.isNaN(page)) {
        reply.send({ success: false, error: 'Invalid page number' })
        return
      }
    }
    if (startCycle > 0 || endCycle > 0 || page > 0) {
      totalReceipts = await ReceiptDB.queryReceiptCount(startCycle, endCycle)
      res.totalReceipts = totalReceipts
    }
    if (page > 0) {
      totalPages = Math.ceil(totalReceipts / itemsPerPage)
      if (page > totalPages) {
        reply.send({
          success: false,
          error: 'Page no is greater than the totalPage',
        })
      }
      res.totalPages = totalPages
    }
    if (totalReceipts > 0) {
      if (page === 0) page = 1
      res.receipts = await ReceiptDB.queryReceipts(
        (page - 1) * itemsPerPage,
        itemsPerPage,
        startCycle,
        endCycle
      )
    }
    reply.send(res)
  })

  type OriginalTxDataRequest = FastifyRequest<{
    Querystring: {
      count: string
      page: string
      txId: string
      accountId: string
      startCycle: string
      endCycle: string
    }
  }>

  server.get('/api/originalTx', async (_request: OriginalTxDataRequest, reply) => {
    const err = utils.validateTypes(_request.query, {
      count: 's?',
      page: 's?',
      txId: 's?',
      accountId: 's?',
      startCycle: 's?',
      endCycle: 's?',
    })
    if (err) {
      reply.send({ success: false, error: err })
      return
    }
    /* prettier-ignore */ if (CONFIG.verbose) console.log('Request', _request.query);
    const query = _request.query
    // Check at least one of the query parameters is present
    if (
      !query.count &&
      !query.page &&
      !query.txId &&
      !query.accountId &&
      !query.startCycle &&
      !query.endCycle
    ) {
      reply.send({
        success: false,
        reason: 'Not specified which original tx to query',
      })
      return
    }
    const itemsPerPage = 10
    let totalPages = 0
    let totalOriginalTxs = 0
    let page = 0
    let startCycle = 0
    let endCycle = 0
    let accountId = ''
    const res: OriginalTxResponse = {
      success: true,
      originalTxs: [],
    }
    if (query.count) {
      const count: number = parseInt(query.count)
      if (count <= 0 || Number.isNaN(count)) {
        reply.send({ success: false, error: 'Invalid count' })
        return
      }
      if (count > 100) {
        reply.send({ success: false, error: 'Maximum count is 100' })
        return
      }
      res.originalTxs = await OriginalTxDataDB.queryOriginalTxsData(0, count)
      res.totalOriginalTxs = await OriginalTxDataDB.queryOriginalTxDataCount()
      reply.send(res)
      return
    } else if (query.txId) {
      const txId: string = query.txId.toLowerCase()
      if (txId.length !== 64) {
        reply.send({ success: false, error: 'Invalid txId' })
        return
      }
      const originalTxs = await OriginalTxDataDB.queryOriginalTxDataByTxId(txId)
      if (originalTxs) res.originalTxs = [originalTxs]
      reply.send(res)
      return
    }
    if (query.accountId) {
      accountId = query.accountId.toLowerCase()
      if (accountId.length !== 64) {
        reply.send({ success: false, error: 'Invalid account id' })
        return
      }
    }
    if (query.startCycle) {
      startCycle = parseInt(query.startCycle)
      if (startCycle < 0 || Number.isNaN(startCycle)) {
        reply.send({ success: false, error: 'Invalid start cycle number' })
        return
      }
      endCycle = startCycle
      if (query.endCycle) {
        endCycle = parseInt(query.endCycle)
        if (endCycle < 0 || Number.isNaN(endCycle) || endCycle < startCycle) {
          reply.send({ success: false, error: 'Invalid end cycle number' })
          return
        }
        if (endCycle - startCycle > 100) {
          reply.send({ success: false, error: 'The cycle range is too big. Max cycle range is 100 cycles.' })
          return
        }
      }
    }
    if (query.page) {
      page = parseInt(query.page)
      if (page <= 1 || Number.isNaN(page)) {
        reply.send({ success: false, error: 'Invalid page number' })
        return
      }
    }
    if (accountId || startCycle > 0 || endCycle > 0 || page > 0) {
      totalOriginalTxs = await OriginalTxDataDB.queryOriginalTxDataCount(accountId, startCycle, endCycle)
      res.totalOriginalTxs = totalOriginalTxs
    }
    if (page > 0) {
      totalPages = Math.ceil(totalOriginalTxs / itemsPerPage)
      if (page > totalPages) {
        reply.send({
          success: false,
          error: 'Page no is greater than the totalPage',
        })
      }
      res.totalPages = totalPages
    }
    if (totalOriginalTxs > 0) {
      if (page === 0) page = 1
      res.originalTxs = await OriginalTxDataDB.queryOriginalTxsData(
        (page - 1) * itemsPerPage,
        itemsPerPage,
        accountId,
        startCycle,
        endCycle
      )
    }
    reply.send(res)
  })

  server.get('/totalData', async (_request, reply) => {
    interface TotalDataResponse {
      totalCycles: number
      totalAccounts?: number
      totalTransactions?: number
      totalReceipts: number
      totalOriginalTxs: number
    }

    const res: TotalDataResponse = {
      totalCycles: 0,
      totalReceipts: 0,
      totalOriginalTxs: 0,
    } // Initialize 'res' with an empty object

    res.totalCycles = await CycleDB.queryCycleCount()
    if (CONFIG.processData.indexReceipt) {
      res.totalAccounts = await AccountDB.queryAccountCount(AccountSearchType.All)
      res.totalTransactions = await TransactionDB.queryTransactionCount()
    }
    res.totalReceipts = await ReceiptDB.queryReceiptCount()
    res.totalOriginalTxs = await OriginalTxDataDB.queryOriginalTxDataCount()
    reply.send(res)
  })

  server.listen(
    {
      port: Number(CONFIG.port.server),
      host: '0.0.0.0',
    },
    async (err) => {
      if (err) {
        server.log.error(err)
        console.log(err)
        throw err
      }
      console.log('Server is listening on port:', CONFIG.port.server)
    }
  )
}

start()
