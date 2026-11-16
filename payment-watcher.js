import { pool } from './db.js';
import { getRecentUsdtTransfers } from './tron.js';
import { createDownloadUrl } from './downloads.js';
import { sendPaidOrderEmail } from './mailer.js';
import { sha256 } from './security.js';

async function scan() {
  const { rows: addresses } = await pool.query(
    `SELECT address FROM deposit_addresses WHERE status='assigned'`
  );
  for (const { address } of addresses) {
    try {
      const transfers = await getRecentUsdtTransfers(address);
      for (const transfer of transfers) {
        const client = await pool.connect();
        let paidOrder = null;
        try {
          await client.query('BEGIN');
          const { rows: orders } = await client.query(
            `SELECT * FROM orders
             WHERE deposit_address=$1 AND status='pending' AND expires_at>NOW()
             FOR UPDATE`, [address]
          );
          // One unique address is assigned to one order. Accept only exact payment
          // in this starter; over/underpayments require manual review.
          const order = orders.find(o => Number(transfer.amount) === Number(o.expected_amount));
          if (!order) { await client.query('ROLLBACK'); continue; }

          const inserted = await client.query(
            `INSERT INTO payments(order_id,txid,from_address,to_address,amount_usdt,block_timestamp,confirmed)
             VALUES($1,$2,$3,$4,$5,$6,true) ON CONFLICT DO NOTHING RETURNING id`,
            [order.id, transfer.txid, transfer.from, transfer.to, transfer.amount, transfer.timestamp]
          );
          if (inserted.rowCount) {
            await client.query(`UPDATE orders SET status='paid',paid_at=NOW() WHERE id=$1`, [order.id]);
            await client.query(
              `INSERT INTO ledger_entries(entry_type,reference,amount_usdt)
               VALUES('sale_credit',$1,$2) ON CONFLICT DO NOTHING`,
              [order.id, transfer.amount]
            );
            await client.query(`UPDATE deposit_addresses SET status='retired' WHERE address=$1`, [address]);
            paidOrder = order;
          }
          await client.query('COMMIT');
        } catch (e) { await client.query('ROLLBACK'); throw e; }
        finally { client.release(); }

        if (paidOrder) {
          let link = null;
          try {
            link = await createDownloadUrl(paidOrder.id);
            if (link) {
              const sent = await sendPaidOrderEmail(paidOrder.customer_email, link.title, link.url);
              if (!sent) await pool.query(`DELETE FROM download_tokens WHERE token_hash=$1`, [sha256(link.url.split('/').pop())]);
            }
          } catch (mailErr) {
            if (link) await pool.query(`DELETE FROM download_tokens WHERE token_hash=$1`, [sha256(link.url.split('/').pop())]).catch(()=>{});
            console.error('Delivery email issue; a fresh link can be issued from order status:', mailErr.message);
          }
        }
      }
    } catch (error) {
      console.error('Payment scan error:', address, error.message);
    }
  }
}
console.log('smoker.entry.web payment watcher active.');
await scan();
setInterval(() => scan().catch(console.error), Number(process.env.PAYMENT_POLL_INTERVAL_MS || 60000));
