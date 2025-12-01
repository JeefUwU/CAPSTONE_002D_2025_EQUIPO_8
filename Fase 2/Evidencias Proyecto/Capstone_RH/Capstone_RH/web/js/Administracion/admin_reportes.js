// ../js/Administracion/admin_reportes.js
document.addEventListener("DOMContentLoaded", () => {
  // Backend de ANALYTICS (FastAPI)
  const DASH_API_BASE = window.DASH_API_BASE || "http://localhost:8000";

  // Controles del periodo en la vista de Reportes
  const periodInput = document.getElementById("rep_period");
  const applyBtn = document.getElementById("rep_apply");
  const refreshBtn = document.getElementById("rep_refresh");
  const errorEl = document.getElementById("repError");

  // Selector de gráfico
  const chartSelector = document.getElementById("rep_chart_selector");
  const cardCtr = document.getElementById("rep_card_ctr");
  const cardLiq = document.getElementById("rep_card_liq");
  const cardEmp = document.getElementById("rep_card_emp");
  const cardAsis = document.getElementById("rep_card_asis");

  // Canvas del gráfico 1: Contratos por tipo
  const ctrTipoCanvas = document.getElementById("rep_ctr_tipo");
  let ctrTipoChart = null;

  // Canvas del gráfico 2: Tendencia liquidaciones
  const liqTrendCanvas = document.getElementById("rep_liq_trend");
  let liqTrendChart = null;

  // Canvas del gráfico 3: Empleados con / sin contrato
  const empCtrCanvas = document.getElementById("rep_emp_ctr");
  let empCtrChart = null;

  // Canvas del gráfico 4: Asistencia por estado
  const asisEstadoCanvas = document.getElementById("rep_asis_estado");
  let asisEstadoChart = null;

  // ===== Helpers =====
  function getCurrentPeriod() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${d.getFullYear()}-${m}`;
  }

  function ensurePeriodInput() {
    const current = getCurrentPeriod();
    if (!periodInput) return current;

    if (!periodInput.value) {
      periodInput.value = current;
    }
    return periodInput.value;
  }

  function resetToCurrentPeriod() {
    const current = getCurrentPeriod();
    if (periodInput) {
      periodInput.value = current;
    }
    return current;
  }

  function formatCLP(value) {
    const n = Number(value);
    if (isNaN(n)) return "—";
    try {
      return new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
        maximumFractionDigits: 0,
      }).format(n);
    } catch {
      return "$" + Math.round(n).toLocaleString("es-CL");
    }
  }

  // Mostrar/ocultar cards según el selector
  function updateChartVisibility() {
    if (!chartSelector) return;
    const val = chartSelector.value || "ctr";

    if (cardCtr)  cardCtr.style.display  = (val === "ctr")  ? "" : "none";
    if (cardLiq)  cardLiq.style.display  = (val === "liq")  ? "" : "none";
    if (cardEmp)  cardEmp.style.display  = (val === "emp")  ? "" : "none";
    if (cardAsis) cardAsis.style.display = (val === "asis") ? "" : "none";
  }

  // ===== Carga de datos para reportes =====
  async function loadReportes(periodOverride) {
    const period = (periodOverride || ensurePeriodInput()).slice(0, 7);

    if (errorEl) {
      errorEl.style.display = "none";
      errorEl.textContent = "";
    }

    try {
      const url = `${DASH_API_BASE}/dashboard/resumen?period=${encodeURIComponent(
        period
      )}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("HTTP " + res.status);
      }

      const data = await res.json();

      // ==================== GRAFICO 1: CONTRATOS POR TIPO ====================
      if (ctrTipoCanvas && typeof Chart !== "undefined") {
        const ctr = data.contratos || {};
        const vig = ctr.por_tipo_vigentes || {};
        const fin = ctr.por_tipo_finiquitados || {};

        const tiposUnicos = Array.from(
          new Set([...Object.keys(vig), ...Object.keys(fin)])
        );

        const valoresVig = tiposUnicos.map((t) => vig[t] || 0);
        const valoresFin = tiposUnicos.map((t) => fin[t] || 0);

        if (ctrTipoChart) {
          ctrTipoChart.destroy();
        }

        if (tiposUnicos.length > 0) {
          const ctx = ctrTipoCanvas.getContext("2d");
          ctrTipoChart = new Chart(ctx, {
            type: "bar",
            data: {
              labels: tiposUnicos,
              datasets: [
                {
                  label: "Vigentes",
                  data: valoresVig,
                  borderWidth: 1,
                },
                {
                  label: "Finiquitados",
                  data: valoresFin,
                  borderWidth: 1,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              interaction: {
                mode: "index",
                intersect: false,
              },
              plugins: {
                legend: {
                  position: "top",
                },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const v = ctx.parsed.y || 0;
                      return `${ctx.dataset.label}: ${v}`;
                    },
                  },
                },
              },
              scales: {
                x: {
                  ticks: {
                    autoSkip: false,
                  },
                },
                y: {
                  beginAtZero: true,
                  ticks: {
                    precision: 0,
                  },
                },
              },
            },
          });
        }
      }

      // ============ GRAFICO 2: TENDENCIA SUELDO LÍQUIDO PROMEDIO ============
      if (liqTrendCanvas && typeof Chart !== "undefined") {
        const trend =
          (data.trends && data.trends.liquidaciones_ultimos_6m) || [];

        if (liqTrendChart) {
          liqTrendChart.destroy();
        }

        if (trend.length > 0) {
          const labels = trend.map((r) => r.periodo);
          const valores = trend.map((r) => r.promedio_liquido || 0);

          const ctx2 = liqTrendCanvas.getContext("2d");
          liqTrendChart = new Chart(ctx2, {
            type: "line",
            data: {
              labels,
              datasets: [
                {
                  label: "Promedio sueldo líquido",
                  data: valores,
                  fill: false,
                  tension: 0.2,
                  borderWidth: 2,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: "top",
                },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const v = ctx.parsed.y || 0;
                      return `${ctx.dataset.label}: ${formatCLP(v)}`;
                    },
                  },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: (val) => formatCLP(val),
                  },
                },
              },
            },
          });
        }
      }

      // ============ GRAFICO 3: EMPLEADOS CON / SIN CONTRATO ============
      if (empCtrCanvas && typeof Chart !== "undefined") {
        const emp = data.empleados || {};
        const total = Number(emp.total ?? 0);
        const conVig = Number(emp.con_contrato_vigente ?? 0);
        const sinVig =
          emp.sin_contrato_vigente != null
            ? Number(emp.sin_contrato_vigente)
            : Math.max(total - conVig, 0);

        if (empCtrChart) {
          empCtrChart.destroy();
        }

        if (total > 0) {
          const ctx3 = empCtrCanvas.getContext("2d");
          empCtrChart = new Chart(ctx3, {
            type: "doughnut",
            data: {
              labels: ["Con contrato vigente", "Sin contrato vigente"],
              datasets: [
                {
                  data: [conVig, sinVig],
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: "bottom",
                },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const v = ctx.parsed || 0;
                      const percent = total > 0 ? ((v / total) * 100).toFixed(1) : 0;
                      return `${ctx.label}: ${v} (${percent}%)`;
                    },
                  },
                },
              },
            },
          });
        }
      }

      // ============ GRAFICO 4: ASISTENCIA POR ESTADO ============
      if (asisEstadoCanvas && typeof Chart !== "undefined") {
        const asis = data.asistencia || {};
        const mapa = asis.por_estado || {};
        const estados = Object.keys(mapa);
        const valores = estados.map((k) => mapa[k] || 0);

        if (asisEstadoChart) {
          asisEstadoChart.destroy();
        }

        if (estados.length > 0) {
          const ctx4 = asisEstadoCanvas.getContext("2d");
          asisEstadoChart = new Chart(ctx4, {
            type: "bar",
            data: {
              labels: estados,
              datasets: [
                {
                  label: "Registros",
                  data: valores,
                  borderWidth: 1,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: false,
                },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const v = ctx.parsed.y || 0;
                      return `Registros: ${v}`;
                    },
                  },
                },
              },
              scales: {
                x: {
                  ticks: {
                    autoSkip: false,
                  },
                },
                y: {
                  beginAtZero: true,
                  ticks: {
                    precision: 0,
                  },
                },
              },
            },
          });
        }
      }

      // Aseguramos que se vea solo el gráfico elegido
      updateChartVisibility();
    } catch (err) {
      console.error("ERROR cargar reportes:", err);
      if (errorEl) {
        errorEl.textContent =
          "No se pudieron cargar los reportes. Intenta nuevamente más tarde.";
        errorEl.style.display = "block";
      }
    }
  }

  // ===== Eventos toolbar de Reportes =====
  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      const p = ensurePeriodInput();
      loadReportes(p);
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      const p = resetToCurrentPeriod();
      loadReportes(p);
    });
  }

  // Cambio de gráfico
  if (chartSelector) {
    chartSelector.addEventListener("change", () => {
      updateChartVisibility();
    });
  }

  // Carga inicial si estás en la vista de reportes al entrar
  const reportesSection = document.getElementById("reportes");
  if (reportesSection && reportesSection.classList.contains("active")) {
    loadReportes();
  } else {
    // Al menos mantenemos el selector coherente con los cards
    updateChartVisibility();
  }
});