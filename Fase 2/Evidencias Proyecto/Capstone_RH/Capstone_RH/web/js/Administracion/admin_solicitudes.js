// ===================================================================
// ===================== MÓDULO: Solicitudes =========================
// ===================================================================
(() => {
  const SOL_$ = (s, r = document) => r.querySelector(s);

  let SOL_inited = false;
  let SOL_loaded = false;
  let SOL_all = [];
  let SOL_page = 1;
  const SOL_SIZE = 20;

  async function SOL_get(path) {
    // Usa el helper global getJSON de admin_core.js
    return await getJSON(path);
  }

  const SOL_toYMD = (v) => {
    if (!v) return "—";
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    return isNaN(d) ? "—" : d.toISOString().slice(0, 10);
  };

  function SOL_normalizeRow(r) {
    const id_solicitud = r.id_solicitud ?? r.id ?? null;

    const tipoRaw =
      r.tipo ??
      r.tipo_solicitud ??
      r.categoria ??
      "Solicitud";

    const estadoRaw =
      r.estado ??
      r.estado_solicitud ??
      "pendiente";

    // *** SIN objetos anidados, solo campos planos ***
    const empleadoNombre =
      r.nombre_empleado ??
      r.empleado_nombre ??
      "Empleado";

    const id_empleado =
      r.id_empleado ??
      r.empleado_id ??
      null;

    const fecha_solicitud =
      r.fecha_creacion ??
      r.creado_en ??
      r.fecha_solicitud ??
      r.fecha ??
      null;

    const motivoPreview =
      r.asunto ??
      r.motivo ??
      r.detalle ??
      r.mensaje ??
      "";

    return {
      id_solicitud,
      tipo: String(tipoRaw).toLowerCase(),
      estado: String(estadoRaw).toLowerCase(),
      empleadoNombre,
      id_empleado,
      fecha_solicitud,
      motivo: motivoPreview,
    };
  }

  function SOL_bootstrapUI() {
    if (SOL_inited) return;
    const sec = document.getElementById("solicitudes");
    if (!sec) return;
    SOL_inited = true;

    SOL_$("#sol_clear")?.addEventListener("click", () => {
      SOL_$("#sol_q").value = "";
      SOL_$("#sol_estado").value = "";
      SOL_$("#sol_tipo").value = "";
      SOL_page = 1;
      SOL_applyFilters();
    });

    const qInput = SOL_$("#sol_q");
    let qTimer = null;

    qInput?.addEventListener("input", () => {
      clearTimeout(qTimer);
      qTimer = setTimeout(() => {
        SOL_page = 1;
        SOL_applyFilters();
      }, 220);
    });

    qInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        SOL_page = 1;
        SOL_applyFilters();
      }
    });

    ["sol_estado", "sol_tipo"].forEach((id) => {
      const el = document.getElementById(id);
      el?.addEventListener("change", () => {
        SOL_page = 1;
        SOL_applyFilters();
      });
    });
  }

  function SOL_skeleton() {
    const root = SOL_$("#solListContainer");
    if (!root) return;
    root.innerHTML = `
      <div class="doc" style="opacity:.7">
        <div>
          <div class="skel" style="width:220px;height:16px;"></div>
          <div class="skel" style="width:180px;height:14px;margin-top:6px;"></div>
        </div>
      </div>
      <div class="doc" style="opacity:.7">
        <div>
          <div class="skel" style="width:260px;height:16px;"></div>
          <div class="skel" style="width:160px;height:14px;margin-top:6px;"></div>
        </div>
      </div>
    `;
  }

  function SOL_render(list) {
    const root = SOL_$("#solListContainer");
    if (!root) return;

    if (!list.length) {
      root.innerHTML = `<div class="muted">No hay solicitudes que coincidan.</div>`;
      SOL_updatePager(0, 0);
      return;
    }

    const start = (SOL_page - 1) * SOL_SIZE;
    const pageItems = list.slice(start, start + SOL_SIZE);

    root.innerHTML = pageItems
      .map((s) => {
        const estadoClass =
          s.estado === "aprobada" || s.estado === "aceptada"
            ? "vigente"
            : s.estado === "rechazada" || s.estado === "cancelada"
            ? "finalizado"
            : "";

        const tipoLabel =
          s.tipo.charAt(0).toUpperCase() + s.tipo.slice(1);

        return `
        <div class="doc">
          <div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <strong>${tipoLabel}</strong>
              ${
                s.estado
                  ? `<span class="chip ${estadoClass}">${s.estado}</span>`
                  : ""
              }
            </div>
            <div class="small">
              Empleado: ${s.empleadoNombre}${
                s.id_empleado ? ` (ID: ${s.id_empleado})` : ""
              }
            </div>
            <div class="small">
              Fecha solicitud: ${SOL_toYMD(s.fecha_solicitud)}
              ${
                s.motivo
                  ? ` • Motivo: ${
                      s.motivo.length > 80
                        ? s.motivo.slice(0, 77) + "…"
                        : s.motivo
                    }`
                  : ""
              }
            </div>
          </div>
          <div class="doc-actions">
            <button class="btn small" type="button" data-sol-id="${
              s.id_solicitud ?? ""
            }">
              Ver detalle
            </button>
          </div>
        </div>
      `;
      })
      .join("");

    root.onclick = (ev) => {
      const btn = ev.target.closest("[data-sol-id]");
      if (!btn) return;
      const id = btn.getAttribute("data-sol-id");
      if (!id) return;

      sessionStorage.setItem("admin:currentSolId", id);
      location.hash = "#fichaSolicitud";
    };

    SOL_updatePager(list.length, pageItems.length);
  }

  function SOL_updatePager(total, currentCount) {
    const info = SOL_$("#solPageInfo");
    const prev = SOL_$("#solPrev");
    const next = SOL_$("#solNext");

    const totalPages = Math.max(1, Math.ceil(total / SOL_SIZE));
    if (SOL_page > totalPages) SOL_page = totalPages;

    if (info) info.textContent = `Página ${SOL_page} de ${totalPages}`;

    if (prev) {
      prev.disabled = SOL_page <= 1;
      prev.onclick = () => {
        if (SOL_page > 1) {
          SOL_page--;
          SOL_applyFilters();
        }
      };
    }

    if (next) {
      next.disabled = SOL_page >= totalPages || currentCount === 0;
      next.onclick = () => {
        SOL_page++;
        SOL_applyFilters();
      };
    }
  }

  function SOL_applyFilters() {
    const q = (SOL_$("#sol_q")?.value || "").toLowerCase();
    const estado = (SOL_$("#sol_estado")?.value || "").toLowerCase();
    const tipo = (SOL_$("#sol_tipo")?.value || "").toLowerCase();

    let list = SOL_all.slice();

    if (estado) list = list.filter((x) => x.estado === estado);
    if (tipo) list = list.filter((x) => x.tipo === tipo);

    if (q) {
      list = list.filter(
        (x) =>
          (x.empleadoNombre || "").toLowerCase().includes(q) ||
          (x.motivo || "").toLowerCase().includes(q) ||
          (x.tipo || "").toLowerCase().includes(q) ||
          String(x.id_solicitud || "").includes(q)
      );
    }

    SOL_render(list);
  }

  async function SOL_loadData() {
    if (SOL_loaded) return;
    SOL_loaded = true;
    SOL_skeleton();

    try {
      const rows = await SOL_get("/solicitudes");
      SOL_all = (rows || []).map(SOL_normalizeRow);
      SOL_page = 1;
      SOL_applyFilters();
    } catch (err) {
      const root = SOL_$("#solListContainer");
      if (root) {
        root.innerHTML = `<div class="small" style="color:#b91c1c">
          No se pudieron cargar solicitudes. ${err.message || ""}
        </div>`;
      }
    }
  }

  // Helper global para refrescar listado después de actualizar desde la ficha
  window.SOL_reloadList = async () => {
    SOL_loaded = false;
    await SOL_loadData();
  };

  // Hook que llama admin_core.js cuando la pestaña está visible
  window.SOL_onEnterTabIfVisible = function () {
    const sec = document.getElementById("solicitudes");
    if (!sec) return;
    if (!sec.classList.contains("active")) return;
    SOL_bootstrapUI();
    SOL_loadData();
  };

  // Si entra directo por #solicitudes en el hash
  if ((location.hash || "").slice(1) === "solicitudes") {
    setTimeout(() => {
      window.SOL_onEnterTabIfVisible && window.SOL_onEnterTabIfVisible();
    }, 0);
  }
})();

