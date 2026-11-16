import crypto from 'node:crypto';
import { pool } from './db.js';
import { config } from './config.js';

export async function availableBalance(client = pool) {
  const { rows } = await client.query(`
    SELECT
      COALESCE((SELECT SUM(amount_usdt) FROM ledger_entries WHERE entry_type IN ('sale_credit','withdrawal_release')),0)
      - COALESCE((SELECT SUM(amount_usdt) FROM ledger_entries WHERE entry_type='withdrawal_reserve'),0)
      AS available
  `);
  return Number(rows[0].available);
}

export async function queueWithdrawal(amount, source='manual') {
  if (!config.indodaxAddress) throw new Error('Indodax destination address is not configured');
  if (config.indodaxNetwork !== 'TRC20') throw new Error('Configured Indodax network must be TRC20');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(824601)');
    const balance = await availableBalance(client);
    if (balance < amount) throw new Error('Insufficient available balance');
    const { rows: daily } = await client.query(
      `SELECT COALESCE(SUM(amount_usdt),0) AS total FROM withdrawals
       WHERE status IN ('queued','processing','sent')
         AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`
    );
    if (Number(daily[0].total) + amount > config.withdrawalDailyLimit) {
      throw new Error('Daily withdrawal limit would be exceeded');
    }
    const id = crypto.randomUUID();
    await client.query(
      `INSERT INTO withdrawals(id,amount_usdt,destination_address,network,source)
       VALUES($1,$2,$3,'TRC20',$4)`, [id, amount, config.indodaxAddress, source]
    );
    await client.query(
      `INSERT INTO ledger_entries(entry_type,reference,amount_usdt)
       VALUES('withdrawal_reserve',$1,$2)`, [id, amount]
    );
    await client.query('COMMIT');
    return { id, amount, status: 'queued', source };
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}
