import http from 'node:http';

/**
 * Servidor mínimo de saúde para o Render rodar a bot como Web Service.
 * Render só roda web services se elas mantiverem uma porta HTTP aberta;
 * sem requisições por 15 minutos a web service é "dormida" e o bot some.
 */
export function startHealthServer() {
  const rawPort = process.env.PORT;
  if (!rawPort) return null;

  const port = Number(rawPort);
  if (!Number.isFinite(port)) return null;

  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('ok');
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[health] ouvindo em 0.0.0.0:${port}`);
  });

  server.on('error', (error) => {
    console.error('[health]', error.message);
  });

  return server;
}
