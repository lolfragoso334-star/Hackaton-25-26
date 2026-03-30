/* ══════════════════════════════════════════════════════════════════════
   supabase.js  —  Configuración central de Supabase para NeuroVida
════════════════════════════════════════════════════════════════════════ */

const SUPABASE_URL = "https://eddipileoalgcmphzcuo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkZGlwaWxlb2FsZ2NtcGh6Y3VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzE4NzUsImV4cCI6MjA4ODgwNzg3NX0.w-1m6QbxRMbVUy3A7nshNlF3-MuX5Mds6Vvy-xXhkNM";

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
   AUTH
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
   PERFILES TRABAJADORES
════════════════════════════════════════════════════════════════════════ */
async function sbGetPerfilesTrabajadores() {
  const { data, error } = await sbFetch("perfiles?rol=eq.trabajador&select=id,nombre_completo,usuario&order=nombre_completo.asc");
  if (error) return { data: [], error };
  return { data: data || [], error: null };
}

/* ══════════════════════════════════════════════════════════════════════
   TAREAS + PASOS
════════════════════════════════════════════════════════════════════════ */
async function sbGetTareas(usuarioId = null) {
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
      usuario_id: tarea.usuarioId || null,
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
      usuario_id: tarea.usuarioId || null,
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
      tarea_titulo:   notif.tareaTitulo,
      paso_orden:     notif.pasoOrden,
      paso_texto:     notif.pasoTexto,
      mensaje:        notif.mensaje,
      usuario_nombre: notif.usuarioNombre || null,  // ← nombre del usuario
    }),
  });
  return { error };
}

