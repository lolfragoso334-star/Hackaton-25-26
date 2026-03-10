/* ══════════════════════════════════════════════════════════════
   ESTADO GLOBAL
   TODO: sustituir el array `tareas` por llamadas reales a la BD:
     GET    /api/tareas          → cargar lista
     POST   /api/tareas          → crear tarea
     PUT    /api/tareas/:id      → actualizar tarea
     DELETE /api/tareas/:id      → borrar tarea
══════════════════════════════════════════════════════════════ */
const STORAGE_KEY = "neurovida_tareas";

// Cargar desde localStorage (o arrancar vacío)
let tareas = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

// Sincronizar contadores con los ids ya existentes para no colisionar
let idCounter = tareas.length > 0
  ? Math.max(...tareas.map(t => parseInt(t.id) || 0)) + 1
  : 1;
let pasoIdCounter = (() => {
  const ids = tareas.flatMap(t => t.pasos.map(p => parseInt(p.id.replace("p","")) || 0));
  return ids.length > 0 ? Math.max(...ids) + 1 : 1;
})();

let tareaEditando = null;   // id de la tarea que se está editando (null = nueva)
let tareaABorrar  = null;   // id pendiente de confirmación de borrado

/* Persiste el array en localStorage — reemplazar por fetch a BD cuando esté listo */
function guardarStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tareas));
}

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
function uid()     { return String(idCounter++); }
function pasoUid() { return "p" + String(pasoIdCounter++); }

function calcProgreso(pasos) {
  const total  = pasos.length;
  const hechos = pasos.filter(p => p.estado === "completado").length;
  const pct    = total > 0 ? Math.round((hechos / total) * 100) : 0;
  return { total, hechos, pct };
}

function badgeHtml(estado) {
  const cfg = {
    completado:  { cls: "estado-completado",  label: "✓ Listo" },
    en_progreso: { cls: "estado-en_progreso", label: "▶ En curso" },
    pendiente:   { cls: "estado-pendiente",   label: "○ Pendiente" },
  };
  const c = cfg[estado] || cfg.pendiente;
  return `<span class="estado-badge ${c.cls}">${c.label}</span>`;
}

function toast(msg, tipo = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className   = "toast" + (tipo ? " " + tipo : "");
  el.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add("hidden"), 2800);
}

