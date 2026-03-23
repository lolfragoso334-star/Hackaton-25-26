/* ══════════════════════════════════════════════════════════════
   admin.js — Panel de administración NeuroVida + Supabase
   Incluye selector de usuario al crear/editar tareas.
══════════════════════════════════════════════════════════════ */

let tareas = [];
let perfilesTrabajadores = [];   // ← lista de trabajadores para el selector
let tareaEditando = null;
let tareaABorrar = null;

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
function calcProgreso(pasos) {
  const total = pasos.length;
  const hechos = pasos.filter(p => p.estado === "completado").length;
  const pct = total > 0 ? Math.round((hechos / total) * 100) : 0;
  return { total, hechos, pct };
}

function badgeHtml(estado) {
  const cfg = {
    completado: { cls: "estado-completado", label: "✓ Listo" },
    en_progreso: { cls: "estado-en_progreso", label: "▶ En curso" },
    pendiente: { cls: "estado-pendiente", label: "○ Pendiente" },
  };
  const c = cfg[estado] || cfg.pendiente;
  return `<span class="estado-badge ${c.cls}">${c.label}</span>`;
}

function toast(msg, tipo = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast" + (tipo ? " " + tipo : "");
  el.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add("hidden"), 2800);
}

/* ══════════════════════════════════════════════════════════════
   INYECTAR CAMPO "ASIGNAR A" EN EL FORMULARIO
   (se llama una sola vez al inicio, tras cargar perfiles)
══════════════════════════════════════════════════════════════ */
function inyectarSelectorUsuario() {
  // Evitar duplicados si se llama dos veces
  if (document.getElementById("campo-usuario-asignado")) return;

  const estadoField = document.querySelector(".form-field:has(#campo-estado)");
  if (!estadoField) return;

  const div = document.createElement("div");
  div.className = "form-field";
  div.innerHTML = `
    <label class="form-label" for="campo-usuario-asignado">
      👤 Asignar a trabajador
    </label>
    <select id="campo-usuario-asignado" class="form-select">
      <option value="">— Sin asignar —</option>
      ${perfilesTrabajadores.map(p =>
        `<option value="${p.id}">${p.nombre_completo} (${p.usuario})</option>`
      ).join("")}
    </select>
    <span class="form-hint">Solo este trabajador verá la tarea en su lista.</span>
  `;

  // Insertar justo antes del campo Estado
  estadoField.parentNode.insertBefore(div, estadoField);
}

/* ══════════════════════════════════════════════════════════════
   CARGA INICIAL
══════════════════════════════════════════════════════════════ */
async function cargarTareas() {
  // Admin carga TODAS las tareas (sin filtro de usuario)
  const { data, error } = await sbGetTareas();
  if (error) { toast("⚠ Error al cargar tareas", "rojo"); return; }
  tareas = data;
  renderLista();
}

async function cargarPerfiles() {
  const { data } = await sbGetPerfilesTrabajadores();
  perfilesTrabajadores = data || [];
  inyectarSelectorUsuario();
}

