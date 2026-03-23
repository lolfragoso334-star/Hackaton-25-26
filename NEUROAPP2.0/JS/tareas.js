/* ══════════════════════════════════════════════════════════════
   tareas.js — Vista de tareas NeuroVida + Supabase
══════════════════════════════════════════════════════════════ */

let tareas       = [];
let filtroActual = "todas";
let tareaActiva  = null;
let pasoActual   = 0;

/* ══════════════════════════════════════════════════════════════
   HELPERS — PICTOGRAMAS SVG
══════════════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════════════
   HELPERS — BARRA Y BADGE
══════════════════════════════════════════════════════════════ */
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
   ABRIR VISTA DETALLE
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
   RENDERIZADO — VISTA DETALLE
══════════════════════════════════════════════════════════════ */
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
    pictoArea.innerHTML = `<img src="${paso.imagen_url}" alt="${paso.instruccion_texto}" style="max-height:180px;border-radius:12px;object-fit:contain;"/>`;
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
   ACTUALIZAR ESTADO DE UN PASO — Supabase
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

  // Guardar en Supabase
  await sbActualizarEstadoPaso(pasoId, nuevoEstado);
  if (todosCompletos) {
    await sbFetch(`tareas?id=eq.${tareaId}`, {
      method: "PATCH",
      body: JSON.stringify({ estado: "completado" }),
    });
  } else {
    await sbFetch(`tareas?id=eq.${tareaId}`, {
      method: "PATCH",
      body: JSON.stringify({ estado: "en_progreso" }),
    });
  }
}

/* ══════════════════════════════════════════════════════════════
   EVENTOS — VISTA DETALLE
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
  if (pasoActual < tareaActiva.pasos.length - 1) pasoActual++;
  renderDetalle();
});

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
   MODAL AYUDA — enviar notificación a Supabase
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
    tareaTitulo: tareaActiva.titulo,
    pasoOrden:   paso.orden,
    pasoTexto:   paso.instruccion_texto,
    mensaje,
  });

  cerrarModal();
  const msgEl = document.getElementById("msg-enviado");
  msgEl.classList.remove("hidden");
  setTimeout(() => msgEl.classList.add("hidden"), 3000);
});

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
   INIT — carga desde Supabase
══════════════════════════════════════════════════════════════ */
(async () => {
  const { data, error } = await sbGetTareas();
  if (error) { console.error("Error cargando tareas:", error); return; }
  tareas = data;
  renderLista();
})();
