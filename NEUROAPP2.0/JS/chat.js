// ── NeuroVida – Chat IA con Gemini ───────────────────────────
const GEMINI_API_KEY = 'AIzaSyB4zYoXOrwploBPlyVUzXt8QlcaoQYblaw';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=' + GEMINI_API_KEY;

const SYSTEM_PROMPT = 'Eres NeuroAsistente, un asistente empático y accesible de la plataforma NeuroVida, diseñada para personas con diversidad neurológica. Responde siempre con lenguaje claro, frases cortas y un tono cálido y comprensivo. Nunca des diagnósticos médicos. Si el usuario expresa una crisis, anímale a contactar con su especialista o llamar al 024.';

let chatHistory = [];
let chatOpen = false;

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
            <small>Powered by Gemini ✨</small>\
          </div>\
        </div>\
        <button id="chat-close-btn" aria-label="Cerrar chat">✕</button>\
      </div>\
      <div id="chat-messages" aria-live="polite">\
        <div class="chat-msg assistant">\
          <span class="chat-bubble">¡Hola! 👋 Soy tu NeuroAsistente. ¿En qué puedo ayudarte hoy?</span>\
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
}

function toggleChat() {
  chatOpen = !chatOpen;
  var panel = document.getElementById('chat-panel');
  var icon = document.getElementById('chat-fab-icon');
  panel.hidden = !chatOpen;
  icon.textContent = chatOpen ? '✕' : '🧠';
  if (chatOpen) document.getElementById('chat-input').focus();
}

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
      { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
      { role: 'model', parts: [{ text: 'Entendido, actuaré como NeuroAsistente.' }] }
    ].concat(chatHistory);

    var res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: contents })
    });

    var data = await res.json();

    // Mostrar error exacto de la API en el chat para debug
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
      // Mostrar respuesta cruda para debug
      addMessage('assistant', '⚠️ Sin respuesta. Raw: ' + JSON.stringify(data).substring(0, 200));
      return;
    }

    addMessage('assistant', reply);
    chatHistory.push({ role: 'model', parts: [{ text: reply }] });

  } catch (err) {
    typing.remove();
    // Mostrar error exacto
    addMessage('assistant', '⚠️ Excepción: ' + err.message);
  }
}

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
