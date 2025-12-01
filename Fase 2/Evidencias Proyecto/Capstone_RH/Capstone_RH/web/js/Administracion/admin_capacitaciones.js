// ===================================================================
// ===================== MÓDULO: Capacitaciones =======================
// ===================================================================
(() => {
  const CAP_API_BASE =
    (window.__CONFIG && window.__CONFIG.API_BASE_URL) ||
    window.API_BASE_URL ||
    "http://localhost:3000/api/v1";

  const CAP_token = () => localStorage.getItem("accessToken");
  const CAP_hdrs = () => ({ Authorization: `Bearer ${CAP_token()}` });
  const CAP_$ = (sel, root = document) => root.querySelector(sel);

  let CAP_inited = false;
  let CAP_loaded = false;
  let CAP_all = [];
  let CAP_page = 1;
  const CAP_SIZE = 20;

  // ------------------------ Fetch helper --------------------------- //
  async function CAP_get(path) {
    const url = `${CAP_API_BASE}${path}`;
    const res = await fetch(url, { headers: CAP_hdrs() });
    const txt = await res.text();
    let json;
    try {
      json = txt ? JSON.parse(txt) : {};
    } catch {
      json = {};
    }

    if (res.status === 401) {
      console.warn("[CAP_get] 401, limpiando sesión…");
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

  // ------------------------ Helpers fecha -------------------------- //
  function CAP_toYMD(v) {
    if (!v) return "—";
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? "—" : d.toISOString().slice(0, 10);
  }

  // ------------------------ Normalizar fila ------------------------ //
  function CAP_normalizeRow(r) {
    const id_capacitacion = r.id_capacitacion ?? r.id ?? null;
    const titulo =
      r.titulo ?? r.nombre_capacitacion ?? r.nombre ?? "Capacitación";

    const tipo = (r.tipo ?? r.categoria ?? "curso").toString().toLowerCase();
    const estado = (r.estado ?? r.estado_capacitacion ?? "pendiente")
      .toString()
      .toLowerCase();

    const fecha_inicio = r.fecha_inicio ?? r.inicio ?? null;
    const fecha_fin = r.fecha_fin ?? r.termino ?? null;

    const empleadoNombre =
      r.empleado_nombre ??
      r.nombre_empleado ??
      (r.empleado
        ? [
            r.empleado.nombres ?? r.empleado.nombre ?? "",
            r.empleado.apellido_paterno ?? "",
            r.empleado.apellido_materno ?? "",
          ]
            .filter(Boolean)
            .join(" ")
            .trim()
        : "");

    const id_empleado =
      r.id_empleado ??
      r.empleado_id ??
      (r.empleado ? r.empleado.id_empleado ?? r.empleado.id : null);

    const proveedor = r.proveedor ?? r.entidad ?? "";
    const horas = r.horas ?? r.duracion_horas ?? null;

    return {
      id_capacitacion,
      titulo,
      tipo,
      estado,
      fecha_inicio,
      fecha_fin,
      empleadoNombre: empleadoNombre || "Empleado",
      id_empleado,
      proveedor,
      horas,
    };
  }

  // ------------------------ UI Bootstrap --------------------------- //
  function CAP_bootstrapUI() {
    if (CAP_inited) return;
    const sec = document.getElementById("capacitaciones");
    if (!sec) return;
    CAP_inited = true;

    const list = CAP_$("#capListContainer", sec);

    // Toolbar (filtros) – se crea sólo si no existe
    if (!CAP_$("#capToolbar", sec)) {
      const toolbar = document.createElement("div");
      toolbar.id = "capToolbar";
      toolbar.className = "toolbar";
      toolbar.style.marginTop = "10px";
      toolbar.innerHTML = `
        <div class="row">
          <input id="cap_q" type="search"
            placeholder="Buscar por capacitación, empleado o proveedor" />
          <select id="cap_estado">
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="en curso">En curso</option>
            <option value="completada">Completada</option>
            <option value="cancelada">Cancelada</option>
          </select>
          <select id="cap_tipo">
            <option value="">Todos los tipos</option>
            <option value="curso">Curso</option>
            <option value="taller">Taller</option>
            <option value="certificacion">Certificación</option>
          </select>
          <button id="cap_clear" class="btn small ghost" type="button">Limpiar</button>
        </div>
      `;
      // insertamos toolbar antes de la lista
      sec.insertBefore(toolbar, list);
    }

    // Paginador – se crea sólo si no existe
    if (!CAP_$("#capPager", sec)) {
      const pager = document.createElement("div");
      pager.id = "capPager";
      pager.style.display = "flex";
      pager.style.alignItems = "center";
      pager.style.gap = "10px";
      pager.style.justifyContent = "flex-end";
      pager.style.marginTop = "10px";
      pager.innerHTML = `
        <button id="capPrev" class="btn small ghost" type="button" disabled>Anterior</button>
        <span id="capPageInfo" class="small" style="color:#64748b">Página 1 de 1</span>
        <button id="capNext" class="btn small" type="button" disabled>Siguiente</button>
      `;
      sec.appendChild(pager);
    }

    // -------- Filtros --------
    CAP_$("#cap_clear")?.addEventListener("click", () => {
      CAP_$("#cap_q").value = "";
      CAP_$("#cap_estado").value = "";
      CAP_$("#cap_tipo").value = "";
      CAP_page = 1;
      CAP_applyFilters();
    });

    const qInput = CAP_$("#cap_q");
    let qTimer = null;
    qInput?.addEventListener("input", () => {
      clearTimeout(qTimer);
      qTimer = setTimeout(() => {
        CAP_page = 1;
        CAP_applyFilters();
      }, 220);
    });
    qInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        CAP_page = 1;
        CAP_applyFilters();
      }
    });

    ["cap_estado", "cap_tipo"].forEach((id) => {
      CAP_$("#" + id)?.addEventListener("change", () => {
        CAP_page = 1;
        CAP_applyFilters();
      });
    });

    // -------- Modal de capacitaciones --------
    const overlay = CAP_$("#capModalOverlay");
    const btnCancel = CAP_$("#capModalCancel");

    btnCancel?.addEventListener("click", CAP_closeModal);
    overlay?.addEventListener("click", (e) => {
      if (e.target === overlay) CAP_closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") CAP_closeModal();
    });
  }

  // ------------------------ Skeleton ------------------------------ //
  function CAP_skeleton() {
    const root = CAP_$("#capListContainer");
    if (!root) return;
    root.innerHTML = `
      <div class="doc" style="opacity:.7">
        <div>
          <div class="skel" style="width:260px;height:16px"></div>
          <div class="skel" style="width:200px;height:14px;margin-top:6px"></div>
        </div>
      </div>
      <div class="doc" style="opacity:.7">
        <div>
          <div class="skel" style="width:220px;height:16px"></div>
          <div class="skel" style="width:180px;height:14px;margin-top:6px"></div>
        </div>
      </div>
    `;
  }

  // ------------------------ Modal helpers ------------------------- //
  function CAP_openModal(item) {
    const overlay = CAP_$("#capModalOverlay");
    if (!overlay || !item) return;

    overlay.style.display = "block";

    CAP_$("#cap_titulo").value = item.titulo || "";
    CAP_$("#cap_empleado").value =
      (item.empleadoNombre || "") +
      (item.id_empleado ? ` (ID: ${item.id_empleado})` : "");
    CAP_$("#cap_estado").value = item.estado || "";
    CAP_$("#cap_tipo_det").value = item.tipo || "";
    CAP_$("#cap_proveedor").value = item.proveedor || "";
    CAP_$("#cap_horas").value =
      item.horas != null ? String(item.horas) : "";
    CAP_$("#cap_inicio").value = CAP_toYMD(item.fecha_inicio);
    CAP_$("#cap_fin").value = CAP_toYMD(item.fecha_fin);
  }

  function CAP_closeModal() {
    const overlay = CAP_$("#capModalOverlay");
    if (overlay) overlay.style.display = "none";
  }

  // ------------------------ Render listado ------------------------ //
  function CAP_render(list) {
    const root = CAP_$("#capListContainer");
    if (!root) return;

    if (!list.length) {
      root.innerHTML = `<div class="muted">No hay capacitaciones que coincidan.</div>`;
      CAP_updatePager(0, 0);
      return;
    }

    const start = (CAP_page - 1) * CAP_SIZE;
    const pageItems = list.slice(start, start + CAP_SIZE);

    root.innerHTML = pageItems
      .map(
        (c) => `
        <div class="doc">
          <div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <strong>${c.titulo}</strong>
              <span class="chip ${
                c.estado === "completada"
                  ? "vigente"
                  : c.estado === "cancelada"
                  ? "finalizado"
                  : ""
              }">${c.estado}</span>
              ${
                c.tipo
                  ? `<span class="chip" style="border-color:#e5e7eb">${c.tipo}</span>`
                  : ``
              }
            </div>
            <div class="small">
              Empleado: ${c.empleadoNombre} ${
          c.id_empleado ? `(ID: ${c.id_empleado})` : ""
        }
            </div>
            <div class="small">
              Inicio: ${CAP_toYMD(c.fecha_inicio)} | Fin: ${CAP_toYMD(
          c.fecha_fin
        )} ${c.proveedor ? `| Proveedor: ${c.proveedor}` : ``} ${
          c.horas ? `| Horas: ${c.horas}` : ``
        }
            </div>
          </div>
          <div class="doc-actions">
            <button class="btn small" type="button" data-cap-id="${
              c.id_capacitacion ?? ""
            }">Ver detalle</button>
          </div>
        </div>
      `
      )
      .join("");

    // Click en "Ver detalle": abre popup con la info
    root.onclick = (ev) => {
      const btn = ev.target.closest("[data-cap-id]");
      if (!btn) return;
      const id = btn.getAttribute("data-cap-id");
      if (!id) return;

      const item = CAP_all.find(
        (x) => String(x.id_capacitacion) === String(id)
      );
      if (!item) {
        console.warn("[CAP] No se encontró la capacitación en memoria:", id);
        return;
      }

      CAP_openModal(item);
    };

    CAP_updatePager(list.length, pageItems.length);
  }

  // ------------------------ Paginador ----------------------------- //
  function CAP_updatePager(total, currentCount) {
    const info = CAP_$("#capPageInfo");
    const prev = CAP_$("#capPrev");
    const next = CAP_$("#capNext");

    const totalPages = Math.max(1, Math.ceil(total / CAP_SIZE));
    if (CAP_page > totalPages) CAP_page = totalPages;

    if (info) info.textContent = `Página ${CAP_page} de ${totalPages}`;

    if (prev) {
      prev.disabled = CAP_page <= 1;
      prev.onclick = () => {
        if (CAP_page > 1) {
          CAP_page--;
          CAP_applyFilters();
        }
      };
    }
    if (next) {
      next.disabled = CAP_page >= totalPages || currentCount === 0;
      next.onclick = () => {
        CAP_page++;
        CAP_applyFilters();
      };
    }
  }

  // ------------------------ Filtros ------------------------------- //
  function CAP_applyFilters() {
    const q = (CAP_$("#cap_q")?.value || "").toLowerCase();
    const estado = (CAP_$("#cap_estado")?.value || "").toLowerCase();
    const tipo = (CAP_$("#cap_tipo")?.value || "").toLowerCase();

    let list = CAP_all.slice();

    if (estado) list = list.filter((x) => x.estado === estado);
    if (tipo) list = list.filter((x) => x.tipo === tipo);

    if (q) {
      list = list.filter(
        (x) =>
          (x.titulo || "").toLowerCase().includes(q) ||
          (x.empleadoNombre || "").toLowerCase().includes(q) ||
          (x.proveedor || "").toLowerCase().includes(q)
      );
    }

    CAP_render(list);
  }

  // ------------------------ Cargar datos -------------------------- //
  async function CAP_loadData() {
    if (CAP_loaded) return;
    CAP_loaded = true;
    CAP_skeleton();

    try {
      const rows = await CAP_get("/capacitaciones");
      CAP_all = (rows || []).map(CAP_normalizeRow);
      CAP_page = 1;
      CAP_applyFilters();
    } catch (err) {
      console.error("[CAP_loadData] error:", err);
      const root = CAP_$("#capListContainer");
      if (root) {
        root.innerHTML = `<div class="small" style="color:#b91c1c">
          No se pudieron cargar capacitaciones. ${err.message || ""}
        </div>`;
      }
    }
  }

  // ------------------ Hook global para pestaña -------------------- //
  window.CAP_onEnterTabIfVisible = function () {
    const sec = document.getElementById("capacitaciones");
    if (!sec) return;
    if (!sec.classList.contains("active")) return;
    CAP_bootstrapUI();
    CAP_loadData();
  };

  // Click en botón de la sidebar
  document.addEventListener("click", (e) => {
    const btn = e.target.closest('.access-btn[data-target="capacitaciones"]');
    if (btn) window.CAP_onEnterTabIfVisible();
  });

  // Si entras directo con #capacitaciones en la URL
  if ((location.hash || "").slice(1) === "capacitaciones") {
    setTimeout(window.CAP_onEnterTabIfVisible, 0);
  }
})();