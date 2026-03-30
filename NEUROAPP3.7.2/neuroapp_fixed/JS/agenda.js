/* ══════════════════════════════════════════════════════════════
   agenda.js — Gestión de citas/sesiones NeuroVida
   Compatible con supabase.js y auth.js existentes.
   Tabla esperada en Supabase: "citas"
   Columnas: id, titulo, tipo, fecha, hora, duracion_min,
             lugar, notas, recordatorio, realizada,
             usuario_id (FK → perfiles), created_at
══════════════════════════════════════════════════════════════ */

'use strict';

/* ── Estado global ──────────────────────────────────────────── */
let todasLasCitas   = [];
let vistaActual     = 'proximas';
let mesActual       = new Date();
let diaSeleccionado = null;
let citaEditandoId  = null;
let citaBorrandoId  = null;
let perfilesTrab    = [];
const esAdmin       = _session.rol === 'admin';

/* ── Helpers de fecha ───────────────────────────────────────── */
const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};
const pad = n => String(n).padStart(2, '0');

function fechaHuman(fechaISO) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const diasSem = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const dt = new Date(y, m-1, d);
  return `${diasSem[dt.getDay()]} ${d} ${meses[m-1]} ${y}`;
}

function esHoy(fechaISO) { return fechaISO === hoy(); }

function esPasada(fechaISO) { return fechaISO < hoy(); }

function duracionLabel(min) {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min/60), m = min%60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

const TIPO_LABEL = {
  seguimiento: '📊 Seguimiento',
  orientacion: '🧭 Orientación',
  empresa:     '🏢 Empresa',
  familia:     '👨‍👩‍👧 Familia',
  medica:      '🏥 Médica',
  otro:        '📌 Otro',
};
const LUGAR_LABEL = {
  presencial:   '📍 Presencial',
  empresa:      '🏢 En empresa',
  videollamada: '💻 Videollamada',
  telefono:     '📞 Teléfono',
};

/* ══════════════════════════════════════════════════════════════
   SUPABASE — funciones específicas de agenda
══════════════════════════════════════════════════════════════ */
async function sbGetCitas() {
  const filtro = esAdmin
    ? 'citas?select=*,perfiles(nombre_completo)&order=fecha.asc,hora.asc'
    : `citas?usuario_id=eq.${_session.id}&select=*,perfiles(nombre_completo)&order=fecha.asc,hora.asc`;
  const { data, error } = await sbFetch(filtro);
  if (error) return { data: [], error };
  return {
    data: (data || []).map(c => ({
      ...c,
      usuarioNombre: c.perfiles?.nombre_completo || null,
    })),
    error: null,
  };
}

async function sbCrearCita(cita) {
  const { data, error } = await sbFetch('citas', {
    method: 'POST',
    body: JSON.stringify({
      titulo:       cita.titulo,
      tipo:         cita.tipo,
      fecha:        cita.fecha,
      hora:         cita.hora,
      duracion_min: cita.duracionMin,
      lugar:        cita.lugar,
      notas:        cita.notas || null,
      recordatorio: cita.recordatorio,
      realizada:    false,
      usuario_id:   cita.usuarioId || _session.id,
    }),
  });
  return { data: data?.[0] || null, error };
}

async function sbActualizarCita(id, cita) {
  const { error } = await sbFetch(`citas?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      titulo:       cita.titulo,
      tipo:         cita.tipo,
      fecha:        cita.fecha,
      hora:         cita.hora,
      duracion_min: cita.duracionMin,
      lugar:        cita.lugar,
      notas:        cita.notas || null,
      recordatorio: cita.recordatorio,
      usuario_id:   cita.usuarioId || _session.id,
    }),
  });
  return { error };
}

async function sbMarcarCitaRealizada(id) {
  const { error } = await sbFetch(`citas?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ realizada: true }),
  });
  return { error };
}

async function sbBorrarCita(id) {
  const { error } = await sbFetch(`citas?id=eq.${id}`, { method: 'DELETE' });
  return { error };
}

