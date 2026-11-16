import 'dotenv/config';
function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}
export const config = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: required('DATABASE_URL'),
  adminToken: required('ADMIN_API_TOKEN'),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3000',
  corsOrigin: process.env.CORS_ORIGIN || '',
  tronGridBaseUrl: process.env.TRONGRID_BASE_URL || 'https://api.trongrid.io',
  tronGridApiKey: process.env.TRONGRID_API_KEY || '',
  usdtContract: process.env.USDT_TRC20_CONTRACT || 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj',
  confirmationsRequired: Number(process.env.TRON_CONFIRMATIONS_REQUIRED || 20),
  ebookStorageDir: process.env.EBOOK_STORAGE_DIR || './storage/ebooks',
  downloadTokenHours: Number(process.env.DOWNLOAD_TOKEN_HOURS || 72),
  downloadMaxCount: Number(process.env.DOWNLOAD_MAX_COUNT || 3),
  autoWithdrawEnabled: process.env.AUTO_WITHDRAW_ENABLED === 'true',
  autoWithdrawMin: Number(process.env.AUTO_WITHDRAW_MIN_USDT || 100),
  autoWithdrawTimeUtc: process.env.AUTO_WITHDRAW_TIME_UTC || '03:00',
  indodaxAddress: process.env.INDODAX_DEPOSIT_ADDRESS || '',
  indodaxNetwork: process.env.INDODAX_NETWORK || 'TRC20',
  withdrawalDailyLimit: Number(process.env.WITHDRAWAL_DAILY_LIMIT_USDT || 500),
  payoutSignerUrl: process.env.PAYOUT_SIGNER_URL || '',
  payoutSignerToken: process.env.PAYOUT_SIGNER_TOKEN || '',
  payoutSignerEnabled: process.env.PAYOUT_SIGNER_ENABLED === 'true',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPassword: process.env.SMTP_PASSWORD || '',
  mailFrom: process.env.MAIL_FROM || 'smoker.entry.web <orders@example.com>'
};
