import { pool } from './db.js';
import { config } from './config.js';

async function processQueue() {
  if (!config.payoutSignerEnabled || !config.payoutSignerUrl || !config.payoutSignerToken) {
    console.log('Payout worker idle: isolated signer is not configured. Queued withdrawals are not sent.');
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM withdrawals WHERE status='queued' ORDER BY created_at
       FOR UPDATE SKIP LOCKED LIMIT 5`
    );
    for (const w of rows) {
      await client.query(`UPDATE withdrawals SET status='processing',updated_at=NOW() WHERE id=$1`, [w.id]);
    }
    await client.query('COMMIT');

    for (const w of rows) {
      let broadcastTxid = null;
      try {
        // Contract for the separately hosted signer:
        // POST /v1/usdt-trc20/send {to, amount, withdrawalId}
        // -> {txid}; signer must enforce allowlisted destination, idempotency,
        // limits, fee checks, and independent authorization.
        const response = await fetch(`${config.payoutSignerUrl.replace(/\/$/,'')}/v1/usdt-trc20/send`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'authorization': `Bearer ${config.payoutSignerToken}`,
            'idempotency-key': w.id
          },
          body: JSON.stringify({ to: w.destination_address, amount: String(w.amount_usdt), withdrawalId: w.id })
        });
        if (!response.ok) throw new Error(`Signer returned ${response.status}`);
        const result = await response.json();
        if (!result.txid) throw new Error('Signer response did not include txid');
        broadcastTxid = result.txid;

        const c = await pool.connect();
        try {
          await c.query('BEGIN');
          await c.query(`UPDATE withdrawals SET status='sent',txid=$2,updated_at=NOW() WHERE id=$1`, [w.id, result.txid]);
          await c.query(
            `INSERT INTO ledger_entries(entry_type,reference,amount_usdt)
             VALUES('withdrawal_debit',$1,$2) ON CONFLICT DO NOTHING`, [w.id, w.amount_usdt]
          );
          await c.query('COMMIT');
        } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
      } catch (e) {
        if (broadcastTxid) {
          // Broadcast may have succeeded. Keep funds reserved and require reconciliation.
          await pool.query(
            `UPDATE withdrawals SET status='processing',txid=$2,failure_reason=$3,updated_at=NOW() WHERE id=$1`,
            [w.id, broadcastTxid, ('Broadcasted; database finalization needs reconciliation: ' + e.message).slice(0,500)]
          );
        } else {
          await pool.query(
            `UPDATE withdrawals SET status='failed',failure_reason=$2,updated_at=NOW() WHERE id=$1`,
            [w.id, String(e.message).slice(0,500)]
          );
          await pool.query(
            `INSERT INTO ledger_entries(entry_type,reference,amount_usdt)
             VALUES('withdrawal_release',$1,$2) ON CONFLICT DO NOTHING`,
            [w.id, w.amount_usdt]
          );
        }
      }
    }
  } finally { client.release(); }
}
console.log('smoker.entry.web payout worker started.');
await processQueue();
setInterval(() => processQueue().catch(e => console.error('Payout worker error:', e)), 30000);
