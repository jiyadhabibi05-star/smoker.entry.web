import { pool } from './db.js';
import { config } from './config.js';
import { availableBalance, queueWithdrawal } from './withdrawals.js';

async function runDaily() {
  if (!config.autoWithdrawEnabled) {
    console.log('Auto-withdraw is disabled. Set AUTO_WITHDRAW_ENABLED=true only after signer validation.');
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(824602)');
    const { rows } = await client.query(`SELECT last_run_at FROM system_jobs WHERE job_key='daily_auto_withdraw' FOR UPDATE`);
    const now = new Date();
    const last = rows[0]?.last_run_at ? new Date(rows[0].last_run_at) : null;
    const utcDay = now.toISOString().slice(0,10);
    if (last && last.toISOString().slice(0,10) === utcDay) {
      await client.query('COMMIT'); return;
    }
    await client.query(
      `INSERT INTO system_jobs(job_key,last_run_at) VALUES('daily_auto_withdraw',NOW())
       ON CONFLICT(job_key) DO UPDATE SET last_run_at=EXCLUDED.last_run_at`
    );
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }

  const balance = await availableBalance();
  if (balance >= config.autoWithdrawMin) {
    const result = await queueWithdrawal(balance, 'automatic');
    console.log('Automatic withdrawal queued:', result.id, result.amount);
  } else {
    console.log(`Auto-withdraw skipped. Available: ${balance}; threshold: ${config.autoWithdrawMin}`);
  }
}

const [hour, minute] = config.autoWithdrawTimeUtc.split(':').map(Number);
function msUntilNextRun() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute, 0));
  if (next <= now) next.setUTCDate(next.getUTCDate()+1);
  return next - now;
}
console.log(`Daily auto-withdraw scheduler armed for ${config.autoWithdrawTimeUtc} UTC; enabled=${config.autoWithdrawEnabled}`);
setTimeout(async function tick() {
  try { await runDaily(); } catch (e) { console.error('Auto-withdraw scheduler error:', e.message); }
  setTimeout(tick, 24*60*60*1000);
}, msUntilNextRun());
