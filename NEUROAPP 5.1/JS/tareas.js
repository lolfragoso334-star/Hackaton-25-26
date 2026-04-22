/* ══════════════════════════════════════════════════════════════
   tareas.js — Vista de tareas NeuroVida + Supabase
══════════════════════════════════════════════════════════════ */

let tareas       = [];
let filtroActual = "todas";
let tareaActiva  = null;
let pasoActual   = 0;

function svgCheck() {
  return `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
    <circle cx="50" cy="50" r="45" fill="#009E73"/>
    <path d="M25 50 L42 67 L75 33" stroke="white" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function svgTask(estado) {
  const color = estado === "completado" ? "#009E73" : estado === "en_progreso" ? "#0072B2" : "#A09080";
  return `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
    <rect x="15" y="10" width="70" height="80" rx="10" fill="${color}" opacity="0.2" stroke="${color}" stroke-width="4"/>
    <rect x="28" y="30" width="44" height="7" rx="3.5" fill="${color}"/>
    <rect x="28" y="46" width="35" height="7" rx="3.5" fill="${color}"/>
    <rect x="28" y="62" width="26" height="7" rx="3.5" fill="${color}"/>
  </svg>`;
}

function calcProgreso(pasos) {
  const total  = pasos.length;
  const hechos = pasos.filter(p => p.estado === "completado").length;
  const pct    = total > 0 ? Math.round((hechos / total) * 100) : 0;
  return { total, hechos, pct };
}

function htmlBadge(estado) {
  const cfg = {
    completado:  { cls: "estado-completado",  label: "✓ Listo" },
    en_progreso: { cls: "estado-en_progreso", label: "▶ En curso" },
    pendiente:   { cls: "estado-pendiente",   label: "○ Pendiente" },
  };
  const c = cfg[estado] || cfg.pendiente;
  return `<span class="estado-badge ${c.cls}">${c.label}</span>`;
}

/* ══════════════════════════════════════════════════════════════
   RENDERIZADO — LISTA DE TAREAS
══════════════════════════════════════════════════════════════ */
function renderLista() {
  const lista      = document.getElementById("lista-tareas");
  const vacia      = document.getElementById("lista-vacia");
  const totalBadge = document.getElementById("total-completadas");

  totalBadge.textContent = tareas.filter(t => t.estado === "completado").length;

  const filtradas = tareas.filter(t =>
    filtroActual === "todas" || t.estado === filtroActual
  );

  lista.innerHTML = "";

  if (filtradas.length === 0) { vacia.classList.remove("hidden"); return; }
  vacia.classList.add("hidden");

  filtradas.forEach(tarea => {
    const { total, hechos, pct } = calcProgreso(tarea.pasos || []);

    const btn = document.createElement("button");
    btn.className = "tarjeta-tarea";
    btn.setAttribute("aria-label", `Abrir tarea: ${tarea.titulo}`);
    btn.innerHTML = `
      <div class="tarjeta-picto">${svgTask(tarea.estado)}</div>
      <div class="tarjeta-body">
        <div class="tarjeta-row">
          <h3 class="tarjeta-titulo">${tarea.titulo}</h3>
          ${htmlBadge(tarea.estado)}
        </div>
        <p class="tarjeta-desc">${tarea.descripcion || ""}</p>
        <div class="barra-progreso-wrap">
          <div class="barra-meta">
            <span class="barra-hechos-label">${hechos} de ${total} pasos</span>
            <span class="barra-pct-label">${pct}%</span>
          </div>
          <div class="barra-track">
            <div class="barra-fill" style="width:${pct}%"></div>
          </div>
        </div>
      </div>
    `;
    btn.addEventListener("click", () => abrirDetalle(tarea.id));
    lista.appendChild(btn);
  });
}

/* ══════════════════════════════════════════════════════════════
   DETALLE
══════════════════════════════════════════════════════════════ */
function abrirDetalle(tareaId) {
  tareaActiva = tareas.find(t => t.id === tareaId);
  if (!tareaActiva) return;

  const primerPendiente = (tareaActiva.pasos || []).findIndex(p => p.estado !== "completado");
  pasoActual = primerPendiente >= 0 ? primerPendiente : 0;

  document.getElementById("vista-lista").classList.add("hidden");
  document.getElementById("vista-detalle").classList.remove("hidden");
  window.scrollTo(0, 0);
  renderDetalle();
}

/* ══════════════════════════════════════════════════════════════
   HELPER — Resuelve el tipo de media y devuelve el HTML adecuado
   Soporta: YouTube, Vimeo, imágenes directas, vídeos directos,
   Google Drive, OneDrive, Dropbox y cualquier URL externa genérica.
══════════════════════════════════════════════════════════════ */
function resolverMedia(url, alt) {
  if (!url) return "";

  // ── YouTube ────────────────────────────────────────────────────
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
  );
  if (ytMatch) {
    const id = ytMatch[1];
    return `<iframe class="media-iframe"
      src="https://www.youtube.com/embed/${id}?rel=0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen title="${alt || 'Vídeo'}"></iframe>`;
  }

  // ── Vimeo ──────────────────────────────────────────────────────
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
  if (vimeoMatch) {
    return `<iframe class="media-iframe"
      src="https://player.vimeo.com/video/${vimeoMatch[1]}"
      allow="autoplay; fullscreen; picture-in-picture"
      allowfullscreen title="${alt || 'Vídeo'}"></iframe>`;
  }

  // ── Google Drive (vista previa) ────────────────────────────────
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveMatch) {
    return `<iframe class="media-iframe"
      src="https://drive.google.com/file/d/${driveMatch[1]}/preview"
      allow="autoplay" allowfullscreen title="${alt || 'Archivo'}"></iframe>`;
  }

  // ── Dropbox (convertir a enlace directo) ───────────────────────
  if (url.includes("dropbox.com")) {
    const directUrl = url.replace(/[?&]dl=0/, "").replace("www.dropbox.com", "dl.dropboxusercontent.com");
    const esVideoDropbox = /\.(mp4|webm|ogg)/i.test(directUrl);
    return esVideoDropbox
      ? `<video class="media-video" src="${directUrl}" controls></video>`
      : `<img class="media-img" src="${directUrl}" alt="${alt || ''}"/>`;
  }

  // ── Vídeo directo (mp4, webm, ogg) ────────────────────────────
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) {
    return `<video class="media-video" src="${url}" controls></video>`;
  }

  // ── Imagen directa ─────────────────────────────────────────────
  if (/\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(url)) {
    return `<img class="media-img" src="${url}" alt="${alt || ''}"/>`;
  }

  // ── Fallback genérico: iframe (OneDrive, otros embeds, etc.) ──
  return `<iframe class="media-iframe" src="${url}"
    allowfullscreen title="${alt || 'Contenido externo'}"></iframe>`;
}

