const localtunnel = require('localtunnel');

let currentTunnel = null;

async function startTunnel() {
  try {
    if (currentTunnel) {
      try { currentTunnel.close(); } catch (e) {}
    }

    const tunnel = await localtunnel({
      port: 3000,
      subdomain: 'campus-gate-pass-7772',
    });

    currentTunnel = tunnel;
    console.log(`[MOBILE HTTPS TUNNEL RUNNING] URL: ${tunnel.url}`);

    tunnel.on('close', () => {
      console.log('[TUNNEL EVENT: CLOSED] Re-establishing tunnel in 2 seconds...');
      setTimeout(startTunnel, 2000);
    });

    tunnel.on('error', (err) => {
      console.error('[TUNNEL EVENT: ERROR]', err);
      setTimeout(startTunnel, 3000);
    });
  } catch (err) {
    console.error('[TUNNEL INIT FAILED]', err.message);
    setTimeout(startTunnel, 4000);
  }
}

// Keep node process alive forever
setInterval(() => {}, 1000 * 60 * 60);

startTunnel();
