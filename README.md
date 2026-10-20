# Los Colonos de la Familia

Ranking familiar de partidas del Catán. Se cargan las victorias (individuales o en equipo, con fecha) y se arma solo el ranking.

## Estructura

- `index.html`: toda la página (sin build, sin dependencias)
- `api/partidas.js`: función serverless de Vercel que guarda las partidas en Redis

## Deploy en Vercel

1. Subí la carpeta a un repo de GitHub (o usá `vercel` desde la terminal dentro de la carpeta).
2. Importá el proyecto en Vercel. No hace falta configurar nada: framework "Other", sin build command.
3. Para que las partidas se compartan entre todos los celulares y compus de la familia, conectá una base:
   - En el proyecto, andá a **Storage** y creá una base **Upstash Redis** desde el Marketplace (el plan gratuito alcanza de sobra).
   - Conectala al proyecto. Vercel agrega solo las variables de entorno (`KV_REST_API_URL` y `KV_REST_API_TOKEN`, o `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`).
   - Hacé un redeploy.
4. Abrí la página: el cartelito de arriba tiene que decir "Sincronizado en la nube".

Si no conectás la base, la página funciona igual en **modo local** (guarda en el navegador de cada dispositivo, sin compartir).

## Cambiar jugadores

Editá la lista `JUGADORES` en `index.html` y la constante `JUGADORES` en `api/partidas.js` (tienen que coincidir).

## Cómo cuenta el ranking

- Cada victoria suma un punto de victoria a cada ganador.
- En una partida por equipos, todos los integrantes del equipo ganador suman un punto.
- Desempate: más victorias individuales, y después orden alfabético.

## Nota

Cualquiera que tenga el link puede cargar y borrar partidas. Para uso familiar está bien; si querés protegerlo, se puede agregar una clave simple.
