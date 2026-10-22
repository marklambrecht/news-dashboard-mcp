const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
test('HTTP bridge is loopback-only and rejects hostile hosts and browser origins', async () => {
  const reservation = net.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, ['dist/index.js'], { env: { ...process.env, HTTP_PORT: String(port), NEWS_DASHBOARD_TOKEN: 'test-only' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Server startup timeout')), 10000);
      child.stderr.on('data', data => { if (data.toString().includes('listening')) { clearTimeout(timer); resolve(); } });
      child.once('exit', code => { clearTimeout(timer); reject(Error(`Server exited ${code}`)); });
    });
    const url = `http://127.0.0.1:${port}/health`;
    assert.equal((await fetch(url)).status, 200);
    assert.equal((await fetch(url, { headers: { Origin: 'https://attacker.example' } })).status, 403);
    assert.equal((await fetch(url, { headers: { Origin: 'null' } })).status, 403);
    assert.equal((await fetch(url, { headers: { Origin: `http://127.0.0.1:${port}` } })).status, 200);
    const response = await new Promise((resolve, reject) => {
      require('node:http').get(url, { headers: { Host: 'attacker.example' } }, res => { res.resume(); resolve(res); }).on('error', reject);
    });
    assert.equal(response.statusCode, 403);
  } finally { child.kill(); }
});
