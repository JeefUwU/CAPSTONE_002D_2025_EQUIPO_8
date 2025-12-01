const API_BASE_URL =
  (window.__CONFIG && window.__CONFIG.API_BASE_URL) ||
  window.API_BASE_URL ||
  "http://localhost:3000/api/v1";

console.info("[empleado.js] API_BASE_URL =", API_BASE_URL);

/* ========== Utils ========== */
const token = () => localStorage.getItem("accessToken");
const auth  = () => ({ Authorization: `Bearer ${token()}` });
const $     = (sel) => document.querySelector(sel);
const setText = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
const setHTML = (sel, v) => { const el = $(sel); if (el) el.innerHTML = v; };

const toYMD = (v) => {
  if (!v) return "—";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return isNaN(d) ? "—" : d.toISOString().slice(0, 10);
};

async function fetchJSON(path) {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, { headers: auth() });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) {
    localStorage.clear();
    location.href = "login.html";
    throw new Error("401");
  }
  if (!res.ok) {
    console.error("[fetchJSON]", res.status, url, json);
    throw new Error(json?.error?.message || `Error ${res.status}`);
  }
  return json.data ?? json;
}

async function fetchBlob(path) {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, { headers: auth() });
  if (res.status === 401) {
    localStorage.clear();
    location.href = "login.html";
    throw new Error("401");
  }
  if (!res.ok) {
    console.error("[fetchBlob]", res.status, url);
    throw new Error("No se pudo obtener PDF");
  }
  return await res.blob();
}

const openBlob = (b) => {
  const u = URL.createObjectURL(b);
  window.open(u, "_blank");
  setTimeout(() => URL.revokeObjectURL(u), 60000);
};

const downloadBlob = (b, fn) => {
  const u = URL.createObjectURL(b);
  const a = document.createElement("a");
  a.href = u;
  a.download = fn;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 60000);
};

/* ========== Tabs ========== */
function showSection(targetId) {
  document.querySelectorAll("section.content").forEach((s) =>
    s.classList.toggle("active", s.id === targetId)
  );
  document
    .querySelectorAll(".access .access-btn[data-target]")
    .forEach((btn) => {
      const on = btn.dataset.target === targetId;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });

  if (["docs", "liq", "cap", "sol"].includes(targetId)) {
    history.replaceState(null, "", `#${targetId}`);
  }
}

function initTabs() {
  document
    .querySelectorAll(".access .access-btn[data-target]")
    .forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        showSection(btn.dataset.target);
      });
    });

  const initial = (location.hash || "#docs").slice(1);
  showSection(["docs", "liq", "cap", "sol"].includes(initial) ? initial : "docs");
}

/* ========== Perfil ========== */
async function loadPerfil(empleadoId) {
  let d;
  try {
    d = await fetchJSON(`/empleados/${empleadoId}`);
  } catch {
    d = {
      nombre: localStorage.getItem("userNombre") || "Empleado",
      apellidos_completos: localStorage.getItem("userApellido") || "",
      rol: localStorage.getItem("userRol") || "Empleado",
      id_empleado: empleadoId,
      correo: localStorage.getItem("userEmail") || "—",
      telefono: localStorage.getItem("userPhone") || "—",
    };
  }
  const nombre  = d.nombre_completo || d.nombre_empleado || d.nombre || "Empleado";
  const apell   = d.apellidos_completos || "";
  const inicial = (nombre?.[0] || "U").toUpperCase() + (apell?.[0] || "S").toUpperCase();

  setText("#perfil-title", apell ? `${nombre} ${apell[0]}.` : nombre);
  setText("#perfil-rol", d.rol || localStorage.getItem("userRol") || "Empleado");
  setText("#perfil-id", `ID: EMP-${String(d.id_empleado || empleadoId).padStart(5, "0")}`);
  setText("#perfil-email", d.correo || "—");
  setText("#perfil-telefono", d.telefono || "—");
  setText("#perfil-avatar", inicial);
  setText("#perfil-ultimo-acceso", `Último acceso: ${toYMD(new Date())}`);
}

