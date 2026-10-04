/* =====================================================================
   CONFIGURACIÓN DE LA INMOBILIARIA
   Este es el ÚNICO archivo que hay que cambiar para cada inmobiliaria.
   (Además: los textos para Google/WhatsApp en el <head> de cada página,
   ver LEEME.md)
   ===================================================================== */
window.SITIO = {
  // ---- Marca ----
  nombre: 'Zurban',                       // nombre corto (logo)
  nombreSub: 'Propiedades',               // segunda línea del logo
  nombreCompleto: 'Zurban Propiedades',
  inicial: 'Z',                           // letra dentro del círculo del logo
  ciudad: 'Córdoba',
  eslogan: 'Tu inmobiliaria de confianza en Córdoba. Experiencia y compromiso en cada operación.',

  // ---- Corredor/a responsable ----
  corredor: 'Leticia Lescano Zurro',
  corredorTitulo: 'Martillera y Corredora Inmobiliaria',
  matricula: 'Mat. Prof. 042436',

  // ---- Contacto ----
  whatsapp: '5493512004745',              // sin +, sin espacios (549 + área + número)
  telefonoVisible: '+54 9 351 200-4745',
  email: 'zurbanpropiedades@hotmail.com',
  direccion: 'Chacabuco 839, Nueva Córdoba',
  direccion2: 'Córdoba, Argentina',
  horarios: ['Lunes a viernes: 9 a 18 hs', 'Sábados: 9 a 13 hs'],
  instagram: 'zurbanpropiedades',         // usuario sin @ ('' para ocultar)
  facebook: 'zurbanpropiedades',          // usuario ('' para ocultar)
  dominio: 'zurbanpropiedades.com.ar',    // sin https:// ni www

  // ---- Números de la sección de estadísticas ----
  estadisticas: [
    ['+500', 'Operaciones concretadas'],
    ['21', 'Años de experiencia'],
    ['98%', 'Clientes satisfechos'],
    ['+80', 'Propiedades activas'],
  ],

  // ---- Colores ----
  colores: {
    principal: '#1A2E4A',        // azul (fondos, textos)
    principalOscuro: '#111f33',
    principalMedio: '#243d5c',
    acento: '#C9A84C',           // dorado
    acentoClaro: '#dfc07a',
    acentoPalido: '#f5edda',
  },

  // ---- Opciones ----
  musica: true,                  // música de fondo en la web

  // ---- Base de datos (Supabase: Project Settings > API) ----
  supabase: {
    url: 'https://zckcdetutyehebezsmlh.supabase.co',
    key: 'sb_publishable_VnAm_RHVhMbsg5413toJxQ_aKBhKZqB',
  },
};

/* ---------------------------------------------------------------------
   No hace falta tocar nada de acá para abajo.
   --------------------------------------------------------------------- */
(function () {
  const S = window.SITIO;
  S.web = 'https://' + S.dominio;
  S.wa = function (texto) {
    return 'https://wa.me/' + S.whatsapp + (texto ? '?text=' + encodeURIComponent(texto) : '');
  };

  // Colores: pisan las variables CSS de todas las páginas
  const c = S.colores, r = document.documentElement.style;
  r.setProperty('--navy', c.principal);
  r.setProperty('--text', c.principal);
  r.setProperty('--navy-dark', c.principalOscuro);
  r.setProperty('--navy-mid', c.principalMedio);
  r.setProperty('--gold', c.acento);
  r.setProperty('--gold-light', c.acentoClaro);
  r.setProperty('--gold-pale', c.acentoPalido);
  const rgb = function (h) { h = h.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }).join(','); };
  r.setProperty('--navy-rgb', rgb(c.principal));
  r.setProperty('--gold-rgb', rgb(c.acento));

  // Rellena el HTML: <span data-cfg="nombreCompleto"></span>
  //                  <a data-wa="Hola!">   -> link de WhatsApp
  function aplicar() {
    document.querySelectorAll('[data-cfg]').forEach(function (el) {
      const v = S[el.dataset.cfg];
      if (v !== undefined) el.textContent = v;
    });
    document.querySelectorAll('[data-wa]').forEach(function (el) {
      el.href = S.wa(el.dataset.wa.replace('{nombre}', S.nombreCompleto));
    });
    document.querySelectorAll('[data-cfg-href="web"]').forEach(function (el) { el.href = S.web; });
    document.querySelectorAll('[data-cfg-href="mail"]').forEach(function (el) { el.href = 'mailto:' + S.email; });
  }
  S.aplicar = aplicar;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicar);
  else aplicar();
})();