function renderDetalle() {
  if (!tareaActiva) return;
  const pasos = tareaActiva.pasos || [];
  const paso  = pasos[pasoActual];
  const { total, hechos, pct } = calcProgreso(pasos);

  document.getElementById("detalle-titulo").textContent = tareaActiva.titulo;
  document.getElementById("barra-hechos").textContent   = `${hechos} de ${total} pasos`;
  document.getElementById("barra-pct").textContent      = `${pct}%`;
  document.getElementById("barra-fill").style.width     = `${pct}%`;

  const indicador = document.getElementById("indicador-pasos");
  indicador.innerHTML = "";
  pasos.forEach((p, i) => {
    const b = document.createElement("button");
    b.className = "paso-bolita";
    b.setAttribute("role", "listitem");
    b.setAttribute("aria-label", `Paso ${i + 1}`);
    if (p.estado === "completado") b.classList.add("completado");
    if (i === pasoActual)          b.classList.add("activo");
    b.textContent = p.estado === "completado" ? "✓" : i + 1;
    b.addEventListener("click", () => { pasoActual = i; renderDetalle(); });
    indicador.appendChild(b);
  });

  const circulo = document.getElementById("paso-num-circulo");
  circulo.textContent = paso.estado === "completado" ? "✓" : paso.orden;
  circulo.className   = "paso-num-circulo" + (paso.estado === "completado" ? " completado" : "");

  document.getElementById("paso-de").textContent = `Paso ${paso.orden} de ${total}`;
  paso.es_critico
    ? document.getElementById("paso-critico").classList.remove("hidden")
    : document.getElementById("paso-critico").classList.add("hidden");

  const pictoArea = document.getElementById("picto-area");
  const pictoHint = document.querySelector(".picto-hint");
  if (paso.imagen_url) {
    pictoArea.innerHTML = resolverMedia(paso.imagen_url, paso.instruccion_texto);
    pictoHint.style.display = "none";
  } else {
    pictoArea.innerHTML = paso.estado === "completado" ? svgCheck() : svgTask(paso.estado);
    pictoHint.style.display = "";
  }

  document.getElementById("instruccion-texto").textContent = paso.instruccion_texto;
  document.getElementById("msg-enviado").classList.add("hidden");

  paso.estado === "completado"
    ? document.getElementById("btn-completar").classList.add("hidden")
    : document.getElementById("btn-completar").classList.remove("hidden");

  document.getElementById("btn-anterior").disabled = pasoActual === 0;
  document.getElementById("btn-siguiente").disabled = pasoActual === pasos.length - 1;
}

