import http from 'node:http';

/**
 * Abre uma porta HTTP simples.
 * O Render só mantém um "Web Service" no ar se o app escutar na porta da variável
 * PORT; sem isso o deploy trava em "Port scan timeout". O Render define o PORT sozinho.
 */
export function startHttpServer(client) {
  const port = Number(process.env.PORT) || 3000;

  const server = http.createServer((req, res) => {
    const path = (req.url || '/').split('?')[0];
    const isRead = req.method === 'GET' || req.method === 'HEAD';

    if (isRead && (path === '/' || path === '/health')) {
      const body = JSON.stringify({
        status: 'ok',
        bot: client.isReady() ? 'online' : 'conectando',
        uptime: Math.round(process.uptime()),
      });

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });

  server.on('error', (error) => {
    console.error(`[http] não consegui abrir a porta ${port}: ${error.message}`);
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Servidor HTTP na porta ${port} (rotas: / e /health)`);
  });

  return server;
}
