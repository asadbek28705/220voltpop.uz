// pm2: haqiqiy dastur va demo. Ikkalasi ham faqat 127.0.0.1 da — tashqariga nginx orqali chiqadi.
const common = {
  script: 'server/index.js',
  cwd: __dirname,
  node_args: '--disable-warning=ExperimentalWarning',
  max_memory_restart: '300M',
  time: true,
}
module.exports = {
  apps: [
    { ...common, name: 'ombor', env: { NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '8100', NO_HTTPS: '1', TRUST_PROXY: '1', NO_SEED: '1' } },
    { ...common, name: 'ombor-demo', env: { NODE_ENV: 'production', DEMO: '1', HOST: '127.0.0.1', PORT: '8101', TRUST_PROXY: '1' } },
  ],
}
