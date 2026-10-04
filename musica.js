/* Música de fondo
   Botón flotante arriba a la derecha, debajo del menú. Arranca sola con la
   primera interacción del visitante; el botón sirve para silenciarla y esa
   elección se recuerda. Al cambiar de página retoma la obra donde quedó.
   La rotación (en orden o aleatoria, y cada cuántos minutos cambia de obra)
   se configura desde el admin, en la tabla "musica_config". Las obras salen de la tabla "musica" (solo las activas),
   en el orden de la lista, y van rotando. */
(function () {
  if (window.SITIO && window.SITIO.musica === false) return;
  if (window.__zurbanMusica) return;
  window.__zurbanMusica = true;

  const SUPABASE_URL = SITIO.supabase.url;
  const SUPABASE_KEY = SITIO.supabase.key;
  const KEY_ON = 'zurban_musica_on';
  const KEY_POS = 'zurban_musica_pos';
  // Volumen opcional por página: <script src="/musica.js" data-volumen="0.2" defer></script>
  const scriptTag = document.currentScript;
  const volAttr = scriptTag && scriptTag.dataset ? parseFloat(scriptTag.dataset.volumen) : NaN;
  const VOLUMEN = (volAttr > 0 && volAttr <= 1) ? volAttr : 0.25;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  const CSS = `
  .zm-wrap { position: fixed; top: 88px; right: 20px; z-index: 45; display: flex; flex-direction: row-reverse; align-items: center; gap: 10px; font-family: 'Jost', sans-serif; }
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
  .zm-label { background: rgba(17,31,51,0.92); color: #fff; font-size: 12px; font-weight: 300; letter-spacing: 0.04em; padding: 8px 14px; border-radius: 100px; border: 1px solid rgba(201,168,76,0.3); white-space: nowrap; max-width: 60vw; overflow: hidden; text-overflow: ellipsis; opacity: 0; transform: translateX(6px); transition: opacity 0.3s, transform 0.3s; pointer-events: none; }
  .zm-label.zm-show, .zm-wrap:hover .zm-label { opacity: 1; transform: none; }
  @media print { .zm-wrap { display: none !important; } }
  @media (prefers-reduced-motion: reduce) { .zm-barras i { animation: none; height: 12px; } }
  `;

  let pistas = [], idx = 0, audio, btn, label;
  let sonando = false, fallos = 0, fadeTimer = null, labelTimer = null;
  let modo = 'orden', limiteSeg = 0, tInicio = 0, cambiando = false;

  async function iniciar() {
    const headers = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY };
    try {
      const [r, rc] = await Promise.all([
        fetch(SUPABASE_URL + '/rest/v1/musica?select=titulo,compositor,interprete,url&activa=eq.true&order=orden.asc,created_at.asc', { headers }),
        fetch(SUPABASE_URL + '/rest/v1/musica_config?select=modo,minutos_por_obra&id=eq.1', { headers }).catch(() => null)
      ]);
      if (!r.ok) return;
      pistas = (await r.json()).filter(p => p.url);
      if (rc && rc.ok) {
        const cfg = (await rc.json())[0];
        if (cfg) {
          modo = cfg.modo === 'aleatorio' ? 'aleatorio' : 'orden';
          limiteSeg = Math.max(0, Number(cfg.minutos_por_obra) || 0) * 60;
        }
      }
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
    // Rotación por tiempo: pasado el límite, fundido suave a la obra siguiente
    audio.addEventListener('timeupdate', () => {
      if (!sonando || !limiteSeg || cambiando) return;
      const restante = (audio.duration || 0) - audio.currentTime;
      if (audio.currentTime - tInicio >= limiteSeg && restante > 5) {
        cambiando = true;
        fade(0, () => { cambiando = false; siguiente(); }, 0.01);
      }
    });
    audio.addEventListener('error', () => {
      if (++fallos < pistas.length) siguiente(); else estado(false);
    });

    // Retomar la obra y el segundo donde quedó
    let pos = null;
    try { pos = JSON.parse(store.get(KEY_POS) || 'null'); } catch (e) {}
    const i = pos && pos.url ? pistas.findIndex(p => p.url === pos.url) : -1;
    if (i >= 0) {
      idx = i;
      tInicio = Number(pos.t0) || 0;
      cargarPista(pos.t || 0);
    } else {
      idx = modo === 'aleatorio' ? Math.floor(Math.random() * pistas.length) : 0;
      cargarPista(0);
    }

    setInterval(guardar, 3000);
    window.addEventListener('pagehide', guardar);

    // Arranca sola con la primera interacción (clic, toque o tecla),
    // salvo que el visitante la haya silenciado antes con el botón.
    if (store.get(KEY_ON) !== '0') {
      const eventos = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'];
      let intentando = false;
      const quitar = () => eventos.forEach(ev => document.removeEventListener(ev, arrancar, true));
      const arrancar = (e) => {
        if (btn.contains(e.target) || sonando) { quitar(); return; }
        if (intentando) return;
        intentando = true;
        reproducir().then(ok => { intentando = false; if (ok) quitar(); });
      };
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
    cambiando = false;
    estado(false);
    store.set(KEY_ON, '0');
    guardar();
    fade(0, () => audio.pause());
  }

  function toggle() { sonando ? pausar() : reproducir(); }

  function elegirSiguiente() {
    if (modo === 'aleatorio' && pistas.length > 1) {
      let n;
      do { n = Math.floor(Math.random() * pistas.length); } while (n === idx);
      return n;
    }
    return (idx + 1) % pistas.length;
  }

  function siguiente() {
    idx = elegirSiguiente();
    tInicio = 0;
    cargarPista(0);
    if (sonando) audio.play().then(() => { fade(VOLUMEN, null, 0.01); mostrarLabel(); }).catch(() => {});
  }

  function estado(on) {
    sonando = on;
    btn.classList.toggle('zm-on', on);
    btn.setAttribute('aria-label', on ? 'Silenciar música' : 'Activar música');
    btn.title = on ? 'Silenciar música' : 'Activar música';
  }

  function fade(objetivo, alTerminar, paso) {
    const p = paso || 0.02;
    clearInterval(fadeTimer);
    fadeTimer = setInterval(() => {
      const d = objetivo - audio.volume;
      if (Math.abs(d) <= p) {
        audio.volume = objetivo;
        clearInterval(fadeTimer);
        if (alTerminar) alTerminar();
      } else {
        audio.volume = Math.min(1, Math.max(0, audio.volume + Math.sign(d) * p));
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
    store.set(KEY_POS, JSON.stringify({ url: pistas[idx].url, t: Math.floor(audio.currentTime || 0), t0: Math.floor(tInicio) }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
