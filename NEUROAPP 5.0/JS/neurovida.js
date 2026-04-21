/* ── Calendario ──────────────────────────────────────────── */
const DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Ya no hay eventos hardcodeados — se cargan de Supabase
let EVENTS = new Set();

let current = new Date();

/* ── Cargar citas del usuario desde Supabase ─────────────── */
async function cargarEventosCalendario() {
  try {
    if (typeof sbFetch === 'undefined' || typeof _session === 'undefined') return;

    const { data } = await sbFetch(
      `citas?usuario_id=eq.${_session.id}&select=fecha&realizada=eq.false`
    );

    if (data && data.length > 0) {
      // Guardamos las fechas completas (YYYY-MM-DD) en el Set
      EVENTS = new Set(data.map(c => c.fecha));
    }
  } catch (e) {
    console.warn('No se pudieron cargar citas del calendario:', e);
  }
  renderCalendar();
}

function renderCalendar() {
  const grid  = document.getElementById('cal-grid');
  const label = document.getElementById('cal-month-label');
  label.textContent = MONTHS[current.getMonth()] + ' ' + current.getFullYear();

  grid.innerHTML = '';

  // nombres de días
  DAYS.forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-day-name';
    el.textContent = d;
    grid.appendChild(el);
  });

  const firstDay    = new Date(current.getFullYear(), current.getMonth(), 1).getDay();
  const daysInMonth = new Date(current.getFullYear(), current.getMonth()+1, 0).getDate();
  const today       = new Date();

  // celdas vacías antes del primer día
  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day empty';
    grid.appendChild(el);
  }

  // días del mes
  for (let d = 1; d <= daysInMonth; d++) {
    // Construir la fecha en formato YYYY-MM-DD
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const fechaStr = `${y}-${m}-${dd}`;

    const el = document.createElement('div');
    el.className = 'cal-day';
    el.textContent = d;
    el.setAttribute('role', 'gridcell');
    el.setAttribute('aria-label', d + ' de ' + MONTHS[current.getMonth()]);

    const isToday = today.getDate() === d &&
                    today.getMonth() === current.getMonth() &&
                    today.getFullYear() === current.getFullYear();

    if (isToday)             el.classList.add('today');
    if (EVENTS.has(fechaStr)) el.classList.add('has-event');

    el.addEventListener('click', () => {
      const hasEv = EVENTS.has(fechaStr);
      openModal('dia', d, hasEv);
    });
    grid.appendChild(el);
  }
}

function changeMonth(delta) {
  current = new Date(current.getFullYear(), current.getMonth() + delta, 1);
  // Al cambiar mes recargamos para ese mes
  cargarEventosCalendario();
}

// Carga inicial
cargarEventosCalendario();

/* ── Modal ───────────────────────────────────────────────── */
const modals = {
  seguimiento: {
    title: '📊 Seguimiento',
    body: 'Aquí podrás ver tu progreso semanal: estado de ánimo, horas de sueño, rutinas completadas y metas alcanzadas. Próximamente disponible con gráficas interactivas.'
  },
  diario: {
    title: '📖 Mi Diario',
    body: 'Tu diario personal privado. Escribe cómo te sientes, qué pensaste hoy o simplemente un momento que quieras recordar. Solo tú puedes verlo.'
  },
  ayuda: {
    title: '🆘 Necesito Ayuda',
    body: 'Si necesitas apoyo inmediato, llama al 024 (línea de atención a conducta suicida) o al 900 123 456 (NeuroVida). También puedes escribir a ayuda@neurovida.es'
  },
  configuracion: {
    title: '⚙️ Configuración',
    body: 'Aquí podrás ajustar tus preferencias: tamaño de texto, contraste, notificaciones y más opciones de accesibilidad. Próximamente disponible.'
  },
  usuario: {
    title: '👤 Mi Perfil',
    body: 'Bienvenida, María. Desde aquí puedes editar tus datos personales, cambiar tu contraseña y gestionar tus preferencias de cuenta.'
  }
};

function openModal(type, day, hasEvent) {
  const overlay = document.getElementById('modal');
  let m;
  if (type === 'dia') {
    m = {
      title: `📅 Día ${day} de ${MONTHS[current.getMonth()]}`,
      body: hasEvent
        ? `Tienes una cita agendada este día. Puedes ver los detalles en tu Agenda.`
        : `No tienes citas para este día. ¡Puedes añadir una desde tu Agenda!`
    };
  } else {
    m = modals[type];
  }
  document.getElementById('modal-title').textContent = m.title;
  document.getElementById('modal-body').textContent  = m.body;
  overlay.classList.add('open');
  document.querySelector('.modal-close').focus();
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

document.getElementById('modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});
