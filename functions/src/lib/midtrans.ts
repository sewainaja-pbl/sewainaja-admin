import midtransClient from 'midtrans-client';

const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';

// Create Core API instance for callback and transaction query
export const coreApi = new midtransClient.CoreApi({
  isProduction: isProduction,
  serverKey: process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-DEFAULT_MOCK_KEY',
  clientKey: process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-DEFAULT_MOCK_KEY'
});

// Create Snap API instance for generating transaction tokens
export const snap = new midtransClient.Snap({
  isProduction: isProduction,
  serverKey: process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-DEFAULT_MOCK_KEY',
  clientKey: process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-DEFAULT_MOCK_KEY'
});
