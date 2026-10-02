// =============================================================
//  Zurban Propiedades – Conexión con la API de Zonaprop
//  Función de Vercel: /api/zonaprop?accion=...
//
//  Las credenciales NO están en este archivo: se leen de las
//  variables de entorno de Vercel:
//    ZP_CLIENT_ID      -> usuario de la API (ej: Zurban_API)
//    ZP_CLIENT_SECRET  -> contraseña de la API
//    ZP_INMOBILIARIA   -> código de inmobiliaria (ej: 30562506)
//    ZP_ENTORNO        -> "sandbox" o "produccion"
//    ADMIN_EMAILS      -> mails que pueden usar el admin, separados por coma
// =============================================================

const SUPABASE_URL = 'https://zckcdetutyehebezsmlh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VnAm_RHVhMbsg5413toJxQ_aKBhKZqB';

const BASES = {
  sandbox: 'https://api-zp-sandbox-open.navent.com',
  produccion: 'https://api-zp-open.navent.com',
};

const USER_AGENT = 'ZurbanPropiedades/1.0 (zurbanpropiedades@hotmail.com)';

// El token de Zonaprop dura mucho: lo guardamos mientras la función esté viva.
let tokenCache = null; // { valor, vence }

function entorno() {
  return (process.env.ZP_ENTORNO || 'sandbox').toLowerCase() === 'produccion' ? 'produccion' : 'sandbox';
}

function base() {
  return BASES[entorno()];
}

class ErrorZP extends Error {
  constructor(mensaje, status = 500) { super(mensaje); this.status = status; }
}

