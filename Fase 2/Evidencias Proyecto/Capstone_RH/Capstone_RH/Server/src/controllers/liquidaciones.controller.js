const { query } = require("../db");

// ======================================================
// 1) Listar liquidaciones por empleado (vista empleado)
//    GET /api/v1/liquidaciones/:id
// ======================================================
async function listarPorEmpleado(req, res) {
  try {
    const empleadoId = parseInt(req.params.id, 10);
    if (isNaN(empleadoId)) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "ID de empleado inválida." },
      });
    }

    const rol = req.user?.rol || "empleado";
    const yo = req.user?.id_empleado;
    if (rol === "empleado" && yo !== empleadoId) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "No autorizado para ver otras liquidaciones.",
        },
      });
    }

    const { rows } = await query(
      `
      SELECT 
        l.id_liquidacion, l.id_empleado, l.id_contrato,
        l.periodo, l.dias_trabajados, l.sueldo_base, 
        l.horas_extra, l.monto_horas_extra,
        l.gratificacion, l.otros_haberes,
        l.imponible, l.afp_desc, l.salud_desc, l.otros_descuentos,
        l.no_imponibles, l.tributable, l.impuesto, 
        l.sueldo_liquido, l.generado_en, l.observacion,
        l.estado
      FROM liquidaciones l
      WHERE l.id_empleado = $1
      ORDER BY l.periodo DESC, l.id_liquidacion DESC
      `,
      [empleadoId]
    );

    res.json({ data: rows });
  } catch (err) {
    console.error("ERROR_LISTAR_LIQUIDACIONES_EMPLEADO", err);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Error al listar liquidaciones.",
      },
    });
  }
}

// ======================================================
// 2) Calcular liquidación “en vivo” desde asistencia
//    GET /api/v1/liquidaciones/:id/calcular?period=YYYY-MM
//    (NO guarda en BD, solo cálculo)
// ======================================================
async function calcularLiquidacionEmpleado(req, res) {
  const empleadoId = parseInt(req.params.id, 10);
  const period = String(req.query.period || "").trim(); // YYYY-MM

  if (isNaN(empleadoId)) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "ID de empleado inválido." },
    });
  }

  if (!/^\d{4}-\d{2}$/.test(period)) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Usa period=YYYY-MM." },
    });
  }

  // Permisos: mismo criterio que listarPorEmpleado
  const rol = req.user?.rol || "empleado";
  const yo = req.user?.id_empleado;
  if (rol === "empleado" && yo !== empleadoId) {
    return res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "No autorizado para ver esta liquidación.",
      },
    });
  }

  try {
    const { rows } = await query(
      `
      WITH rango AS (
        SELECT
          to_date($2 || '-01','YYYY-MM-DD') AS start_date,
          (to_date($2 || '-01','YYYY-MM-DD') + INTERVAL '1 month')::date AS end_date
      ),
      calendario AS (
        SELECT d::date AS fecha
        FROM rango,
             generate_series(rango.start_date,
                             rango.end_date - INTERVAL '1 day',
                             '1 day') AS d
        WHERE EXTRACT(ISODOW FROM d) BETWEEN 1 AND 5
      ),
      asist AS (
        SELECT DISTINCT a.fecha::date AS fecha
        FROM asistencia a
        JOIN rango ON a.fecha >= rango.start_date AND a.fecha < rango.end_date
        WHERE a.id_empleado = $1
          AND (a.estado ILIKE 'presente'
            OR a.estado ILIKE 'ok'
            OR a.estado ILIKE 'asistencia')
      ),
      feriados_trab AS (
        SELECT COUNT(*) AS cant
        FROM asistencia a
        JOIN feriados_irrenunciables f ON f.fecha = a.fecha
        JOIN rango ON a.fecha >= rango.start_date AND a.fecha < rango.end_date
        WHERE a.id_empleado = $1
          AND (a.estado ILIKE 'presente'
            OR a.estado ILIKE 'ok'
            OR a.estado ILIKE 'asistencia')
      ),
      datos AS (
        SELECT
          e.id_empleado,
          e.nombre,
          e.apellido_paterno,
          e.apellido_materno,
          e.sueldo_base,
          (SELECT COUNT(*) FROM calendario)             AS dias_habiles,
          (SELECT COUNT(*) FROM asist)                  AS dias_trabajados,
          COALESCE((SELECT cant FROM feriados_trab), 0) AS dias_feriado_trab
        FROM empleados e
        WHERE e.id_empleado = $1
      )
      SELECT
        id_empleado,
        nombre,
        apellido_paterno,
        apellido_materno,
        sueldo_base,
        dias_habiles,
        dias_trabajados,
        GREATEST(dias_habiles - dias_trabajados, 0) AS dias_inasistencia,
        dias_feriado_trab,
        ROUND(sueldo_base / NULLIF(dias_habiles, 0), 0) AS valor_dia,
        ROUND(
          GREATEST(dias_habiles - dias_trabajados, 0)
          * (sueldo_base / NULLIF(dias_habiles, 1)), 0
        ) AS monto_desc_inasistencia,
        ROUND(
          dias_feriado_trab
          * (sueldo_base / NULLIF(dias_habiles, 1)), 0
        ) AS monto_feriados_irrenunciables,
        ROUND(
          sueldo_base
          - GREATEST(dias_habiles - dias_trabajados, 0)
            * (sueldo_base / NULLIF(dias_habiles, 1))
          + dias_feriado_trab
            * (sueldo_base / NULLIF(dias_habiles, 1)),
          0
        ) AS sueldo_bruto_calculado
      FROM datos
      `,
      [empleadoId, period]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Empleado o período sin datos.",
        },
      });
    }

    return res.json({ data: rows[0] });
  } catch (err) {
    console.error("❌ ERROR_CALCULAR_LIQUIDACION:", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Error al calcular liquidación.",
      },
    });
  }
}