/* ══════════════════════════════════════════════════════════════
   ACTUALIZAR PASO
══════════════════════════════════════════════════════════════ */
async function actualizarPaso(tareaId, pasoId, nuevoEstado) {
  const tarea = tareas.find(t => t.id === tareaId);
  if (!tarea) return;

  const pasoIdx = tarea.pasos.findIndex(p => p.id === pasoId);
  if (pasoIdx < 0) return;

  tarea.pasos[pasoIdx].estado = nuevoEstado;
  const todosCompletos = tarea.pasos.every(p => p.estado === "completado");
  tarea.estado = todosCompletos ? "completado" : "en_progreso";
  tareaActiva  = tarea;

  await sbActualizarEstadoPaso(pasoId, nuevoEstado);
  await sbFetch(`tareas?id=eq.${tareaId}`, {
    method: "PATCH",
    body: JSON.stringify({ estado: todosCompletos ? "completado" : "en_progreso" }),
  });
}

/* ══════════════════════════════════════════════════════════════
   EVENTOS
══════════════════════════════════════════════════════════════ */
document.getElementById("btn-volver").addEventListener("click", () => {
  document.getElementById("vista-detalle").classList.add("hidden");
  document.getElementById("vista-lista").classList.remove("hidden");
  tareaActiva = null;
  renderLista();
});

document.getElementById("btn-completar").addEventListener("click", async () => {
  if (!tareaActiva) return;
  const paso = tareaActiva.pasos[pasoActual];
  await actualizarPaso(tareaActiva.id, paso.id, "completado");

  // Métrica: el usuario completó el paso sin pedir ayuda
  sbRegistrarMetricaAutonomia(_session.id, tareaActiva.id, paso.id, "paso_solo");

  // ¿Era el último paso? → pantalla de celebración
  const todosCompletos = tareaActiva.pasos.every(p => p.estado === "completado");
  if (todosCompletos) {
    mostrarCelebracion(tareaActiva);
    return;
  }

  if (pasoActual < tareaActiva.pasos.length - 1) pasoActual++;
  renderDetalle();
});