/* ══════════════════════════════════════════════════════════════
   RENDERIZADO — LISTA IZQUIERDA
══════════════════════════════════════════════════════════════ */
function renderLista() {
  const lista = document.getElementById("lista-admin");
  const vacia = document.getElementById("lista-vacia");

  document.getElementById("stat-total").textContent = tareas.length;
  document.getElementById("stat-pasos").textContent =
    tareas.reduce((acc, t) => acc + (t.pasos || []).length, 0);

  lista.innerHTML = "";

  if (tareas.length === 0) { vacia.classList.remove("hidden"); return; }
  vacia.classList.add("hidden");

  tareas.forEach(tarea => {
    const { total, pct } = calcProgreso(tarea.pasos || []);
    const asignadoLabel = tarea.usuarioNombre
      ? `<span class="admin-card-asignado">👤 ${tarea.usuarioNombre}</span>`
      : `<span class="admin-card-asignado sin-asignar">○ Sin asignar</span>`;

    const card = document.createElement("div");
    card.className = "admin-tarea-card" + (tareaEditando === tarea.id ? " activa" : "");
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `Editar tarea: ${tarea.titulo}`);

    card.innerHTML = `
      <div class="admin-card-top">
        <span class="admin-card-titulo">${tarea.titulo}</span>
        <div class="admin-card-actions">
          <button class="btn-card-accion editar" data-id="${tarea.id}" aria-label="Editar">✏️</button>
          <button class="btn-card-accion borrar" data-id="${tarea.id}" aria-label="Borrar">🗑️</button>
        </div>
      </div>
      <p class="admin-card-desc">${tarea.descripcion || "Sin descripción"}</p>
      <div class="admin-card-meta">
        ${badgeHtml(tarea.estado)}
        <div class="barra-mini-track">
          <div class="barra-mini-fill" style="width:${pct}%"></div>
        </div>
        <span class="admin-card-pasos">${total} paso${total !== 1 ? "s" : ""}</span>
      </div>
      <div class="admin-card-asignado-wrap">${asignadoLabel}</div>
    `;

    card.addEventListener("click", e => {
      if (e.target.closest(".btn-card-accion")) return;
      abrirFormEditar(tarea.id);
    });
    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") abrirFormEditar(tarea.id);
    });
    card.querySelector(".editar").addEventListener("click", e => {
      e.stopPropagation(); abrirFormEditar(tarea.id);
    });
    card.querySelector(".borrar").addEventListener("click", e => {
      e.stopPropagation(); confirmarBorrado(tarea.id);
    });

    lista.appendChild(card);
  });
}

/* ══════════════════════════════════════════════════════════════
   FORMULARIO
══════════════════════════════════════════════════════════════ */
function abrirFormNueva() {
  tareaEditando = null;
  limpiarForm();
  document.getElementById("form-modo-label").textContent = "✨ Nueva tarea";
  document.getElementById("form-placeholder").classList.add("hidden");
  document.getElementById("form-tarea").classList.remove("hidden");
  document.getElementById("campo-titulo").focus();
}

function abrirFormEditar(id) {
  const tarea = tareas.find(t => t.id === id);
  if (!tarea) return;

  tareaEditando = id;
  document.getElementById("form-modo-label").textContent = "✏️ Editando tarea";
  document.getElementById("campo-titulo").value = tarea.titulo;
  document.getElementById("campo-desc").value = tarea.descripcion || "";
  document.getElementById("campo-estado").value = tarea.estado;

  // Rellenar selector de usuario asignado
  const sel = document.getElementById("campo-usuario-asignado");
  if (sel) sel.value = tarea.usuario_id || "";

  const listaPasos = document.getElementById("lista-pasos");
  listaPasos.innerHTML = "";
  (tarea.pasos || []).forEach(p => añadirFilaPaso(p));
  actualizarContadorPasos();

  document.getElementById("form-placeholder").classList.add("hidden");
  document.getElementById("form-tarea").classList.remove("hidden");
  renderLista();
  document.getElementById("campo-titulo").focus();
}

function limpiarForm() {
  document.getElementById("campo-titulo").value = "";
  document.getElementById("campo-desc").value = "";
  document.getElementById("campo-estado").value = "pendiente";
  document.getElementById("lista-pasos").innerHTML = "";
  document.getElementById("campo-titulo").classList.remove("error");
  const sel = document.getElementById("campo-usuario-asignado");
  if (sel) sel.value = "";
  actualizarContadorPasos();
}

function cerrarForm() {
  tareaEditando = null;
  document.getElementById("form-tarea").classList.add("hidden");
  document.getElementById("form-placeholder").classList.remove("hidden");
  renderLista();
}