// ---------- 1. Verificar que quien llama está logueado en el admin ----------
async function verificarUsuario(req) {
  const auth = req.headers.authorization || '';
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!jwt) throw new ErrorZP('Tenés que iniciar sesión en el admin.', 401);

  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${jwt}` },
  });
  if (!r.ok) throw new ErrorZP('Tu sesión venció. Cerrá sesión y volvé a entrar.', 401);
  const user = await r.json();

  const permitidos = (process.env.ADMIN_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (permitidos.length === 0) {
    throw new ErrorZP('Falta configurar ADMIN_EMAILS en Vercel.', 500);
  }
  if (!permitidos.includes((user.email || '').toLowerCase())) {
    throw new ErrorZP('Tu usuario no tiene permiso para usar Zonaprop.', 403);
  }
  return user;
}

// ---------- 2. Conseguir el token de Zonaprop ----------
async function obtenerToken(forzar = false) {
  if (!forzar && tokenCache && tokenCache.vence > Date.now()) return tokenCache.valor;

  const id = process.env.ZP_CLIENT_ID;
  const secret = process.env.ZP_CLIENT_SECRET;
  if (!id || !secret) throw new ErrorZP('Faltan ZP_CLIENT_ID o ZP_CLIENT_SECRET en Vercel.', 500);

  const url = `${base()}/v1/application/login?grant_type=client_credentials`
    + `&client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(secret)}`;

  let r;
  try {
    r = await fetch(url, { method: 'POST', headers: { Accept: 'application/json', 'User-Agent': USER_AGENT } });
  } catch (e) {
    throw new ErrorZP(mensajeSinRespuesta(), 502);
  }
  if (r.status === 401 || r.status === 403) {
    throw new ErrorZP('Zonaprop rechazó el usuario o la contraseña de la API. Revisá ZP_CLIENT_ID y ZP_CLIENT_SECRET.', 502);
  }
  if (!r.ok) throw new ErrorZP(`Zonaprop no aceptó el login (código ${r.status}). ${mensajeSinRespuesta()}`, 502);

  const j = await r.json();
  const segundos = Number(j.expires_in) || 3600;
  // Renovamos un día antes (o a la mitad, si dura poco).
  const margen = Math.min(86400, segundos / 2) * 1000;
  tokenCache = { valor: j.access_token, vence: Date.now() + segundos * 1000 - margen };
  return tokenCache.valor;
}

function mensajeSinRespuesta() {
  return entorno() === 'sandbox'
    ? 'Zonaprop no respondió. El Sandbox funciona de lunes a viernes de 7:00 a 20:55.'
    : 'Zonaprop no respondió. Probá de nuevo en unos minutos.';
}

// ---------- 3. Llamar a la API de Zonaprop ----------
// modo: 'ambos' (token en encabezado y en la dirección, como el Playground),
//       'header' (solo encabezado) o 'query' (solo en la dirección).
function conToken(path, token, modo) {
  if (modo === 'header') return path;
  return path + (path.includes('?') ? '&' : '?') + 'access_token=' + encodeURIComponent(token);
}

async function zp(path, { method = 'GET', body, modo = 'ambos' } = {}, reintento = true) {
  const token = await obtenerToken();
  let r;
  try {
    r = await fetch(base() + conToken(path, token, modo), {
      method,
      headers: {
        ...(modo !== 'query' ? { Authorization: `Bearer ${token}` } : {}),
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ErrorZP(mensajeSinRespuesta(), 502);
  }

  // Token vencido: pedimos uno nuevo y reintentamos una sola vez.
  if (r.status === 401 && reintento) {
    tokenCache = null;
    await obtenerToken(true);
    return zp(path, { method, body, modo }, false);
  }

  const texto = await r.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch (e) { datos = null; }

  if (r.status === 429) throw new ErrorZP('Zonaprop recibió demasiadas consultas seguidas. Esperá un minuto y probá de nuevo.', 429);
  if (r.status === 403) throw new ErrorZP('Zonaprop no permite esta acción para tu inmobiliaria.', 403);
  if (!r.ok && !datos) throw new ErrorZP(`Zonaprop respondió con un error (código ${r.status}). ${mensajeSinRespuesta()}`, 502);

  return { status: r.status, datos };
}

// ---------- 4. Acciones disponibles ----------
const ACCIONES = {
  // Conexión, datos de la inmobiliaria y planes disponibles
  async estado() {
    const codigo = codigoInmobiliaria();
    const [inmos, disp] = await Promise.all([
      zp('/v1/inmobiliarias?pageable.size=100'),
      zp(`/v1/inmobiliarias/${encodeURIComponent(codigo)}/disponibilidad`),
    ]);
    const lista = (inmos.datos && inmos.datos.content) || [];
    const propia = lista.find(i => String(i.codigoInmobiliaria) === String(codigo)) || null;
    return {
      entorno: entorno(),
      codigoInmobiliaria: codigo,
      inmobiliaria: propia,
      habilitada: !!propia,
      disponibilidad: disp.datos || { disponibles: [], vencimientos: [] },
    };
  },

  // Resumen de todos los avisos online (solo lectura)
  async avisos() {
    const codigo = encodeURIComponent(codigoInmobiliaria());
    const todos = [];
    let total = Infinity;
    for (let pagina = 0; pagina < 20 && todos.length < total; pagina++) {
      const { datos } = await zp(`/v1/inmobiliarias/${codigo}/avisos/online/resumen`
        + `?excluirAvisosDuplicados=false&pageable.size=100&pageable.page=${pagina}`);
      const contenido = (datos && datos.content) || [];
      total = (datos && Number(datos.total)) || contenido.length;
      todos.push(...contenido);
      if (contenido.length === 0) break;
    }
    return { entorno: entorno(), total: todos.length, avisos: todos };
  },
};

// Vincula un aviso ya publicado en Zonaprop (idAviso) con el código de una propiedad del admin.
ACCIONES.asociar = async function (req) {
  if (req.method !== 'POST') throw new ErrorZP('Esta acción requiere POST.', 405);
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const idAviso = String(body.idAviso || '');
  const codigoAviso = String(body.codigoAviso || '');
  if (!/^\d{1,15}$/.test(idAviso)) throw new ErrorZP('Número de aviso de Zonaprop inválido.', 400);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(codigoAviso)) throw new ErrorZP('Código de propiedad inválido.', 400);

  const codigo = encodeURIComponent(codigoInmobiliaria());
  const { status, datos } = await zp(
    `/v1/inmobiliarias/${codigo}/avisos/${encodeURIComponent(codigoAviso)}/asociar/${idAviso}`,
    { method: 'PUT' }
  );
  const r = Array.isArray(datos) ? datos[0] : datos;
  const errores = (r && r.errors) || [];
  const ok = status < 300 && !(r && r.error === true) && errores.length === 0;
  return { ok, status, respuesta: datos };
};

// Detalle completo de un aviso ya vinculado (por el código de la propiedad del admin)
ACCIONES.detalle = async function (req) {
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const codigoAviso = String(body.codigoAviso || '');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(codigoAviso)) throw new ErrorZP('Código de propiedad inválido.', 400);
  const codigo = encodeURIComponent(codigoInmobiliaria());
  const { status, datos } = await zp(`/v1/inmobiliarias/${codigo}/avisos/${encodeURIComponent(codigoAviso)}`);
  return { status, aviso: datos };
};

// Diagnóstico: pide la disponibilidad de tres formas distintas y devuelve las respuestas crudas.
ACCIONES.diagnostico = async function () {
  const path = `/v1/inmobiliarias/${encodeURIComponent(codigoInmobiliaria())}/disponibilidad`;
  const resultado = { entorno: entorno() };
  for (const modo of ['header', 'query', 'ambos']) {
    try {
      const { status, datos } = await zp(path, { modo });
      resultado[modo] = { status, datos };
    } catch (e) {
      resultado[modo] = { error: e.message };
    }
  }
  return resultado;
};

function codigoInmobiliaria() {
  const c = process.env.ZP_INMOBILIARIA;
  if (!c) throw new ErrorZP('Falta ZP_INMOBILIARIA en Vercel.', 500);
  return c;
}

// ---------- 5. Punto de entrada ----------
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    await verificarUsuario(req);
    const accion = (req.query && req.query.accion) || '';
    const fn = ACCIONES[accion];
    if (!fn) throw new ErrorZP('Acción desconocida.', 400);
    const data = await fn(req);
    res.status(200).json({ ok: true, data });
  } catch (e) {
    const status = e instanceof ErrorZP ? e.status : 500;
    const mensaje = e instanceof ErrorZP ? e.message : 'Error inesperado en el servidor.';
    if (!(e instanceof ErrorZP)) console.error(e);
    res.status(status).json({ ok: false, error: mensaje });
  }
};
