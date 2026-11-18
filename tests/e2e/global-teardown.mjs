import { request } from 'node:http';

export default async function teardown() {
  const port = Number(process.env.F03_E2E_PORT);
  const token = process.env.F03_E2E_SHUTDOWN_TOKEN;

  if (!Number.isInteger(port) || port < 1 || port > 65_535 || !token) {
    throw new Error('F03 webServer teardown is missing its per-run port or shutdown token');
  }

  await new Promise((resolve, reject) => {
    const req = request({
      host: '127.0.0.1',
      port,
      path: '/__f03_internal/shutdown',
      method: 'POST',
      headers: { 'x-f03-shutdown-token': token },
      timeout: 4_000,
    }, (res) => {
      res.resume();
      res.once('end', () => {
        if (res.statusCode === 204 && res.headers['x-f03-server-shutdown'] === 'accepted') resolve();
        else reject(new Error(`F03 webServer rejected teardown (HTTP ${res.statusCode ?? 'unknown'})`));
      });
    });
    req.once('timeout', () => req.destroy(new Error('F03 webServer shutdown request timed out')));
    req.once('error', reject);
    req.end();
  });
}
