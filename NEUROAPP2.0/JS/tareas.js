/* ══════════════════════════════════════════════════════════════
   DATOS — se leen del localStorage (guardado por el panel admin)
   Si no hay nada guardado todavía, se usa el mock de ejemplo.
   TODO: sustituir por fetch GET /api/tareas cuando haya BD real.
══════════════════════════════════════════════════════════════ */
const STORAGE_KEY = "neurovida_tareas";

const MOCK_FALLBACK = [
  {
    id: "1",
    titulo: "Montar servidor",
    descripcion: "Instalar y configurar el servidor principal",
    estado: "en_progreso",
    pasos: [
      { id: "p1", orden: 1, instruccion_texto: "Abre la caja del servidor con cuidado",   imagen_url: null, es_critico: true,  estado: "completado" },
      { id: "p2", orden: 2, instruccion_texto: "Conecta los cables de alimentación",       imagen_url: null, es_critico: true,  estado: "en_progreso" },
      { id: "p3", orden: 3, instruccion_texto: "Enciende el servidor con el botón verde",  imagen_url: null, es_critico: false, estado: "pendiente" },
      { id: "p4", orden: 4, instruccion_texto: "Espera que aparezca la luz azul",          imagen_url: null, es_critico: false, estado: "pendiente" },
    ],
  },
  {
    id: "2",
    titulo: "Organizar almacén",
    descripcion: "Clasificar y ordenar los materiales del almacén",
    estado: "pendiente",
    pasos: [
      { id: "p5", orden: 1, instruccion_texto: "Coge la lista de materiales de la mesa",     imagen_url: null, es_critico: false, estado: "pendiente" },
      { id: "p6", orden: 2, instruccion_texto: "Agrupa las cajas por color",                 imagen_url: null, es_critico: false, estado: "pendiente" },
      { id: "p7", orden: 3, instruccion_texto: "Coloca las cajas en la estantería correcta", imagen_url: null, es_critico: true,  estado: "pendiente" },
    ],
  },
  {
    id: "3",
    titulo: "Revisar inventario",
    descripcion: "Contar y anotar el stock disponible",
    estado: "completado",
    pasos: [
      { id: "p8", orden: 1, instruccion_texto: "Abre la hoja de inventario", imagen_url: null, es_critico: false, estado: "completado" },
      { id: "p9", orden: 2, instruccion_texto: "Cuenta cada producto",       imagen_url: null, es_critico: false, estado: "completado" },
    ],
  },
];

function cargarTareasDesdeStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const datos = JSON.parse(raw);
      if (Array.isArray(datos) && datos.length > 0) return JSON.parse(JSON.stringify(datos));
    } catch(e) {}
  }
  return JSON.parse(JSON.stringify(MOCK_FALLBACK));
}

function guardarEstadoEnStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tareas));
}

/* ══════════════════════════════════════════════════════════════
   ESTADO DE LA APLICACIÓN
══════════════════════════════════════════════════════════════ */
let tareas       = cargarTareasDesdeStorage();
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
    bloqueado:   { cls: "estado-bloqueado",   label: "✕ Bloqueado" },
  };
  const c = cfg[estado] || cfg.pendiente;
  return `<span class="estado-badge ${c.cls}">${c.label}</span>`;
}

