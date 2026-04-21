/* ══════════════════════════════════════════════════════════════
   ajustes.js — Panel de accesibilidad global NeuroVida
   Persistencia: Supabase (por usuario) + localStorage (caché offline)
══════════════════════════════════════════════════════════════ */

const AJUSTES_KEY = "neurovida_ajustes";

const DEFAULTS = {
  tamano:    "normal",
  fuente:    "dislexia",
  contraste: false,
};

/* ── Caché local ─────────────────────────────────────────────── */
function _leerLocal() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(AJUSTES_KEY)) }; }
  catch { return { ...DEFAULTS }; }
}
function _escribirLocal(a) { localStorage.setItem(AJUSTES_KEY, JSON.stringify(a)); }

/* ── ID del usuario activo ───────────────────────────────────── */
function _usuarioId() {
  try { return JSON.parse(sessionStorage.getItem("neurovida_session"))?.id || null; }
  catch { return null; }
}

/* ── Cargar desde Supabase ───────────────────────────────────── */
async function _cargarDesdeServidor() {
  const uid = _usuarioId();
  if (!uid || typeof sbGetAjustes === "undefined") return _leerLocal();
  try {
    const { data } = await sbGetAjustes(uid);
    if (data) {
      const a = { tamano: data.tamano || DEFAULTS.tamano, fuente: data.fuente || DEFAULTS.fuente, contraste: data.contraste ?? DEFAULTS.contraste };
      _escribirLocal(a);
      return a;
    }
  } catch(e) { console.warn("[ajustes] Sin conexión, usando local:", e); }
  return _leerLocal();
}

/* ── Guardar (local inmediato + servidor async) ──────────────── */
function guardarAjustes(a) {
  _escribirLocal(a);
  if (_usuarioId() && typeof sbGuardarAjustes !== "undefined") {
    sbGuardarAjustes(_usuarioId(), a).catch(e => console.warn("[ajustes] Error al guardar:", e));
  }
}

/* ── Aplicar al DOM ──────────────────────────────────────────── */
function aplicarAjustes(a) {
  const root  = document.documentElement;
  // Cambiamos font-size en <html> para que todo rem escale en cascada
  const escala = { "pequeno":"12px", "normal":"16px", "grande":"20px", "muy-grande":"24px" };
  document.documentElement.style.fontSize = escala[a.tamano] || "16px";
  root.style.setProperty("--font-size-base", escala[a.tamano] || "16px");

  const fontVal = a.fuente === "normal"
    ? "'Inter','Segoe UI',system-ui,sans-serif"
    : "'OpenDyslexic','Comic Sans MS',cursive";
  root.style.setProperty("--font", fontVal);
  root.style.setProperty("--font-ui", fontVal);
  document.body.style.fontFamily = fontVal;

  document.body.classList.toggle("alto-contraste", !!a.contraste);
}

/* ── Inter de Google Fonts ───────────────────────────────────── */
function inyectarInter() {
  if (document.getElementById("inter-font")) return;
  const l = document.createElement("link");
  l.id = "inter-font"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap";
  document.head.appendChild(l);
}

/* ── Sincronizar UI del panel con ajustes ────────────────────── */
function _syncUI(a) {
  document.querySelectorAll(".ajustes-tamano-btn").forEach(b => b.classList.toggle("activo", b.dataset.tamano === a.tamano));
  document.querySelectorAll(".ajustes-fuente-btn").forEach(b => b.classList.toggle("activo", b.dataset.fuente === a.fuente));
  const tog = document.getElementById("toggle-contraste");
  if (tog) { tog.setAttribute("aria-checked", a.contraste ? "true":"false"); tog.classList.toggle("on", !!a.contraste); }
}

/* ── Indicador de guardado ───────────────────────────────────── */
function _sync(txt, ms = 2000) {
  const el = document.getElementById("ajustes-sync");
  const tx = document.getElementById("ajustes-sync-texto");
  if (!el || !tx) return;
  tx.textContent = txt; el.style.display = "block";
  clearTimeout(_sync._t);
  _sync._t = setTimeout(() => { el.style.display = "none"; }, ms);
}

