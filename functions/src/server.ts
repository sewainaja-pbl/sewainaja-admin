import 'dotenv/config';
import { app } from './app';

const PORT = process.env.PORT ?? '8080';
const HOST = process.env.HOST ?? '0.0.0.0';

const server = app.listen(parseInt(PORT, 10), HOST, () => {
  console.log(`[server] Listening on ${HOST}:${PORT}`);
  console.log(`[server] Health: http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}/health`);
});

function shutdown(signal: string) {
  console.log(`[server] ${signal} received, closing...`);
  server.close(() => {
    console.log('[server] HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[server] Force exit after 10s');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));