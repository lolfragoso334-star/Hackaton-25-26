/* ══════════════════════════════════════════════════════════════════
   auth.js — Autenticación NeuroVida
════════════════════════════════════════════════════════════════════ */

const SESSION_KEY = "neurovida_session";

function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); }
  catch(e) { return null; }
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = resolverRutaLogin();
}

function requireAuth(rolRequerido = null) {
  const session = getSession();
  if (!session) {
    window.location.replace(resolverRutaLogin());
    throw new Error("No autenticado");
  }
  if (rolRequerido && session.rol !== rolRequerido) {
    if      (session.rol === "admin")        window.location.replace(resolverRutaAdmin());
    else if (session.rol === "especialista") window.location.replace(resolverRutaEspecialista());
    else                                     window.location.replace(resolverRutaInicio());
    throw new Error("Rol insuficiente");
  }
  return session;
}

function enSubcarpeta()            { return window.location.pathname.includes("/HTML/"); }
function resolverRutaLogin()       { return enSubcarpeta() ? "../login.html"          : "login.html"; }
function resolverRutaAdmin()       { return enSubcarpeta() ? "admin.html"             : "HTML/admin.html"; }
function resolverRutaEspecialista(){ return enSubcarpeta() ? "especialista.html"      : "HTML/especialista.html"; }
function resolverRutaInicio()      { return enSubcarpeta() ? "../index.html"          : "index.html"; }

/* ── index.html: redirigir admin y especialista fuera de aquí ── */
if (window.location.pathname.endsWith("index.html") ||
    window.location.pathname.endsWith("/") ||
    window.location.pathname === "") {
  const sessionActiva = getSession();
  if (sessionActiva) {
    if      (sessionActiva.rol === "admin")        window.location.replace("HTML/admin.html");
    else if (sessionActiva.rol === "especialista") window.location.replace("HTML/especialista.html");
    // trabajador → se queda en index.html, no hace nada
  }
}

/* ── Formulario de login (solo en login.html) ── */
if (document.getElementById("btn-login")) {

  const sessionActiva = getSession();
  if (sessionActiva) {
    if      (sessionActiva.rol === "admin")        window.location.replace(resolverRutaAdmin());
    else if (sessionActiva.rol === "especialista") window.location.replace(resolverRutaEspecialista());
    else                                           window.location.replace(resolverRutaInicio());
  }

  document.getElementById("btn-login").addEventListener("click", async () => {
    const email    = document.getElementById("campo-usuario").value.trim();
    const password = document.getElementById("campo-password").value;
    const btn      = document.getElementById("btn-login");
    const btnTexto = document.getElementById("btn-login-texto");
    const spinner  = document.getElementById("btn-login-spinner");

    document.getElementById("login-error").classList.add("hidden");
    document.getElementById("campo-usuario").classList.remove("error");
    document.getElementById("campo-password").classList.remove("error");

    if (!email) {
      document.getElementById("campo-usuario").classList.add("error");
      mostrarError("Escribe tu usuario.");
      document.getElementById("campo-usuario").focus();
      return;
    }
    if (!password) {
      document.getElementById("campo-password").classList.add("error");
      mostrarError("Escribe tu contraseña.");
      document.getElementById("campo-password").focus();
      return;
    }

    btn.disabled = true;
    btnTexto.classList.add("hidden");
    spinner.classList.remove("hidden");

    const resultado = await sbLogin(email, password);

    btn.disabled = false;
    btnTexto.classList.remove("hidden");
    spinner.classList.add("hidden");

    if (!resultado.ok) {
      mostrarError(resultado.error);
      document.getElementById("campo-password").value = "";
      document.getElementById("campo-password").focus();
      return;
    }

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(resultado.session));
    const rol = resultado.session.rol;
    if      (rol === "admin")        window.location.href = resolverRutaAdmin();
    else if (rol === "especialista") window.location.href = resolverRutaEspecialista();
    else                             window.location.href = resolverRutaInicio();
  });

  function mostrarError(msg) {
    const errorEl = document.getElementById("login-error");
    document.getElementById("login-error-msg").textContent = msg;
    errorEl.classList.remove("hidden");
    errorEl.style.animation = "none";
    requestAnimationFrame(() => { errorEl.style.animation = ""; });
  }
}
