import sqlite3Lib from 'sqlite3'
const sqlite3 = sqlite3Lib.verbose()
let db: sqlite3Lib.Database

// Additional databases
let shardeumIndexerDb: sqlite3Lib.Database

export type DbName = 'default' | 'shardeumIndexer'

export interface DbOptions {
  defaultDbSqlitePath: string
  enableShardeumIndexer: boolean
  shardeumIndexerSqlitePath: string
}

export async function init(config: DbOptions): Promise<void> {
  db = new sqlite3.Database(config.defaultDbSqlitePath)
  await run('PRAGMA journal_mode=WAL')
  console.log('Database initialized.')
  if (config.enableShardeumIndexer) {
    shardeumIndexerDb = new sqlite3.Database(config.shardeumIndexerSqlitePath)
    await run('PRAGMA journal_mode=WAL', [], 'shardeumIndexer')
    console.log('Shardeum indexer database initialized.')
  }
}

function getDb(dbName: DbName): sqlite3Lib.Database {
  switch (dbName) {
    case 'default':
      return db
    case 'shardeumIndexer':
      return shardeumIndexerDb
  }
}

export async function runCreate(createStatement: string, dbName: DbName = 'default'): Promise<void> {
  await run(createStatement, [], dbName)
}

export async function run(
  sql: string,
  params: unknown[] | object = [],
  dbName: DbName = 'default'
): Promise<{ id: number }> {
  return new Promise((resolve, reject) => {
    getDb(dbName).run(sql, params, function (err: Error) {
      if (err) {
        console.log('Error running sql ' + sql)
        console.log(err)
        reject(err)
      } else {
        resolve({ id: this.lastID })
      }
    })
  })
}

export async function get<T>(
  sql: string,
  params: unknown[] | object = [],
  dbName: DbName = 'default'
): Promise<T> {
  return new Promise((resolve, reject) => {
    getDb(dbName).get(sql, params, (err: Error, result: T) => {
      if (err) {
        console.log('Error running sql: ' + sql)
        console.log(err)
        reject(err)
      } else {
        resolve(result)
      }
    })
  })
}

export async function all<T>(
  sql: string,
  params: unknown[] | object = [],
  dbName: DbName = 'default'
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    getDb(dbName).all(sql, params, (err: Error, rows: T[]) => {
      if (err) {
        console.log('Error running sql: ' + sql)
        console.log(err)
        reject(err)
      } else {
        resolve(rows)
      }
    })
  })
}

export function extractValues(object: object): string[] {
  try {
    const inputs: string[] = []
    for (let value of Object.values(object)) {
      if (typeof value === 'object') value = JSON.stringify(value)
      inputs.push(value)
    }
    return inputs
  } catch (e) {
    console.log(e)
  }

  return []
}

export function extractValuesFromArray(arr: object[]): string[] {
  try {
    const inputs: string[] = []
    for (const object of arr) {
      for (let value of Object.values(object)) {
        if (typeof value === 'object') value = JSON.stringify(value)
        inputs.push(value)
      }
    }
    return inputs
  } catch (e) {
    console.log(e)
  }

  return []
}