/* ══════════════════════════════════════════════════════════════
   PASOS
══════════════════════════════════════════════════════════════ */
function añadirFilaPaso(paso = null) {
  const listaPasos = document.getElementById("lista-pasos");
  const idx = listaPasos.children.length + 1;
  const id = paso ? paso.id : "tmp-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  const texto = paso ? paso.instruccion_texto : "";
  const critico = paso ? paso.es_critico : false;

  const div = document.createElement("div");
  div.className = "paso-item";
  div.dataset.pasoId = id;

  div.innerHTML = `
    <div class="paso-item-header">
      <span class="paso-drag" aria-hidden="true">⠿</span>
      <span class="paso-num-label">Paso ${idx}</span>
      <div class="paso-item-controls">
        <label class="paso-check-label">
          <input type="checkbox" class="paso-critico-check" ${critico ? "checked" : ""}/>
          ⚠ Crítico
        </label>
        <button type="button" class="btn-eliminar-paso" aria-label="Eliminar paso">✕</button>
      </div>
    </div>
    <input
      type="text"
      class="paso-input"
      placeholder="Describe este paso..."
      value="${texto.replace(/"/g, '&quot;')}"
      maxlength="160"
    />
  `;

  div.querySelector(".btn-eliminar-paso").addEventListener("click", () => {
    div.remove();
    renumerarPasos();
    actualizarContadorPasos();
  });

  listaPasos.appendChild(div);
  actualizarContadorPasos();
  if (!paso) div.querySelector(".paso-input").focus();
}

function renumerarPasos() {
  document.querySelectorAll(".paso-item").forEach((el, i) => {
    el.querySelector(".paso-num-label").textContent = `Paso ${i + 1}`;
  });
}

function actualizarContadorPasos() {
  const n = document.getElementById("lista-pasos").children.length;
  document.getElementById("pasos-count").textContent = `${n} paso${n !== 1 ? "s" : ""}`;
}

/* ══════════════════════════════════════════════════════════════
   GUARDAR TAREA — Supabase (incluye usuarioId)
══════════════════════════════════════════════════════════════ */
document.getElementById("form-tarea").addEventListener("submit", async e => {
  e.preventDefault();

  const titulo = document.getElementById("campo-titulo").value.trim();
  if (!titulo) {
    document.getElementById("campo-titulo").classList.add("error");
    document.getElementById("campo-titulo").focus();
    toast("⚠ El título es obligatorio", "rojo");
    return;
  }
  document.getElementById("campo-titulo").classList.remove("error");

  const desc    = document.getElementById("campo-desc").value.trim();
  const estado  = document.getElementById("campo-estado").value;
  const selUser = document.getElementById("campo-usuario-asignado");
  const usuarioId = selUser ? (selUser.value || null) : null;

  const filasPasos = document.querySelectorAll(".paso-item");
  let hayErrorPaso = false;
  const pasos = Array.from(filasPasos).map((el, i) => {
    const input = el.querySelector(".paso-input");
    const texto = input.value.trim();
    const critico = el.querySelector(".paso-critico-check").checked;
    if (!texto) { input.classList.add("error"); hayErrorPaso = true; }
    else input.classList.remove("error");
    return {
      id: el.dataset.pasoId,
      orden: i + 1,
      instruccion_texto: texto,
      imagen_url: null,
      es_critico: critico,
      estado: "pendiente",
    };
  });

  if (hayErrorPaso) { toast("⚠ Rellena todos los pasos o elimínalos", "rojo"); return; }

  document.getElementById("btn-guardar").disabled = true;

  if (tareaEditando) {
    const { error } = await sbActualizarTarea(tareaEditando, { titulo, descripcion: desc, estado, pasos, usuarioId });
    if (error) { toast("⚠ Error al guardar en Supabase", "rojo"); document.getElementById("btn-guardar").disabled = false; return; }
    toast("✅ Tarea actualizada", "verde");
  } else {
    const { error } = await sbCrearTarea({ titulo, descripcion: desc, estado, pasos, usuarioId });
    if (error) { toast("⚠ Error al crear en Supabase", "rojo"); document.getElementById("btn-guardar").disabled = false; return; }
    toast("✅ Tarea creada", "verde");
  }

  document.getElementById("btn-guardar").disabled = false;
  cerrarForm();
  await cargarTareas();
});

/* ══════════════════════════════════════════════════════════════
   BORRADO — Supabase
══════════════════════════════════════════════════════════════ */
function confirmarBorrado(id) {
  tareaABorrar = id;
  document.getElementById("modal-borrar").classList.remove("hidden");
}

document.getElementById("modal-borrar-cancelar").addEventListener("click", () => {
  tareaABorrar = null;
  document.getElementById("modal-borrar").classList.add("hidden");
});

