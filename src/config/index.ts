export const config = {
  env: process.env.NODE_ENV || 'development', // development, production
  host: process.env.HOST || '127.0.0.1',
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

export const DISTRIBUTOR_URL = `http://${config.distributorInfo.ip}:${config.distributorInfo.port}`