/* ══════════════════════════════════════════════════════════════
   CALENDARIO MINI
══════════════════════════════════════════════════════════════ */
const DIAS_NOMBRE  = ['Do','Lu','Ma','Mi','Ju','Vi','Sá'];
const MESES_NOMBRE = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                      'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function renderCalMini() {
  const grid  = document.getElementById('cal-mini-grid');
  const label = document.getElementById('cal-mini-label');
  label.textContent = MESES_NOMBRE[mesActual.getMonth()] + ' ' + mesActual.getFullYear();

  grid.innerHTML = '';
  DIAS_NOMBRE.forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-mini-dayname';
    el.textContent = d;
    grid.appendChild(el);
  });

  const primerDia    = new Date(mesActual.getFullYear(), mesActual.getMonth(), 1).getDay();
  const diasEnMes    = new Date(mesActual.getFullYear(), mesActual.getMonth()+1, 0).getDate();
  const todayStr     = hoy();
  const diasConCitas = new Set(
    todasLasCitas.map(c => c.fecha).filter(f =>
      f.startsWith(`${mesActual.getFullYear()}-${pad(mesActual.getMonth()+1)}`)
    ).map(f => Number(f.split('-')[2]))
  );

  for (let i = 0; i < primerDia; i++) {
    const el = document.createElement('div');
    el.className = 'cal-mini-day empty';
    grid.appendChild(el);
  }

  for (let d = 1; d <= diasEnMes; d++) {
    const fechaStr = `${mesActual.getFullYear()}-${pad(mesActual.getMonth()+1)}-${pad(d)}`;
    const el = document.createElement('button');
    el.className = 'cal-mini-day';
    el.textContent = d;
    el.setAttribute('aria-label', fechaStr);
    if (fechaStr === todayStr)     el.classList.add('today');
    if (fechaStr === diaSeleccionado) el.classList.add('seleccionado');
    if (diasConCitas.has(d))       el.classList.add('tiene-citas');
    el.addEventListener('click', () => {
      diaSeleccionado = fechaStr;
      vistaActual = 'dia';
      renderCalMini();
      renderLista();
    });
    grid.appendChild(el);
  }
}

/* ══════════════════════════════════════════════════════════════
   LISTA DE CITAS
══════════════════════════════════════════════════════════════ */
function filtrarCitas() {
  const h = hoy();
  switch (vistaActual) {
    case 'proximas': return todasLasCitas.filter(c => c.fecha >= h && !c.realizada);
    case 'hoy':      return todasLasCitas.filter(c => c.fecha === h);
    case 'todas':    return [...todasLasCitas];
    case 'pasadas':  return todasLasCitas.filter(c => c.realizada || c.fecha < h);
    case 'dia':      return todasLasCitas.filter(c => c.fecha === diaSeleccionado);
    default:         return todasLasCitas;
  }
}

function renderLista() {
  const lista  = document.getElementById('lista-citas');
  const vacia  = document.getElementById('citas-vacias');
  const subMsg = document.getElementById('vacia-sub-texto');

  const citasFiltradas = filtrarCitas();
  lista.innerHTML = '';

  if (citasFiltradas.length === 0) {
    const msgs = {
      proximas: 'No tienes citas próximas. ¡Todo tranquilo!',
      hoy:      'No tienes citas hoy.',
      todas:    'No hay citas registradas todavía.',
      pasadas:  'No hay citas pasadas.',
      dia:      `No hay citas el ${diaSeleccionado ? fechaHuman(diaSeleccionado) : 'día seleccionado'}.`,
    };
    subMsg.textContent = msgs[vistaActual] || '';
    vacia.classList.remove('hidden');
    actualizarStats();
    return;
  }
  vacia.classList.add('hidden');

  // Agrupar por fecha
  const grupos = {};
  citasFiltradas.forEach(c => {
    if (!grupos[c.fecha]) grupos[c.fecha] = [];
    grupos[c.fecha].push(c);
  });

  Object.keys(grupos).sort().forEach(fecha => {
    // Separador de fecha
    const sep = document.createElement('div');
    sep.className = 'fecha-separador';
    const labelClase = esHoy(fecha) ? 'fecha-separador-label hoy' : 'fecha-separador-label';
    sep.innerHTML = `
      <span class="${labelClase}">${esHoy(fecha) ? '☀️ HOY — ' : ''}${fechaHuman(fecha)}</span>
      <div class="fecha-separador-line"></div>`;
    lista.appendChild(sep);

    grupos[fecha].forEach(cita => {
      lista.appendChild(crearTarjetaCita(cita));
    });
  });

  actualizarStats();
}

