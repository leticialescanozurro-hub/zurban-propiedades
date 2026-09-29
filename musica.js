/* Zurban Propiedades – música de fondo
   Botón flotante abajo a la izquierda. Arranca apagado; si el visitante
   lo activa, la web lo recuerda y retoma la obra donde quedó al cambiar
   de página. Las obras salen de la tabla "musica" (solo las activas),
   en el orden de la lista, y van rotando. */
(function () {
  if (window.__zurbanMusica) return;
  window.__zurbanMusica = true;

  const SUPABASE_URL = 'https://zckcdetutyehebezsmlh.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_VnAm_RHVhMbsg5413toJxQ_aKBhKZqB';
  const KEY_ON = 'zurban_musica_on';
  const KEY_POS = 'zurban_musica_pos';
  const VOLUMEN = 0.35;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  const CSS = `
  .zm-wrap { position: fixed; left: 24px; bottom: 24px; z-index: 150; display: flex; align-items: center; gap: 10px; font-family: 'Jost', sans-serif; }
  .zm-btn { width: 48px; height: 48px; border-radius: 50%; background: #1A2E4A; border: 1.5px solid #C9A84C; color: #C9A84C; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; box-shadow: 0 4px 16px rgba(17,31,51,0.35); transition: transform 0.2s, background 0.2s; }
  .zm-btn:hover { transform: scale(1.06); background: #243d5c; }
  .zm-btn:focus-visible { outline: 2px solid #C9A84C; outline-offset: 3px; }
  .zm-nota { font-size: 22px; line-height: 1; }
  .zm-barras { display: none; align-items: flex-end; gap: 3px; height: 18px; }
  .zm-barras i { display: block; width: 3px; height: 8px; background: #C9A84C; border-radius: 1px; animation: zmBar 1.1s ease-in-out infinite; }
  .zm-barras i:nth-child(2) { animation-delay: 0.2s; }
  .zm-barras i:nth-child(3) { animation-delay: 0.4s; }
  .zm-on .zm-nota { display: none; }
  .zm-on .zm-barras { display: flex; }
  @keyframes zmBar { 0%, 100% { height: 5px; } 50% { height: 18px; } }
  .zm-label { background: rgba(17,31,51,0.92); color: #fff; font-size: 12px; font-weight: 300; letter-spacing: 0.04em; padding: 8px 14px; border-radius: 100px; border: 1px solid rgba(201,168,76,0.3); white-space: nowrap; max-width: 60vw; overflow: hidden; text-overflow: ellipsis; opacity: 0; transform: translateX(-6px); transition: opacity 0.3s, transform 0.3s; pointer-events: none; }
  .zm-label.zm-show, .zm-wrap:hover .zm-label { opacity: 1; transform: none; }
  @media (prefers-reduced-motion: reduce) { .zm-barras i { animation: none; height: 12px; } }
  `;

  let pistas = [], idx = 0, audio, btn, label;
  let sonando = false, fallos = 0, fadeTimer = null, labelTimer = null;

  async function iniciar() {
    try {
      const r = await fetch(SUPABASE_URL + '/rest/v1/musica?select=titulo,compositor,interprete,url&activa=eq.true&order=orden.asc,created_at.asc', {
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
      });
      if (!r.ok) return;
      pistas = (await r.json()).filter(p => p.url);
    } catch (e) { return; }
    if (pistas.length === 0) return; // sin obras activas: no aparece el botón
    montar();
  }

  function montar() {
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    const wrap = document.createElement('div');
    wrap.className = 'zm-wrap';
    wrap.innerHTML = '<button class="zm-btn" type="button" aria-label="Activar música"><span class="zm-nota" aria-hidden="true">♪</span><span class="zm-barras" aria-hidden="true"><i></i><i></i><i></i></span></button><div class="zm-label" aria-live="polite"></div>';
    document.body.appendChild(wrap);
    btn = wrap.querySelector('.zm-btn');
    label = wrap.querySelector('.zm-label');
    btn.addEventListener('click', toggle);

    audio = new Audio();
    audio.preload = 'none';
    audio.volume = 0;
    audio.addEventListener('ended', siguiente);
    audio.addEventListener('playing', () => { fallos = 0; });
    audio.addEventListener('error', () => {
      if (++fallos < pistas.length) siguiente(); else estado(false);
    });

    // Retomar la obra y el segundo donde quedó
    let pos = null;
    try { pos = JSON.parse(store.get(KEY_POS) || 'null'); } catch (e) {}
    const i = pos && pos.url ? pistas.findIndex(p => p.url === pos.url) : -1;
    idx = i >= 0 ? i : 0;
    cargarPista(i >= 0 ? (pos.t || 0) : 0);

    setInterval(guardar, 3000);
    window.addEventListener('pagehide', guardar);

    // Si la había activado antes, arranca con el primer toque en la página
    if (store.get(KEY_ON) === '1') {
      const eventos = ['pointerdown', 'keydown', 'touchstart'];
      const quitar = () => eventos.forEach(ev => document.removeEventListener(ev, arrancar, true));
      const arrancar = (e) => { quitar(); if (btn.contains(e.target)) return; reproducir(); };
      eventos.forEach(ev => document.addEventListener(ev, arrancar, true));
      reproducir().then(ok => { if (ok) quitar(); });
    }
  }

  function textoPista() {
    const p = pistas[idx];
    return (p.compositor ? p.compositor + ' – ' : '') + p.titulo + (p.interprete ? ' · ' + p.interprete : '');
  }

  function cargarPista(t) {
    audio.src = pistas[idx].url;
    label.textContent = '♪ ' + textoPista();
    if (t > 0) {
      audio.addEventListener('loadedmetadata', () => {
        try { if (!audio.duration || t < audio.duration - 2) audio.currentTime = t; } catch (e) {}
      }, { once: true });
    }
  }

  async function reproducir() {
    try { await audio.play(); } catch (e) { return false; }
    estado(true);
    store.set(KEY_ON, '1');
    fade(VOLUMEN);
    mostrarLabel();
    return true;
  }

  function pausar() {
    estado(false);
    store.set(KEY_ON, '0');
    guardar();
    fade(0, () => audio.pause());
  }

  function toggle() { sonando ? pausar() : reproducir(); }

  function siguiente() {
    idx = (idx + 1) % pistas.length;
    cargarPista(0);
    if (sonando) audio.play().then(mostrarLabel).catch(() => {});
  }

  function estado(on) {
    sonando = on;
    btn.classList.toggle('zm-on', on);
    btn.setAttribute('aria-label', on ? 'Pausar música' : 'Activar música');
  }

  function fade(objetivo, alTerminar) {
    clearInterval(fadeTimer);
    fadeTimer = setInterval(() => {
      const d = objetivo - audio.volume;
      if (Math.abs(d) <= 0.02) {
        audio.volume = objetivo;
        clearInterval(fadeTimer);
        if (alTerminar) alTerminar();
      } else {
        audio.volume = Math.min(1, Math.max(0, audio.volume + Math.sign(d) * 0.02));
      }
    }, 40);
  }

  function mostrarLabel() {
    label.textContent = '♪ ' + textoPista();
    label.classList.add('zm-show');
    clearTimeout(labelTimer);
    labelTimer = setTimeout(() => label.classList.remove('zm-show'), 5000);
  }

  function guardar() {
    if (!audio || !audio.src) return;
    if (!sonando && !audio.currentTime) return; // no pisar la posición guardada antes de arrancar
    store.set(KEY_POS, JSON.stringify({ url: pistas[idx].url, t: Math.floor(audio.currentTime || 0) }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
