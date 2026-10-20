// Función serverless de Vercel. Guarda la lista de partidas en Upstash Redis
// (Vercel Marketplace). Si no hay base conectada, responde configured:false
// y la página funciona en modo local (localStorage).

const KEY = 'catan:familia:partidas';

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

function limpiar(lista) {
  if (!Array.isArray(lista)) return null;
  const out = [];
  for (const p of lista.slice(0, 5000)) {
    if (!p || typeof p !== 'object') return null;
    const ganadores = Array.isArray(p.ganadores) ? p.ganadores.filter((g) => JUGADORES.includes(g)) : [];
    if (!ganadores.length) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.fecha))) return null;
    out.push({
      id: String(p.id).slice(0, 40),
      fecha: String(p.fecha),
      modo: p.modo === 'eq' ? 'eq' : 'ind',
      ganadores,
      nota: String(p.nota || '').slice(0, 200),
      creada: Number(p.creada) || 0,
    });
  }
  return out;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (!URL_REDIS || !TOKEN_REDIS) {
    return res.status(200).json({ configured: false, partidas: [] });
  }

  try {
    if (req.method === 'GET') {
      const raw = await redis(['GET', KEY]);
      const partidas = raw ? JSON.parse(raw) : [];
      return res.status(200).json({ configured: true, partidas });
    }

    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const partidas = limpiar(body && body.partidas);
      if (!partidas) return res.status(400).json({ error: 'datos inválidos' });
      await redis(['SET', KEY, JSON.stringify(partidas)]);
      return res.status(200).json({ configured: true, ok: true });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'método no permitido' });
  } catch (e) {
    return res.status(500).json({ error: 'error de servidor' });
  }
};