// ===================================================================
// ---------------------- FICHA DE SOLICITUD --------------------------
// ===================================================================
window.loadSolicitud = async () => {
  console.log("[loadSolicitud] inicializando ficha…");

  const sec = $("#fichaSolicitud");
  if (!sec) {
    console.warn("[loadSolicitud] No existe #fichaSolicitud en el DOM");
    return;
  }

  const tituloEl  = $("#solTitulo");
  const metaEl    = $("#solMeta");
  const resumenEl = $("#solResumen");

  const form      = $("#solResolverForm");
  const estadoIn  = $("#solEstadoInput");
  const respIn    = $("#solRespuestaInput");
  const msgEl     = $("#solResolverMsg");

  const id = sessionStorage.getItem("admin:currentSolId");
  console.log("[loadSolicitud] currentSolId =", id);

  if (!id) {
    if (tituloEl) tituloEl.textContent = "Solicitud";
    if (metaEl)
      metaEl.textContent =
        "Selecciona una solicitud desde el listado para ver su detalle.";
    if (resumenEl) resumenEl.innerHTML = "";
    if (form) form.reset();
    return;
  }

  if (metaEl) metaEl.textContent = "Cargando…";

  try {
    // 1) Traer solicitud
    const data = await getJSON(`/solicitudes/${id}`);
    const sol  = Array.isArray(data) ? data[0] : data;

    console.log("[loadSolicitud] datos solicitud =", sol);

    if (!sol) {
      if (metaEl) metaEl.textContent = "No se encontró la solicitud.";
      if (resumenEl)
        resumenEl.innerHTML = `<div class="muted">Sin datos para mostrar.</div>`;
      return;
    }

    const tipo   = sol.tipo || "Solicitud";
    const estado = sol.estado || "pendiente";

    // 2) Nombre e ID de empleado (súper simple, SIN romper)
    const idEmpleado =
      sol.id_empleado ||
      sol.empleado_id ||
      null;

    let empleadoNombre =
      sol.nombre_empleado ||
      sol.empleado_nombre ||
      "Empleado";

    // Si no viene nombre en la solicitud, intentamos resolver desde /empleados/:id
    if ((!empleadoNombre || empleadoNombre === "Empleado") && idEmpleado) {
      try {
        const empData = await getJSON(`/empleados/${idEmpleado}`);
        const emp = Array.isArray(empData) ? empData[0] : empData;
        console.log("[loadSolicitud] datos empleado =", emp);
        if (emp) {
          const nom = emp.nombre || emp.nombres || "";
          const ap  = emp.apellido_paterno || "";
          const am  = emp.apellido_materno || "";
          const full = [nom, ap, am].filter(Boolean).join(" ").trim();
          if (full) empleadoNombre = full;
        }
      } catch (e) {
        console.warn("[loadSolicitud] no se pudo obtener nombre de empleado", e);
      }
    }

    const fechaCreacion   = sol.fecha_creacion || sol.creado_en || null;
    const fechaDesde      = sol.fecha_desde || null;
    const fechaHasta      = sol.fecha_hasta || null;
    const horas           = sol.horas ?? null;
    const monto           = sol.monto ?? null;
    const motivo          = sol.motivo || "";
    const detalle         = sol.detalle || "";
    const asunto          = sol.asunto || "";
    const mensaje         = sol.mensaje || "";
    const adjuntosCount   = sol.adjuntos_count ?? 0;
    const adjuntoUrl      = sol.adjunto_url || null;
    const resueltoPor     = sol.resuelto_por ?? null;
    const fechaResolucion = sol.fecha_resolucion || null;
    const comentarioRes   = sol.comentario_resolucion || sol.respuesta || "";

    // Título
    if (tituloEl) {
      tituloEl.textContent = `Solicitud ${tipo}`;
    }

    // Meta principal (usa toYMD global de admin_core.js)
    if (metaEl) {
      metaEl.textContent = `Estado: ${estado.toLowerCase()} · Creada: ${toYMD(
        fechaCreacion
      )} · Empleado: ${empleadoNombre}${
        idEmpleado ? ` (ID: ${idEmpleado})` : ""
      }`;
    }

    // Ficha detalle
    const rows = [];
    const pushRow = (label, value) => {
      if (
        value === null ||
        value === undefined ||
        value === "" ||
        (typeof value === "number" && isNaN(value))
      )
        return;
      rows.push(
        `<li><span>${label}</span><strong>${value}</strong></li>`
      );
    };

    pushRow("ID solicitud", sol.id_solicitud ?? sol.id);
    pushRow("Tipo", tipo);
    pushRow("Estado", estado);
    pushRow("Fecha de creación", toYMD(fechaCreacion));
    pushRow("Fecha desde", toYMD(fechaDesde));
    pushRow("Fecha hasta", toYMD(fechaHasta));
    pushRow("Horas", horas !== null ? `${horas} h` : null);

    if (monto !== null) {
      const fmtMonto = Number(monto).toLocaleString("es-CL", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      pushRow("Monto", `$ ${fmtMonto}`);
    }

    pushRow(
      "Empleado",
      empleadoNombre + (idEmpleado ? ` (ID: ${idEmpleado})` : "")
    );
    pushRow("Motivo", motivo);
    pushRow("Detalle", detalle);
    pushRow("Asunto", asunto);
    pushRow("Mensaje", mensaje);
    pushRow(
      "Cantidad de adjuntos",
      typeof adjuntosCount === "number" ? adjuntosCount : null
    );
    pushRow("URL adjunto", adjuntoUrl);
    pushRow("Resuelto por (ID usuario)", resueltoPor);
    pushRow("Fecha de resolución", toYMD(fechaResolucion));
    pushRow("Comentario de resolución", comentarioRes);

    if (resumenEl) {
      resumenEl.innerHTML = `
        <ul class="ficha-lista">
          ${rows.join("")}
        </ul>
      `;
    }

    // ---------- Formulario de respuesta / cambio de estado ----------
    if (!form) {
      console.warn("[loadSolicitud] No se encontró #solResolverForm, no se engancha onsubmit");
      return;
    } else {
      console.log("[loadSolicitud] Formulario de resolución encontrado");
    }

    if (estadoIn) {
      estadoIn.value = estado;
    }
    if (respIn) {
      respIn.value = comentarioRes;
    }
    if (msgEl) {
      msgEl.textContent = "";
      msgEl.style.color = "#6b7280";
    }

    form.onsubmit = async (ev) => {
      ev.preventDefault();
      console.log("[resolverSolicitud] submit disparado");

      if (msgEl) {
        msgEl.style.color = "#6b7280";
        msgEl.textContent = "Guardando respuesta…";
      }

      const nuevoEstado = estadoIn ? estadoIn.value || null : null;
      const comentario  = respIn ? respIn.value.trim() || null : null;

      console.log("[resolverSolicitud] payload:", {
        estado: nuevoEstado,
        comentario_resolucion: comentario,
      });

      try {
        const res = await fetch(
          `${API_BASE}/solicitudes/${sol.id_solicitud}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token()}`
            },
            body: JSON.stringify({
              estado: nuevoEstado,
              // Mandamos ambas, tu controller puede usar una u otra
              comentario_resolucion: comentario,
              respuesta: comentario,
            }),
          }
        );

        const txt = await res.text();
        let json;
        try {
          json = txt ? JSON.parse(txt) : {};
        } catch {
          json = {};
        }

        console.log("[resolverSolicitud] respuesta PATCH:", res.status, json);

        if (!res.ok) {
          throw new Error(json?.error?.message || `HTTP ${res.status}`);
        }

        if (msgEl) {
          msgEl.style.color = "#16a34a";
          msgEl.textContent = "Solicitud actualizada correctamente.";
        }

        // Refrescar ficha con lo que devolvió el backend
        const updated = json.data || json;
        console.log("[resolverSolicitud] updated desde servidor:", updated);

        // Guardamos el id en session por si cambia algo y recargamos:
        sessionStorage.setItem(
          "admin:currentSolId",
          updated.id_solicitud || sol.id_solicitud
        );

        // Volvemos a cargar la ficha (hará GET de nuevo)
        await window.loadSolicitud();

        // Refrescar listado si existe helper
        if (window.SOL_reloadList) {
          await window.SOL_reloadList();
        }
      } catch (err) {
        console.error("[resolverSolicitud] error:", err);
        if (msgEl) {
          msgEl.style.color = "#b91c1c";
          msgEl.textContent =
            "Error al guardar la respuesta: " + (err.message || "");
        }
      }
    };
  } catch (err) {
    console.error("[loadSolicitud] error:", err);
    if (metaEl) metaEl.textContent = "Error al cargar la solicitud.";
    if (resumenEl) {
      resumenEl.innerHTML = `<div class="small" style="color:#b91c1c">
        No se pudieron cargar los datos de la solicitud.
      </div>`;
    }
  }
};