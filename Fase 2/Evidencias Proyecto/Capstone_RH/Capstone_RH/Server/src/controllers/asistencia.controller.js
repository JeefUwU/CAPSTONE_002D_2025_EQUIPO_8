const { query } = require("../db");

//---Marcar asistencia---//
async function marcarDia(req, res) {
  const idEmpleado = req.user?.id_empleado;
  if (!idEmpleado) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Empleado no autenticado." },
    });
  }

  try {
    const { rows: nowRows } = await query(
      `SELECT (now() AT TIME ZONE 'America/Santiago') AS ts`
    );
    const tsNow = nowRows[0].ts;
    const abierto = await query(
      `SELECT id_asistencia
       FROM asistencia
       WHERE id_empleado = $1
         AND fecha = ($2::timestamp)::date
         AND hora_salida IS NULL
       LIMIT 1`,
      [idEmpleado, tsNow]
    );

    // === ENTRADA ===
    if (abierto.rowCount === 0) {
      const yaHoy = await query(
        `SELECT 1 FROM asistencia WHERE id_empleado = $1 AND fecha = ($2::timestamp)::date LIMIT 1`,
        [idEmpleado, tsNow]
      );
      if (yaHoy.rowCount > 0) {
        return res.status(409).json({
          error: {
            code: "CONFLICT",
            message: "Ya marcaste tu jornada de hoy.",
          },
        });
      }

      const ins = await query(
        `INSERT INTO asistencia (
           id_empleado, fecha, hora_entrada, minutos_colacion,
           horas_trabajadas, horas_extra, estado, observacion
         )
         VALUES ($1, ($2::timestamp)::date, ($2::timestamp)::time, 60, 0, 0, 'presente', NULL)
         RETURNING id_asistencia, fecha, hora_entrada`,
        [idEmpleado, tsNow]
      );

      return res.status(201).json({
        data: {
          message: "Entrada registrada correctamente.",
          registro: ins.rows[0],
        },
      });
    }

    // === SALIDA ===
    const idAsistencia = abierto.rows[0].id_asistencia;
    const up = await query(
      `UPDATE asistencia
         SET hora_salida = ($2::timestamp)::time,
             horas_trabajadas = ROUND(
               GREATEST(
                 EXTRACT(EPOCH FROM (
                   (fecha::timestamp + (($2::timestamp)::time))
                   - (fecha::timestamp + (hora_entrada::time))
                 )) / 3600.0
                 - (COALESCE(minutos_colacion,60) / 60.0),
                 0
               )::numeric, 2),
             horas_extra = ROUND(
               GREATEST(
                 (
                   EXTRACT(EPOCH FROM (
                     (fecha::timestamp + (($2::timestamp)::time))
                     - (fecha::timestamp + (hora_entrada::time))
                   )) / 3600.0
                   - (COALESCE(minutos_colacion,60) / 60.0)
                   - 8.0
                 ),
                 0
               )::numeric, 2)
       WHERE id_asistencia = $1
       RETURNING id_asistencia, fecha, hora_entrada, hora_salida, horas_trabajadas, horas_extra`,
      [idAsistencia, tsNow]
    );

    return res.json({
      data: {
        message: "Salida registrada correctamente.",
        registro: up.rows[0],
      },
    });
  } catch (err) {
    console.error("❌ ERROR_MARCAR_DIA:", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Error interno al marcar asistencia.",
      },
    });
  }
}

//---Listar días de asistencia---//
async function listarDias(req, res) {
  const empleadoId = parseInt(req.params.id_empleado, 10);
  const period = String(req.query.period || "").trim();

  if (isNaN(empleadoId))
    return res
      .status(400)
      .json({ error: { code: "VALIDATION_ERROR", message: "ID inválido." } });
  if (!/^\d{4}-\d{2}$/.test(period))
    return res
      .status(400)
      .json({ error: { code: "VALIDATION_ERROR", message: "Use YYYY-MM." } });

  try {
    const { rows: r } = await query(
      `
      WITH rango AS (
        SELECT to_date($2 || '-01','YYYY-MM-DD') AS start_date,
               (to_date($2 || '-01','YYYY-MM-DD') + INTERVAL '1 month')::date AS end_date
      )
      SELECT a.*
        FROM asistencia a, rango
       WHERE a.id_empleado = $1
         AND a.fecha >= rango.start_date
         AND a.fecha < rango.end_date
       ORDER BY fecha DESC, id_asistencia DESC
      `,
      [empleadoId, period]
    );

    const { rows: abiertoRows } = await query(
      `SELECT 1 FROM asistencia WHERE id_empleado=$1 AND fecha=CURRENT_DATE AND hora_salida IS NULL LIMIT 1`,
      [empleadoId]
    );

    res.json({ data: r, abierto: abiertoRows.length > 0 });
  } catch (err) {
    console.error("❌ ERROR_LISTAR_DIAS:", err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Error al listar asistencia." },
    });
  }
}

