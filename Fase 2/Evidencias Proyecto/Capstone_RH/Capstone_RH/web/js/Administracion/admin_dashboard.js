// ../js/Administracion/admin_dashboard.js
document.addEventListener("DOMContentLoaded", () => {
  // Backend de ANALYTICS (FastAPI)
  const DASH_API_BASE = window.DASH_API_BASE || "http://localhost:8000";

  // Controles de período
  const periodInput  = document.getElementById("dash_period");
  const applyBtn     = document.getElementById("dash_apply");
  const refreshBtn   = document.getElementById("dash_refresh");
  const errorEl      = document.getElementById("dashError");

  // ----- Empleados -----
  const empTotalEl   = document.getElementById("dash_emp_total");
  const empConVigEl  = document.getElementById("dash_emp_con_vig");
  const empSinVigEl  = document.getElementById("dash_emp_sin_vig");

  // ----- Contratos -----
  const ctrTotalEl   = document.getElementById("dash_ctr_total");
  const ctrVigEl     = document.getElementById("dash_ctr_vigentes");
  const ctrPromEl    = document.getElementById("dash_ctr_prom");
  const ctrMinEl     = document.getElementById("dash_ctr_min");
  const ctrMaxEl     = document.getElementById("dash_ctr_max");

  // ----- Liquidaciones -----
  const liqPeriodEl  = document.getElementById("dash_liq_period");
  const liqPromEl    = document.getElementById("dash_liq_prom");
  const liqCantEl    = document.getElementById("dash_liq_cant");

  // ----- Asistencia -----
  const asisPeriodEl   = document.getElementById("dash_asis_period");
  const asisPctEl      = document.getElementById("dash_asis_pct");
  const asisTotalEl    = document.getElementById("dash_asis_total");
  const asisEstadosEl  = document.getElementById("dash_asis_estados");

  // ===== Helpers =====
  function formatCLP(value) {
    if (value == null || isNaN(value)) return "—";
    try {
      return new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
        maximumFractionDigits: 0
      }).format(value);
    } catch {
      return "$" + Math.round(Number(value)).toLocaleString("es-CL");
    }
  }

  function setText(el, value, opts = {}) {
    if (!el) return;
    const { money = false, suffix = "" } = opts;

    if (
      value == null ||
      value === "" ||
      (typeof value === "number" && isNaN(value))
    ) {
      el.textContent = "—";
      return;
    }

    let txt = value;
    if (money) txt = formatCLP(value);
    el.textContent = String(txt) + (suffix || "");
  }

  function getCurrentPeriod() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${d.getFullYear()}-${m}`; // YYYY-MM
  }

  function ensurePeriodInput() {
    if (!periodInput) return getCurrentPeriod();
    if (!periodInput.value) {
      periodInput.value = getCurrentPeriod();
    }
    return periodInput.value;
  }

  // ===== Carga de datos =====
  async function loadDashboardSummary(periodOverride) {
    const period = (periodOverride || ensurePeriodInput()).slice(0, 7);

    if (errorEl) {
      errorEl.style.display = "none";
      errorEl.textContent = "";
    }

    try {
      const url = `${DASH_API_BASE}/dashboard/resumen?period=${encodeURIComponent(period)}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("HTTP " + res.status);
      }
      const data = await res.json();

      // ---------- Empleados ----------
      const emp = data.empleados || {};
      const totalEmp = Number(emp.total ?? 0);
      let conVig = Number(emp.con_contrato_vigente ?? 0);

      // Si la API no trae sin_contrato_vigente, lo calculamos
      let sinVig =
        emp.sin_contrato_vigente != null
          ? Number(emp.sin_contrato_vigente)
          : Math.max(totalEmp - conVig, 0);

      setText(empTotalEl,  isNaN(totalEmp) ? "—" : totalEmp);
      setText(empConVigEl, isNaN(conVig)   ? 0    : conVig);
      setText(empSinVigEl, isNaN(sinVig)   ? 0    : sinVig);

      // ---------- Contratos ----------
      const ctr = data.contratos || {};
      setText(ctrTotalEl, ctr.total ?? "—");
      setText(ctrVigEl,   ctr.vigentes ?? "—");
      setText(ctrPromEl,  ctr.sueldo_promedio, { money: true });
      setText(ctrMinEl,   ctr.sueldo_minimo,   { money: true });
      setText(ctrMaxEl,   ctr.sueldo_maximo,   { money: true });

      // ---------- Liquidaciones ----------
      const liq = data.liquidaciones || {};
      setText(liqPeriodEl, liq.periodo || period);
      setText(liqPromEl,   liq.promedio_liquido, { money: true });
      setText(liqCantEl,   liq.cantidad ?? "0");

      // ---------- Asistencia ----------
      const asis = data.asistencia || {};
      const periodoLabel = asis.periodo || period;

      if (asisPeriodEl) {
        asisPeriodEl.textContent = `Periodo ${periodoLabel}`;
      }

      setText(asisPctEl,   asis.porcentaje_asistencia, { suffix: " %" });
      setText(asisTotalEl, asis.total_registros ?? "0");

      if (asisEstadosEl) {
        asisEstadosEl.innerHTML = "";
        const mapa = asis.por_estado || {};
        Object.keys(mapa).forEach((estado) => {
          const pill = document.createElement("span");
          pill.className = "badge";
          pill.textContent = `${estado}: ${mapa[estado]}`;
          asisEstadosEl.appendChild(pill);
        });
      }
    } catch (err) {
      console.error("ERROR cargar dashboard:", err);
      if (errorEl) {
        errorEl.textContent =
          "No se pudo cargar el resumen. Intenta nuevamente más tarde.";
        errorEl.style.display = "block";
      }
    }
  }

  // ===== Eventos toolbar =====
  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      const p = ensurePeriodInput();
      loadDashboardSummary(p);
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      // Volver siempre al mes actual
      const hoy = getCurrentPeriod();
      if (periodInput) {
        periodInput.value = hoy;
      }
      loadDashboardSummary(hoy);
    });
  }

  // Carga inicial
  loadDashboardSummary();
});