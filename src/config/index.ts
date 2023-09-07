import { readFileSync } from 'fs'
import merge from 'deepmerge'
import minimist from 'minimist'

export interface Config {
  env: string
  host: string
  identity: {
    publicKey: string
    secretKey: string
  }
  haskKey: string
  subscription: {
    enabled: boolean
  }
  port: {
    collector: string
    server: string
    log_server: string
  }
  distributorInfo: {
    ip: string
    port: string
    publicKey: string
  }
  rpcUrl: string
  apiUrl: string
  verbose: boolean
  experimentalSnapshot: boolean
  rateLimit: number
  patchData: boolean
  USAGE_ENDPOINTS_KEY: string
}

let config: Config = {
  env: process.env.NODE_ENV || 'development', // development, production
  host: process.env.HOST || '127.0.0.1',
  identity: {
    publicKey: '',
    secretKey:
      '',
  },
  haskKey: '69fa4195670576c0160d660c3be36556ff8d504725be8a59b5a96509e0c994bc',
  subscription: {
    enabled: false,
  },
  port: {
    collector: process.env.COLLECTOR_PORT || '4444',
    server: process.env.PORT || '6001',
    log_server: process.env.LOG_SERVER_PORT || '4446',
  },
  distributorInfo: {
    ip: process.env.DISTRIBUTOR_IP || '127.0.0.1',
    port: process.env.DISTRIBUTOR_PORT || '5000',
    publicKey:
      process.env.DISTRIBUTOR_PUBLIC_KEY ||
      '758b1c119412298802cd28dbfa394cdfeecc4074492d60844cc192d632d84de3',
  },
  rpcUrl: 'http://localhost:8080',
  apiUrl: '',
  verbose: false,
  experimentalSnapshot: true,
  rateLimit: 100,
  patchData: false,
  USAGE_ENDPOINTS_KEY: process.env.USAGE_ENDPOINTS_KEY || 'ceba96f6eafd2ea59e68a0b0d754a939',
}

let DISTRIBUTOR_URL = `http://${config.distributorInfo.ip}:${config.distributorInfo.port}`

export function overrideDefaultConfig(file: string, env: NodeJS.ProcessEnv, args: string[]) {
  // Override config from config file
  try {
    const fileConfig = JSON.parse(readFileSync(file, { encoding: 'utf8' }))
    const overwriteMerge = (target: [], source: [], options: {}): [] => source
    config = merge(config, fileConfig, { arrayMerge: overwriteMerge })
  } catch (err) {
    if ((err as any).code !== 'ENOENT') {
      console.warn('Failed to parse config file:', err)
    }
  }

  // Override config from env vars
  for (const param in config) {
    if (env[param]) {
      switch (typeof config[param]) {
        case 'number': {
          config[param] = Number(env[param])
          break
        }
        case 'string': {
          config[param] = String(env[param])
          break
        }
        case 'object': {
          try {
            var parameterStr = env[param]
            if (parameterStr) {
              let parameterObj = JSON.parse(parameterStr)
              config[param] = parameterObj
            }
          } catch (e) {
            console.error(e)
            console.error('Unable to JSON parse', env[param])
          }
          break
        }
        case 'boolean': {
          config[param] = String(env[param]).toLowerCase() === 'true'
          break
        }
        default: {
        }
      }
    }
  }

  // Override config from cli args
  const parsedArgs = minimist(args.slice(2))
  for (const param of Object.keys(config)) {
    if (parsedArgs[param]) {
      switch (typeof config[param]) {
        case 'number': {
          config[param] = Number(parsedArgs[param])
          break
        }
        case 'string': {
          config[param] = String(parsedArgs[param])
          break
        }
        case 'boolean': {
          if (typeof parsedArgs[param] === 'boolean') {
            config[param] = parsedArgs[param]
          } else {
            config[param] = String(parsedArgs[param]).toLowerCase() === 'true'
          }
          break
        }
        default: {
        }
      }
    }
  }

  DISTRIBUTOR_URL = `http://${config.distributorInfo.ip}:${config.distributorInfo.port}`
}

export { config, DISTRIBUTOR_URL }
