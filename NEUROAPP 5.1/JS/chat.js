// ── NeuroVida – Chat IA con Gemini ───────────────────────────
const GEMINI_API_KEY = 'AIzaSyByHprLmQjW6_teQ4sx3yggBCSYz1HRLWw';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=' + GEMINI_API_KEY;

const SYSTEM_PROMPT_BASE = 'Eres NeuroAsistente, un asistente empático y accesible de la plataforma NeuroVida, diseñada para personas con diversidad neurológica. Responde siempre con lenguaje claro, frases cortas y un tono cálido y comprensivo. Nunca des diagnósticos médicos. Si el usuario expresa una crisis, anímale a contactar con su especialista o llamar al 024.';

let chatHistory = [];
let chatOpen = false;
let contextoTareas = '';

/* ══════════════════════════════════════════════════════════════
   CARGAR TAREAS Y CONSTRUIR CONTEXTO SEPARADO POR ESTADO
══════════════════════════════════════════════════════════════ */
async function cargarContextoTareas() {
  try {
    if (typeof _session === 'undefined' || !_session) return;
    if (typeof sbGetTareas === 'undefined') return;

    const { data: tareas } = await sbGetTareas(_session.id);
    if (!tareas || tareas.length === 0) {
      contextoTareas = 'El usuario no tiene tareas asignadas actualmente.';
      return;
    }

    const pendientes = tareas.filter(t => t.estado === 'pendiente');
    const enProgreso = tareas.filter(t => t.estado === 'en_progreso');
    const completadas = tareas.filter(t => t.estado === 'completado');

    const lineas = [];
    lineas.push(`El usuario se llama ${_session.nombre}.`);
    lineas.push(`Resumen: ${pendientes.length} pendiente(s), ${enProgreso.length} en curso, ${completadas.length} completada(s).`);
    lineas.push('');

    // ── Tareas en curso ──────────────────────────────────────
    if (enProgreso.length > 0) {
      lineas.push('── EN CURSO ──');
      enProgreso.forEach(t => lineas.push(...formatearTarea(t)));
      lineas.push('');
    }

    // ── Tareas pendientes ────────────────────────────────────
    if (pendientes.length > 0) {
      lineas.push('── PENDIENTES ──');
      pendientes.forEach(t => lineas.push(...formatearTarea(t)));
      lineas.push('');
    }

    // ── Tareas completadas ───────────────────────────────────
    if (completadas.length > 0) {
      lineas.push('── COMPLETADAS ──');
      completadas.forEach(t => {
        lineas.push(`✓ "${t.titulo}" — todos los pasos completados.`);
      });
      lineas.push('');
    }

    contextoTareas = lineas.join('\n');
  } catch (e) {
    contextoTareas = '';
  }
}

function formatearTarea(tarea) {
  const pasos = tarea.pasos || [];
  const pendientes = pasos.filter(p => p.estado !== 'completado');
  const completados = pasos.filter(p => p.estado === 'completado');
  const lineas = [];

  lineas.push(`• "${tarea.titulo}"`);
  if (tarea.descripcion) lineas.push(`  Descripción: ${tarea.descripcion}`);
  lineas.push(`  Progreso: ${completados.length} de ${pasos.length} pasos completados`);

  if (pendientes.length > 0) {
    lineas.push('  Pasos pendientes:');
    pendientes.forEach(p => {
      const critico = p.es_critico ? ' ⚠ IMPORTANTE' : '';
      lineas.push(`    - Paso ${p.orden}: ${p.instruccion_texto}${critico}`);
    });
  }
  return lineas;
}

function getSystemPrompt() {
  if (!contextoTareas) return SYSTEM_PROMPT_BASE;
  return SYSTEM_PROMPT_BASE +
    '\n\nINFORMACIÓN ACTUAL DEL USUARIO:\n' + contextoTareas +
    '\nUsa esta información para responder cualquier pregunta sobre sus tareas: pendientes, en curso o completadas. Sé claro, breve y animador.';
}