/* ── Crear panel HTML ────────────────────────────────────────── */
function crearPanelAjustes() {
  if (document.getElementById("panel-ajustes")) return;
  const p = document.createElement("div");
  p.id = "panel-ajustes";
  p.setAttribute("role","dialog"); p.setAttribute("aria-modal","true");
  p.setAttribute("aria-label","Ajustes de accesibilidad");
  p.className = "ajustes-panel";
  p.innerHTML = `
    <div class="ajustes-overlay" id="ajustes-overlay"></div>
    <div class="ajustes-drawer">
      <div class="ajustes-header">
        <span class="ajustes-titulo">⚙️ Ajustes</span>
        <button class="ajustes-cerrar" id="ajustes-cerrar" aria-label="Cerrar">✕</button>
      </div>
      <div class="ajustes-sync" id="ajustes-sync" style="display:none">
        <span id="ajustes-sync-texto">💾 Guardando…</span>
      </div>
      <div class="ajustes-seccion">
        <p class="ajustes-label">Tamaño de texto</p>
        <div class="ajustes-tamano-row" role="group">
          <button class="ajustes-tamano-btn"           data-tamano="pequeno"   >A<span>Pequeño</span></button>
          <button class="ajustes-tamano-btn"           data-tamano="normal"    >A<span>Normal</span></button>
          <button class="ajustes-tamano-btn grande"    data-tamano="grande"    >A<span>Grande</span></button>
          <button class="ajustes-tamano-btn muy-grande" data-tamano="muy-grande">A<span>Muy grande</span></button>
        </div>
      </div>
      <div class="ajustes-seccion">
        <p class="ajustes-label">Tipo de letra</p>
        <div class="ajustes-fuente-row">
          <button class="ajustes-fuente-btn" data-fuente="dislexia">
            <span class="fuente-muestra fuente-dislexia">Aa</span>
            <span class="fuente-nombre">OpenDyslexic</span>
            <span class="fuente-desc">Para dislexia</span>
          </button>
          <button class="ajustes-fuente-btn" data-fuente="normal">
            <span class="fuente-muestra fuente-inter">Aa</span>
            <span class="fuente-nombre">Inter</span>
            <span class="fuente-desc">Estándar</span>
          </button>
        </div>
      </div>
      <div class="ajustes-seccion">
        <div class="ajustes-toggle-row">
          <div>
            <p class="ajustes-label" style="margin-bottom:2px">Alto contraste</p>
            <p class="ajustes-hint">Más diferencia entre colores</p>
          </div>
          <button class="ajustes-toggle" id="toggle-contraste" role="switch" aria-checked="false">
            <span class="toggle-thumb"></span>
          </button>
        </div>
      </div>
      <div class="ajustes-separador"></div>
      <div class="ajustes-seccion">
        <button class="ajustes-logout-btn" id="ajustes-btn-logout">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Cerrar sesión
        </button>
      </div>
    </div>`;
  document.body.appendChild(p);
}

/* ── Bind eventos (solo una vez) ─────────────────────────────── */
function _bindEvents() {
  document.getElementById("ajustes-cerrar").addEventListener("click", cerrarAjustes);
  document.getElementById("ajustes-overlay").addEventListener("click", cerrarAjustes);
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { cerrarAjustes(); document.removeEventListener("keydown", esc); }
  });

  document.querySelectorAll(".ajustes-tamano-btn").forEach(btn => btn.addEventListener("click", () => {
    const a = _leerLocal(); a.tamano = btn.dataset.tamano;
    aplicarAjustes(a); guardarAjustes(a); _syncUI(a); _sync("✅ Guardado en tu cuenta");
  }));

  document.querySelectorAll(".ajustes-fuente-btn").forEach(btn => btn.addEventListener("click", () => {
    const a = _leerLocal(); a.fuente = btn.dataset.fuente;
    aplicarAjustes(a); guardarAjustes(a); _syncUI(a); _sync("✅ Guardado en tu cuenta");
  }));

  document.getElementById("toggle-contraste").addEventListener("click", () => {
    const a = _leerLocal(); a.contraste = !a.contraste;
    aplicarAjustes(a); guardarAjustes(a); _syncUI(a); _sync("✅ Guardado en tu cuenta");
  });

  document.getElementById("ajustes-btn-logout").addEventListener("click", () => {
    cerrarAjustes(); logout();
  });
}

/* ── Abrir ───────────────────────────────────────────────────── */
async function abrirAjustes() {
  inyectarInter();
  crearPanelAjustes();

  const panel = document.getElementById("panel-ajustes");
  if (!panel.dataset.bound) { _bindEvents(); panel.dataset.bound = "1"; }

  // Mostrar inmediatamente con datos locales
  _syncUI(_leerLocal());
  panel.classList.add("abierto");
  document.getElementById("ajustes-cerrar").focus();

  // Sincronizar con servidor y actualizar si hay diferencias
  const servidor = await _cargarDesdeServidor();
  const local    = _leerLocal();
  if (JSON.stringify(servidor) !== JSON.stringify(local)) {
    aplicarAjustes(servidor);
    _syncUI(servidor);
    _escribirLocal(servidor);
  }
}

/* ── Cerrar ──────────────────────────────────────────────────── */
function cerrarAjustes() {
  const p = document.getElementById("panel-ajustes");
  if (p) p.classList.remove("abierto");
}

/* ══════════════════════════════════════════════════════════════
   INIT — ejecuta al cargar cada página
══════════════════════════════════════════════════════════════ */
(function initAjustes() {
  inyectarInter();
  aplicarAjustes(_leerLocal()); // aplica local sin esperar red (sin parpadeo)

  document.addEventListener("DOMContentLoaded", async () => {
    if (!_usuarioId()) return;
    const a = await _cargarDesdeServidor();
    aplicarAjustes(a); // reaplica si el servidor tenía algo diferente
  });
})();
