module.exports = {
  apps: [{
    name: 'sistema-licencas',
    script: 'server/index.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      JWT_SECRET: process.env.JWT_SECRET || 'seu_jwt_secret_aqui'
    }
  }]
};