/* ══════════════════════════════════════════════════════════════
   INIT CHAT
══════════════════════════════════════════════════════════════ */
function initChat() {
  const widget = document.createElement('div');
  widget.innerHTML = '\
    <button id="chat-fab" aria-label="Abrir asistente IA" title="Habla con NeuroAsistente">\
      <span id="chat-fab-icon">🧠</span>\
    </button>\
    <div id="chat-panel" role="dialog" aria-modal="true" aria-label="NeuroAsistente" hidden>\
      <div id="chat-header">\
        <div id="chat-header-info">\
          <span id="chat-avatar">🧠</span>\
          <div>\
            <strong>NeuroAsistente</strong>\
            <small id="chat-status">Cargando tareas...</small>\
          </div>\
        </div>\
        <button id="chat-close-btn" aria-label="Cerrar chat">✕</button>\
      </div>\
      <div id="chat-messages" aria-live="polite">\
        <div class="chat-msg assistant">\
          <span class="chat-bubble">¡Hola! 👋 Soy tu NeuroAsistente. Puedo ayudarte con tus tareas pendientes, en curso o completadas. ¿Qué necesitas?</span>\
        </div>\
      </div>\
      <div id="chat-input-area">\
        <textarea id="chat-input" placeholder="Escribe tu mensaje..." rows="1" aria-label="Escribe tu mensaje"></textarea>\
        <button id="chat-send-btn" aria-label="Enviar mensaje">➤</button>\
      </div>\
    </div>';
  document.body.appendChild(widget);

  document.getElementById('chat-fab').addEventListener('click', toggleChat);
  document.getElementById('chat-close-btn').addEventListener('click', toggleChat);
  document.getElementById('chat-send-btn').addEventListener('click', sendChat);
  document.getElementById('chat-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });

  cargarContextoTareas().then(() => {
    const status = document.getElementById('chat-status');
    if (status) {
      status.textContent = contextoTareas ? 'Conozco tus tareas ✓' : 'Powered by Gemini ✨';
    }
  });
}

function toggleChat() {
  chatOpen = !chatOpen;
  var panel = document.getElementById('chat-panel');
  var icon = document.getElementById('chat-fab-icon');
  panel.hidden = !chatOpen;
  icon.textContent = chatOpen ? '✕' : '🧠';
  if (chatOpen) {
    document.getElementById('chat-input').focus();
    // ← Recargar tareas cada vez que se abre el chat
    cargarContextoTareas().then(() => {
      const status = document.getElementById('chat-status');
      if (status) status.textContent = contextoTareas ? 'Conozco tus tareas ✓' : 'Powered by Gemini ✨';
    });
  }
}

/* ══════════════════════════════════════════════════════════════
   ENVIAR MENSAJE
══════════════════════════════════════════════════════════════ */
async function sendChat() {
  var input = document.getElementById('chat-input');
  var text = input.value.trim();
  if (!text) return;

  input.value = '';
  addMessage('user', text);
  chatHistory.push({ role: 'user', parts: [{ text: text }] });

  var typing = addTyping();

  try {
    var contents = [
      { role: 'user', parts: [{ text: getSystemPrompt() }] },
      { role: 'model', parts: [{ text: 'Entendido, actuaré como NeuroAsistente y conozco todas las tareas del usuario.' }] }
    ].concat(chatHistory);

    var res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: contents })
    });

    var data = await res.json();

    if (!res.ok) {
      var apiMsg = (data.error && data.error.message) ? data.error.message : ('HTTP ' + res.status);
      typing.remove();
      addMessage('assistant', '⚠️ Error API: ' + apiMsg);
      return;
    }

    var reply = data.candidates
      && data.candidates[0]
      && data.candidates[0].content
      && data.candidates[0].content.parts
      && data.candidates[0].content.parts[0].text;

    typing.remove();

    if (!reply) {
      addMessage('assistant', '⚠️ Sin respuesta. Raw: ' + JSON.stringify(data).substring(0, 200));
      return;
    }

    addMessage('assistant', reply);
    chatHistory.push({ role: 'model', parts: [{ text: reply }] });

  } catch (err) {
    typing.remove();
    addMessage('assistant', '⚠️ Excepción: ' + err.message);
  }
}

/* ══════════════════════════════════════════════════════════════
   HELPERS UI
══════════════════════════════════════════════════════════════ */
function addMessage(role, text) {
  var msgs = document.getElementById('chat-messages');
  var div = document.createElement('div');
  div.className = 'chat-msg ' + role;
  div.innerHTML = '<span class="chat-bubble">' + escapeHtml(text) + '</span>';
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

function addTyping() {
  var msgs = document.getElementById('chat-messages');
  var div = document.createElement('div');
  div.className = 'chat-msg assistant typing';
  div.innerHTML = '<span class="chat-bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>';
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

function escapeHtml(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

document.addEventListener('DOMContentLoaded', initChat);
