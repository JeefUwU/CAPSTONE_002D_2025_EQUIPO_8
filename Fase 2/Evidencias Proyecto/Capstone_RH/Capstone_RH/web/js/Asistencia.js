// Asistencia.js (FRONT empleado)
import { API_BASE_URL } from "../js/config.js";

/* ===================== Helpers generales ===================== */
const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
  "Content-Type": "application/json",
});

const getEmpleadoId = () => Number(localStorage.getItem("empleadoId") || 0);

const toPeriod = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/* fetchJSON genérico para llamar al backend (empleados, etc.) */
async function fetchJSON(path) {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, { headers: authHeaders() });
  const json = await res.json().catch(() => ({}));

  if (res.status === 401) {
    localStorage.clear();
    window.location.href = "login.html";
    throw new Error("401");
  }
  if (!res.ok) {
    console.error("[fetchJSON]", res.status, url, json);
    throw new Error(json?.error?.message || `Error ${res.status}`);
  }
  return json.data ?? json;
}

/* ---- formateo visual ---- */
const fmtDate = (v) => {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d)
    ? "—"
    : d.toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
};

const fmtTime = (v) => {
  if (!v) return "—";
  // soporta "21:19:55.481642-03" o "21:19:55"
  const m = String(v).match(/^(\d{2}:\d{2})/);
  if (m) return m[1];
  const t = String(v).slice(0, 8);
  if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t.slice(0, 5);
  return "—";
};

const hoursOrDash = (n) => {
  const v = Number.isFinite(Number(n)) ? Number(n) : 0;
  return v.toFixed(2) + " h";
};

const estadoBadge = (estadoRaw = "") => {
  const e = String(estadoRaw).toLowerCase().trim();
  let cls = "badge-neutral",
    label = estadoRaw || "—";

  if (["presente", "ok", "asistencia"].includes(e)) {
    cls = "badge-ok";
    label = "presente";
  } else if (["ausente", "falta"].includes(e)) {
    cls = "badge-bad";
    label = "ausente";
  } else if (["permiso", "licencia"].includes(e)) {
    cls = "badge-warn";
    label = "permiso";
  } else if (["tarde", "retraso"].includes(e)) {
    cls = "badge-info";
    label = "tarde";
  }

  return `<span class="badge ${cls}">${label}</span>`;
};

/* ===================== DOM refs ===================== */
const $period = document.getElementById("periodInput"); // <input type="month">
const $refresh = document.getElementById("btnRefresh");
const $btnMarcar = document.getElementById("btnMarcar");
const $tbody = document.getElementById("tbodyAsistencia");
const $sumHoras = document.getElementById("resumen-total-horas");
const $sumExtra = document.getElementById("resumen-total-extra");
const $sumDias = document.getElementById("resumen-dias-asistidos");

// Lado perfil
const $pTitle = document.getElementById("perfil-title");
const $pRol = document.getElementById("perfil-rol");
const $pId = document.getElementById("perfil-id");
const $pEmail = document.getElementById("perfil-email");
const $pTel = document.getElementById("perfil-telefono");
const $pAvatar = document.getElementById("perfil-avatar");
const $pUltAcc = document.getElementById("perfil-ultimo-acceso");

// Botones adicionales
const $btnVolver = document.getElementById("btnVolver");
const $btnLogout = document.getElementById("btnLogout");

/* ===================== Estado UI ===================== */
let ultimoRegistroAbierto = false; // true si hay entrada sin salida

function setButtonState() {
  if (!$btnMarcar) return;
  $btnMarcar.textContent = ultimoRegistroAbierto
    ? "Marcar SALIDA"
    : "Marcar ENTRADA";
}

/* ===================== Perfil (empleado real) ===================== */
function inicialesDeNombre(nombreCompleto = "") {
  const p = nombreCompleto.trim().split(/\s+/);
  return (p[0]?.[0] || "U").toUpperCase() + (p[1]?.[0] || "S").toUpperCase();
}

/**
 * Cargar datos del empleado desde /empleados/:id
 * y mostrarlos en el panel lateral.
 */
async function loadPerfilEmpleado(empleadoId) {
  let d;

  try {
    d = await fetchJSON(`/empleados/${empleadoId}`);
  } catch (e) {
    console.warn("[Asistencia] No se pudo cargar perfil desde API, usando localStorage...", e);
    // Fallback a los datos que ya guardamos en localStorage
    d = {
      nombre: localStorage.getItem("userNombre") || "Empleado",
      apellidos_completos: localStorage.getItem("userApellido") || "",
      rol: localStorage.getItem("userRol") || "Empleado",
      id_empleado: empleadoId,
      correo: localStorage.getItem("userEmail") || "—",
      telefono: localStorage.getItem("userPhone") || "—",
    };
  }

  const nombreBase =
    d.nombre_completo || d.nombre_empleado || d.nombre || "Empleado";
  const apell =
    d.apellidos_completos || d.apellido_paterno || d.apellido || "";
  const inicial = inicialesDeNombre(`${nombreBase} ${apell}`);

  if ($pTitle)
    $pTitle.textContent = apell ? `${nombreBase} ${apell[0]}.` : nombreBase;
  if ($pRol)
    $pRol.textContent = d.rol || localStorage.getItem("userRol") || "Empleado";
  if ($pId)
    $pId.textContent = `ID: EMP-${String(d.id_empleado || empleadoId).padStart(
      5,
      "0"
    )}`;
  if ($pEmail) $pEmail.textContent = d.correo || "—";
  if ($pTel) $pTel.textContent = d.telefono || "—";
  if ($pAvatar) $pAvatar.textContent = inicial;

  if ($pUltAcc) {
    const hoyIso = new Date().toISOString().slice(0, 10);
    $pUltAcc.textContent = `Último acceso: ${hoyIso}`;
  }
}