//---Resumen mensual---//
async function resumenMensual(req, res) {
  const empleadoId = parseInt(req.params.id_empleado, 10);
  const period = String(req.query.period || "").trim();

  if (isNaN(empleadoId))
    return res
      .status(400)
      .json({ error: { code: "VALIDATION_ERROR", message: "ID inválido." } });
  if (!/^\d{4}-\d{2}$/.test(period))
    return res
      .status(400)
      .json({ error: { code: "VALIDATION_ERROR", message: "Use YYYY-MM." } });

  try {
    const { rows } = await query(
      `
      WITH rango AS (
        SELECT to_date($2 || '-01','YYYY-MM-DD') AS start_date,
               (to_date($2 || '-01','YYYY-MM-DD') + INTERVAL '1 month')::date AS end_date
      )
      SELECT
        COALESCE(SUM(horas_trabajadas),0)::numeric(10,2) AS total_horas,
        COALESCE(SUM(horas_extra),0)::numeric(10,2) AS total_horas_extra,
        COUNT(*) FILTER (WHERE estado ILIKE 'presente' OR estado ILIKE 'ok' OR estado ILIKE 'asistencia') AS dias_asistidos
      FROM asistencia, rango
      WHERE id_empleado=$1 AND fecha>=rango.start_date AND fecha<rango.end_date
      `,
      [empleadoId, period]
    );

    res.json({ data: rows[0] });
  } catch (err) {
    console.error("❌ ERROR_RESUMEN_MENSUAL:", err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Error al obtener resumen." },
    });
  }
}

//---Editar día (solo RRHH/Admin)---/
async function editarDia(req, res) {
  if (!["rrhh", "admin"].includes(req.user?.rol))
    return res
      .status(403)
      .json({ error: { code: "FORBIDDEN", message: "No autorizado." } });

  const idAsistencia = parseInt(req.params.id_asistencia, 10);
  if (isNaN(idAsistencia))
    return res
      .status(400)
      .json({ error: { code: "VALIDATION_ERROR", message: "ID inválido." } });

  const {
    hora_entrada,
    hora_salida,
    minutos_colacion,
    horas_trabajadas,
    horas_extra,
    estado,
    observacion,
  } = req.body || {};

  try {
    const up = await query(
      `UPDATE asistencia
          SET hora_entrada=$1, hora_salida=$2, minutos_colacion=$3,
              horas_trabajadas=$4, horas_extra=$5, estado=$6, observacion=$7
        WHERE id_asistencia=$8 RETURNING *`,
      [
        hora_entrada,
        hora_salida,
        minutos_colacion,
        horas_trabajadas,
        horas_extra,
        estado,
        observacion,
        idAsistencia,
      ]
    );
    res.json({ data: up.rows[0] });
  } catch (err) {
    console.error("❌ ERROR_EDITAR_DIA:", err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Error al editar día." },
    });
  }
}

