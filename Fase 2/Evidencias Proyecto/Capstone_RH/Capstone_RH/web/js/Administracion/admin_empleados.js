// ===================================================================
// ===================== MÓDULO: Empleados ===========================
// ===================================================================

(() => {
  const EMP_API_BASE =
    (window.__CONFIG && window.__CONFIG.API_BASE_URL) ||
    window.API_BASE_URL ||
    "http://localhost:3000/api/v1";

  const EMP_token = () => localStorage.getItem("accessToken");
  const EMP_hdrs = () => ({ Authorization: `Bearer ${EMP_token()}` });
  const EMP_$ = (s, r = document) => r.querySelector(s);

  let EMP_inited = false;
  let EMP_loaded = false;
  let EMP_all = [];
  let EMP_page = 1;
  const EMP_SIZE = 20;

  async function EMP_get(path) {
    const url = `${EMP_API_BASE}${path}`;
    const res = await fetch(url, { headers: EMP_hdrs() });
    const txt = await res.text();
    let json;
    try {
      json = txt ? JSON.parse(txt) : {};
    } catch {
      json = {};
    }
    if (res.status === 401) {
      localStorage.clear();
      location.href = "login.html";
      throw new Error("401");
    }
    if (!res.ok)
      throw new Error(json?.error?.message || `[${res.status}] ${url}`);
    return json.data ?? json ?? [];
  }

  function EMP_normalizeRow(r) {
    const id_empleado = r.id_empleado ?? r.empleado_id ?? r.id ?? null;
    const rut = r.rut ?? r.run ?? r.documento ?? "";
    const nombre = r.nombre ?? r.nombres ?? r.nombre_empleado ?? "";
    const ap = r.apellido_paterno ?? "";
    const am = r.apellido_materno ?? "";
    const full =
      [nombre, ap, am].filter(Boolean).join(" ").trim() ||
      r.nombre_empleado ||
      "Empleado";

    const cargo = r.cargo ?? r.cargo_contratado ?? "";
    const estado = (
      r.estado ??
      r.estado_laboral ??
      (r.activo === false ? "inactivo" : "activo")
    )
      .toString()
      .toLowerCase();
    const rol = (r.rol ?? r.role ?? "").toString().toLowerCase();
    const correo = r.correo ?? r.email ?? "";

    return { id_empleado, rut, full, cargo, estado, rol, correo };
  }

  // POST /empleados
  async function EMP_createEmpleado(payload) {
    const res = await fetch(`${EMP_API_BASE}/empleados`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${EMP_token()}`,
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    console.log("[EMP_createEmpleado] respuesta backend:", res.status, json);

    if (!res.ok) {
      throw new Error(json?.error?.message || "Error al crear empleado.");
    }
    return json.data;
  }

  // -------------------- FORMULARIO + MODAL --------------------
  function EMP_initForm() {
    const form = EMP_$("#empForm");
    const toggle = EMP_$("#empAddToggle");
    const overlay = document.getElementById("empModalOverlay");
    const cancelBtn = document.getElementById("empModalCancel");
    const msg = EMP_$("#empFormMsg");

    if (!form || !toggle || !overlay) {
      console.warn("[EMP_initForm] Falta form, toggle o overlay del modal.");
      return;
    }

    const openModal = () => {
      overlay.style.display = "flex";
      if (msg) {
        msg.textContent = "";
        msg.style.color = "#6b7280";
      }
    };

    const closeModal = () => {
      overlay.style.display = "none";
      form.reset();
      if (msg) msg.textContent = "";
    };

    // Abrir modal
    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      openModal();
    });

    // Cerrar con botón cancelar
    cancelBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal();
    });

    // Cerrar si hace click fuera de la tarjeta
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });

    // Submit del formulario
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (msg) {
        msg.style.color = "#6b7280";
        msg.textContent = "Guardando…";
      }

      const fd = new FormData(form);

      const payload = {
        nombre: fd.get("nombre")?.trim() || null,
        apellido_paterno: fd.get("apellido_paterno")?.trim() || null,
        apellido_materno: fd.get("apellido_materno")?.trim() || null,
        rut: fd.get("rut")?.trim() || null,
        digito_verificador: fd.get("digito_verificador")?.trim() || null,
        direccion: fd.get("direccion")?.trim() || null,
        telefono: fd.get("telefono")?.trim() || null,
        correo: fd.get("correo")?.trim() || null,
        fecha_ingreso: fd.get("fecha_ingreso") || null,
        cargo: fd.get("cargo")?.trim() || null,
        sueldo_base: fd.get("sueldo_base")
          ? Number(fd.get("sueldo_base"))
          : null,
        id_afp: fd.get("id_afp") ? Number(fd.get("id_afp")) : null,
        id_salud: fd.get("id_salud") ? Number(fd.get("id_salud")) : null,
        fecha_nacimiento: fd.get("fecha_nacimiento") || null,
      };

      const required = [
        "nombre",
        "apellido_paterno",
        "apellido_materno",
        "rut",
        "digito_verificador",
        "direccion",
        "telefono",
        "correo",
        "fecha_ingreso",
        "cargo",
        "sueldo_base",
        "id_afp",
        "id_salud",
        "fecha_nacimiento",
      ];
      const faltantes = required.filter((k) => !payload[k] && payload[k] !== 0);
      if (faltantes.length) {
        if (msg) {
          msg.style.color = "#b91c1c";
          msg.textContent =
            "Faltan campos obligatorios: " + faltantes.join(", ");
        }
        return;
      }

      try {
        await EMP_createEmpleado(payload);
        if (msg) {
          msg.style.color = "#16a34a";
          msg.textContent = "Empleado creado correctamente.";
        }

        // recargar listado
        EMP_loaded = false;
        await EMP_loadData();

        setTimeout(() => {
          closeModal();
        }, 800);
      } catch (err) {
        console.error("[EMP_createEmpleado] error:", err);
        if (msg) {
          msg.style.color = "#b91c1c";
          msg.textContent = `Error al crear empleado: ${err.message}`;
        }
      }
    });
  }

  // ----------------- LISTADO / FILTROS / PAGINACIÓN -----------------

  function EMP_skeleton() {
    const root = EMP_$("#empListContainer");
    if (!root) return;
    root.innerHTML = `
      <div class="doc" style="opacity:.7"><div><div class="skel" style="width:220px;height:16px"></div><div class="skel" style="width:140px;height:14px;margin-top:6px"></div></div></div>
      <div class="doc" style="opacity:.7"><div><div class="skel" style="width:260px;height:16px"></div><div class="skel" style="width:120px;height:14px;margin-top:6px"></div></div></div>
      <div class="doc" style="opacity:.7"><div><div class="skel" style="width:200px;height:16px"></div><div class="skel" style="width:160px;height:14px;margin-top:6px"></div></div></div>
    `;
  }

  function EMP_render(list) {
    const root = EMP_$("#empListContainer");
    if (!root) return;

    if (!list.length) {
      root.innerHTML = `<div class="muted">No hay empleados que coincidan.</div>`;
      EMP_updatePager(0, 0);
      return;
    }

    const start = (EMP_page - 1) * EMP_SIZE;
    const pageItems = list.slice(start, start + EMP_SIZE);

    root.innerHTML = pageItems
      .map(
        (e) => `
      <div class="doc">
        <div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <strong>${e.full}</strong>
            <span class="chip ${
              e.estado === "inactivo" ? "finalizado" : "vigente"
            }">${e.estado}</span>
            ${
              e.rol
                ? `<span class="chip" style="border-color:#e5e7eb">${e.rol}</span>`
                : ``
            }
          </div>
          <div class="small">
            ID: ${e.id_empleado ?? "—"} ${e.rut ? `| RUT: ${e.rut}` : ``} ${
          e.cargo ? `| Cargo: ${e.cargo}` : ``
        } ${e.correo ? `| Correo: ${e.correo}` : ``}
          </div>
        </div>
        <div class="doc-actions">
          <button class="btn small" data-emp-id="${
            e.id_empleado ?? ""
          }">Ver ficha</button>
        </div>
      </div>
    `
      )
      .join("");

    root.onclick = (ev) => {
      const btn = ev.target.closest("[data-emp-id]");
      if (!btn) return;
      const id = btn.getAttribute("data-emp-id");
      if (!id) return;
      sessionStorage.setItem("admin:currentEmpId", id);
      location.hash = "#fichaEmpleado";
    };

    EMP_updatePager(list.length, pageItems.length);
  }

  function EMP_updatePager(total, currentCount) {
    const info = EMP_$("#empPageInfo");
    const prev = EMP_$("#empPrev");
    const next = EMP_$("#empNext");

    const totalPages = Math.max(1, Math.ceil(total / EMP_SIZE));
    if (EMP_page > totalPages) EMP_page = totalPages;

    if (info) info.textContent = `Página ${EMP_page} de ${totalPages}`;
    if (prev) {
      prev.disabled = EMP_page <= 1;
      prev.onclick = () => {
        if (EMP_page > 1) {
          EMP_page--;
          EMP_applyFilters();
        }
      };
    }
    if (next) {
      next.disabled = EMP_page >= totalPages || currentCount === 0;
      next.onclick = () => {
        EMP_page++;
        EMP_applyFilters();
      };
    }
  }

  function EMP_applyFilters() {
    const q = (EMP_$("#emp_q")?.value || "").toLowerCase();
    const estado = (EMP_$("#emp_estado")?.value || "").toLowerCase();
    const rol = (EMP_$("#emp_rol")?.value || "").toLowerCase();

    let list = EMP_all.slice();

    if (estado) list = list.filter((x) => x.estado === estado);
    if (rol) list = list.filter((x) => x.rol === rol);

    if (q) {
      list = list.filter(
        (x) =>
          (x.full || "").toLowerCase().includes(q) ||
          String(x.id_empleado || "").includes(q) ||
          (x.rut || "").toLowerCase().includes(q) ||
          (x.cargo || "").toLowerCase().includes(q) ||
          (x.correo || "").toLowerCase().includes(q)
      );
    }

    EMP_render(list);
  }

  async function EMP_loadData() {
    if (EMP_loaded) return;
    EMP_loaded = true;
    EMP_skeleton();

    try {
      let rows = await EMP_get("/empleados").catch(() => null);

      if (!rows) {
        const contratos = await EMP_get("/contratos");
        const m = new Map();
        (contratos || []).forEach((c) => {
          const n = c.nombre || c.nombres || c.nombre_empleado || "";
          const ap = c.apellido_paterno || c.paterno || "";
          const am = c.apellido_materno || c.materno || "";
          const full =
            [n, ap, am].filter(Boolean).join(" ").trim() ||
            c.empleado_nombre ||
            "Empleado";
          const id = c.id_empleado ?? c.empleado_id ?? null;
          const rut = c.rut || c.run || "";
          const cargo = c.cargo || c.cargo_contratado || "";
          const correo = c.correo || c.email || "";
          if (!m.has(id))
            m.set(id, {
              id_empleado: id,
              rut,
              full,
              cargo,
              estado: "activo",
              rol: "empleado",
              correo,
            });
        });
        rows = Array.from(m.values());
      }

      EMP_all = (rows || []).map(EMP_normalizeRow);
      EMP_page = 1;
      EMP_applyFilters();
    } catch (err) {
      const root = EMP_$("#empListContainer");
      if (root) {
        root.innerHTML = `<div class="small" style="color:#b91c1c">No se pudieron cargar empleados. ${
          err.message || ""
        }</div>`;
      }
    }
  }

  function EMP_bootstrapUI() {
    if (EMP_inited) return;
    const sec = document.getElementById("empleados");
    if (!sec) return;
    EMP_inited = true;

    document.getElementById("emp_clear")?.addEventListener("click", () => {
      document.getElementById("emp_q").value = "";
      document.getElementById("emp_estado").value = "";
      document.getElementById("emp_rol").value = "";
      EMP_page = 1;
      EMP_applyFilters();
    });

    const qInput = document.getElementById("emp_q");
    let qTimer = null;
    qInput?.addEventListener("input", () => {
      clearTimeout(qTimer);
      qTimer = setTimeout(() => {
        EMP_page = 1;
        EMP_applyFilters();
      }, 220);
    });
    qInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        EMP_page = 1;
        EMP_applyFilters();
      }
    });

    ["emp_estado", "emp_rol"].forEach((id) => {
      const el = document.getElementById(id);
      el?.addEventListener("change", () => {
        EMP_page = 1;
        EMP_applyFilters();
      });
    });

    // inicializar modal + form
    EMP_initForm();
  }

  // Hook global
  window.EMP_onEnterTabIfVisible = function () {
    const sec = document.getElementById("empleados");
    if (!sec) return;
    if (!sec.classList.contains("active")) return;
    EMP_bootstrapUI();
    EMP_loadData();
  };

  document.addEventListener("click", (e) => {
    const btn = e.target.closest('.access-btn[data-target="empleados"]');
    if (btn) window.EMP_onEnterTabIfVisible();
  });

  if ((location.hash || "").slice(1) === "empleados") {
    setTimeout(window.EMP_onEnterTabIfVisible, 0);
  }
})();

// ===================================================================
// ---------------------- FICHA DE EMPLEADO ---------------------------
// ===================================================================
window.loadFicha = async () => {
  const sec = $("#fichaEmpleado");
  if (!sec) return;

  const nombreEl = $("#fichaNombre");
  const metaEl = $("#fichaMeta");
  const resumenEl = $("#fichaResumen");
  const docsEl = $("#fichaDocs");

  const id = sessionStorage.getItem("admin:currentEmpId");

  if (!id) {
    if (nombreEl) nombreEl.textContent = "Empleado";
    if (metaEl)
      metaEl.textContent =
        "Selecciona un empleado desde el listado para ver su ficha.";
    if (resumenEl) resumenEl.innerHTML = "";
    if (docsEl)
      docsEl.innerHTML = `<div class="muted">Sin documentos para mostrar.</div>`;
    return;
  }

  if (metaEl) metaEl.textContent = "Cargando…";

  try {
    const data = await getJSON(`/empleados/${id}`);
    const emp = Array.isArray(data) ? data[0] : data;

    if (!emp) {
      if (metaEl) metaEl.textContent = "No se encontró el empleado.";
      if (docsEl)
        docsEl.innerHTML = `<div class="muted">Sin documentos.</div>`;
      return;
    }

    const fullName =
      [
        emp.nombre || emp.nombre_empleado,
        emp.apellido_paterno,
        emp.apellido_materno,
      ]
        .filter(Boolean)
        .join(" ")
        .trim() || "Empleado";

    const rutStr = emp.rut || emp.rut_completo || "s/rut";

    if (nombreEl) nombreEl.textContent = fullName;

    if (metaEl) {
      metaEl.textContent = `RUT: ${rutStr} · Cargo: ${
        emp.cargo || emp.cargo_contratado || "—"
      } · Ingreso: ${toYMD(emp.fecha_ingreso)} · Estado: ${(
        emp.estado || "activo"
      ).toLowerCase()}`;
    }

    if (resumenEl) {
      const afpNombre =
        emp.afp_nombre ||
        emp.nombre_afp ||
        emp.nombre_afp ||
        "—";

      const saludNombre =
        emp.salud_nombre ||
        emp.nombre_salud ||
        emp.nombre_salud ||
        "—";

      const cumple = emp.fecha_nacimiento ? toYMD(emp.fecha_nacimiento) : "—";

      resumenEl.innerHTML = `
        <ul class="ficha-lista">
          <li><span>AFP</span><strong>${afpNombre}</strong></li>
          <li><span>Salud</span><strong>${saludNombre}</strong></li>
          <li><span>Cumpleaños</span><strong>${cumple}</strong></li>
          <li><span>Dirección</span><strong>${
            emp.direccion || "—"
          }</strong></li>
          <li><span>Teléfono</span><strong>${
            emp.telefono || "—"
          }</strong></li>
          <li><span>Correo</span><strong>${emp.correo || "—"}</strong></li>
        </ul>
      `;
    }

    if (docsEl) {
      docsEl.innerHTML = `<div class="muted">Documentos del empleado (contratos, anexos, etc.) se integrarán más adelante.</div>`;
    }
  } catch (err) {
    console.error("[loadFicha] error:", err);
    if (metaEl) metaEl.textContent = "Error al cargar la ficha de empleado.";
    if (docsEl)
      docsEl.innerHTML = `<div class="small" style="color:#b91c1c">No se pudieron cargar los documentos.</div>`;
  }
};
