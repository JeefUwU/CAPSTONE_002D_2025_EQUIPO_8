const { query } = require("../db");

async function getContratoBasico(id_contrato) {
  const { rows } = await query(
    `SELECT c.id_contrato, c.tipo, c.jornada, c.cargo_contratado,
            c.sueldo_base_contrato, c.estado, c.fecha_inicio, c.fecha_termino,
            e.id_empleado, e.nombre AS nombre_empleado,
            (e.apellido_paterno || ' ' || COALESCE(e.apellido_materno,'')) AS apellidos_completos,
            (e.rut || '-' || COALESCE(e.digito_verificador,'')) AS rut
       FROM contrato c
       JOIN empleados e ON e.id_empleado = c.id_empleado
      WHERE c.id_contrato = $1`,
    [id_contrato]
  );
  return rows[0] || null;
}

//--- ANEXOS POR CONTRATO ---//
async function anexosPorContrato(req, res) {
  const contratoId = parseInt(req.params.id_contrato ?? req.params.id, 10);
  if (isNaN(contratoId)) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "ID de contrato inválido." },
    });
  }

  try {
    const contrato = await getContratoBasico(contratoId);
    if (!contrato) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Contrato no encontrado." },
      });
    }

    if (
      req.user?.rol === "empleado" &&
      req.user.id_empleado !== contrato.id_empleado
    ) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "No puedes ver anexos de otro empleado.",
        },
      });
    }

    const resultado = await query(
      `SELECT id_anexo, id_contrato, fecha, tipo_cambio, detalle,
              valor_anterior, valor_nuevo, documento_url, creado_en
         FROM anexo
        WHERE id_contrato = $1
        ORDER BY fecha DESC, id_anexo DESC`,
      [contratoId]
    );

    res.json({ data: resultado.rows });
  } catch (err) {
    console.error("ERROR_ANEXOS_CONTRATO", err);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Error al listar anexos del contrato.",
      },
    });
  }
}

// --- ANEXOS POR EMPLEADO ---//
async function anexosPorEmpleado(req, res) {
  const empleadoId = parseInt(req.params.id, 10);
  if (isNaN(empleadoId)) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "ID de empleado inválido." },
    });
  }

  try {
    if (req.user?.rol === "empleado" && req.user.id_empleado !== empleadoId) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "No puedes ver anexos de otro empleado.",
        },
      });
    }

    const resultado = await query(
      `SELECT a.id_anexo, a.id_contrato, a.fecha, a.tipo_cambio, a.detalle,
              a.valor_anterior, a.valor_nuevo, a.documento_url, a.creado_en
         FROM anexo a
         JOIN contrato c ON c.id_contrato = a.id_contrato
        WHERE c.id_empleado = $1
        ORDER BY a.fecha DESC, a.id_anexo DESC`,
      [empleadoId]
    );

    res.json({ data: resultado.rows });
  } catch (err) {
    console.error("ERROR_ANEXOS_EMPLEADO", err);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Error al listar anexos del empleado.",
      },
    });
  }
}

// --- CREAR NUEVO ANEXO---//
async function crearAnexo(req, res) {
  const {
    id_contrato,
    fecha,
    tipo_cambio,
    detalle,
    valor_anterior,
    valor_nuevo,
  } = req.body || {};

  if (
    !id_contrato ||
    !fecha ||
    !tipo_cambio ||
    !detalle ||
    !valor_anterior ||
    !valor_nuevo
  ) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Faltan campos obligatorios.",
      },
    });
  }

  const tipo = String(tipo_cambio).toLowerCase().trim();
  if (!["sueldo", "jornada", "cargo", "otro"].includes(tipo)) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "tipo_cambio inválido." },
    });
  }

  // Reglas específicas
  if (tipo === "sueldo" && (!Number(valor_nuevo) || valor_nuevo <= 0)) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "valor_nuevo inválido para sueldo.",
      },
    });
  }
  if (
    tipo === "jornada" &&
    !["completa", "parcial"].includes(String(valor_nuevo).toLowerCase())
  ) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "jornada inválida (use 'completa' o 'parcial').",
      },
    });
  }

  try {
    const contrato = await getContratoBasico(id_contrato);
    if (!contrato) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Contrato no encontrado." },
      });
    }

    if (contrato.estado !== "vigente") {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "No se pueden crear anexos sobre contrato no vigente.",
        },
      });
    }

    if (!["rrhh", "admin"].includes(req.user?.rol)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "No tienes permisos para crear anexos.",
        },
      });
    }

    // Insertar el nuevo anexo
    const ins = await query(
      `INSERT INTO anexo (id_contrato, fecha, tipo_cambio, detalle, valor_anterior, valor_nuevo, documento_url)
       VALUES ($1,$2,$3,$4,$5,$6, NULL)
       RETURNING id_anexo`,
      [
        id_contrato,
        fecha,
        tipo,
        detalle.trim(),
        valor_anterior.trim(),
        valor_nuevo.trim(),
      ]
    );

    const id_anexo = ins.rows[0].id_anexo;

    // Actualizar contrato base según tipo
    if (tipo === "sueldo") {
      await query(
        `UPDATE contrato SET sueldo_base_contrato = $1 WHERE id_contrato = $2`,
        [valor_nuevo, id_contrato]
      );
    } else if (tipo === "jornada") {
      await query(`UPDATE contrato SET jornada = $1 WHERE id_contrato = $2`, [
        valor_nuevo.toLowerCase(),
        id_contrato,
      ]);
    } else if (tipo === "cargo") {
      await query(
        `UPDATE contrato SET cargo_contratado = $1 WHERE id_contrato = $2`,
        [valor_nuevo.trim(), id_contrato]
      );
    }

    res.status(201).json({
      data: {
        id_anexo,
        message: "Anexo creado correctamente (PDF se generará al visualizar).",
      },
      meta: { location: `/api/v1/anexos/${id_anexo}` },
    });
  } catch (err) {
    console.error("ERROR_CREAR_ANEXO", err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Error al crear anexo." },
    });
  }
}

module.exports = {
  anexosPorContrato,
  anexosPorEmpleado,
  crearAnexo,
};