/* ══════════════════════════════════════════════════════════════
   PANTALLA DE CELEBRACIÓN
══════════════════════════════════════════════════════════════ */
function mostrarCelebracion(tarea) {
  const pasos       = tarea.pasos || [];
  const totalPasos  = pasos.length;
  // Contar cuántos completó solo (sin ayuda) — aproximado: todos los que no tienen notificación
  // Usamos totalPasos como dato principal; el especialista verá el desglose exacto
  const nombreTarea = tarea.titulo;

  // Calcular pasos solos de esta sesión comparando métricas si estuvieran disponibles
  // Por ahora mostramos el total de pasos como logro
  const vista = document.createElement("div");
  vista.id = "vista-celebracion";
  vista.setAttribute("role", "dialog");
  vista.setAttribute("aria-modal", "true");
  vista.setAttribute("aria-label", "¡Tarea completada!");

  // Confeti — 30 partículas con colores de la paleta NeuroVida
  const colores = ["#F0E442","#FFFDF7","rgba(255,255,255,0.6)","#56B4E9","#E69F00"];
  let confeti = "";
  for (let i = 0; i < 30; i++) {
    const color  = colores[i % colores.length];
    const left   = Math.random() * 100;
    const delay  = (Math.random() * 1.4).toFixed(2);
    const dur    = (1.8 + Math.random() * 0.8).toFixed(2);
    const rot    = Math.random() > 0.5 ? "rotate(45deg)" : "skew(15deg)";
    confeti += `<span style="left:${left}%;background:${color};animation-delay:${delay}s;animation-duration:${dur}s;transform:${rot}"></span>`;
  }

  vista.innerHTML = `
    <div class="cel-confeti">${confeti}</div>

    <div class="cel-circulo" aria-hidden="true">🏆</div>

    <h1 class="cel-titulo">¡Lo has conseguido!</h1>
    <p class="cel-nombre-tarea">${nombreTarea}</p>

    <div class="cel-stats">
      <div class="cel-stat">
        <span class="cel-stat-num">${totalPasos}</span>
        <span class="cel-stat-lbl">Pasos completados</span>
      </div>
      <div class="cel-stat">
        <span class="cel-stat-num">100%</span>
        <span class="cel-stat-lbl">Completado</span>
      </div>
    </div>

    <button class="cel-btn-volver" id="cel-btn-volver">
      ← Volver a mis tareas
    </button>
  `;

  document.body.appendChild(vista);

  // Foco accesible
  vista.querySelector("#cel-btn-volver").focus();

  // Botón volver
  vista.querySelector("#cel-btn-volver").addEventListener("click", () => {
    vista.remove();
    document.getElementById("vista-detalle").classList.add("hidden");
    document.getElementById("vista-lista").classList.remove("hidden");
    tareaActiva = null;
    renderLista();
  });

  // También con Escape
  const onKey = (e) => {
    if (e.key === "Escape") {
      vista.remove();
      document.removeEventListener("keydown", onKey);
      document.getElementById("vista-detalle").classList.add("hidden");
      document.getElementById("vista-lista").classList.remove("hidden");
      tareaActiva = null;
      renderLista();
    }
  };
  document.addEventListener("keydown", onKey);
}

document.getElementById("btn-anterior").addEventListener("click", () => {
  if (pasoActual > 0) { pasoActual--; renderDetalle(); }
});

document.getElementById("btn-siguiente").addEventListener("click", () => {
  if (tareaActiva && pasoActual < tareaActiva.pasos.length - 1) { pasoActual++; renderDetalle(); }
});

document.getElementById("btn-ayuda").addEventListener("click", () => {
  if (!tareaActiva) return;
  const paso = tareaActiva.pasos[pasoActual];
  document.getElementById("modal-subtitulo").textContent = `Paso ${paso.orden}: ${paso.instruccion_texto}`;
  document.getElementById("modal-textarea").value = "";
  document.getElementById("modal-enviar").disabled = true;
  document.getElementById("modal-ayuda").classList.remove("hidden");
  document.getElementById("modal-textarea").focus();
});

/* ══════════════════════════════════════════════════════════════
   MODAL AYUDA
══════════════════════════════════════════════════════════════ */
function cerrarModal() {
  document.getElementById("modal-ayuda").classList.add("hidden");
}