// ======================================================
// 3) Listado general (ADMIN / RRHH)
//    GET /api/v1/liquidaciones/admin?period=YYYY-MM[&id_empleado=]
// ======================================================
async function listarGeneral(req, res) {
  console.log("GET /liquidaciones/admin hit, query:", req.query);

  try {
    const rol = req.user?.rol || "empleado";
    if (!["admin", "rrhh"].includes(rol)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "No autorizado para ver liquidaciones generales.",
        },
      });
    }

    const periodRaw = String(req.query.period || "").trim(); // YYYY-MM
    const idEmpRaw = req.query.id_empleado;

    if (!/^\d{4}-\d{2}$/.test(periodRaw)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Debes indicar period=YYYY-MM.",
        },
      });
    }

    let idEmpleado = null;
    if (idEmpRaw !== undefined) {
      const tmp = parseInt(idEmpRaw, 10);
      if (!Number.isInteger(tmp)) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "id_empleado inválido.",
          },
        });
      }
      idEmpleado = tmp;
    }

    const params = [periodRaw];
    let sql = `
      SELECT
        l.id_liquidacion,
        l.id_empleado,
        l.id_contrato,
        l.periodo,
        l.dias_trabajados,
        l.sueldo_base,
        l.horas_extra,
        l.monto_horas_extra,
        l.gratificacion,
        l.otros_haberes,
        l.imponible,
        l.afp_desc,
        l.salud_desc,
        l.otros_descuentos,
        l.no_imponibles,
        l.tributable,
        l.impuesto,
        l.sueldo_liquido,
        l.generado_en,
        l.observacion,
        l.estado,
        e.nombre,
        e.apellido_paterno,
        e.apellido_materno,
        e.rut,
        e.digito_verificador,
        e.cargo
      FROM liquidaciones l
      JOIN empleados e ON l.id_empleado = e.id_empleado
      WHERE l.periodo = $1
    `;

    if (idEmpleado) {
      sql += ` AND l.id_empleado = $2`;
      params.push(idEmpleado);
    }

    sql += `
      ORDER BY
        l.periodo DESC,
        e.apellido_paterno,
        e.apellido_materno,
        e.nombre,
        l.id_liquidacion DESC
    `;

    const { rows } = await query(sql, params);
    return res.json({ data: rows });
  } catch (err) {
    console.error("ERROR_LISTAR_LIQUIDACIONES_GENERAL", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Error al listar liquidaciones generales.",
      },
    });
  }
}

// ======================================================
// 4) Cambiar estado de una liquidación (Admin / RRHH)
//    PUT /api/v1/liquidaciones/:id/estado
// ======================================================
async function cambiarEstado(req, res) {
  try {
    const rol = req.user?.rol || "empleado";
    if (!["admin", "rrhh"].includes(rol)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "No autorizado para cambiar estado de liquidaciones.",
        },
      });
    }

    const idLiq = parseInt(req.params.id, 10);
    if (isNaN(idLiq)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "ID de liquidación inválida.",
        },
      });
    }

    const { estado, observacion } = req.body || {};
    const estadoTrim = String(estado || "").trim().toLowerCase();
    const ALLOWED = ["calculada", "revisada", "aprobada", "publicada"];

    if (!ALLOWED.includes(estadoTrim)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Estado inválido. Usa: calculada, revisada, aprobada o publicada.",
        },
      });
    }

    let obsVal = null;
    if (typeof observacion === "string") {
      const t = observacion.trim();
      obsVal = t.length ? t : null;
    } else if (observacion === null || observacion === undefined) {
      obsVal = null;
    } else {
      obsVal = String(observacion);
    }

    const { rows } = await query(
      `
      UPDATE liquidaciones
      SET estado      = $1,
          observacion = $2
      WHERE id_liquidacion = $3
      RETURNING *
      `,
      [estadoTrim, obsVal, idLiq]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Liquidación no encontrada.",
        },
      });
    }

    return res.json({ data: rows[0] });
  } catch (err) {
    console.error("ERROR_CAMBIAR_ESTADO_LIQUIDACION", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Error al cambiar estado de la liquidación.",
      },
    });
  }
}