/* ========== API helpers ========== */
const API = {
  contratos:      (idEmp) => fetchJSON(`/contratos/empleado/${idEmp}`),
  anexos:         (idEmp) => fetchJSON(`/anexos/empleado/${idEmp}`),
  // 🔧 CORREGIDO: coincide con backend GET /api/v1/liquidaciones/:id
  liquidaciones:  (idEmp) => fetchJSON(`/liquidaciones/${idEmp}`),
  capacitaciones: (idEmp) => fetchJSON(`/capacitaciones/empleado/${idEmp}`),
  pdfPath:        (tipo, id) => `/documentos/${tipo}/${id}/pdf`,
};

async function abrirPDF(tipo, id) {
  openBlob(await fetchBlob(API.pdfPath(tipo, id)));
}
async function descargarPDF(tipo, id, filename) {
  downloadBlob(await fetchBlob(API.pdfPath(tipo, id)), filename);
}

/* ========== Render genérico ========== */
function renderList({ target, emptyText, items, mapItem }) {
  if (!document.querySelector(target)) return;
  if (!items?.length) {
    setHTML(
      target,
      `<div class="small" style="color:#6b7280">${emptyText}</div>`
    );
    return;
  }
  setHTML(target, items.map(mapItem).join(""));
}

/* ===== Documentos ===== */
function pintarDocumentos({ contratos = [], anexos = [] }) {
  document.getElementById("documentsLoading")?.remove();

  renderList({
    target: "#documentsList",
    emptyText: "Sin documentos.",
    items: [
      {
        __title: "Contratos",
        __html: contratos
          .map((c) => {
            const id = c.id_contrato;
            const ini = toYMD(c.fecha_inicio);
            const fin = toYMD(c.fecha_termino);
            const anio = ini && ini !== "—" ? ini.slice(0, 4) : "s/f";
            return `
        <div class="doc">
          <div>
            <strong>Contrato ${anio}</strong><br>
            <span class="small">Inicio: ${ini} | Término: ${fin}</span>
          </div>
          <div class="doc-actions">
            <button class="btn small" data-open data-tipo="contratos" data-id="${id}">Ver PDF</button>
            <button class="btn small descargar" data-dl data-tipo="contratos" data-id="${id}" data-fn="Contrato_${anio}_${id}.pdf">Descargar</button>
          </div>
        </div>`;
          })
          .join(""),
      },
      {
        __title: "Anexos",
        __html: anexos
          .map((a) => {
            const id = a.id_anexo || a.id;
            const fecha = toYMD(a.fecha || a.fecha_emision || a.creado_en);
            const tipo = a.tipo_cambio || "condición";
            const anio = fecha && fecha !== "—" ? fecha.slice(0, 4) : "s/f";
            return `
        <div class="doc">
          <div>
            <strong>Anexo ${anio} – Cambio de ${tipo}</strong><br>
            <span class="small">Fecha: ${fecha} | Tipo: ${tipo}</span>
          </div>
          <div class="doc-actions">
            <button class="btn small" data-open data-tipo="anexos" data-id="${id}">Ver PDF</button>
            <button class="btn small descargar" data-dl data-tipo="anexos" data-id="${id}" data-fn="Anexo_${anio}_${id}.pdf">Descargar</button>
          </div>
        </div>`;
          })
          .join(""),
      },
    ],
    mapItem: (blk) => `
      <h3 class="docs-title" style="${
        blk.__title === "Anexos" ? "margin-top:1rem;" : ""
      }">${blk.__title}</h3>
      ${
        blk.__html ||
        `<div class="small" style="color:#6b7280">Sin ${blk.__title.toLowerCase()}.</div>`
      }
    `,
  });

  $("#documentsList").onclick = (e) => {
    const o = e.target.closest("[data-open]");
    const d = e.target.closest("[data-dl]");
    if (o) abrirPDF(o.dataset.tipo, o.dataset.id);
    if (d) descargarPDF(d.dataset.tipo, d.dataset.id, d.dataset.fn);
  };
}

