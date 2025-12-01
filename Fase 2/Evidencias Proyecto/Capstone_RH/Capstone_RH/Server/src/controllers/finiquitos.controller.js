const { query } = require("../db");

async function getContratoYEmpleado(id_contrato) {
  const { rows } = await query(
    `
    SELECT 
      c.id_contrato, c.id_empleado, c.fecha_inicio, c.fecha_termino,
      c.tipo, c.jornada, c.cargo_contratado, c.sueldo_base_contrato, c.estado,
      e.nombre AS nombre_empleado,
      (e.apellido_paterno || ' ' || COALESCE(e.apellido_materno,'')) AS apellidos_completos,
      (e.rut || '-' || COALESCE(e.digito_verificador,'')) AS rut
    FROM contrato c
    JOIN empleados e ON e.id_empleado = c.id_empleado
    WHERE c.id_contrato = $1
    `,
    [id_contrato]
  );
  return rows[0] || null;
}

//---CREAR NUEVO FINIQUITO---//
async function crearFiniquito(req, res) {
  try {
    // Solo RRHH o admin
    if (!["rrhh", "admin"].includes(req.user?.rol)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "No tienes permisos para crear finiquitos.",
        },
      });
    }

    const { id_contrato, fecha_finiquito, causal, monto_total, detalle } =
      req.body || {};
    if (!id_contrato || !causal) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "id_contrato y causal son obligatorios.",
        },
      });
    }

    const contrato = await getContratoYEmpleado(id_contrato);
    if (!contrato) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Contrato no encontrado." },
      });
    }

    // Verificar duplicado
    const existeFiniquito = await query(
      `SELECT 1 FROM finiquitos WHERE id_contrato = $1`,
      [id_contrato]
    );
    if (existeFiniquito.rowCount > 0) {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "El contrato ya tiene un finiquito registrado.",
        },
      });
    }

    // Validar fechas
    const hoy = new Date().toISOString().slice(0, 10);
    const fechaFin = fecha_finiquito || hoy;
    if (new Date(fechaFin) < new Date(contrato.fecha_inicio)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "La fecha de finiquito no puede ser anterior al inicio del contrato.",
        },
      });
    }

    if (contrato.estado === "finiquitado") {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "El contrato ya está finiquitado.",
        },
      });
    }

    // Insertar registro
    const ins = await query(
      `INSERT INTO finiquitos (id_contrato, fecha_finiquito, causal, monto_total, detalle, documento_url, firmado)
       VALUES ($1,$2,$3,$4,$5,NULL,false)
       RETURNING id_finiquito`,
      [
        id_contrato,
        fechaFin,
        String(causal).trim(),
        Number(monto_total ?? 0),
        detalle ?? null,
      ]
    );

    const id_finiquito = ins.rows[0].id_finiquito;

    // Actualizar contrato
    await query(
      `UPDATE contrato SET estado = 'finiquitado', fecha_termino = $1 WHERE id_contrato = $2`,
      [fechaFin, id_contrato]
    );

    // No generamos PDF aquí, se hará bajo demanda
    return res.status(201).json({
      data: {
        id_finiquito,
        id_contrato,
        fecha_finiquito: fechaFin,
        causal,
        monto_total: Number(monto_total ?? 0),
        message:
          "Finiquito registrado correctamente (PDF disponible al visualizar).",
      },
      meta: { location: `/api/v1/finiquitos/${id_finiquito}` },
    });
  } catch (err) {
    console.error("ERROR_CREAR_FINIQUITO", err);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Error interno al crear finiquito.",
      },
    });
  }
}

//---LISTAR FINIQUITOS POR EMPLEADO---//
async function listarFiniquitosPorEmpleado(req, res) {
  try {
    const id_empleado = parseInt(req.params.id_empleado ?? req.params.id, 10);
    if (isNaN(id_empleado)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "ID de empleado inválida.",
        },
      });
    }

    if (req.user?.rol === "empleado" && req.user.id_empleado !== id_empleado) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "No puedes ver finiquitos de otro empleado.",
        },
      });
    }

    const { rows } = await query(
      `SELECT f.id_finiquito, f.id_contrato, f.fecha_finiquito, f.causal,
              f.monto_total, f.documento_url, f.firmado, f.creado_en,
              c.cargo_contratado, c.jornada, c.tipo
         FROM finiquitos f
         JOIN contrato c ON c.id_contrato = f.id_contrato
        WHERE c.id_empleado = $1
        ORDER BY f.fecha_finiquito DESC, f.id_finiquito DESC`,
      [id_empleado]
    );

    res.json({ data: rows });
  } catch (err) {
    console.error("ERROR_LISTAR_FINIQUITOS_EMPLEADO", err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Error al listar finiquitos." },
    });
  }
}

module.exports = {
  crearFiniquito,
  listarFiniquitosPorEmpleado,
};
