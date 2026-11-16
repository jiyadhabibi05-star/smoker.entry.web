import { config } from './config.js';
export async function getRecentUsdtTransfers(address) {
  const url = new URL(`${config.tronGridBaseUrl}/v1/accounts/${address}/transactions/trc20`);
  url.searchParams.set('only_confirmed', 'true');
  url.searchParams.set('limit', '200');
  url.searchParams.set('contract_address', config.usdtContract);
  const headers = {};
  if (config.tronGridApiKey) headers['TRON-PRO-API-KEY'] = config.tronGridApiKey;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`TronGrid request failed: ${response.status}`);
  const body = await response.json();
  return (body.data || []).map(tx => {
    const decimals = Number(tx.token_info?.decimals ?? 6);
    return {
      txid: tx.transaction_id, from: tx.from, to: tx.to,
      amount: Number(tx.value) / (10 ** decimals),
      timestamp: tx.block_timestamp ? new Date(tx.block_timestamp) : null,
      confirmed: tx.type === 'Transfer'
    };
  }).filter(tx => tx.confirmed && tx.to === address);
}