/* ===== Liquidaciones ===== */
function pintarLiquidaciones(liqs = []) {
  renderList({
    target: "#liquidacionesList",
    emptyText: "Sin liquidaciones registradas.",
    items: liqs,
    mapItem: (l) => {
      const periodo = l.periodo || "s/p";
      const liquido = Number(l.sueldo_liquido || 0).toLocaleString("es-CL");
      const id = l.id_liquidacion;
      return `
        <div class="liq">
          <div>
            <strong>Liquidación ${periodo}</strong><br>
            <span class="small">Líquido: $${liquido}</span>
          </div>
          <div class="doc-actions">
            <button class="btn small" data-open data-tipo="liquidaciones" data-id="${id}">Ver PDF</button>
            <button class="btn small descargar" data-dl data-tipo="liquidaciones" data-id="${id}" data-fn="Liquidacion_${periodo}_${id}.pdf">Descargar</button>
          </div>
        </div>`;
    },
  });

  $("#liquidacionesList").onclick = (e) => {
    const o = e.target.closest("[data-open]");
    const d = e.target.closest("[data-dl]");
    if (o) abrirPDF(o.dataset.tipo, o.dataset.id);
    if (d) descargarPDF(d.dataset.tipo, d.dataset.id, d.dataset.fn);
  };
}

/* ===== Capacitaciones ===== */
function pintarCapacitaciones(caps = []) {
  renderList({
    target: "#capList",
    emptyText: "Sin capacitaciones registradas.",
    items: caps,
    mapItem: (c) => {
      const id = c.id_capacitacion;
      const fecha = toYMD(c.fecha);
      const tipo = c.tipo || "—";
      const titulo = c.titulo || "—";
      return `
        <div class="cap">
          <div>
            <strong>${titulo}</strong><br>
            <span class="small">Fecha: ${fecha} • Tipo: ${tipo}</span>
            ${
              c.descripcion
                ? `<div class="small" style="margin-top:4px">${c.descripcion}</div>`
                : ""
            }
          </div>
          <div class="doc-actions">
            <button class="btn small" data-open data-tipo="capacitaciones" data-id="${id}">Ver PDF</button>
            <button class="btn small descargar" data-dl data-tipo="capacitaciones" data-id="${id}" data-fn="Capacitacion_${fecha}_${id}.pdf">Descargar</button>
          </div>
        </div>`;
    },
  });

  $("#capList").onclick = (e) => {
    const o = e.target.closest("[data-open]");
    const d = e.target.closest("[data-dl]");
    if (o) abrirPDF(o.dataset.tipo, o.dataset.id);
    if (d) descargarPDF(d.dataset.tipo, d.dataset.id, d.dataset.fn);
  };
}

/* ========== Solicitudes (empleado) ========== */

async function getSolicitudesMias() {
  return await fetchJSON("/solicitudes/mias");
}

// Render en el contenedor existente .solicitudes-list
function pintarSolicitudes(items = []) {
  const box = document.querySelector(".solicitudes-list");
  if (!box) return;

  if (!items.length) {
    box.innerHTML =
      '<div class="small" style="color:#6b7280">Aún no tienes solicitudes.</div>';
    return;
  }

  box.innerHTML = items
    .map((s) => {
      const f = (s.creado_en || "").slice(0, 10);
      const estado = s.estado?.replaceAll("_", " ") || "en revisión";
      return `
      <div class="sol">
        <div>
          <div><strong>${s.asunto}</strong></div>
          <div class="small">Tipo: ${s.tipo} • Estado: ${estado} • ${f}</div>
          ${
            s.respuesta
              ? `<div class="small" style="margin-top:4px"><em>Respuesta:</em> ${s.respuesta}</div>`
              : ""
          }
          ${
            s.adjunto_url
              ? `<div class="small" style="margin-top:4px"><a target="_blank" href="${API_BASE_URL.replace(
                  /\/api\/v1$/,
                  ""
                )}${s.adjunto_url}">Ver adjunto</a></div>`
              : ""
          }
        </div>
        <div class="small"></div>
      </div>`;
    })
    .join("");
}

/* --- Envío del formulario (ARREGLADO) --- */
async function submitRequest(event) {
  event.preventDefault();

  const form   = event.target;
  const notice = document.getElementById("request-notice");
  const btn    = form.querySelector(".req-submit");

  if (notice) {
    notice.classList.remove("show");
    notice.textContent = "Solicitud enviada correctamente.";
    notice.style.background = "#ecfdf5";
    notice.style.color = "#065f46";
  }

  const originalBtnHTML = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "Enviando…";
  }

  const fd = new FormData(form); // incluye adjunto si se seleccionó

  try {
    const res = await fetch(`${API_BASE_URL}/solicitudes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
      body: fd,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error?.message || `Error (${res.status})`);

    // feedback UI
    form.reset();
    const nameEl = form.querySelector(".req-file__name");
    if (nameEl) nameEl.textContent = "Ningún archivo seleccionado";

    if (notice) {
      notice.textContent = "Solicitud enviada correctamente.";
      notice.classList.add("show");
    }

    // refrescar lista de solicitudes del empleado
    try {
      const mias = await getSolicitudesMias();
      pintarSolicitudes(mias);
    } catch (e) {
      console.error("No se pudieron refrescar las solicitudes:", e);
    }
  } catch (e) {
    console.error(e);
    if (notice) {
      notice.textContent = `No se pudo enviar la solicitud: ${e.message}`;
      notice.style.background = "#fef2f2";
      notice.style.color = "#b91c1c";
      notice.classList.add("show");
    } else {
      alert(`No se pudo enviar la solicitud: ${e.message}`);
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtnHTML;
    }
  }
}

