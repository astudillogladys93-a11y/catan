// Servidor para desarrollo local (`yarn dev`): sirve index.html y la API
// de api/partidas.js sin necesitar Vercel. Si hay credenciales de Redis en
// .env.local las usa; si no, guarda las partidas en datos-dev.json.

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const ARCHIVO = path.join(__dirname, 'datos-dev.json');

// Variables de .env.local (opcional)
try {
  for (const linea of fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch (e) {}

const usarArchivo = !(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);
if (usarArchivo) {
  process.env.KV_REST_API_URL = `http://127.0.0.1:${PORT}/__redis`;
  process.env.KV_REST_API_TOKEN = 'local';
}

// Mini "Redis" en archivo, con los comandos que usa la API.
function leerDb() {
  try { return JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')); } catch (e) { return { str: {}, hash: {} }; }
}
function redisLocal([cmd, key, ...args]) {
  const db = leerDb();
  let result = null;
  if (cmd === 'GET') result = db.str[key] || null;
  else if (cmd === 'DEL') delete db.str[key];
  else if (cmd === 'HSET') {
    db.hash[key] = db.hash[key] || {};
    for (let i = 0; i < args.length; i += 2) db.hash[key][args[i]] = args[i + 1];
  } else if (cmd === 'HGETALL') result = Object.entries(db.hash[key] || {}).flat();
  else if (cmd === 'HDEL') delete (db.hash[key] || {})[args[0]];
  fs.writeFileSync(ARCHIVO, JSON.stringify(db, null, 2));
  return { result };
}

const handler = require('./api/partidas.js');

function leerBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const body = await leerBody(req);

  if (url.pathname === '/__redis') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(redisLocal(JSON.parse(body))));
  }

  if (url.pathname === '/api/partidas') {
    req.query = Object.fromEntries(url.searchParams);
    try { req.body = body ? JSON.parse(body) : undefined; } catch (e) { req.body = body; }
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (j) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(j)); };
    return handler(req, res);
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
  }

  res.statusCode = 404;
  res.end('no encontrado');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Catán corriendo en http://localhost:${PORT}`);
  for (const ifs of Object.values(os.networkInterfaces())) {
    for (const i of ifs || []) {
      if (i.family === 'IPv4' && !i.internal) console.log(`  Desde el celu (mismo wifi): http://${i.address}:${PORT}`);
    }
  }
  console.log(usarArchivo ? '  Guardando en datos-dev.json\n' : '  Guardando en Redis (.env.local)\n');
});
