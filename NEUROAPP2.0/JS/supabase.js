/* ══════════════════════════════════════════════════════════════════════
   supabase.js  —  Configuración central de Supabase para NeuroVida
   ──────────────────────────────────────────────────────────────────────
   ✏️  SOLO TIENES QUE TOCAR ESTAS DOS LÍNEAS:
       SUPABASE_URL  →  Settings › API › Project URL
       SUPABASE_KEY  →  Settings › API › anon / public key
════════════════════════════════════════════════════════════════════════ */

const SUPABASE_URL = "https://eddipileoalgcmphzcuo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkZGlwaWxlb2FsZ2NtcGh6Y3VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzE4NzUsImV4cCI6MjA4ODgwNzg3NX0.w-1m6QbxRMbVUy3A7nshNlF3-MuX5Mds6Vvy-xXhkNM";

/* ══════════════════════════════════════════════════════════════════════
   NO TOCAR A PARTIR DE AQUÍ
════════════════════════════════════════════════════════════════════════ */

// ── Helper REST genérico ─────────────────────────────────────────────
async function sbFetch(path, options = {}) {
  const token = _authToken || SUPABASE_KEY;
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { }

  if (!res.ok) {
    console.error("[Supabase] Error:", res.status, data);
    return { data: null, error: data?.message || `HTTP ${res.status}` };
  }
  return { data, error: null };
}

/* ══════════════════════════════════════════════════════════════════════
   AUTH — login directo contra tabla perfiles
   
   Tu tabla perfiles necesita: usuario (text), password (text), 
   nombre_completo (text), rol (text)
════════════════════════════════════════════════════════════════════════ */
let _authToken = null;

async function sbLogin(usuario, password) {
  const { data, error } = await sbFetch(
    `perfiles?usuario=eq.${encodeURIComponent(usuario)}&password=eq.${encodeURIComponent(password)}&select=id,nombre_completo,rol&limit=1`
  );

  if (error) return { ok: false, error: "Error de conexión. Inténtalo de nuevo." };
  if (!data || !data[0]) return { ok: false, error: "Usuario o contraseña incorrectos." };

  return {
    ok: true,
    session: {
      id: data[0].id,
      usuario: usuario,
      nombre: data[0].nombre_completo,
      rol: data[0].rol,
      avatar: data[0].rol === "admin" ? "🛡️" : "👤",
    },
  };
}

/* ══════════════════════════════════════════════════════════════════════
   TAREAS + PASOS
   
   - sbGetTareas(usuarioId?)  →  si se pasa usuarioId, filtra por ese usuario
                                 si no se pasa (admin), devuelve todas
   - sbCrearTarea(tarea)      →  ahora acepta tarea.usuarioId
   - sbActualizarTarea(id, tarea) → actualiza también usuario_id
════════════════════════════════════════════════════════════════════════ */

// Obtiene perfiles para el selector de asignación (solo admin)
async function sbGetPerfilesTrabajadores() {
  const { data, error } = await sbFetch("perfiles?rol=eq.trabajador&select=id,nombre_completo,usuario&order=nombre_completo.asc");
  if (error) return { data: [], error };
  return { data: data || [], error: null };
}

async function sbGetTareas(usuarioId = null) {
  // Si se pasa usuarioId → solo sus tareas (vista trabajador)
  // Si no → todas las tareas (vista admin)
  const filtro = usuarioId
    ? `tareas?usuario_id=eq.${usuarioId}&select=*,pasos(*),perfiles(nombre_completo)`
    : `tareas?select=*,pasos(*),perfiles(nombre_completo)`;

  const { data, error } = await sbFetch(filtro);
  if (error) return { data: [], error };

  const normalizado = (data || []).map(t => ({
    ...t,
    usuarioNombre: t.perfiles?.nombre_completo || null,
    pasos: (t.pasos || []).sort((a, b) => a.orden - b.orden),
  }));
  return { data: normalizado, error: null };
}