/* Nombre del archivo seleccionado en el input */
document.addEventListener("change", (e) => {
  const input = e.target.closest(".req-file");
  if (!input) return;
  const nameEl = input.parentElement.querySelector(".req-file__name");
  nameEl.textContent = input.files?.[0]?.name || "Ningún archivo seleccionado";
});

/* ========== INIT ========== */
document.addEventListener("DOMContentLoaded", async () => {
  const tk = token();
  const empleadoId = Number(localStorage.getItem("empleadoId") || 0);
  if (!tk || !empleadoId) {
    localStorage.clear();
    location.href = "login.html";
    return;
  }

  $("#btnAsistencia")?.addEventListener(
    "click",
    () => (location.href = "./asistencia.html")
  );
  $("#btnLogout")?.addEventListener("click", () => {
    localStorage.clear();
    location.href = "login.html";
  });

  const rol = localStorage.getItem("userRol");
  const adminBtn = $("#btnAdmin");
  if (adminBtn && (rol === "admin" || rol === "rrhh")) {
    adminBtn.style.display = "flex";
    adminBtn.addEventListener(
      "click",
      () => (location.href = "./Panel_administracion.html")
    );
  }

  initTabs();
  await loadPerfil(empleadoId);

  // enganchar el formulario (ya sin onsubmit en HTML)
  const form = document.getElementById("request-form");
  if (form) {
    form.addEventListener("submit", submitRequest);
  }

  // cargar datos iniciales
  try {
    const [contratos, anexos, liqs, caps, mias] = await Promise.all([
      fetchJSON(`/contratos/empleado/${empleadoId}`),
      fetchJSON(`/anexos/empleado/${empleadoId}`),
      // 🔧 CORREGIDO: coincide con la ruta del backend
      fetchJSON(`/liquidaciones/${empleadoId}`),
      fetchJSON(`/capacitaciones/empleado/${empleadoId}`),
      getSolicitudesMias(),
    ]);
    pintarDocumentos({ contratos, anexos });
    pintarLiquidaciones(liqs);
    pintarCapacitaciones(caps);
    pintarSolicitudes(mias);
    $("#documentsLoading")?.remove();
  } catch (e) {
    console.error("[INIT] Error cargando datos:", e);
    $("#documentsList")?.insertAdjacentHTML(
      "beforeend",
      `<div class="small" style="color:#b91c1c;margin-top:8px">Error al cargar documentos.</div>`
    );
    $("#liquidacionesList")?.insertAdjacentHTML(
      "beforeend",
      `<div class="small" style="color:#b91c1c;margin-top:8px">Error al cargar liquidaciones.</div>`
    );
    $("#capList")?.insertAdjacentHTML(
      "beforeend",
      `<div class="small" style="color:#b91c1c;margin-top:8px">Error al cargar capacitaciones.</div>`
    );
    $("#documentsLoading")?.remove();
    const err = $("#documentsError");
    if (err) {
      err.style.display = "block";
      err.textContent = "Error al cargar documentos.";
    }
  }
});