document.getElementById("modal-borrar-confirmar").addEventListener("click", async () => {
  if (!tareaABorrar) return;
  const { error } = await sbBorrarTarea(tareaABorrar);
  if (error) { toast("⚠ Error al borrar", "rojo"); return; }
  if (tareaEditando === tareaABorrar) cerrarForm();
  tareaABorrar = null;
  document.getElementById("modal-borrar").classList.add("hidden");
  toast("🗑️ Tarea eliminada", "rojo");
  await cargarTareas();
});

document.getElementById("modal-borrar").addEventListener("click", e => {
  if (e.target === e.currentTarget) {
    tareaABorrar = null; e.currentTarget.classList.add("hidden");
  }
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    tareaABorrar = null;
    document.getElementById("modal-borrar").classList.add("hidden");
  }
});

/* ══════════════════════════════════════════════════════════════
   EVENTOS GENERALES
══════════════════════════════════════════════════════════════ */
document.getElementById("btn-nueva-tarea").addEventListener("click", abrirFormNueva);
document.getElementById("btn-add-paso").addEventListener("click", () => añadirFilaPaso());
document.getElementById("btn-cancelar-form").addEventListener("click", cerrarForm);

/* ══════════════════════════════════════════════════════════════
   NOTIFICACIONES
══════════════════════════════════════════════════════════════ */
function horaFormateada(iso) {
  const d = new Date(iso);
  const hoy = new Date();
  const hora = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === hoy.toDateString()) return `Hoy · ${hora}`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) + ` · ${hora}`;
}

async function actualizarBadge() {
  const { data } = await sbGetNotificaciones();
  const n = (data || []).filter(n => !n.leida).length;
  const badge = document.getElementById("campana-badge");
  if (n > 0) { badge.textContent = n > 99 ? "99+" : n; badge.classList.remove("hidden"); }
  else { badge.classList.add("hidden"); }
}

async function renderNotifs() {
  const { data: notifs } = await sbGetNotificaciones();
  const lista = document.getElementById("notif-lista");
  const vacia = document.getElementById("notif-vacia");

  await actualizarBadge();
  lista.innerHTML = "";

  if (!notifs || notifs.length === 0) { vacia.classList.remove("hidden"); return; }
  vacia.classList.add("hidden");

  notifs.forEach(n => {
    const div = document.createElement("div");
    div.className = "notif-item" + (n.leida ? "" : " no-leida");
    div.innerHTML = `
      <div class="notif-avatar">🙋</div>
      <div class="notif-cuerpo">
        <p class="notif-nombre">Usuario · <strong>${n.tareaTitulo}</strong></p>
        <p class="notif-tarea-paso">Paso ${n.pasoOrden}: ${n.pasoTexto}</p>
        <p class="notif-mensaje">"${n.mensaje}"</p>
        <p class="notif-hora">${horaFormateada(n.hora)}</p>
      </div>
      <button class="notif-btn-leer" data-id="${n.id}" aria-label="Marcar como leída" title="Marcar como leída">✓</button>
    `;
    div.querySelector(".notif-btn-leer").addEventListener("click", async e => {
      e.stopPropagation();
      await sbMarcarNotifLeida(n.id);
      renderNotifs();
    });
    lista.appendChild(div);
  });
}

document.getElementById("btn-campana").addEventListener("click", e => {
  e.stopPropagation();
  const panel = document.getElementById("panel-notif");
  const backdrop = document.getElementById("notif-backdrop");
  if (!panel.classList.contains("hidden")) {
    panel.classList.add("hidden"); backdrop.classList.add("hidden");
  } else {
    renderNotifs();
    panel.classList.remove("hidden"); backdrop.classList.remove("hidden");
  }
});

function cerrarPanelNotif() {
  document.getElementById("panel-notif").classList.add("hidden");
  document.getElementById("notif-backdrop").classList.add("hidden");
}

document.getElementById("btn-cerrar-notif").addEventListener("click", cerrarPanelNotif);
document.getElementById("notif-backdrop").addEventListener("click", cerrarPanelNotif);
document.getElementById("btn-marcar-todas").addEventListener("click", async () => {
  await sbMarcarTodasLeidas();
  renderNotifs();
});

setInterval(actualizarBadge, 10000);

/* ══════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════ */
(async () => {
  await cargarPerfiles();   // primero los perfiles (inyecta el selector)
  await cargarTareas();     // luego las tareas
  actualizarBadge();
})();