//---Agregar día manualmente (solo RRHH/Admin)---//
async function agregarDia(req, res) {
  if (!["rrhh", "admin"].includes(req.user?.rol))
    return res
      .status(403)
      .json({ error: { code: "FORBIDDEN", message: "No autorizado." } });

  const { id_empleado, fecha, hora_entrada, hora_salida, estado } =
    req.body || {};
  if (!id_empleado || !fecha)
    return res
      .status(400)
      .json({ error: { code: "VALIDATION_ERROR", message: "Faltan campos." } });

  try {
    const ins = await query(
      `INSERT INTO asistencia (id_empleado, fecha, hora_entrada, hora_salida, estado)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [
        id_empleado,
        fecha,
        hora_entrada || null,
        hora_salida || null,
        estado || "presente",
      ]
    );
    res.status(201).json({ data: ins.rows[0] });
  } catch (err) {
    console.error("❌ ERROR_AGREGAR_DIA:", err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Error al agregar día." },
    });
  }
}

//---Eliminar día (solo RRHH/Admin)---//
async function eliminarDia(req, res) {
  if (!["rrhh", "admin"].includes(req.user?.rol))
    return res
      .status(403)
      .json({ error: { code: "FORBIDDEN", message: "No autorizado." } });

  const idAsistencia = parseInt(req.params.id_asistencia, 10);
  if (isNaN(idAsistencia))
    return res
      .status(400)
      .json({ error: { code: "VALIDATION_ERROR", message: "ID inválido." } });

  try {
    await query(`DELETE FROM asistencia WHERE id_asistencia=$1`, [
      idAsistencia,
    ]);
    res.json({ data: { message: "Registro eliminado correctamente." } });
  } catch (err) {
    console.error("❌ ERROR_ELIMINAR_DIA:", err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Error al eliminar día." },
    });
  }
}

// --- Listado general para Admin / RRHH --- //
async function listarGeneral(req, res) {
  try {
    // 1) Autorización
    const rol = req.user?.rol;
    if (!["admin", "rrhh"].includes(rol)) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "No autorizado." },
      });
    }

    // 2) Parámetros de filtro
    const periodRaw = String(req.query.period || "").trim(); // YYYY-MM
    const fechaRaw  = String(req.query.fecha  || "").trim(); // YYYY-MM-DD
    const fromRaw   = String(req.query.from   || "").trim(); // YYYY-MM-DD
    const toRaw     = String(req.query.to     || "").trim(); // YYYY-MM-DD
    const idEmpRaw  = req.query.id_empleado;

    const period = /^\d{4}-\d{2}$/.test(periodRaw) ? periodRaw : null;
    const fecha  = /^\d{4}-\d{2}-\d{2}$/.test(fechaRaw) ? fechaRaw : null;
    const from   = /^\d{4}-\d{2}-\d{2}$/.test(fromRaw) ? fromRaw : null;
    const to     = /^\d{4}-\d{2}-\d{2}$/.test(toRaw) ? toRaw : null;

    let idEmpleado = null;
    if (idEmpRaw !== undefined) {
      const tmp = parseInt(idEmpRaw, 10);
      if (!Number.isInteger(tmp)) {
        return res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "id_empleado inválido." },
        });
      }
      idEmpleado = tmp;
    }

    // 3) Elegir modo de filtro: period / fecha / from-to
    let sql = "";
    const params = [];

    if (period) {
      // ---- Filtro por MES (YYYY-MM) ----
      sql = `
        WITH rango AS (
          SELECT
            to_date($1 || '-01','YYYY-MM-DD') AS start_date,
            (to_date($1 || '-01','YYYY-MM-DD') + INTERVAL '1 month')::date AS end_date
        )
        SELECT
          a.*,
          e.nombre AS nombre_empleado,
          e.apellido_paterno,
          e.apellido_materno,
          e.rut,
          e.digito_verificador,
          e.cargo
        FROM asistencia a
        JOIN empleados e ON a.id_empleado = e.id_empleado,
             rango
        WHERE a.fecha >= rango.start_date
          AND a.fecha <  rango.end_date
      `;
      params.push(period);

      if (idEmpleado) {
        sql += ` AND a.id_empleado = $2`;
        params.push(idEmpleado);
      }

      sql += ` ORDER BY a.fecha DESC, a.id_asistencia DESC`;
    } else if (fecha) {
      // ---- Filtro por DÍA (YYYY-MM-DD) ----
      sql = `
        SELECT
          a.*,
          e.nombre AS nombre_empleado,
          e.apellido_paterno,
          e.apellido_materno,
          e.rut,
          e.digito_verificador,
          e.cargo
        FROM asistencia a
        JOIN empleados e ON a.id_empleado = e.id_empleado
        WHERE a.fecha = $1
      `;
      params.push(fecha);

      if (idEmpleado) {
        sql += ` AND a.id_empleado = $2`;
        params.push(idEmpleado);
      }

      sql += ` ORDER BY a.fecha DESC, a.id_asistencia DESC`;
    } else if (from && to) {
      // ---- Filtro por RANGO (semana u otro) ----
      sql = `
        SELECT
          a.*,
          e.nombre AS nombre_empleado,
          e.apellido_paterno,
          e.apellido_materno,
          e.rut,
          e.digito_verificador,
          e.cargo
        FROM asistencia a
        JOIN empleados e ON a.id_empleado = e.id_empleado
        WHERE a.fecha >= $1
          AND a.fecha <= $2
      `;
      params.push(from, to);

      if (idEmpleado) {
        sql += ` AND a.id_empleado = $3`;
        params.push(idEmpleado);
      }

      sql += ` ORDER BY a.fecha DESC, a.id_asistencia DESC`;
    } else {
      // ---- Nada definido correctamente ----
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Debes indicar period=YYYY-MM, o fecha=YYYY-MM-DD, o from/to=YYYY-MM-DD.",
        },
      });
    }

    // 4) Ejecutar consulta
    const { rows } = await query(sql, params);

    // 5) Responder
    return res.json({ data: rows });
  } catch (err) {
    console.error("❌ ERROR_LISTAR_GENERAL_ASISTENCIA:", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Error al listar asistencia general.",
      },
    });
  }
}

module.exports = {
  marcarDia,
  listarDias,
  resumenMensual,
  editarDia,
  agregarDia,
  eliminarDia,
  listarGeneral,
};