/* ══════════════════════════════════════════════════════════════
   RENDERIZADO — LISTA DE TAREAS
══════════════════════════════════════════════════════════════ */
function renderLista() {
  const lista     = document.getElementById("lista-tareas");
  const vacia     = document.getElementById("lista-vacia");
  const totalBadge = document.getElementById("total-completadas");

  // Contador completadas
  totalBadge.textContent = tareas.filter(t => t.estado === "completado").length;

  // Filtrar
  const filtradas = tareas.filter(t =>
    filtroActual === "todas" || t.estado === filtroActual
  );

  lista.innerHTML = "";

  if (filtradas.length === 0) {
    vacia.classList.remove("hidden");
    return;
  }
  vacia.classList.add("hidden");

  filtradas.forEach(tarea => {
    const { total, hechos, pct } = calcProgreso(tarea.pasos);

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
        <p class="tarjeta-desc">${tarea.descripcion}</p>
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

  // Determinar el primer paso no completado
  const primerPendiente = tareaActiva.pasos.findIndex(p => p.estado !== "completado");
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

  const pasos = tareaActiva.pasos;
  const paso  = pasos[pasoActual];
  const { total, hechos, pct } = calcProgreso(pasos);

  // Título y barra
  document.getElementById("detalle-titulo").textContent = tareaActiva.titulo;
  document.getElementById("barra-hechos").textContent   = `${hechos} de ${total} pasos`;
  document.getElementById("barra-pct").textContent      = `${pct}%`;
  document.getElementById("barra-fill").style.width     = `${pct}%`;

  // Indicador de bolitas
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

  // Número de paso
  const circulo = document.getElementById("paso-num-circulo");
  circulo.textContent = paso.estado === "completado" ? "✓" : paso.orden;
  circulo.className   = "paso-num-circulo" + (paso.estado === "completado" ? " completado" : "");

  // Meta del paso
  document.getElementById("paso-de").textContent = `Paso ${paso.orden} de ${total}`;

  const criticoBadge = document.getElementById("paso-critico");
  paso.es_critico
    ? criticoBadge.classList.remove("hidden")
    : criticoBadge.classList.add("hidden");

  // Pictograma
  const pictoArea = document.getElementById("picto-area");
  const pictoHint = document.querySelector(".picto-hint");
  if (paso.imagen_url) {
    pictoArea.innerHTML = `<img src="${paso.imagen_url}" alt="${paso.instruccion_texto}" style="max-height:180px;border-radius:12px;object-fit:contain;"/>`;
    pictoHint.style.display = "none";
  } else {
    pictoArea.innerHTML = paso.estado === "completado" ? svgCheck() : svgTask(paso.estado);
    pictoHint.style.display = "";
  }

  // Instrucción
  document.getElementById("instruccion-texto").textContent = paso.instruccion_texto;

  // Ocultar mensaje enviado al cambiar de paso
  document.getElementById("msg-enviado").classList.add("hidden");

  // Botón completar
  const btnCompletar = document.getElementById("btn-completar");
  paso.estado === "completado"
    ? btnCompletar.classList.add("hidden")
    : btnCompletar.classList.remove("hidden");

  // Navegación
  document.getElementById("btn-anterior").disabled = pasoActual === 0;
  document.getElementById("btn-siguiente").disabled = pasoActual === pasos.length - 1;
}

/* ══════════════════════════════════════════════════════════════
   ACTUALIZAR ESTADO DE UN PASO
   TODO: sustituir por llamada PUT/PATCH a la API:
   fetch(`/api/tareas/${tareaId}/pasos/${pasoId}`, { method:'PATCH', body: JSON.stringify({estado}) })
══════════════════════════════════════════════════════════════ */
function actualizarPaso(tareaId, pasoId, nuevoEstado) {
  // Actualizar en el array global
  const tarea = tareas.find(t => t.id === tareaId);
  if (!tarea) return;

  const pasoIdx = tarea.pasos.findIndex(p => p.id === pasoId);
  if (pasoIdx < 0) return;
  tarea.pasos[pasoIdx].estado = nuevoEstado;

  // Recalcular estado de la tarea
  const todosCompletos = tarea.pasos.every(p => p.estado === "completado");
  tarea.estado = todosCompletos ? "completado" : "en_progreso";

  // Sincronizar tareaActiva y persistir
  tareaActiva = tarea;
  guardarEstadoEnStorage();
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

document.getElementById("btn-completar").addEventListener("click", () => {
  if (!tareaActiva) return;
  const paso = tareaActiva.pasos[pasoActual];
  actualizarPaso(tareaActiva.id, paso.id, "completado");

  // Avanzar al siguiente paso si no es el último
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
   EVENTOS — MODAL AYUDA
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

document.getElementById("modal-enviar").addEventListener("click", () => {
  const mensaje = document.getElementById("modal-textarea").value.trim();
  if (!mensaje) return;

  // Guardar notificación en localStorage → el admin la verá en su campana
  const paso = tareaActiva.pasos[pasoActual];
  const notifs = (() => {
    try { return JSON.parse(localStorage.getItem("neurovida_notif") || "[]"); }
    catch(e) { return []; }
  })();
  notifs.push({
    id:          Date.now() + "-" + Math.random().toString(36).slice(2),
    tareaTitulo: tareaActiva.titulo,
    pasoOrden:   paso.orden,
    pasoTexto:   paso.instruccion_texto,
    mensaje,
    hora:        new Date().toISOString(),
    leida:       false,
  });
  localStorage.setItem("neurovida_notif", JSON.stringify(notifs));

  cerrarModal();

  // Mostrar confirmación en pantalla
  const msgEl = document.getElementById("msg-enviado");
  msgEl.classList.remove("hidden");
  setTimeout(() => msgEl.classList.add("hidden"), 3000);
});

/* ══════════════════════════════════════════════════════════════
   EVENTOS — FILTROS
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
   INIT
══════════════════════════════════════════════════════════════ */
renderLista();
