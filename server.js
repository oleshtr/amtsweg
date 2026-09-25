'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml' };
function createServer() {
  return http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400).end('Bad request'); return; }
    // Serve only game assets, never repository metadata or arbitrary local files.
    if(pathname === '/') pathname='/index.html';
    if(!/^\/(index\.html|styles\.css|src\/[a-z-]+\.js)$/.test(pathname)) {
      res.writeHead(404).end('Not found'); return;
    }
    fs.readFile(path.join(__dirname, pathname), (error, data) => {
      if(error) { res.writeHead(404).end('Not found'); return; }
      res.writeHead(200, {'Content-Type':types[path.extname(pathname)], 'Cache-Control':'no-store'});
      res.end(data);
    });
  });
}
if(require.main === module) {
  const port = Number(process.env.PORT) || 8080;
  createServer().listen(port,'127.0.0.1',()=>console.log(`AMTSWEG läuft auf http://127.0.0.1:${port}`));
}
module.exports = {createServer};
