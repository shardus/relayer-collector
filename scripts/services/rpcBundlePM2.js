// eslint-disable-next-line @typescript-eslint/no-var-requires
const pm2 = require('pm2')

pm2.connect(function (err) {
  if (err) {
    console.error(err)
    process.exit(2)
  }

  const apps = [
    {
      name: 'collector',
      script: './dist/collector.js',
      exec_mode: 'fork',
    },
    {
      name: 'server',
      script: './dist/server.js',
      exec_mode: 'fork',
    },
    {
      name: 'log_server',
      script: './dist/log_server.js',
      exec_mode: 'fork',
    },
  ]

  pm2.start(apps, function (err) {
    if (err) {
      throw err
    }
    pm2.disconnect()

    // Exit the script
    process.exit()
  })

  pm2.launchBus((err, bus) => {
    console.log('[PM2] Log streaming started')

    bus.on('log:out', function (data) {
      console.log('[App:%s] %s', data.process.name, data.data)
    })

    bus.on('log:err', function (data) {
      console.error('[App:%s][Err] %s', data.process.name, data.data)
    })
  })
})
