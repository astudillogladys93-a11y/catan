// Función serverless de Vercel. Guarda las partidas en Upstash Redis
// (Vercel Marketplace), una por campo de un hash, así dos dispositivos
// cargando a la vez no se pisan.
//   GET            -> lista todas las partidas
//   POST {partidas} -> agrega (o reemplaza por id) una o más partidas
//   DELETE ?id=...  -> borra una partida

const KEY = 'catan:familia:partidas:v2';
const KEY_VIEJA = 'catan:familia:partidas';

const URL_REDIS = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN_REDIS = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const JUGADORES = ['Agustín', 'Paula', 'Norberto', 'Iván', 'Julia', 'Francisco', 'Valentín'];

async function redis(cmd) {
  const r = await fetch(URL_REDIS, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN_REDIS}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).result;
}

function limpiarPartida(p) {
  if (!p || typeof p !== 'object') return null;
  const ganadores = Array.isArray(p.ganadores) ? p.ganadores.filter((g) => JUGADORES.includes(g)) : [];
  if (!ganadores.length) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.fecha))) return null;
  const id = String(p.id || '').slice(0, 40);
  if (!id) return null;
  return {
    id,
    fecha: String(p.fecha),
    modo: p.modo === 'eq' ? 'eq' : 'ind',
    ganadores,
    nota: String(p.nota || '').slice(0, 200),
    creada: Number(p.creada) || 0,
  };
}

async function agregar(lista) {
  const args = [];
  for (const p of lista) args.push(p.id, JSON.stringify(p));
  if (args.length) await redis(['HSET', KEY, ...args]);
}

async function listar() {
  let plano = (await redis(['HGETALL', KEY])) || [];
  if (!plano.length) {
    // Migración desde la versión anterior (todas las partidas en un solo string).
    const raw = await redis(['GET', KEY_VIEJA]);
    const viejas = raw ? JSON.parse(raw).map(limpiarPartida).filter(Boolean) : [];
    if (viejas.length) await agregar(viejas);
    if (raw) await redis(['DEL', KEY_VIEJA]);
    if (viejas.length) return viejas;
  }
  const partidas = [];
  for (let i = 1; i < plano.length; i += 2) {
    try { partidas.push(JSON.parse(plano[i])); } catch (e) {}
  }
  return partidas;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (!URL_REDIS || !TOKEN_REDIS) {
    return res.status(503).json({ configured: false, error: 'base de datos no conectada' });
  }

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ configured: true, partidas: await listar() });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const entrada = body && Array.isArray(body.partidas) ? body.partidas.slice(0, 5000) : [];
      const partidas = entrada.map(limpiarPartida);
      if (!partidas.length || partidas.some((p) => !p)) return res.status(400).json({ error: 'datos inválidos' });
      await agregar(partidas);
      return res.status(200).json({ ok: true, partidas });
    }

    if (req.method === 'DELETE') {
      const id = String((req.query && req.query.id) || '').slice(0, 40);
      if (!id) return res.status(400).json({ error: 'falta id' });
      await redis(['HDEL', KEY, id]);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'método no permitido' });
  } catch (e) {
    return res.status(500).json({ error: 'error de servidor' });
  }
};