function crearTarjetaCita(cita) {
  const card = document.createElement('div');
  card.className = 'cita-card' +
    (cita.realizada ? ' realizada' : '') +
    (esHoy(cita.fecha) && !cita.realizada ? ' hoy-card' : '');
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `Cita: ${cita.titulo}`);

  const trabajadorHtml = (esAdmin && cita.usuarioNombre)
    ? `<span class="cita-trabajador-chip">👤 ${cita.usuarioNombre}</span>`
    : '';

  const badgeExtra = esHoy(cita.fecha) && !cita.realizada
    ? `<span class="cita-badge-hoy">HOY</span>`
    : cita.realizada
      ? `<span class="cita-badge-realizada">✓ Realizada</span>`
      : '';

  card.innerHTML = `
    <div class="cita-franja ${cita.tipo}"></div>
    <div class="cita-hora-col">
      <span class="cita-hora">${cita.hora.substring(0,5)}</span>
      <span class="cita-duracion">${duracionLabel(cita.duracion_min)}</span>
    </div>
    <div class="cita-body">
      <div class="cita-row">
        <span class="cita-titulo-text">${cita.titulo}</span>
        <span class="cita-tipo-badge badge-${cita.tipo}">${TIPO_LABEL[cita.tipo] || cita.tipo}</span>
        ${badgeExtra}
      </div>
      <div class="cita-meta">
        <span class="cita-meta-item">${LUGAR_LABEL[cita.lugar] || cita.lugar}</span>
        ${cita.notas ? `<span class="cita-meta-item">📝 Con notas</span>` : ''}
        ${cita.recordatorio ? `<span class="cita-meta-item">🔔 Recordatorio</span>` : ''}
      </div>
      ${trabajadorHtml}
    </div>`;

  card.addEventListener('click', () => abrirDetalle(cita.id));
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') abrirDetalle(cita.id); });
  return card;
}

function actualizarStats() {
  const h = hoy();
  document.getElementById('stat-proximas').textContent =
    todasLasCitas.filter(c => c.fecha >= h && !c.realizada).length;
  document.getElementById('stat-hoy').textContent =
    todasLasCitas.filter(c => c.fecha === h).length;
}

