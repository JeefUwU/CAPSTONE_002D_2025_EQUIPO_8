// -------- Config --------
const API_BASE =
  (window.__CONFIG && window.__CONFIG.API_BASE_URL) ||
  window.API_BASE_URL ||
  "http://localhost:3000/api/v1";

const token = () => localStorage.getItem("accessToken");
const authHdrs = () => ({ Authorization: `Bearer ${token()}` });
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const toYMD = (v) => {
  if (!v) return "—";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return isNaN(d) ? "—" : d.toISOString().slice(0, 10);
};

const yearOf = (v) => {
  const d = new Date(v);
  return isNaN(d) ? "s/f" : String(d.getFullYear());
};

// -------- Guard --------
function guard() {
  const t = token();
  const rol = (localStorage.getItem("userRol") || "").toLowerCase();
  const nom =
    localStorage.getItem("userNombre") || localStorage.getItem("userName");

  if (!t) {
    location.href = "login.html";
    return false;
  }
  if (!["admin", "rrhh"].includes(rol)) {
    location.href = "empleado.html";
    return false;
  }

  const uName = $("#uName");
  if (uName && nom) uName.textContent = nom;

  const uRole = $("#uRole");
  if (uRole && rol) uRole.textContent = rol.toUpperCase();

  return true;
}

if (!guard()) {
  // si no pasa el guard redirige; no seguimos usando este panel
}

// -------- Fetch helper --------
async function getJSON(path) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, { headers: authHdrs() });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }

  if (res.status === 401) {
    localStorage.clear();
    location.href = "login.html";
    throw new Error("401");
  }

  if (!res.ok) {
    throw new Error(json?.error?.message || `HTTP ${res.status} ${url}`);
  }

  return json.data ?? json ?? [];
}

// -------- PDF helper --------
async function abrirPdf(tipo, id) {
  const url = `${API_BASE}/documentos/${tipo}/${id}/pdf`;
  const r = await fetch(url, { headers: authHdrs() });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);

  const blob = await r.blob();
  const u = URL.createObjectURL(blob);
  window.open(u, "_blank");
  setTimeout(() => URL.revokeObjectURL(u), 60000);
}
window.abrirPdf = abrirPdf;

// ===================================================================
//                  HOOKS GLOBALES PARA PESTAÑAS
// ===================================================================
window.EMP_onEnterTabIfVisible = null;   // empleados
window.CAP_onEnterTabIfVisible = null;   // capacitaciones
window.SOL_onEnterTabIfVisible = null;   // solicitudes
window.DOC_onEnterTabIfVisible = null;   // contratos (si quieres)
window.ASIS_onEnterTabIfVisible = null;  // ✅ asistencia
window.LIQ_onEnterTabIfVisible = null;   // ✅ liquidaciones

// ===================================================================
//                         MENÚ + NAVEGACIÓN
// ===================================================================
(function initMenu() {
  const KEY = "admin:lastSection";

  const sections = () => $$("main .content");
  const exists = (id) => sections().some((s) => s.id === id);

  function setActive(id) {
    sections().forEach((s) => s.classList.toggle("active", s.id === id));

    $$(".access-btn[data-target]").forEach((b) => {
      const on = b.dataset.target === id;
      b.classList.toggle("active", on);
      if (on) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
  }

  function showSection(id, { push = true, force = false } = {}) {
    if (!exists(id)) id = "dashboard";

    setActive(id);

    if (push) {
      localStorage.setItem(KEY, id);
      history.replaceState(null, "", "#" + id);
    }

    // ---------- llamados a cada módulo ----------
    // Contratos (si tu módulo usa loadDocs)
    if (id === "contratos" && typeof loadDocs === "function") {
      loadDocs({ force: true });
    }

    // Empleados
    if (id === "empleados" && window.EMP_onEnterTabIfVisible) {
      window.EMP_onEnterTabIfVisible();
    }

    // Capacitaciones
    if (id === "capacitaciones" && window.CAP_onEnterTabIfVisible) {
      window.CAP_onEnterTabIfVisible();
    }

    // Solicitudes
    if (id === "solicitudes" && window.SOL_onEnterTabIfVisible) {
      window.SOL_onEnterTabIfVisible();
    }

    // Asistencia ✅
    if (id === "asistencia" && window.ASIS_onEnterTabIfVisible) {
      window.ASIS_onEnterTabIfVisible();
    }

    // Liquidaciones ✅
    if (id === "liquidaciones" && window.LIQ_onEnterTabIfVisible) {
      window.LIQ_onEnterTabIfVisible();
    }

    // Ficha empleado
    if (id === "fichaEmpleado" && window.loadFicha) {
      window.loadFicha();
    }

    // Ficha solicitud
    if (id === "fichaSolicitud" && window.loadSolicitud) {
      window.loadSolicitud();
    }
  }

  // click en menú lateral
  const nav = $(".side-nav");
  nav?.addEventListener("click", (e) => {
    const btn = e.target.closest(".access-btn[data-target]");
    if (!btn) return;
    e.preventDefault();
    showSection(btn.dataset.target, { push: true, force: true });
  });

  // accesibilidad teclado
  $$(".access-btn[data-target]").forEach((b) => {
    b.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        b.click();
      }
    });
  });

  // cambio de hash (ej: pegan URL con #fichaEmpleado)
  window.addEventListener("hashchange", () => {
    const id = (location.hash || "").slice(1);
    if (exists(id)) showSection(id, { push: false, force: true });
  });

  // al volver con atrás del navegador (bfcache)
  window.addEventListener("pageshow", () => {
    const id =
      (location.hash || "").slice(1) ||
      localStorage.getItem(KEY) ||
      "dashboard";
    if (exists(id)) showSection(id, { push: false, force: true });
  });

  const hash = (location.hash || "").slice(1);
  const stored = localStorage.getItem(KEY);
  const initial = exists(hash) ? hash : exists(stored) ? stored : "dashboard";

  showSection(initial, {
    push: true,
    force:
      initial === "contratos" ||
      initial === "empleados" ||
      initial === "capacitaciones" ||
      initial === "asistencia" ||
      initial === "liquidaciones" ||
      initial === "fichaEmpleado" ||
      initial === "solicitudes" ||
      initial === "fichaSolicitud",
  });

  // botón "Volver" de ficha empleado
  $("#fichaVolver")?.addEventListener("click", () => {
    showSection("empleados", { push: true, force: true });
  });

  // botón "Volver" de ficha solicitud (id en tu HTML es solVolver)
  $("#solVolver")?.addEventListener("click", () => {
    showSection("solicitudes", { push: true, force: true });
  });

  // Logout top
  $("#btnLogout")?.addEventListener("click", async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHdrs() },
        body: JSON.stringify({
          refreshToken: localStorage.getItem("refreshToken"),
        }),
      }).catch(() => {});
    } finally {
      localStorage.clear();
      location.href = "login.html";
    }
  });

  // Botón "volver a vista empleado"
  $("#btnVolver")?.addEventListener("click", () => {
    location.href = "empleado.html";
  });
})();