document.getElementById("modal-cancelar").addEventListener("click", cerrarModal);
document.getElementById("modal-ayuda").addEventListener("click", e => {
  if (e.target === e.currentTarget) cerrarModal();
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") cerrarModal();
});
document.getElementById("modal-textarea").addEventListener("input", function () {
  document.getElementById("modal-enviar").disabled = !this.value.trim();
});

document.getElementById("modal-enviar").addEventListener("click", async () => {
  const mensaje = document.getElementById("modal-textarea").value.trim();
  if (!mensaje) return;

  const paso = tareaActiva.pasos[pasoActual];
  await sbCrearNotificacion({
    tareaTitulo:   tareaActiva.titulo,
    pasoOrden:     paso.orden,
    pasoTexto:     paso.instruccion_texto,
    mensaje,
    usuarioNombre: _session.nombre,   // ← nombre real del usuario
  });

  // Métrica: el usuario pidió ayuda en este paso
  sbRegistrarMetricaAutonomia(_session.id, tareaActiva.id, paso.id, "ayuda_solicitada");

  cerrarModal();
  mostrarConfirmacionAyuda();
});

/* ══════════════════════════════════════════════════════════════
   PANTALLA DE CONFIRMACIÓN DE AYUDA
══════════════════════════════════════════════════════════════ */
function mostrarConfirmacionAyuda() {
  // Evitar duplicados
  const existente = document.getElementById("vista-confirmacion-ayuda");
  if (existente) existente.remove();

  const vista = document.createElement("div");
  vista.id = "vista-confirmacion-ayuda";
  vista.setAttribute("role", "dialog");
  vista.setAttribute("aria-modal", "true");
  vista.setAttribute("aria-label", "Ayuda enviada");

  const nombre = _session?.nombre?.split(" ")[0] || "aquí";

  vista.innerHTML = `
    <div class="conf-circulo" aria-hidden="true">💙</div>
    <h1 class="conf-titulo">¡Tu monitor ya lo sabe!</h1>
    <p class="conf-subtitulo">
      Hemos avisado a tu equipo. Puedes seguir tranquilo o tranquila mientras llega la ayuda.
    </p>
    <div class="conf-barra-wrap">
      <div class="conf-barra"></div>
    </div>
    <button class="conf-btn-continuar" id="conf-btn-continuar">
      Entendido, continuar 👍
    </button>
  `;

  document.body.appendChild(vista);

  // Foco accesible
  vista.querySelector("#conf-btn-continuar").focus();

  // Cerrar al pulsar el botón
  const cerrar = () => {
    vista.style.animation = "conf-entrada 0.25s ease reverse";
    setTimeout(() => vista.remove(), 220);
  };

  vista.querySelector("#conf-btn-continuar").addEventListener("click", cerrar);

  // Auto-cierre a los 5 segundos (sincronizado con la barra)
  const timer = setTimeout(cerrar, 5000);

  // Si pulsan antes, cancelar el timer
  vista.querySelector("#conf-btn-continuar").addEventListener("click", () => clearTimeout(timer), { once: true });
}

/* ══════════════════════════════════════════════════════════════
   FILTROS
══════════════════════════════════════════════════════════════ */
document.querySelectorAll(".filtro-btn").forEach(btn => {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".filtro-btn").forEach(b => b.classList.remove("active"));
    this.classList.add("active");
    filtroActual = this.dataset.filtro;
    renderLista();
  });
});

/* ══════════════════════════════════════════════════════════════
   INIT — solo para trabajadores (en admin el elemento no existe)
══════════════════════════════════════════════════════════════ */
(async () => {
  if (!document.getElementById("lista-tareas")) return; // admin o página sin lista
  if (typeof _session === "undefined" || _session.rol === "admin") return;

  const { data, error } = await sbGetTareas(_session.id);
  if (error) { console.error("Error cargando tareas:", error); return; }
  tareas = data;
  renderLista();
})();
