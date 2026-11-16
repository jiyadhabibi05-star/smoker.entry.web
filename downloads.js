import crypto from 'node:crypto';
import path from 'node:path';
import { pool } from './db.js';
import { config } from './config.js';
import { sha256 } from './security.js';

export async function createDownloadUrl(orderId) {
  const { rows } = await pool.query(
    `SELECT o.id, o.status, p.title FROM orders o JOIN products p ON p.id=o.product_id WHERE o.id=$1`,
    [orderId]
  );
  if (!rows.length || rows[0].status !== 'paid') return null;
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + config.downloadTokenHours * 3600 * 1000);
  await pool.query(
    `INSERT INTO download_tokens(order_id,token_hash,expires_at,max_downloads)
     VALUES($1,$2,$3,$4)`,
    [orderId, sha256(token), expiresAt, config.downloadMaxCount]
  );
  return { url: `${config.publicBaseUrl}/download/${token}`, title: rows[0].title, expiresAt };
}

export async function consumeDownload(token) {
  const hash = sha256(token);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT dt.id, dt.order_id, dt.expires_at, dt.max_downloads, dt.download_count,
              p.ebook_file, p.title
       FROM download_tokens dt
       JOIN orders o ON o.id=dt.order_id
       JOIN products p ON p.id=o.product_id
       WHERE dt.token_hash=$1 AND o.status='paid'
       FOR UPDATE OF dt`,
      [hash]
    );
    if (!rows.length) { await client.query('ROLLBACK'); return null; }
    const item = rows[0];
    if (new Date(item.expires_at) < new Date() || item.download_count >= item.max_downloads) {
      await client.query('ROLLBACK'); return null;
    }
    await client.query(`UPDATE download_tokens SET download_count=download_count+1 WHERE id=$1`, [item.id]);
    await client.query('COMMIT');
    const filePath = path.resolve(config.ebookStorageDir, path.basename(item.ebook_file));
    return { filePath, title: item.title };
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}
