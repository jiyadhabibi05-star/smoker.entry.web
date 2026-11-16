import crypto from 'node:crypto';
import { config } from './config.js';
export function requireAdmin(req, res, next) {
  const supplied = req.header('authorization')?.replace(/^Bearer\\s+/i, '');
  const expected = config.adminToken;
  if (!supplied || supplied.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
