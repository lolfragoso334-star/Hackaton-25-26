/* ── Calendario ──────────────────────────────────────────── */
const DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const EVENTS = [3,5,10,12,17,20,24,28];  // días con eventos ficticios

let current = new Date(2026, 2, 1); // Marzo 2026

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

  const firstDay = new Date(current.getFullYear(), current.getMonth(), 1).getDay();
  const daysInMonth = new Date(current.getFullYear(), current.getMonth()+1, 0).getDate();
  const today = new Date();

  // celdas vacías antes del primer día
  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day empty';
    grid.appendChild(el);
  }

  // días del mes
  for (let d = 1; d <= daysInMonth; d++) {
    const el = document.createElement('div');
    el.className = 'cal-day';
    el.textContent = d;
    el.setAttribute('role','gridcell');
    el.setAttribute('aria-label', d + ' de ' + MONTHS[current.getMonth()]);

    const isToday = today.getDate()===d &&
                    today.getMonth()===current.getMonth() &&
                    today.getFullYear()===current.getFullYear();
    if (isToday)            el.classList.add('today');
    if (EVENTS.includes(d)) el.classList.add('has-event');

    el.addEventListener('click', () => {
      const hasEv = EVENTS.includes(d);
      openModal('dia', d, hasEv);
    });
    grid.appendChild(el);
  }
}

function changeMonth(delta) {
  current = new Date(current.getFullYear(), current.getMonth() + delta, 1);
  renderCalendar();
}

renderCalendar();

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
        ? `Tienes un evento registrado este día. Consulta la sección de Seguimiento para ver los detalles.`
        : `No tienes eventos registrados para este día. ¡Puedes añadir uno desde "Nueva entrada"!`
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