/* ══════════════════════════════════════════════════════════════
   MODAL DETALLE
══════════════════════════════════════════════════════════════ */
function abrirDetalle(citaId) {
  const cita = todasLasCitas.find(c => c.id === citaId);
  if (!cita) return;

  document.getElementById('detalle-titulo').textContent = cita.titulo;

  const body = document.getElementById('detalle-body');
  body.innerHTML = `
    <div class="detalle-fila">
      <span class="detalle-fila-icon">📅</span>
      <div>
        <p class="detalle-fila-label">Fecha y hora</p>
        <p class="detalle-fila-valor">${fechaHuman(cita.fecha)} — ${cita.hora.substring(0,5)} (${duracionLabel(cita.duracion_min)})</p>
      </div>
    </div>
    <div class="detalle-fila">
      <span class="detalle-fila-icon">🏷️</span>
      <div>
        <p class="detalle-fila-label">Tipo</p>
        <p class="detalle-fila-valor">${TIPO_LABEL[cita.tipo] || cita.tipo}</p>
      </div>
    </div>
    <div class="detalle-fila">
      <span class="detalle-fila-icon">📍</span>
      <div>
        <p class="detalle-fila-label">Modalidad</p>
        <p class="detalle-fila-valor">${LUGAR_LABEL[cita.lugar] || cita.lugar}</p>
      </div>
    </div>
    ${cita.usuarioNombre ? `
    <div class="detalle-fila">
      <span class="detalle-fila-icon">👤</span>
      <div>
        <p class="detalle-fila-label">Trabajador</p>
        <p class="detalle-fila-valor">${cita.usuarioNombre}</p>
      </div>
    </div>` : ''}
    ${cita.notas ? `
    <div class="detalle-fila">
      <span class="detalle-fila-icon">📝</span>
      <div style="flex:1">
        <p class="detalle-fila-label">Notas previas</p>
        <div class="detalle-notas-box">${cita.notas}</div>
      </div>
    </div>` : ''}
    ${cita.realizada ? `<p style="color:var(--green);font-weight:900;font-size:0.9rem;">✓ Esta cita ya fue realizada.</p>` : ''}
  `;

  // Botón completar
  const btnCompletar = document.getElementById('detalle-btn-completar');
  btnCompletar.disabled = cita.realizada;
  btnCompletar.onclick = async () => {
    await sbMarcarCitaRealizada(cita.id);
    const idx = todasLasCitas.findIndex(c => c.id === cita.id);
    if (idx >= 0) todasLasCitas[idx].realizada = true;
    cerrarModalDetalle();
    renderCalMini();
    renderLista();
    mostrarToast('✓ Cita marcada como realizada', 'verde');
  };

  // Botones admin
  const btnEditar = document.getElementById('detalle-btn-editar');
  const btnBorrar = document.getElementById('detalle-btn-borrar');
  if (esAdmin) {
    btnEditar.classList.remove('hidden');
    btnBorrar.classList.remove('hidden');
    btnEditar.onclick = () => { cerrarModalDetalle(); abrirFormEditar(cita.id); };
    btnBorrar.onclick = () => { cerrarModalDetalle(); pedirConfirmacionBorrar(cita.id); };
  } else {
    btnEditar.classList.add('hidden');
    btnBorrar.classList.add('hidden');
  }

  document.getElementById('modal-detalle').classList.remove('hidden');
  document.getElementById('detalle-cerrar').focus();
}

function cerrarModalDetalle() {
  document.getElementById('modal-detalle').classList.add('hidden');
}
document.getElementById('detalle-cerrar').addEventListener('click', cerrarModalDetalle);
document.getElementById('modal-detalle').addEventListener('click', e => {
  if (e.target === e.currentTarget) cerrarModalDetalle();
});

/* ══════════════════════════════════════════════════════════════
   MODAL NUEVA / EDITAR CITA
══════════════════════════════════════════════════════════════ */
function abrirFormNueva() {
  citaEditandoId = null;
  document.getElementById('modal-cita-titulo').textContent = 'Nueva cita';
  document.getElementById('form-cita').reset();
  // Fecha por defecto: hoy
  document.getElementById('cita-fecha').value = hoy();
  document.getElementById('cita-hora').value  = '10:00';
  document.getElementById('modal-cita').classList.remove('hidden');
  document.getElementById('cita-titulo').focus();
}

function abrirFormEditar(citaId) {
  const cita = todasLasCitas.find(c => c.id === citaId);
  if (!cita) return;
  citaEditandoId = citaId;
  document.getElementById('modal-cita-titulo').textContent = 'Editar cita';
  document.getElementById('cita-titulo').value       = cita.titulo;
  document.getElementById('cita-tipo').value         = cita.tipo;
  document.getElementById('cita-fecha').value        = cita.fecha;
  document.getElementById('cita-hora').value         = cita.hora;
  document.getElementById('cita-duracion').value     = cita.duracion_min;
  document.getElementById('cita-lugar').value        = cita.lugar;
  document.getElementById('cita-notas').value        = cita.notas || '';
  document.getElementById('cita-recordatorio').checked = cita.recordatorio;
  if (esAdmin) document.getElementById('cita-trabajador').value = cita.usuario_id || '';
  document.getElementById('modal-cita').classList.remove('hidden');
  document.getElementById('cita-titulo').focus();
}