async function sbGetNotificaciones() {
  const { data, error } = await sbFetch("notificaciones?order=hora.desc");
  if (error) return { data: [], error };
  return {
    data: (data || []).map(n => ({
      id:            n.id,
      tareaTitulo:   n.tarea_titulo,
      pasoOrden:     n.paso_orden,
      pasoTexto:     n.paso_texto,
      mensaje:       n.mensaje,
      hora:          n.hora,
      leida:         n.leida,
      usuarioNombre: n.usuario_nombre || 'Usuario',  // ← nombre del usuario
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

/* ══════════════════════════════════════════════════════════════════════
   MÉTRICAS DE AUTONOMÍA
   Tabla: metricas_autonomia (id, usuario_id, tarea_id, paso_id,
          tipo TEXT CHECK(tipo IN ('paso_solo','ayuda_solicitada')),
          created_at TIMESTAMPTZ DEFAULT now())
════════════════════════════════════════════════════════════════════════ */

/**
 * Registra un evento de autonomía.
 * @param {string} usuarioId
 * @param {string} tareaId
 * @param {string} pasoId
 * @param {'paso_solo'|'ayuda_solicitada'} tipo
 */
async function sbRegistrarMetricaAutonomia(usuarioId, tareaId, pasoId, tipo) {
  const { error } = await sbFetch("metricas_autonomia", {
    method: "POST",
    body: JSON.stringify({
      usuario_id: usuarioId,
      tarea_id:   tareaId,
      paso_id:    pasoId,
      tipo,
    }),
  });
  if (error) console.warn("[sbRegistrarMetricaAutonomia] error:", error);
  return { error };
}

/**
 * Devuelve las métricas de autonomía de un usuario agrupadas por semana ISO.
 * Retorna { data: [{ semana, pasos_solos, ayudas }], error }.
 * @param {string} usuarioId
 */
async function sbGetMetricasAutonomia(usuarioId) {
  const filtro = usuarioId
    ? `metricas_autonomia?usuario_id=eq.${usuarioId}&order=created_at.asc`
    : `metricas_autonomia?order=created_at.asc`;

  const { data, error } = await sbFetch(filtro);
  if (error) return { data: [], error };

  // Agrupar en cliente por semana ISO (lunes = inicio de semana)
  const semanas = {};
  (data || []).forEach(row => {
    const d = new Date(row.created_at);
    const day = d.getDay(); // 0=domingo
    const diff = (day === 0 ? -6 : 1 - day);
    const lunes = new Date(d);
    lunes.setDate(d.getDate() + diff);
    lunes.setHours(0, 0, 0, 0);
    const key = lunes.toISOString().slice(0, 10); // "YYYY-MM-DD"

    if (!semanas[key]) semanas[key] = { semana: key, pasos_solos: 0, ayudas: 0 };
    if (row.tipo === "paso_solo")             semanas[key].pasos_solos++;
    else if (row.tipo === "ayuda_solicitada") semanas[key].ayudas++;
  });

  const resultado = Object.values(semanas).sort((a, b) => a.semana.localeCompare(b.semana));
  return { data: resultado, error: null };
}

/* ══════════════════════════════════════════════════════════════════════
   ESPECIALISTA → TRABAJADOR  (tabla: especialista_trabajador)
   Columnas: id, especialista_id, trabajador_id
════════════════════════════════════════════════════════════════════════ */

/** Devuelve los trabajadores asignados a un especialista */
async function sbGetTrabajadoresDeEspecialista(especialistaId) {
  const { data, error } = await sbFetch(
    `especialista_trabajador?especialista_id=eq.${especialistaId}&select=trabajador_id,perfiles!especialista_trabajador_trabajador_id_fkey(id,nombre_completo,usuario)`
  );
  if (error) return { data: [], error };
  return {
    data: (data || []).map(r => ({
      id:             r.perfiles?.id,
      nombre_completo: r.perfiles?.nombre_completo,
      usuario:        r.perfiles?.usuario,
    })),
    error: null,
  };
}

/** Devuelve todos los especialistas con sus trabajadores asignados (para admin) */
async function sbGetAsignaciones() {
  const { data, error } = await sbFetch(
    `especialista_trabajador?select=especialista_id,trabajador_id,especialistas:perfiles!especialista_trabajador_especialista_id_fkey(nombre_completo),trabajadores:perfiles!especialista_trabajador_trabajador_id_fkey(nombre_completo)`
  );
  if (error) return { data: [], error };
  return { data: data || [], error: null };
}

/** Asigna un especialista a un trabajador */
async function sbAsignarEspecialista(especialistaId, trabajadorId) {
  const { error } = await sbFetch("especialista_trabajador", {
    method: "POST",
    body: JSON.stringify({ especialista_id: especialistaId, trabajador_id: trabajadorId }),
  });
  return { error };
}

/** Elimina la asignación de un especialista a un trabajador */
async function sbDesasignarEspecialista(especialistaId, trabajadorId) {
  const { error } = await sbFetch(
    `especialista_trabajador?especialista_id=eq.${especialistaId}&trabajador_id=eq.${trabajadorId}`,
    { method: "DELETE" }
  );
  return { error };
}

/** Lista todos los perfiles con rol especialista */
async function sbGetEspecialistas() {
  const { data, error } = await sbFetch(
    "perfiles?rol=eq.especialista&select=id,nombre_completo,usuario&order=nombre_completo.asc"
  );
  if (error) return { data: [], error };
  return { data: data || [], error: null };
}

/* ══════════════════════════════════════════════════════════════════════
   NOTAS CLÍNICAS  (tabla: notas_clinicas)
   Columnas: id, especialista_id, trabajador_id, contenido, created_at
   RLS: solo el especialista asignado puede insertar/ver sus notas.
        El admin puede ver todas. El trabajador NO ve ninguna.
════════════════════════════════════════════════════════════════════════ */

/** Obtiene las notas clínicas de un trabajador (solo las del especialista autenticado) */
async function sbGetNotasClinicas(trabajadorId) {
  const { data, error } = await sbFetch(
    `notas_clinicas?trabajador_id=eq.${trabajadorId}&order=created_at.desc&select=id,contenido,created_at,perfiles!notas_clinicas_especialista_id_fkey(nombre_completo)`
  );
  if (error) return { data: [], error };
  return {
    data: (data || []).map(n => ({
      id:          n.id,
      contenido:   n.contenido,
      created_at:  n.created_at,
      autor:       n.perfiles?.nombre_completo || "Especialista",
    })),
    error: null,
  };
}

/** Crea una nota clínica */
async function sbCrearNotaClinica(especialistaId, trabajadorId, contenido) {
  const { error } = await sbFetch("notas_clinicas", {
    method: "POST",
    body: JSON.stringify({ especialista_id: especialistaId, trabajador_id: trabajadorId, contenido }),
  });
  return { error };
}

/** Elimina una nota clínica (solo la puede borrar el propio especialista) */
async function sbBorrarNotaClinica(notaId) {
  const { error } = await sbFetch(`notas_clinicas?id=eq.${notaId}`, { method: "DELETE" });
  return { error };
}

/* ══════════════════════════════════════════════════════════════════════
   AJUSTES DE USUARIO  (tabla: ajustes_usuario)
   Columnas: usuario_id UUID PK, tamano TEXT, fuente TEXT, contraste BOOL
════════════════════════════════════════════════════════════════════════ */

async function sbGetAjustes(usuarioId) {
  const { data, error } = await sbFetch(
    `ajustes_usuario?usuario_id=eq.${usuarioId}&limit=1`
  );
  if (error || !data || !data[0]) return { data: null, error };
  return { data: data[0], error: null };
}

async function sbGuardarAjustes(usuarioId, ajustes) {
  const { error } = await sbFetch("ajustes_usuario", {
    method: "POST",
    headers: { "Prefer": "resolution=merge-duplicates" },
    body: JSON.stringify({
      usuario_id: usuarioId,
      tamano:     ajustes.tamano,
      fuente:     ajustes.fuente,
      contraste:  ajustes.contraste,
    }),
  });
  return { error };
}

/* ══════════════════════════════════════════════════════════════════════
   STORAGE — Subida de archivos para pasos (imágenes y vídeos)
   Bucket recomendado: "pasos-media"  (público, max 10 MB)
════════════════════════════════════════════════════════════════════════ */
const STORAGE_BUCKET = "pasos-media";
const MAX_FILE_SIZE  = 10 * 1024 * 1024; // 10 MB

const TIPOS_PERMITIDOS = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "video/mp4", "video/webm", "video/ogg",
];

/**
 * Sube un archivo al bucket de Supabase Storage.
 * @param {File} file  — Archivo a subir (imagen o vídeo, ≤ 10 MB)
 * @returns {{ url: string|null, error: string|null }}
 */
async function sbSubirArchivoPaso(file) {
  if (!file) return { url: null, error: "No se ha seleccionado ningún archivo." };

  if (file.size > MAX_FILE_SIZE)
    return { url: null, error: "El archivo supera el límite de 10 MB." };

  if (!TIPOS_PERMITIDOS.includes(file.type))
    return { url: null, error: "Tipo de archivo no permitido. Usa imagen (JPG, PNG, GIF, WEBP) o vídeo (MP4, WEBM, OGG)." };

  const ext      = file.name.split(".").pop();
  const nombre   = `paso_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const token    = _authToken || SUPABASE_KEY;

  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${nombre}`,
    {
      method: "POST",
      headers: {
        "apikey":        SUPABASE_KEY,
        "Authorization": `Bearer ${token}`,
        "Content-Type":  file.type,
        "x-upsert":      "true",
      },
      body: file,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { url: null, error: err.message || `Error al subir (HTTP ${res.status})` };
  }

  const url = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${nombre}`;
  return { url, error: null };
}

/* ══════════════════════════════════════════════════════════════════════
   MENSAJES  (tabla: mensajes)
   SQL para crear la tabla:
   CREATE TABLE mensajes (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     remitente_id uuid REFERENCES perfiles(id),
     destinatario_id uuid REFERENCES perfiles(id),
     contenido text NOT NULL,
     leido boolean DEFAULT false,
     created_at timestamptz DEFAULT now()
   );
════════════════════════════════════════════════════════════════════════ */

async function sbEnviarMensaje(remitenteId, destinatarioId, contenido) {
  const { error } = await sbFetch("mensajes", {
    method: "POST",
    body: JSON.stringify({ remitente_id: remitenteId, destinatario_id: destinatarioId, contenido }),
  });
  return { error };
}

async function sbGetConversaciones(usuarioId) {
  const { data, error } = await sbFetch(
    `mensajes?or=(remitente_id.eq.${usuarioId},destinatario_id.eq.${usuarioId})&order=created_at.desc&select=id,contenido,leido,created_at,remitente:perfiles!mensajes_remitente_id_fkey(id,nombre_completo,rol),destinatario:perfiles!mensajes_destinatario_id_fkey(id,nombre_completo,rol)`
  );
  if (error) return { data: [], error };
  const convMap = {};
  (data || []).forEach(m => {
    const esRemitente = m.remitente?.id === usuarioId;
    const otro = esRemitente ? m.destinatario : m.remitente;
    if (!otro) return;
    if (!convMap[otro.id]) {
      convMap[otro.id] = {
        otroId: otro.id,
        otroNombre: otro.nombre_completo || 'Usuario',
        otroRol: otro.rol,
        ultimoMensaje: m.contenido,
        ultimaFecha: m.created_at,
        noLeidos: 0,
      };
    }
    if (!esRemitente && !m.leido) convMap[otro.id].noLeidos++;
  });
  return { data: Object.values(convMap), error: null };
}

async function sbGetMensajesConversacion(usuarioAId, usuarioBId) {
  const { data, error } = await sbFetch(
    `mensajes?or=(and(remitente_id.eq.${usuarioAId},destinatario_id.eq.${usuarioBId}),and(remitente_id.eq.${usuarioBId},destinatario_id.eq.${usuarioAId}))&order=created_at.asc`
  );
  if (error) return { data: [], error };
  return { data: data || [], error: null };
}

async function sbMarcarMensajesLeidos(remitenteId, destinatarioId) {
  const { error } = await sbFetch(
    `mensajes?remitente_id=eq.${remitenteId}&destinatario_id=eq.${destinatarioId}&leido=eq.false`,
    { method: "PATCH", body: JSON.stringify({ leido: true }) }
  );
  return { error };
}

async function sbContarNoLeidos(usuarioId) {
  const { data, error } = await sbFetch(
    `mensajes?destinatario_id=eq.${usuarioId}&leido=eq.false&select=id`
  );
  if (error) return { count: 0, error };
  return { count: (data || []).length, error: null };
}
