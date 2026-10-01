module.exports = {
  apps: [
    {
      name: 'orvya-deploy-manager',
      script: 'dist/main.js',
      cwd: '/home/ubuntu/deploy/orvya-deploy-manager',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
};
