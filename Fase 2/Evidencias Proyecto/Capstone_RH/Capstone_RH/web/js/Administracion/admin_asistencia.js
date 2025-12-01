// ===================================================================
// ===================== MÓDULO: Asistencia (ADMIN) ==================
// ===================================================================
(() => {
  const ASIS_API_BASE =
    (window.__CONFIG && window.__CONFIG.API_BASE_URL) ||
    window.API_BASE_URL ||
    "http://localhost:3000/api/v1";

  const ASIS_token = () => localStorage.getItem("accessToken");
  const ASIS_hdrs = () => ({ Authorization: `Bearer ${ASIS_token()}` });
  const $ = (sel, root = document) => root.querySelector(sel);

  let ASIS_inited = false;
  let ASIS_loaded = false;
  let ASIS_all = [];
  let ASIS_page = 1;
  const ASIS_SIZE = 20;

  // ------------------------ Helpers de fecha ---------------------- //
  function toYMD(value) {
    if (!value) return "";
    // Si ya viene como 'YYYY-MM-DD'
    if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) {
      return String(value).slice(0, 10);
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function getCurrentPeriod() {
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`; // YYYY-MM
  }

  // ------------------------ Fetch helpers ------------------------ //
  async function ASIS_get(path) {
    const url = `${ASIS_API_BASE}${path}`;
    const res = await fetch(url, { headers: ASIS_hdrs() });
    const txt = await res.text();
    let json;
    try {
      json = txt ? JSON.parse(txt) : {};
    } catch {
      json = {};
    }

    if (res.status === 401) {
      console.warn("[ASIS_get] 401, limpiando sesión…");
      localStorage.clear();
      location.href = "login.html";
      throw new Error("401");
    }
    if (!res.ok) {
      const msg = json?.error?.message || `[${res.status}] ${url}`;
      throw new Error(msg);
    }
    return json.data ?? json ?? [];
  }

  async function ASIS_put(path, body) {
    const url = `${ASIS_API_BASE}${path}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...ASIS_hdrs(),
      },
      body: JSON.stringify(body || {}),
    });
    const txt = await res.text();
    let json;
    try {
      json = txt ? JSON.parse(txt) : {};
    } catch {
      json = {};
    }

    if (res.status === 401) {
      console.warn("[ASIS_put] 401, limpiando sesión…");
      localStorage.clear();
      location.href = "login.html";
      throw new Error("401");
    }
    if (!res.ok) {
      const msg = json?.error?.message || `[${res.status}] ${url}`;
      throw new Error(msg);
    }
    return json.data ?? json ?? {};
  }

  // --------------------- Normalizar fila ------------------------ //
  function ASIS_normalizeRow(r) {
    const id_asistencia = r.id_asistencia;
    const id_empleado = r.id_empleado;

    const nombre =
      r.nombre_empleado ||
      [r.nombre, r.apellido_paterno, r.apellido_materno]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      "Empleado";

    const rut = r.rut
      ? `${r.rut}${r.digito_verificador ? "-" + r.digito_verificador : ""}`
      : "";

    const cargo = r.cargo || "";
    const fecha = r.fecha || null;
    const estado = (r.estado || "").toLowerCase();

    return {
      id_asistencia,
      id_empleado,
      nombre,
      rut,
      cargo,
      fecha,
      hora_entrada: r.hora_entrada || null,
      hora_salida: r.hora_salida || null,
      horas_trabajadas: r.horas_trabajadas ?? 0,
      horas_extra: r.horas_extra ?? 0,
      minutos_colacion: r.minutos_colacion ?? 0,
      estado,
      observacion: r.observacion || "",
    };
  }

  // --------------------- Skeleton de carga ---------------------- //
  function ASIS_skeleton() {
    const root = $("#asisListContainer");
    if (!root) return;
    root.innerHTML = `
      <div class="doc" style="opacity:.7">
        <div>
          <div class="skel" style="width:260px;height:16px"></div>
          <div class="skel" style="width:180px;height:14px;margin-top:6px"></div>
        </div>
      </div>
      <div class="doc" style="opacity:.7">
        <div>
          <div class="skel" style="width:220px;height:16px"></div>
          <div class="skel" style="width:160px;height:14px;margin-top:6px"></div>
        </div>
      </div>
    `;
  }

  // --------------------- Abrir / cerrar modal ------------------- //
  function ASIS_openModal(row) {
    const overlay = $("#asisModalOverlay");
    if (!overlay || !row) return;

    overlay.style.display = "block";

    const msg = $("#asisFormMsg");
    if (msg) {
      msg.textContent = "";
      msg.style.color = "";
    }

    $("#asis_id_asistencia").value = row.id_asistencia ?? "";
    $("#asis_nombre").value = row.nombre ?? "";
    $("#asis_fecha").value = row.fecha ? toYMD(row.fecha) : "";
    $("#asis_hora_entrada").value = row.hora_entrada || "";
    $("#asis_hora_salida").value = row.hora_salida || "";
    $("#asis_min_colacion").value = row.minutos_colacion ?? 0;
    $("#asis_horas_trab").value = row.horas_trabajadas ?? 0;
    $("#asis_horas_extra").value = row.horas_extra ?? 0;
    $("#asis_estado_edit").value = row.estado || "presente";
    $("#asis_observacion").value = row.observacion || "";
  }

  function ASIS_closeModal() {
    const overlay = $("#asisModalOverlay");
    if (overlay) overlay.style.display = "none";
  }

  // ------------------------ Render listado ---------------------- //
  function ASIS_render(list) {
    const root = $("#asisListContainer");
    if (!root) return;

    if (!Array.isArray(list) || list.length === 0) {
      root.innerHTML =
        `<div class="muted">No hay registros de asistencia para los filtros seleccionados.</div>`;
      ASIS_updatePager(0, 0);
      return;
    }

    const start = (ASIS_page - 1) * ASIS_SIZE;
    const pageItems = list.slice(start, start + ASIS_SIZE);

    root.innerHTML = pageItems
      .map((r) => {
        const fechaStr = r.fecha ? toYMD(r.fecha) : "—";
        const he = r.hora_entrada ? r.hora_entrada.toString().slice(0, 5) : "—";
        const hs = r.hora_salida ? r.hora_salida.toString().slice(0, 5) : "—";
        const chipClass =
          r.estado === "presente" ||
          r.estado === "ok" ||
          r.estado === "asistencia"
            ? "vigente"
            : "finalizado";

        return `
          <div class="doc">
            <div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <strong>${r.nombre}</strong>
                <span class="chip ${chipClass}">${r.estado || "—"}</span>
              </div>
              <div class="small">
                Fecha: ${fechaStr}
                · Entrada: ${he}
                · Salida: ${hs}
                · Horas: ${Number(r.horas_trabajadas).toFixed(2)}
                ${
                  Number(r.horas_extra) > 0
                    ? `· Extra: ${Number(r.horas_extra).toFixed(2)}`
                    : ""
                }
              </div>
              <div class="small">
                ID Emp: ${r.id_empleado ?? "—"}
                ${r.rut ? `· RUT: ${r.rut}` : ""}
                ${r.cargo ? `· Cargo: ${r.cargo}` : ""}
              </div>
              ${
                r.observacion
                  ? `<div class="small" style="margin-top:4px;">Obs: ${r.observacion}</div>`
                  : ""
              }
            </div>
            <div class="doc-actions">
              <button
                class="btn small"
                type="button"
                data-asis-id="${r.id_asistencia}"
              >
                Ver / Editar
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    // Click en "Ver / Editar": abre modal con datos del registro
    root.onclick = (ev) => {
      const btn = ev.target.closest("[data-asis-id]");
      if (!btn) return;
      const id = btn.getAttribute("data-asis-id");
      if (!id) return;

      const row = ASIS_all.find(
        (x) => String(x.id_asistencia) === String(id)
      );
      if (!row) {
        console.warn("[ASIS] No se encontró el registro en memoria:", id);
        return;
      }
      ASIS_openModal(row);
    };

    ASIS_updatePager(list.length, pageItems.length);
  }

  // -------------------------- Pager ----------------------------- //
  function ASIS_updatePager(total, currentCount) {
    const info = $("#asisPageInfo");
    const prev = $("#asisPrev");
    const next = $("#asisNext");

    const totalPages = Math.max(1, Math.ceil(total / ASIS_SIZE));
    if (ASIS_page > totalPages) ASIS_page = totalPages;

    if (info) info.textContent = `Página ${ASIS_page} de ${totalPages}`;

    if (prev) {
      prev.disabled = ASIS_page <= 1;
      prev.onclick = () => {
        if (ASIS_page > 1) {
          ASIS_page--;
          ASIS_applyFilters();
        }
      };
    }
    if (next) {
      next.disabled = ASIS_page >= totalPages || currentCount === 0;
      next.onclick = () => {
        ASIS_page++;
        ASIS_applyFilters();
      };
    }
  }

  // ---------------------- Filtros en memoria -------------------- //
  function ASIS_applyFilters() {
    const q = ($("#asis_q")?.value || "").toLowerCase();
    const estado = ($("#asis_estado")?.value || "").toLowerCase();

    let list = ASIS_all.slice();

    if (estado) {
      list = list.filter(
        (x) => (x.estado || "").toLowerCase() === estado
      );
    }

    if (q) {
      list = list.filter((x) => {
        return (
          (x.nombre || "").toLowerCase().includes(q) ||
          (x.rut || "").toLowerCase().includes(q) ||
          String(x.id_empleado || "").includes(q) ||
          (x.cargo || "").toLowerCase().includes(q)
        );
      });
    }

    ASIS_render(list);
  }

  // --------------- Cargar datos según mes seleccionado ---------- //
  async function ASIS_reloadFromServer() {
    const root = $("#asisListContainer");
    ASIS_skeleton();

    try {
      const periodInput = $("#asis_period");
      let period = periodInput?.value || "";

      // Si no hay valor válido en el input, usamos el mes actual
      if (!/^\d{4}-\d{2}$/.test(period)) {
        period = getCurrentPeriod();
        if (periodInput) periodInput.value = period;
      }

      const rows = await ASIS_get(`/asistencia/admin?period=${period}`);
      console.log("[ASIS_reloadFromServer] period =", period, "filas:", rows);

      ASIS_all = (rows || []).map(ASIS_normalizeRow);
      ASIS_page = 1;
      ASIS_applyFilters();
    } catch (err) {
      console.error("[ASIS_reloadFromServer] error:", err);
      if (root) {
        root.innerHTML = `<div class="small" style="color:#b91c1c">
          No se pudo cargar asistencia. ${err.message || ""}
        </div>`;
      }
    }
  }

  // ---------------------- Cargar datos iniciales ---------------- //
  async function ASIS_loadData() {
    if (ASIS_loaded) return;
    ASIS_loaded = true;
    await ASIS_reloadFromServer();
  }

  // ------------------------- Bootstrap UI ----------------------- //
  function ASIS_bootstrapUI() {
    if (ASIS_inited) return;
    const sec = document.getElementById("asistencia");
    if (!sec) return;
    ASIS_inited = true;

    const qInput = $("#asis_q");
    let qTimer = null;

    // Buscador por texto
    qInput?.addEventListener("input", () => {
      clearTimeout(qTimer);
      qTimer = setTimeout(() => {
        ASIS_page = 1;
        ASIS_applyFilters();
      }, 220);
    });

    qInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        ASIS_page = 1;
        ASIS_applyFilters();
      }
    });

    // Filtro por estado
    $("#asis_estado")?.addEventListener("change", () => {
      ASIS_page = 1;
      ASIS_applyFilters();
    });

    // Cambio de MES (input month o text YYYY-MM)
    $("#asis_period")?.addEventListener("change", () => {
      ASIS_page = 1;
      ASIS_reloadFromServer();
    });

    // Limpiar filtros: texto, estado y volver al mes actual
    $("#asis_clear")?.addEventListener("click", () => {
      const qInput = $("#asis_q");
      const estadoSel = $("#asis_estado");
      const periodInput = $("#asis_period");

      // 1) Limpiar texto y estado
      if (qInput) qInput.value = "";
      if (estadoSel) estadoSel.value = "";

      // 2) Volver al mes actual (YYYY-MM)
      const currentPeriod = getCurrentPeriod();
      if (periodInput) {
        periodInput.value = currentPeriod;
      }

      // 3) Reset paginación y recargar desde backend
      ASIS_page = 1;
      ASIS_reloadFromServer();
    });

    // --------- Eventos del modal de asistencia ---------- //
    const asisOverlay = $("#asisModalOverlay");
    const asisCancel = $("#asisModalCancel");
    const asisForm = $("#asisForm");
    const asisMsg = $("#asisFormMsg");

    // Botón "Cancelar"
    asisCancel?.addEventListener("click", ASIS_closeModal);

    // Cerrar haciendo click fuera del cuadro
    asisOverlay?.addEventListener("click", (e) => {
      if (e.target === asisOverlay) {
        ASIS_closeModal();
      }
    });

    // ESC para cerrar
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        ASIS_closeModal();
      }
    });

    // Guardar cambios (submit)
    asisForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!asisMsg) return;

      asisMsg.style.color = "";
      asisMsg.textContent = "Guardando cambios…";

      const id = $("#asis_id_asistencia").value;

      const body = {
        hora_entrada: $("#asis_hora_entrada").value || null,
        hora_salida: $("#asis_hora_salida").value || null,
        minutos_colacion: Number($("#asis_min_colacion").value || 0),
        horas_trabajadas: Number($("#asis_horas_trab").value || 0),
        horas_extra: Number($("#asis_horas_extra").value || 0),
        estado: $("#asis_estado_edit").value || "presente",
        observacion: $("#asis_observacion").value || "",
      };

      try {
        await ASIS_put(`/asistencia/${id}`, body);
        asisMsg.style.color = "#16a34a";
        asisMsg.textContent = "Cambios guardados correctamente.";

        await ASIS_reloadFromServer();

        setTimeout(() => {
          ASIS_closeModal();
        }, 600);
      } catch (err) {
        console.error("[ASIS] error guardando:", err);
        asisMsg.style.color = "#b91c1c";
        asisMsg.textContent =
          "Error al guardar cambios en asistencia.";
      }
    });
  }

  // ------------------ Hook global para pestaña ------------------ //
  window.ASIS_onEnterTabIfVisible = function () {
    const sec = document.getElementById("asistencia");
    if (!sec) return;
    if (!sec.classList.contains("active")) return;
    ASIS_bootstrapUI();
    ASIS_loadData();
  };

  // Click en botón de la sidebar
  document.addEventListener("click", (e) => {
    const btn = e.target.closest('.access-btn[data-target="asistencia"]');
    if (btn) window.ASIS_onEnterTabIfVisible();
  });

  // Si entras directo con #asistencia en la URL
  if ((location.hash || "").slice(1) === "asistencia") {
    setTimeout(window.ASIS_onEnterTabIfVisible, 0);
  }
})();