function cerrarFormCita() {
  document.getElementById('modal-cita').classList.add('hidden');
  citaEditandoId = null;
}

document.getElementById('btn-cancelar-cita').addEventListener('click', cerrarFormCita);
document.getElementById('modal-cita-cerrar').addEventListener('click', cerrarFormCita);
document.getElementById('modal-cita').addEventListener('click', e => {
  if (e.target === e.currentTarget) cerrarFormCita();
});

document.getElementById('form-cita').addEventListener('submit', async e => {
  e.preventDefault();

  const titulo = document.getElementById('cita-titulo').value.trim();
  const fecha  = document.getElementById('cita-fecha').value;
  const hora   = document.getElementById('cita-hora').value;

  // Validaciones
  document.getElementById('cita-titulo').classList.remove('error');
  document.getElementById('cita-fecha').classList.remove('error');
  document.getElementById('cita-hora').classList.remove('error');

  if (!titulo) { document.getElementById('cita-titulo').classList.add('error'); document.getElementById('cita-titulo').focus(); return; }
  if (!fecha)  { document.getElementById('cita-fecha').classList.add('error'); return; }
  if (!hora)   { document.getElementById('cita-hora').classList.add('error'); return; }

  const payload = {
    titulo,
    tipo:        document.getElementById('cita-tipo').value,
    fecha,
    hora,
    duracionMin: Number(document.getElementById('cita-duracion').value),
    lugar:       document.getElementById('cita-lugar').value,
    notas:       document.getElementById('cita-notas').value.trim(),
    recordatorio:document.getElementById('cita-recordatorio').checked,
    usuarioId:   esAdmin ? (document.getElementById('cita-trabajador').value || _session.id) : _session.id,
  };

  const btn = document.getElementById('btn-guardar-cita');
  btn.disabled = true;
  btn.textContent = '⏳ Guardando...';

  let result;
  if (citaEditandoId) {
    result = await sbActualizarCita(citaEditandoId, payload);
  } else {
    result = await sbCrearCita(payload);
  }

  btn.disabled = false;
  btn.textContent = '💾 Guardar cita';

  if (result.error) {
    mostrarToast('⚠️ Error al guardar. Inténtalo de nuevo.', 'rojo');
    return;
  }

  cerrarFormCita();
  await recargarCitas();
  mostrarToast(citaEditandoId ? '✏️ Cita actualizada' : '✅ Cita creada', 'verde');
}); 

/* ══════════════════════════════════════════════════════════════
   MODAL BORRAR
══════════════════════════════════════════════════════════════ */
function pedirConfirmacionBorrar(citaId) {
  citaBorrandoId = citaId;
  document.getElementById('modal-borrar').classList.remove('hidden');
}

document.getElementById('modal-borrar-cancelar').addEventListener('click', () => {
  document.getElementById('modal-borrar').classList.add('hidden');
  citaBorrandoId = null;
});

document.getElementById('modal-borrar-confirmar').addEventListener('click', async () => {
  if (!citaBorrandoId) return;
  const { error } = await sbBorrarCita(citaBorrandoId);
  document.getElementById('modal-borrar').classList.add('hidden');
  citaBorrandoId = null;
  if (error) { mostrarToast('⚠️ Error al borrar.', 'rojo'); return; }
  await recargarCitas();
  mostrarToast('🗑️ Cita eliminada', 'rojo');
});

/* ══════════════════════════════════════════════════════════════
   TABS DE VISTA
══════════════════════════════════════════════════════════════ */
document.querySelectorAll('.vista-tab').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.vista-tab').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    this.classList.add('active');
    this.setAttribute('aria-selected', 'true');
    vistaActual = this.dataset.vista;
    diaSeleccionado = null;
    renderCalMini();
    renderLista();
  });
});