/* ══════════════════════════════════════════════════════════════
   RENDERIZADO — LISTA IZQUIERDA
══════════════════════════════════════════════════════════════ */
function renderLista() {
  const lista = document.getElementById("lista-admin");
  const vacia = document.getElementById("lista-vacia");

  // Stats del header
  document.getElementById("stat-total").textContent = tareas.length;
  document.getElementById("stat-pasos").textContent =
    tareas.reduce((acc, t) => acc + t.pasos.length, 0);

  lista.innerHTML = "";

  if (tareas.length === 0) {
    vacia.classList.remove("hidden");
    return;
  }
  vacia.classList.add("hidden");

  tareas.forEach(tarea => {
    const { total, pct } = calcProgreso(tarea.pasos);

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
    `;

    // Click en la card → editar
    card.addEventListener("click", e => {
      if (e.target.closest(".btn-card-accion")) return;
      abrirFormEditar(tarea.id);
    });
    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") abrirFormEditar(tarea.id);
    });

    // Botón editar
    card.querySelector(".editar").addEventListener("click", e => {
      e.stopPropagation();
      abrirFormEditar(tarea.id);
    });

    // Botón borrar
    card.querySelector(".borrar").addEventListener("click", e => {
      e.stopPropagation();
      confirmarBorrado(tarea.id);
    });

    lista.appendChild(card);
  });
}

/* ══════════════════════════════════════════════════════════════
   FORMULARIO — abrir para NUEVA tarea
══════════════════════════════════════════════════════════════ */
function abrirFormNueva() {
  tareaEditando = null;
  limpiarForm();
  document.getElementById("form-modo-label").textContent = "✨ Nueva tarea";
  document.getElementById("form-placeholder").classList.add("hidden");
  document.getElementById("form-tarea").classList.remove("hidden");
  document.getElementById("campo-titulo").focus();
}

/* ══════════════════════════════════════════════════════════════
   FORMULARIO — abrir para EDITAR tarea existente
══════════════════════════════════════════════════════════════ */
function abrirFormEditar(id) {
  const tarea = tareas.find(t => t.id === id);
  if (!tarea) return;

  tareaEditando = id;

  document.getElementById("form-modo-label").textContent = "✏️ Editando tarea";
  document.getElementById("campo-titulo").value  = tarea.titulo;
  document.getElementById("campo-desc").value    = tarea.descripcion || "";
  document.getElementById("campo-estado").value  = tarea.estado;

  // Cargar pasos
  const listaPasos = document.getElementById("lista-pasos");
  listaPasos.innerHTML = "";
  tarea.pasos.forEach(p => añadirFilaPaso(p));
  actualizarContadorPasos();

  document.getElementById("form-placeholder").classList.add("hidden");
  document.getElementById("form-tarea").classList.remove("hidden");
  renderLista(); // refrescar activa
  document.getElementById("campo-titulo").focus();
}

/* ══════════════════════════════════════════════════════════════
   FORMULARIO — limpiar
══════════════════════════════════════════════════════════════ */
function limpiarForm() {
  document.getElementById("campo-titulo").value = "";
  document.getElementById("campo-desc").value   = "";
  document.getElementById("campo-estado").value = "pendiente";
  document.getElementById("lista-pasos").innerHTML = "";
  document.getElementById("campo-titulo").classList.remove("error");
  actualizarContadorPasos();
}

function cerrarForm() {
  tareaEditando = null;
  document.getElementById("form-tarea").classList.add("hidden");
  document.getElementById("form-placeholder").classList.remove("hidden");
  renderLista();
}

/* ══════════════════════════════════════════════════════════════
   PASOS — añadir fila al formulario
══════════════════════════════════════════════════════════════ */
function añadirFilaPaso(paso = null) {
  const listaPasos = document.getElementById("lista-pasos");
  const idx = listaPasos.children.length + 1;

  const id       = paso ? paso.id    : pasoUid();
  const texto    = paso ? paso.instruccion_texto : "";
  const critico  = paso ? paso.es_critico : false;

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

  // Eliminar paso
  div.querySelector(".btn-eliminar-paso").addEventListener("click", () => {
    div.remove();
    renumerarPasos();
    actualizarContadorPasos();
  });

  listaPasos.appendChild(div);
  actualizarContadorPasos();

  // Foco automático si es nuevo
  if (!paso) {
    div.querySelector(".paso-input").focus();
  }
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
   GUARDAR TAREA (crear o actualizar)
══════════════════════════════════════════════════════════════ */
document.getElementById("form-tarea").addEventListener("submit", e => {
  e.preventDefault();

  const titulo = document.getElementById("campo-titulo").value.trim();
  if (!titulo) {
    document.getElementById("campo-titulo").classList.add("error");
    document.getElementById("campo-titulo").focus();
    toast("⚠ El título es obligatorio", "rojo");
    return;
  }
  document.getElementById("campo-titulo").classList.remove("error");

  const desc   = document.getElementById("campo-desc").value.trim();
  const estado = document.getElementById("campo-estado").value;

  // Recoger pasos
  const filasPasos = document.querySelectorAll(".paso-item");
  let hayErrorPaso = false;
  const pasos = Array.from(filasPasos).map((el, i) => {
    const input   = el.querySelector(".paso-input");
    const texto   = input.value.trim();
    const critico = el.querySelector(".paso-critico-check").checked;

    if (!texto) {
      input.classList.add("error");
      hayErrorPaso = true;
    } else {
      input.classList.remove("error");
    }

    return {
      id:                el.dataset.pasoId,
      orden:             i + 1,
      instruccion_texto: texto,
      imagen_url:        null,
      es_critico:        critico,
      estado:            "pendiente",  // los pasos siempre arrancan pendientes al guardar
    };
  });

  if (hayErrorPaso) {
    toast("⚠ Rellena todos los pasos o elimínalos", "rojo");
    return;
  }

  if (tareaEditando) {
    // ── ACTUALIZAR ──
    const idx = tareas.findIndex(t => t.id === tareaEditando);
    if (idx >= 0) {
      // Conservar estado de pasos ya existentes
      pasos.forEach(p => {
        const anterior = tareas[idx].pasos.find(ap => ap.id === p.id);
        if (anterior) p.estado = anterior.estado;
      });
      tareas[idx] = { ...tareas[idx], titulo, descripcion: desc, estado, pasos };
    }
    guardarStorage();
    toast("✅ Tarea actualizada", "verde");

    /* TODO: PUT /api/tareas/${tareaEditando}
       fetch(`/api/tareas/${tareaEditando}`, {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(tareas[idx])
       }); */

  } else {
    // ── CREAR ──
    const nueva = { id: uid(), titulo, descripcion: desc, estado, pasos };
    tareas.push(nueva);
    guardarStorage();
    toast("✅ Tarea creada", "verde");

    /* TODO: POST /api/tareas
       fetch('/api/tareas', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(nueva)
       }); */
  }

  cerrarForm();
});

/* ══════════════════════════════════════════════════════════════
   BORRADO
══════════════════════════════════════════════════════════════ */
function confirmarBorrado(id) {
  tareaABorrar = id;
  document.getElementById("modal-borrar").classList.remove("hidden");
}

document.getElementById("modal-borrar-cancelar").addEventListener("click", () => {
  tareaABorrar = null;
  document.getElementById("modal-borrar").classList.add("hidden");
});

document.getElementById("modal-borrar-confirmar").addEventListener("click", () => {
  if (!tareaABorrar) return;

  tareas = tareas.filter(t => t.id !== tareaABorrar);
  guardarStorage();

  /* TODO: DELETE /api/tareas/${tareaABorrar}
     fetch(`/api/tareas/${tareaABorrar}`, { method: 'DELETE' }); */

  if (tareaEditando === tareaABorrar) cerrarForm();
  tareaABorrar = null;
  document.getElementById("modal-borrar").classList.add("hidden");
  renderLista();
  toast("🗑️ Tarea eliminada", "rojo");
});

// Cerrar modal al hacer click fuera
document.getElementById("modal-borrar").addEventListener("click", e => {
  if (e.target === e.currentTarget) {
    tareaABorrar = null;
    e.currentTarget.classList.add("hidden");
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
document.getElementById("btn-add-paso").addEventListener("click",    () => añadirFilaPaso());
document.getElementById("btn-cancelar-form").addEventListener("click", cerrarForm);

/* ══════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════ */
renderLista();