// ======================================================
// Helper: obtener contrato vigente para un empleado y periodo
// ======================================================
async function getContratoVigente(empleadoId, period) {
  const { rows } = await query(
    `
    SELECT id_contrato
    FROM contrato
    WHERE id_empleado = $1
      AND estado = 'vigente'
      -- Fecha inicio <= último día del mes
      AND fecha_inicio <= (
        to_date($2 || '-01','YYYY-MM-DD')
        + INTERVAL '1 month'
        - INTERVAL '1 day'
      )::date
      -- Fecha término NULL o >= primer día del mes
      AND (
        fecha_termino IS NULL
        OR fecha_termino >= to_date($2 || '-01','YYYY-MM-DD')
      )
    ORDER BY fecha_inicio DESC
    LIMIT 1
    `,
    [empleadoId, period] // 👈 OJO: acá mandamos '2025-11', no '2025-11-01'
  );

  if (rows.length === 0) return null;
  return rows[0].id_contrato;
}

// ======================================================
// 5) Generar / recalcular liquidaciones de un período
//    POST /api/v1/liquidaciones/admin/generar?period=YYYY-MM
// ======================================================
async function generarPeriodoLiquidaciones(req, res) {
  try {
    const rol = req.user?.rol || "empleado";
    if (!["admin", "rrhh"].includes(rol)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "No autorizado para generar liquidaciones.",
        },
      });
    }

    const periodRaw = String(req.query.period || "").trim(); // YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(periodRaw)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Debes indicar period=YYYY-MM.",
        },
      });
    }

    // 1) Traer empleados (ajusta WHERE si usas campo estado)
    const { rows: empleados } = await query(
      `
      SELECT id_empleado
      FROM empleados
      -- WHERE estado = 'activo'
      ORDER BY id_empleado
      `
    );

    if (empleados.length === 0) {
      return res.json({
        data: {
          periodo: periodRaw,
          procesados: 0,
          nuevos: 0,
          actualizados: 0,
        },
      });
    }

    let procesados = 0;
    let nuevos = 0;
    let actualizados = 0;

    for (const emp of empleados) {
      const idEmp = emp.id_empleado;

      // 2) Contrato vigente
      const idContrato = await getContratoVigente(idEmp, periodRaw);
      if (!idContrato) {
        console.warn(
          `⚠️  Empleado ${idEmp} no tiene contrato vigente en ${periodRaw}, se omite.`
        );
        continue;
      }

      // 3) Calcular resumen desde asistencia
      const { rows: calcRows } = await query(
        `
        WITH rango AS (
          SELECT
            to_date($2 || '-01','YYYY-MM-DD') AS start_date,
            (to_date($2 || '-01','YYYY-MM-DD') + INTERVAL '1 month')::date AS end_date
        ),
        calendario AS (
          SELECT d::date AS fecha
          FROM rango,
               generate_series(rango.start_date,
                               rango.end_date - INTERVAL '1 day',
                               '1 day') AS d
          WHERE EXTRACT(ISODOW FROM d) BETWEEN 1 AND 5
        ),
        asist AS (
          SELECT DISTINCT a.fecha::date AS fecha
          FROM asistencia a
          JOIN rango ON a.fecha >= rango.start_date AND a.fecha < rango.end_date
          WHERE a.id_empleado = $1
            AND (a.estado ILIKE 'presente'
              OR a.estado ILIKE 'ok'
              OR a.estado ILIKE 'asistencia')
        ),
        feriados_trab AS (
          SELECT COUNT(*) AS cant
          FROM asistencia a
          JOIN feriados_irrenunciables f ON f.fecha = a.fecha
          JOIN rango ON a.fecha >= rango.start_date AND a.fecha < rango.end_date
          WHERE a.id_empleado = $1
            AND (a.estado ILIKE 'presente'
              OR a.estado ILIKE 'ok'
              OR a.estado ILIKE 'asistencia')
        ),
        datos AS (
          SELECT
            e.id_empleado,
            e.sueldo_base,
            (SELECT COUNT(*) FROM calendario)             AS dias_habiles,
            (SELECT COUNT(*) FROM asist)                  AS dias_trabajados,
            COALESCE((SELECT cant FROM feriados_trab), 0) AS dias_feriado_trab
          FROM empleados e
          WHERE e.id_empleado = $1
        )
        SELECT
          id_empleado,
          sueldo_base,
          dias_habiles,
          dias_trabajados,
          GREATEST(dias_habiles - dias_trabajados, 0) AS dias_inasistencia,
          dias_feriado_trab,
          ROUND(sueldo_base / NULLIF(dias_habiles, 0), 0) AS valor_dia,
          ROUND(
            GREATEST(dias_habiles - dias_trabajados, 0)
            * (sueldo_base / NULLIF(dias_habiles, 1)), 0
          ) AS monto_desc_inasistencia,
          ROUND(
            dias_feriado_trab
            * (sueldo_base / NULLIF(dias_habiles, 1)), 0
          ) AS monto_feriados_irrenunciables,
          ROUND(
            sueldo_base
            - GREATEST(dias_habiles - dias_trabajados, 0)
              * (sueldo_base / NULLIF(dias_habiles, 1))
            + dias_feriado_trab
              * (sueldo_base / NULLIF(dias_habiles, 1)),
            0
          ) AS sueldo_bruto_calculado
        FROM datos
        `,
        [idEmp, periodRaw]
      );

      if (calcRows.length === 0) {
        // sin datos de asistencia para ese período → saltamos
        continue;
      }

      const c = calcRows[0];
      procesados++;

      const imponible = Number(c.sueldo_bruto_calculado || 0);
      const afp_desc = 0;          // por ahora 0, puedes ajustar la lógica
      const salud_desc = 0;        // idem
      const otros_desc = 0;
      const no_imponibles = 0;
      const tributable = imponible - afp_desc - salud_desc - otros_desc;
      const impuesto = 0;
      const liquido =
        imponible - afp_desc - salud_desc - otros_desc - impuesto;

      // 4) ¿Existe ya liquidación para empleado+periodo?
      const { rows: existing } = await query(
        `
        SELECT id_liquidacion
        FROM liquidaciones
        WHERE id_empleado = $1
          AND periodo = $2
        LIMIT 1
        `,
        [idEmp, periodRaw]
      );

      if (existing.length === 0) {
        // INSERT
        await query(
          `
          INSERT INTO liquidaciones (
            id_empleado,
            id_contrato,
            periodo,
            dias_trabajados,
            sueldo_base,
            horas_extra,
            monto_horas_extra,
            gratificacion,
            otros_haberes,
            imponible,
            afp_desc,
            salud_desc,
            otros_descuentos,
            no_imponibles,
            tributable,
            impuesto,
            sueldo_liquido,
            generado_en,
            observacion,
            estado
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            0,
            0,
            0,
            0,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            NOW(),
            NULL,
            'calculada'
          )
          `,
          [
            idEmp,              // $1
            idContrato,         // $2
            periodRaw,          // $3
            c.dias_trabajados,  // $4
            c.sueldo_base,      // $5
            imponible,          // $6
            afp_desc,           // $7
            salud_desc,         // $8
            otros_desc,         // $9
            no_imponibles,      // $10
            tributable,         // $11
            impuesto,           // $12
            liquido,            // $13
          ]
        );
        nuevos++;
      } else {
        // UPDATE
        await query(
          `
          UPDATE liquidaciones
          SET
            id_empleado       = $1,
            id_contrato       = $2,
            dias_trabajados   = $3,
            sueldo_base       = $4,
            horas_extra       = 0,
            monto_horas_extra = 0,
            gratificacion     = 0,
            otros_haberes     = 0,
            imponible         = $5,
            afp_desc          = $6,
            salud_desc        = $7,
            otros_descuentos  = $8,
            no_imponibles     = $9,
            tributable        = $10,
            impuesto          = $11,
            sueldo_liquido    = $12,
            generado_en       = NOW(),
            estado            = 'calculada'
          WHERE id_liquidacion = $13
          `,
          [
            idEmp,                 // $1
            idContrato,            // $2
            c.dias_trabajados,     // $3
            c.sueldo_base,         // $4
            imponible,             // $5
            afp_desc,              // $6
            salud_desc,            // $7
            otros_desc,            // $8
            no_imponibles,         // $9
            tributable,            // $10
            impuesto,              // $11
            liquido,               // $12
            existing[0].id_liquidacion, // $13
          ]
        );
        actualizados++;
      }
    }

    return res.json({
      data: {
        periodo: periodRaw,
        procesados,
        nuevos,
        actualizados,
      },
    });
  } catch (err) {
    console.error("❌ ERROR_GENERAR_PERIODO_LIQUIDACIONES", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Error al generar liquidaciones del período.",
      },
    });
  }
}

module.exports = {
  listarPorEmpleado,
  listarGeneral,
  calcularLiquidacionEmpleado,
  cambiarEstado,
  generarPeriodoLiquidaciones,
};