/* ══════════════════════════════════════════════════════════════
   NAVEGACIÓN CALENDARIO
══════════════════════════════════════════════════════════════ */
document.getElementById('cal-prev').addEventListener('click', () => {
  mesActual = new Date(mesActual.getFullYear(), mesActual.getMonth()-1, 1);
  renderCalMini();
});
document.getElementById('cal-next').addEventListener('click', () => {
  mesActual = new Date(mesActual.getFullYear(), mesActual.getMonth()+1, 1);
  renderCalMini();
});

/* ══════════════════════════════════════════════════════════════
   BOTON NUEVA CITA (solo admin y especialista, NO trabajador)
   NOTA: usamos style.setProperty porque header.css tiene
   display:flex !important en .header-icon-btn, que gana sobre
   .hidden al tener selector mas especifico. El inline style
   siempre tiene maxima prioridad y lo sobreescribe.
══════════════════════════════════════════════════════════════ */
const esEspecialista = _session.rol === 'especialista';
const btnNueva = document.getElementById('btn-nueva-cita');
if (esAdmin || esEspecialista) {
  btnNueva.style.setProperty('display', 'flex', 'important');
  btnNueva.addEventListener('click', abrirFormNueva);
  document.getElementById('campo-trabajador-wrap').style.display = esAdmin ? 'flex' : 'none';
} else {
  btnNueva.style.setProperty('display', 'none', 'important');
  document.getElementById('campo-trabajador-wrap').style.display = 'none';
}

/* ══════════════════════════════════════════════════════════════
   BANNER RECORDATORIO (citas de mañana)
══════════════════════════════════════════════════════════════ */
function mostrarBannerRecordatorio() {
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const mananaStr = `${manana.getFullYear()}-${pad(manana.getMonth()+1)}-${pad(manana.getDate())}`;
  const citasManana = todasLasCitas.filter(c => c.fecha === mananaStr && c.recordatorio && !c.realizada);
  if (citasManana.length === 0) return;

  const banner = document.createElement('div');
  banner.className = 'banner-recordatorio';
  banner.innerHTML = `
    <span class="banner-icon">🔔</span>
    <span>Mañana tienes <strong>${citasManana.length} cita${citasManana.length > 1 ? 's' : ''}</strong>:
      ${citasManana.map(c => `"${c.titulo}" a las ${c.hora.substring(0,5)}`).join(', ')}
    </span>
    <button class="banner-close" aria-label="Cerrar recordatorio">✕</button>`;
  banner.querySelector('.banner-close').addEventListener('click', () => banner.remove());

  const header = document.querySelector('.agenda-header');
  header.insertAdjacentElement('afterend', banner);
}

/* ══════════════════════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════════════════════ */
let toastTimer = null;
function mostrarToast(msg, tipo = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast' + (tipo ? ` ${tipo}` : '');
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2800);
}

/* ══════════════════════════════════════════════════════════════
   ESCAPE GLOBAL
══════════════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    cerrarFormCita();
    cerrarModalDetalle();
    document.getElementById('modal-borrar').classList.add('hidden');
  }
});

/* ══════════════════════════════════════════════════════════════
   CARGA DE PERFILES (para el select de trabajadores)
══════════════════════════════════════════════════════════════ */
async function cargarPerfiles() {
  if (!esAdmin) return;
  const { data } = await sbGetPerfilesTrabajadores();
  perfilesTrab = data || [];
  const sel = document.getElementById('cita-trabajador');
  perfilesTrab.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.nombre_completo;
    sel.appendChild(opt);
  });
}

/* ══════════════════════════════════════════════════════════════
   RECARGAR CITAS
══════════════════════════════════════════════════════════════ */
async function recargarCitas() {
  const { data, error } = await sbGetCitas();
  if (error) { mostrarToast('⚠️ Error cargando citas.', 'rojo'); return; }
  todasLasCitas = data;
  renderCalMini();
  renderLista();
}

/* ══════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════ */
(async () => {
  await cargarPerfiles();
  await recargarCitas();
  mostrarBannerRecordatorio();
})();
