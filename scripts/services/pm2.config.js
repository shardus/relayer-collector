module.exports = {
  apps: [
    {
      name: 'collector-server-6001',
      script: 'dist/server.js',
      env: {
        PORT: 6001,
      },
    },
    {
      name: 'collector-server-6002',
      script: 'dist/server.js',
      env: {
        PORT: 6002,
      },
    },
    {
      name: 'collector-server-6003',
      script: 'dist/server.js',
      env: {
        PORT: 6003,
      },
    },
    {
      name: 'collector-server-6004',
      script: 'dist/server.js',
      env: {
        PORT: 6004,
      },
    },
    {
      name: 'collector-server-6005',
      script: 'dist/server.js',
      env: {
        PORT: 6005,
      },
    },
  ],
}