/* ===================== API calls (asistencia) ===================== */
/**
 * Backend (según tu router):
 *   GET  /asistencia/:id_empleado/dias?period=YYYY-MM
 *   GET  /asistencia/:id_empleado/resumen?period=YYYY-MM
 *   POST /asistencia/marcar
 */

// 🔹 Listar días de asistencia del empleado
async function apiListarDias(empleadoId, period) {
  const url = `${API_BASE_URL}/asistencia/${empleadoId}/dias?period=${encodeURIComponent(
    period
  )}`;
  const res = await fetch(url, { headers: authHeaders() });
  const json = await res.json().catch(() => ({}));

  if (res.status === 401) {
    localStorage.clear();
    window.location.href = "login.html";
    return { data: [], abierto: false };
  }
  if (!res.ok) {
    console.error("API_LISTAR_DIAS_ERROR", res.status, json);
    throw new Error(json?.error?.message || "No se pudo cargar asistencia");
  }

  // contrato del back: { data: [...], abierto: true/false }
  return json;
}

// 🔹 Resumen mensual de asistencia
async function apiResumen(empleadoId, period) {
  const url = `${API_BASE_URL}/asistencia/${empleadoId}/resumen?period=${encodeURIComponent(
    period
  )}`;
  const res = await fetch(url, { headers: authHeaders() });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("API_RESUMEN_ERROR", res.status, json);
    throw new Error(json?.error?.message || "No se pudo cargar el resumen");
  }

  // backend responde { data: { total_horas, total_horas_extra, dias_asistidos } }
  return json?.data || json;
}

// 🔹 Marcar entrada/salida (el back decide según jornada abierta)
async function apiMarcar() {
  const res = await fetch(`${API_BASE_URL}/asistencia/marcar`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({}), // el back decide si es entrada o salida
  });
  const json = await res.json().catch(() => ({}));

  if (res.status === 401) {
    localStorage.clear();
    window.location.href = "login.html";
    return null;
  }
  if (!res.ok) {
    console.error("API_MARCAR_ERROR", res.status, json);
    throw new Error(json?.error?.message || "No se pudo marcar asistencia");
  }

  return json?.data || json;
}

/* ===================== Render tabla/resumen ===================== */
function renderTabla(rows = []) {
  if (!$tbody) return;

  if (!rows.length) {
    $tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;color:#6b7280;padding:18px">
          No hay registros en el periodo seleccionado.
        </td>
      </tr>`;
    return;
  }

  $tbody.innerHTML = rows
    .map(
      (d) => `
      <tr>
        <td>${fmtDate(d.fecha)}</td>
        <td>${fmtTime(d.hora_entrada)}</td>
        <td>${fmtTime(d.hora_salida)}</td>
        <td>${d.minutos_colacion ?? 60}</td>
        <td>${hoursOrDash(d.horas_trabajadas)}</td>
        <td>${hoursOrDash(d.horas_extra)}</td>
        <td>${estadoBadge(d.estado)}</td>
        <td>${d.observacion || "—"}</td>
      </tr>
    `
    )
    .join("");
}

function renderResumen(res = {}) {
  if ($sumHoras) $sumHoras.textContent = hoursOrDash(res.total_horas);
  if ($sumExtra) $sumExtra.textContent = hoursOrDash(res.total_horas_extra);
  if ($sumDias) $sumDias.textContent = Number(res.dias_asistidos ?? 0);
}

/* ===================== Carga principal ===================== */
async function loadAll() {
  const token = localStorage.getItem("accessToken");
  const empleadoId = getEmpleadoId();

  if (!token || !empleadoId) {
    localStorage.clear();
    window.location.href = "login.html";
    return;
  }

  const period = ($period && $period.value) || toPeriod();

  try {
    // Perfil (carga en paralelo, pero si falla igual seguimos)
    loadPerfilEmpleado(empleadoId).catch((e) =>
      console.error("PERFIL_ERROR", e)
    );

    const [{ data = [], abierto = false }, resumen] = await Promise.all([
      apiListarDias(empleadoId, period),
      apiResumen(empleadoId, period),
    ]);

    ultimoRegistroAbierto = Boolean(abierto);
    setButtonState();
    renderTabla(data);
    renderResumen(resumen);
  } catch (err) {
    console.error("ASISTENCIA_LOAD_ERROR", err);
    renderTabla([]);
    renderResumen({});
  }
}

/* ===================== Eventos ===================== */
document.addEventListener("DOMContentLoaded", () => {
  // default mes actual si el input está vacío
  if ($period && !$period.value) $period.value = toPeriod();

  loadAll();

  $period?.addEventListener("change", loadAll);
  $refresh?.addEventListener("click", loadAll);

  $btnMarcar?.addEventListener("click", async () => {
    $btnMarcar.disabled = true;
    try {
      await apiMarcar();
      await loadAll();
    } catch (e) {
      alert(e.message || "No se pudo marcar asistencia.");
    } finally {
      $btnMarcar.disabled = false;
    }
  });

  // Navegación auxiliar
  $btnVolver?.addEventListener("click", () => {
    window.location.href = "./empleado.html";
  });

  // Cerrar sesión
  $btnLogout?.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "login.html";
  });
});