async function sbCrearTarea(tarea) {
  const { data: tareaData, error: tareaError } = await sbFetch("tareas", {
    method: "POST",
    body: JSON.stringify({
      titulo: tarea.titulo,
      descripcion: tarea.descripcion,
      estado: tarea.estado,
      usuario_id: tarea.usuarioId || null,   // ← NUEVO
    }),
  });
  if (tareaError) return { data: null, error: tareaError };

  const tareaCreada = tareaData[0];

  if (tarea.pasos && tarea.pasos.length > 0) {
    const { error: pasosError } = await sbFetch("pasos", {
      method: "POST",
      body: JSON.stringify(tarea.pasos.map(p => ({
        tarea_id: tareaCreada.id,
        orden: p.orden,
        instruccion_texto: p.instruccion_texto,
        imagen_url: p.imagen_url || null,
        es_critico: p.es_critico,
        estado: "pendiente",
      }))),
    });
    if (pasosError) return { data: null, error: pasosError };
  }
  return { data: tareaCreada, error: null };
}

async function sbActualizarTarea(id, tarea) {
  const { error: tareaError } = await sbFetch(`tareas?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      titulo: tarea.titulo,
      descripcion: tarea.descripcion,
      estado: tarea.estado,
      usuario_id: tarea.usuarioId || null,   // ← NUEVO
    }),
  });
  if (tareaError) return { error: tareaError };

  await sbFetch(`pasos?tarea_id=eq.${id}`, { method: "DELETE" });

  if (tarea.pasos && tarea.pasos.length > 0) {
    const { error: pasosError } = await sbFetch("pasos", {
      method: "POST",
      body: JSON.stringify(tarea.pasos.map(p => ({
        tarea_id: id,
        orden: p.orden,
        instruccion_texto: p.instruccion_texto,
        imagen_url: p.imagen_url || null,
        es_critico: p.es_critico,
        estado: p.estado || "pendiente",
      }))),
    });
    if (pasosError) return { error: pasosError };
  }
  return { error: null };
}

async function sbBorrarTarea(id) {
  const { error } = await sbFetch(`tareas?id=eq.${id}`, { method: "DELETE" });
  return { error };
}

async function sbActualizarEstadoPaso(pasoId, nuevoEstado) {
  const { error } = await sbFetch(`pasos?id=eq.${pasoId}`, {
    method: "PATCH",
    body: JSON.stringify({ estado: nuevoEstado }),
  });
  return { error };
}

/* ══════════════════════════════════════════════════════════════════════
   NOTIFICACIONES
════════════════════════════════════════════════════════════════════════ */
async function sbCrearNotificacion(notif) {
  const { error } = await sbFetch("notificaciones", {
    method: "POST",
    body: JSON.stringify({
      tarea_titulo: notif.tareaTitulo,
      paso_orden: notif.pasoOrden,
      paso_texto: notif.pasoTexto,
      mensaje: notif.mensaje,
    }),
  });
  return { error };
}

async function sbGetNotificaciones() {
  const { data, error } = await sbFetch("notificaciones?order=hora.desc");
  if (error) return { data: [], error };
  return {
    data: (data || []).map(n => ({
      id: n.id,
      tareaTitulo: n.tarea_titulo,
      pasoOrden: n.paso_orden,
      pasoTexto: n.paso_texto,
      mensaje: n.mensaje,
      hora: n.hora,
      leida: n.leida,
    })),
    error: null,
  };
}

async function sbMarcarNotifLeida(id) {
  const { error } = await sbFetch(`notificaciones?id=eq.${id}`, {
    method: "PATCH", body: JSON.stringify({ leida: true }),
  });
  return { error };
}

async function sbMarcarTodasLeidas() {
  const { error } = await sbFetch("notificaciones?leida=eq.false", {
    method: "PATCH", body: JSON.stringify({ leida: true }),
  });
  return { error };
}
