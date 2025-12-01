// ===================================================================
// =================== MÓDULO: Liquidaciones (ADMIN) =================
// ===================================================================
(() => {
  const LIQ_API_BASE =
    (window.__CONFIG && window.__CONFIG.API_BASE_URL) ||
    window.API_BASE_URL ||
    "http://localhost:3000/api/v1";

  const LIQ_token = () => localStorage.getItem("accessToken");
  const LIQ_hdrs = () => ({ Authorization: `Bearer ${LIQ_token()}` });
  const $ = (sel, root = document) => root.querySelector(sel);

  let LIQ_inited = false;
  let LIQ_loaded = false;
  let LIQ_all = [];
  let LIQ_page = 1;
  const LIQ_SIZE = 20;

  // ------------------------ Fetch helpers ------------------------ //
  async function LIQ_get(path) {
    const url = `${LIQ_API_BASE}${path}`;
    const res = await fetch(url, { headers: LIQ_hdrs() });
    const txt = await res.text();
    let json;
    try {
      json = txt ? JSON.parse(txt) : {};
    } catch {
      json = {};
    }
    if (res.status === 401) {
      console.warn("[LIQ_get] 401, limpiando sesión…");
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

  async function LIQ_put(path, body) {
    const url = `${LIQ_API_BASE}${path}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...LIQ_hdrs(),
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
      console.warn("[LIQ_put] 401, limpiando sesión…");
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

  // 🔵 NUEVO: helper para POST (generar periodo)
  async function LIQ_post(path, body) {
    const url = `${LIQ_API_BASE}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...LIQ_hdrs(),
      },
      body: body ? JSON.stringify(body) : null,
    });
    const txt = await res.text();
    let json;
    try {
      json = txt ? JSON.parse(txt) : {};
    } catch {
      json = {};
    }
    if (res.status === 401) {
      console.warn("[LIQ_post] 401, limpiando sesión…");
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

  // -------------------- Normalizar fila ------------------------- //
  function LIQ_normalizeRow(r) {
    const id_liquidacion = Number(r.id_liquidacion);
    const id_empleado = Number(r.id_empleado);
    const nombreCompleto =
      [r.nombre, r.apellido_paterno, r.apellido_materno]
        .filter(Boolean)
        .join(" ")
        .trim() || "Empleado";

    const rut = r.rut
      ? `${r.rut}${r.digito_verificador ? "-" + r.digito_verificador : ""}`
      : "";

    const periodoStr =
      typeof r.periodo === "string" ? r.periodo.slice(0, 7) : "";

    return {
      id_liquidacion,
      id_empleado,
      nombre: nombreCompleto,
      rut,
      cargo: r.cargo || "",
      periodo: periodoStr,
      dias_trabajados: r.dias_trabajados ?? 0,
      sueldo_base: Number(r.sueldo_base || 0),
      horas_extra: Number(r.horas_extra || 0),
      monto_horas_extra: Number(r.monto_horas_extra || 0),
      gratificacion: Number(r.gratificacion || 0),
      otros_haberes: Number(r.otros_haberes || 0),
      imponible: Number(r.imponible || 0),
      afp_desc: Number(r.afp_desc || 0),
      salud_desc: Number(r.salud_desc || 0),
      otros_descuentos: Number(r.otros_descuentos || 0),
      no_imponibles: Number(r.no_imponibles || 0),
      tributable: Number(r.tributable || 0),
      impuesto: Number(r.impuesto || 0),
      sueldo_liquido: Number(r.sueldo_liquido || 0),
      generado_en: r.generado_en || null,
      observacion: r.observacion || "",
      estado: (r.estado || "calculada").toLowerCase(),
    };
  }

  // --------------------- Skeleton de carga ---------------------- //
  function LIQ_skeleton() {
    const root = $("#liqListContainer");
    if (!root) return;
    root.innerHTML = `
      <div class="doc" style="opacity:.7">
        <div>
          <div class="skel" style="width:260px;height:16px"></div>
          <div class="skel" style="width:220px;height:14px;margin-top:6px"></div>
        </div>
      </div>
      <div class="doc" style="opacity:.7">
        <div>
          <div class="skel" style="width:240px;height:16px"></div>
          <div class="skel" style="width:200px;height:14px;margin-top:6px"></div>
        </div>
      </div>
    `;
  }

  // ------------------------ Render listado ---------------------- //
  function LIQ_render(list) {
    const root = $("#liqListContainer");
    if (!root) return;

    if (!Array.isArray(list) || list.length === 0) {
      root.innerHTML = `<div class="muted">
        No hay liquidaciones para los filtros seleccionados.
      </div>`;
      LIQ_updatePager(0, 0);
      return;
    }

    const start = (LIQ_page - 1) * LIQ_SIZE;
    const pageItems = list.slice(start, start + LIQ_SIZE);

    root.innerHTML = pageItems
      .map((r) => {
        const liquidoFmt = r.sueldo_liquido.toLocaleString("es-CL", {
          style: "currency",
          currency: "CLP",
          maximumFractionDigits: 0,
        });
        const imponibleFmt = r.imponible.toLocaleString("es-CL", {
          style: "currency",
          currency: "CLP",
          maximumFractionDigits: 0,
        });

        let chipClass = "chip";
        switch (r.estado) {
          case "revisada":
            chipClass = "chip vigente";
            break;
          case "aprobada":
          case "publicada":
            chipClass = "chip vigente";
            break;
          default:
            chipClass = "chip gris";
        }

        return `
          <div class="doc">
            <div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <strong>${r.nombre}</strong>
                <span class="small muted">
                  ${r.cargo ? "· " + r.cargo : ""} ${r.rut ? "· " + r.rut : ""}
                </span>
                <span class="${chipClass}" style="margin-left:auto;">
                  ${r.estado}
                </span>
              </div>
              <div class="small">
                Periodo: <strong>${r.periodo || "—"}</strong>
                · Días trabajados: ${r.dias_trabajados}
                · Imponible: ${imponibleFmt}
                · Líquido: <strong>${liquidoFmt}</strong>
              </div>
              ${
                r.observacion
                  ? `<div class="small" style="margin-top:4px;">
                       Obs: ${r.observacion}
                     </div>`
                  : ""
              }
            </div>
            <div class="doc-actions">
              <button
                class="btn small"
                type="button"
                data-liq-id="${r.id_liquidacion}"
              >
                Ver detalle
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    // Click en "Ver detalle" para abrir popup
    root.onclick = (ev) => {
      const btn = ev.target.closest("[data-liq-id]");
      if (!btn) return;
      const id = parseInt(btn.getAttribute("data-liq-id") || "", 10);
      if (!Number.isInteger(id)) return;

      const row = LIQ_all.find((x) => x.id_liquidacion === id);
      if (!row) return;

      LIQ_openModal(row);
    };

    LIQ_updatePager(list.length, pageItems.length);
  }

  // -------------------------- Pager ----------------------------- //
  function LIQ_updatePager(total, currentCount) {
    const info = $("#liqPageInfo");
    const prev = $("#liqPrev");
    const next = $("#liqNext");

    const totalPages = Math.max(1, Math.ceil(total / LIQ_SIZE));
    if (LIQ_page > totalPages) LIQ_page = totalPages;

    if (info) info.textContent = `Página ${LIQ_page} de ${totalPages}`;

    if (prev) {
      prev.disabled = LIQ_page <= 1;
      prev.onclick = () => {
        if (LIQ_page > 1) {
          LIQ_page--;
          LIQ_applyFilters();
        }
      };
    }

    if (next) {
      next.disabled = LIQ_page >= totalPages || currentCount === 0;
      next.onclick = () => {
        LIQ_page++;
        LIQ_applyFilters();
      };
    }
  }

  // ---------------------- Filtros en memoria -------------------- //
  function LIQ_applyFilters() {
    const q = ($("#liq_q")?.value || "").toLowerCase();
    const estadoSel = ($("#liq_estado")?.value || "").toLowerCase();

    let list = LIQ_all.slice();

    if (estadoSel) {
      list = list.filter(
        (x) => (x.estado || "").toLowerCase() === estadoSel
      );
    }

    if (q) {
      list = list.filter((x) => {
        return (
          (x.nombre || "").toLowerCase().includes(q) ||
          (x.rut || "").toLowerCase().includes(q) ||
          String(x.id_empleado || "").includes(q) ||
          (x.cargo || "").toLowerCase().includes(q) ||
          (x.periodo || "").toLowerCase().includes(q)
        );
      });
    }

    LIQ_render(list);
  }

  // --------------- Cargar datos según mes seleccionado ---------- //
  async function LIQ_reloadFromServer() {
    const root = $("#liqListContainer");
    LIQ_skeleton();
    try {
      const periodInput = $("#liq_period");
      let period = periodInput?.value || "";

      // Si no hay valor en el input, usamos el mes actual
      if (!/^\d{4}-\d{2}$/.test(period)) {
        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth() + 1).padStart(2, "0");
        period = `${yyyy}-${mm}`;
        if (periodInput) periodInput.value = period;
      }

      const rows = await LIQ_get(`/liquidaciones/admin?period=${period}`);
      console.log("[LIQ_reloadFromServer] period =", period, "filas:", rows);
      LIQ_all = (rows || []).map(LIQ_normalizeRow);
      LIQ_page = 1;
      LIQ_applyFilters();
    } catch (err) {
      console.error("[LIQ_reloadFromServer] error:", err);
      if (root) {
        root.innerHTML = `<div class="small" style="color:#b91c1c">
          No se pudieron cargar liquidaciones. ${err.message || ""}
        </div>`;
      }
    }
  }

  // ---------------------- Cargar datos iniciales ---------------- //
  async function LIQ_loadData() {
    if (LIQ_loaded) return;
    LIQ_loaded = true;
    await LIQ_reloadFromServer();
  }

  // ------------------------- Modal detalle ---------------------- //
  function LIQ_openModal(liqRow) {
    if (!liqRow) return;

    const overlay = $("#liqModalOverlay");
    const msgEl = $("#liqFormMsg");
    if (msgEl) msgEl.textContent = "";

    $("#liq_id_liquidacion").value = liqRow.id_liquidacion;
    $("#liq_nombre").value = liqRow.nombre || "";
    $("#liq_rut").value = liqRow.rut || "";
    $("#liq_cargo").value = liqRow.cargo || "";
    $("#liq_periodo").value = liqRow.periodo || "";
    $("#liq_dias_trab").value = liqRow.dias_trabajados ?? 0;
    $("#liq_imponible").value = liqRow.imponible
      ? liqRow.imponible.toLocaleString("es-CL")
      : "0";
    $("#liq_liquido").value = liqRow.sueldo_liquido
      ? liqRow.sueldo_liquido.toLocaleString("es-CL")
      : "0";

    const estadoSel = $("#liq_estado_sel");
    if (estadoSel && liqRow.estado) {
      estadoSel.value = liqRow.estado;
    }

    const obsInput = $("#liq_observacion");
    if (obsInput) {
      obsInput.value = liqRow.observacion || "";
    }

    if (overlay) overlay.style.display = "flex";
  }

  function LIQ_closeModal() {
    const overlay = $("#liqModalOverlay");
    const msgEl = $("#liqFormMsg");
    if (overlay) overlay.style.display = "none";
    if (msgEl) msgEl.textContent = "";
  }

  function LIQ_setupModalEvents() {
    const overlay = $("#liqModalOverlay");
    const btnCancel = $("#liqModalCancel");
    const form = $("#liqForm");

    if (btnCancel) {
      btnCancel.addEventListener("click", (e) => {
        e.preventDefault();
        LIQ_closeModal();
      });
    }

    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          LIQ_closeModal();
        }
      });
    }

    if (form) {
      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const idStr = $("#liq_id_liquidacion")?.value;
        const msgEl = $("#liqFormMsg");
        const estadoSel = $("#liq_estado_sel");
        const obsInput = $("#liq_observacion");

        console.log("[LIQ] submit modal, id oculto =", idStr);

        if (!idStr) {
          if (msgEl) msgEl.textContent = "No hay liquidación seleccionada.";
          return;
        }

        const id = parseInt(idStr, 10);
        if (!Number.isInteger(id)) {
          if (msgEl) msgEl.textContent = "ID de liquidación inválida.";
          return;
        }

        const payload = {
          estado: (estadoSel?.value || "").toLowerCase(),
          observacion: obsInput?.value?.trim() || null,
        };

        try {
          if (msgEl) {
            msgEl.textContent = "Guardando cambios…";
          }

          await LIQ_put(`/liquidaciones/${id}/estado`, payload);

          if (msgEl) {
            msgEl.textContent =
              "Estado y observación actualizados correctamente.";
          }

          await LIQ_reloadFromServer();

          setTimeout(() => {
            LIQ_closeModal();
          }, 600);
        } catch (err) {
          console.error("[LIQ] error al cambiar estado:", err);
          if (msgEl) {
            msgEl.textContent =
              "No se pudo guardar el estado. " + (err.message || "");
          }
        }
      });
    }
  }

  // ------------------------- Bootstrap UI ----------------------- //
  function LIQ_bootstrapUI() {
    if (LIQ_inited) return;
    const sec = document.getElementById("liquidaciones");
    if (!sec) return;
    LIQ_inited = true;

    const qInput = $("#liq_q");
    let qTimer = null;

    // Buscador
    qInput?.addEventListener("input", () => {
      clearTimeout(qTimer);
      qTimer = setTimeout(() => {
        LIQ_page = 1;
        LIQ_applyFilters();
      }, 220);
    });

    qInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        LIQ_page = 1;
        LIQ_applyFilters();
      }
    });

    // Filtro estado
    $("#liq_estado")?.addEventListener("change", () => {
      LIQ_page = 1;
      LIQ_applyFilters();
    });

    // Cambio de MES
    $("#liq_period")?.addEventListener("change", () => {
      LIQ_page = 1;
      LIQ_reloadFromServer();
    });

    // Limpiar filtros
    $("#liq_clear")?.addEventListener("click", () => {
      const qInput = $("#liq_q");
      const estadoSel = $("#liq_estado");
      const periodInput = $("#liq_period");

      if (qInput) qInput.value = "";
      if (estadoSel) estadoSel.value = "";

      const hoy = new Date();
      const yyyy = hoy.getFullYear();
      const mm = String(hoy.getMonth() + 1).padStart(2, "0");
      const currentPeriod = `${yyyy}-${mm}`;
      if (periodInput) {
        periodInput.value = currentPeriod;
      }

      LIQ_page = 1;
      LIQ_reloadFromServer();
    });

    // 🔵 NUEVO: botón "Calcular período"
    const btnGen = $("#liq_generate_period");
    if (btnGen) {
      btnGen.addEventListener("click", async () => {
        const periodInput = $("#liq_period");
        let period = periodInput?.value || "";

        // Si no hay periodo, usamos el mes actual
        if (!/^\d{4}-\d{2}$/.test(period)) {
          const hoy = new Date();
          const yyyy = hoy.getFullYear();
          const mm = String(hoy.getMonth() + 1).padStart(2, "0");
          period = `${yyyy}-${mm}`;
          if (periodInput) periodInput.value = period;
        }

        if (
          !confirm(
            `¿Generar o recalcular las liquidaciones del período ${period}?`
          )
        ) {
          return;
        }

        btnGen.disabled = true;
        const oldText = btnGen.textContent;
        btnGen.textContent = "Calculando…";

        try {
          const res = await LIQ_post(
            `/liquidaciones/admin/generar?period=${encodeURIComponent(period)}`
          );

          const procesados = res.procesados ?? 0;
          const nuevos = res.nuevos ?? 0;
          const actualizados = res.actualizados ?? 0;

          alert(
            `Periodo ${res.periodo || period} procesado.\n` +
              `Empleados procesados: ${procesados}\n` +
              `Nuevas liquidaciones: ${nuevos}\n` +
              `Actualizadas: ${actualizados}`
          );

          await LIQ_reloadFromServer();
        } catch (err) {
          console.error("[LIQ] error al generar periodo:", err);
          alert("No se pudo generar el periodo: " + (err.message || ""));
        } finally {
          btnGen.disabled = false;
          btnGen.textContent = oldText;
        }
      });
    }

    // Modal
    LIQ_setupModalEvents();
  }

  // ------------------ Hook global para pestaña ------------------ //
  window.LIQ_onEnterTabIfVisible = function () {
    const sec = document.getElementById("liquidaciones");
    if (!sec) return;
    if (!sec.classList.contains("active")) return;
    LIQ_bootstrapUI();
    LIQ_loadData();
  };

  // Click en botón de la sidebar
  document.addEventListener("click", (e) => {
    const btn = e.target.closest('.access-btn[data-target="liquidaciones"]');
    if (btn) window.LIQ_onEnterTabIfVisible();
  });

  // Si entras directo con #liquidaciones en la URL
  if ((location.hash || "").slice(1) === "liquidaciones") {
    setTimeout(window.LIQ_onEnterTabIfVisible, 0);
  }
})();