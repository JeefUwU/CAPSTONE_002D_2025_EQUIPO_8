const { query } = require("../db");

/**
 * GET /api/v1/dashboard
 *
 * Devuelve indicadores simples para el Dashboard:
 * - Empleados (total, activos, inactivos)
 * - Contratos (total, vigentes, no vigentes)
 * - Liquidaciones (por estado)
 * - Solicitudes (por estado)
 * - Asistencia del mes actual (presentes, ausentes, etc.)
 */
async function getDashboardResumen(req, res) {
  try {
    const rol = req.user?.rol || "empleado";

    // Solo admin / rrhh pueden ver el dashboard
    if (!["admin", "rrhh"].includes(rol)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "No autorizado para ver el dashboard.",
        },
      });
    }

    // 1) Empleados
    const empPromise = query(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE estado = 'activo')::int AS activos,
        COUNT(*) FILTER (WHERE estado <> 'activo')::int AS inactivos
      FROM empleados
      `
    );

    // 2) Contratos
    const contratosPromise = query(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE estado = 'vigente')::int AS vigentes,
        COUNT(*) FILTER (WHERE estado <> 'vigente')::int AS no_vigentes
      FROM contrato
      `
    );

    // 3) Liquidaciones (todas, por estado)
    const liqPromise = query(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE estado = 'calculada')::int AS calculadas,
        COUNT(*) FILTER (WHERE estado = 'revisada')::int   AS revisadas,
        COUNT(*) FILTER (WHERE estado = 'aprobada')::int   AS aprobadas,
        COUNT(*) FILTER (WHERE estado = 'publicada')::int  AS publicadas
      FROM liquidaciones
      `
    );

    // 4) Solicitudes (por estado)
    const solPromise = query(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE estado = 'pendiente')::int                   AS pendientes,
        COUNT(*) FILTER (WHERE estado = 'en revisión')::int                 AS en_revision,
        COUNT(*) FILTER (WHERE estado = 'aprobada')::int                    AS aprobadas,
        COUNT(*) FILTER (WHERE estado = 'rechazada')::int                   AS rechazadas,
        COUNT(*) FILTER (WHERE estado = 'cancelada')::int                   AS canceladas
      FROM solicitudes
      `
    );

    // 5) Asistencia del MES ACTUAL
    const asisPromise = query(
      `
      WITH rango AS (
        SELECT
          date_trunc('month', CURRENT_DATE)::date                         AS start_date,
          (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date  AS end_date
      )
      SELECT
        COUNT(*)::int AS registros,
        COUNT(*) FILTER (WHERE a.estado ILIKE 'presente')::int                             AS presentes,
        COUNT(*) FILTER (WHERE a.estado ILIKE 'ausente' OR a.estado ILIKE 'falta')::int    AS ausentes,
        COUNT(*) FILTER (WHERE a.estado ILIKE 'licencia')::int                             AS licencias,
        COUNT(*) FILTER (WHERE a.estado ILIKE 'vacaciones')::int                           AS vacaciones
      FROM asistencia a
      JOIN rango r
        ON a.fecha >= r.start_date
       AND a.fecha <  r.end_date
      `
    );

    const [empRes, contRes, liqRes, solRes, asisRes] = await Promise.all([
      empPromise,
      contratosPromise,
      liqPromise,
      solPromise,
      asisPromise,
    ]);

    const empleados = empRes.rows[0] || {
      total: 0,
      activos: 0,
      inactivos: 0,
    };

    const contratos = contRes.rows[0] || {
      total: 0,
      vigentes: 0,
      no_vigentes: 0,
    };

    const liquidaciones = liqRes.rows[0] || {
      total: 0,
      calculadas: 0,
      revisadas: 0,
      aprobadas: 0,
      publicadas: 0,
    };

    const solicitudes = solRes.rows[0] || {
      total: 0,
      pendientes: 0,
      en_revision: 0,
      aprobadas: 0,
      rechazadas: 0,
      canceladas: 0,
    };

    const asistencia = asisRes.rows[0] || {
      registros: 0,
      presentes: 0,
      ausentes: 0,
      licencias: 0,
      vacaciones: 0,
    };

    return res.json({
      data: {
        empleados,
        contratos,
        liquidaciones,
        solicitudes,
        asistencia,
      },
    });
  } catch (err) {
    console.error("❌ ERROR_GET_DASHBOARD_RESUMEN", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Error al obtener indicadores del dashboard.",
      },
    });
  }
}

module.exports = {
  getDashboardResumen,
};