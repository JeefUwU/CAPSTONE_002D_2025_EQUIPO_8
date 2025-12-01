const { query } = require("../db");

//---LISTAR CONTRATOS---//
async function listarContratos(req, res) {
  try {
    const resultado =
      await query(`SELECT c.id_contrato, c.tipo, c.jornada, c.cargo_contratado, c.sueldo_base_contrato, c.estado, c.fecha_inicio, c.fecha_termino, c.archivo_pdf,e.id_empleado,e.nombre,e.apellido_paterno,e.apellido_materno,
        e.rut || '-' || COALESCE(e.digito_verificador,'') AS rut
        FROM contrato c
        INNER JOIN empleados e ON c.id_empleado = e.id_empleado
        ORDER BY c.id_contrato DESC;`);
    res.json({ data: resultado.rows });
  } catch (err) {
    console.error("ERROR_LISTAR_CONTRATOS", err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Error al listar contratos." },
    });
  }
}

//---OBTENER CONTRATO POR ID---//
async function contratoPorId(req, res) {
  const contratoId = parseInt(req.params.id, 10);
  if (isNaN(contratoId)) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "ID de contrato inválido." },
    });
  }

  try {
    const resultado = await query(
      `SELECT 
         c.id_contrato, c.tipo, c.jornada, c.cargo_contratado, c.sueldo_base_contrato, 
         c.estado, c.fecha_inicio, c.fecha_termino, c.archivo_pdf,
         e.nombre AS nombre_empleado, 
         CONCAT_WS(' ', e.apellido_paterno, e.apellido_materno) AS apellidos_completos, 
         e.rut || '-' || COALESCE(e.digito_verificador,'') AS rut
       FROM contrato c
       INNER JOIN empleados e ON c.id_empleado = e.id_empleado
       WHERE c.id_contrato = $1;`,
      [contratoId]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Contrato no encontrado." },
      });
    }

    res.json({ data: resultado.rows[0] });
  } catch (err) {
    console.error("ERROR_CONTRATO_POR_ID", err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Error al obtener contrato." },
    });
  }
}

//---CONTRATOS POR EMPLEADO---//
async function contratoIdEmpleado(req, res) {
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
          message: "No puedes ver contratos de otro empleado.",
        },
      });
    }

    const resultado = await query(
      `SELECT 
         c.id_contrato, c.tipo, c.jornada, c.cargo_contratado, c.sueldo_base_contrato, 
         c.estado, c.fecha_inicio, c.fecha_termino, c.archivo_pdf,
         e.id_empleado, e.nombre AS nombre_empleado, 
         (e.apellido_paterno || ' ' || COALESCE(e.apellido_materno,'')) AS apellidos_completos, 
         (e.rut || '-' || COALESCE(e.digito_verificador,'')) AS rut
       FROM contrato c
       INNER JOIN empleados e ON c.id_empleado = e.id_empleado
       WHERE e.id_empleado = $1
       ORDER BY c.fecha_inicio DESC, c.id_contrato DESC;`,
      [empleadoId]
    );

    res.json({ data: resultado.rows });
  } catch (err) {
    console.error("ERROR_CONTRATOS_EMPLEADO", err);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Error al listar contratos del empleado.",
      },
    });
  }
}

//---CREAR NUEVO CONTRATO---//
async function crearContrato(req, res) {
  const {
    id_empleado,
    fecha_inicio,
    fecha_termino,
    tipo,
    jornada,
    cargo_contratado,
    sueldo_base_contrato,
    observaciones,
  } = req.body || {};

  if (
    !id_empleado ||
    !fecha_inicio ||
    !tipo ||
    !jornada ||
    !cargo_contratado ||
    !sueldo_base_contrato
  ) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Faltan campos obligatorios.",
      },
    });
  }

  if (Number(sueldo_base_contrato) <= 0) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "El sueldo base debe ser mayor que 0.",
      },
    });
  }

  if (String(tipo).toLowerCase() === "plazo fijo") {
    if (!fecha_termino) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "fecha_termino es obligatoria para contratos a plazo fijo.",
        },
      });
    }
    if (new Date(fecha_termino) < new Date(fecha_inicio)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "fecha_termino no puede ser menor que fecha_inicio.",
        },
      });
    }
  }

  try {
    // Verificar existencia de empleado
    const emp = await query(`SELECT 1 FROM empleados WHERE id_empleado = $1`, [
      id_empleado,
    ]);
    if (emp.rowCount === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Empleado no encontrado." },
      });
    }

    // Verificar contrato vigente
    const vigente = await query(
      `SELECT 1 FROM contrato
        WHERE id_empleado = $1
          AND estado = 'vigente'
          AND (fecha_termino IS NULL OR fecha_termino >= CURRENT_DATE);`,
      [id_empleado]
    );
    if (vigente.rowCount > 0) {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "El empleado ya tiene un contrato vigente.",
        },
      });
    }

    // Insertar nuevo contrato
    const insert = await query(
      `INSERT INTO contrato
        (id_empleado, fecha_inicio, fecha_termino, tipo, jornada, cargo_contratado,
         sueldo_base_contrato, estado, observaciones, archivo_pdf)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'vigente',$8,NULL)
       RETURNING id_contrato;`,
      [
        id_empleado,
        fecha_inicio,
        fecha_termino || null,
        tipo,
        jornada,
        cargo_contratado,
        sueldo_base_contrato,
        observaciones || null,
      ]
    );

    const id_contrato = insert.rows[0].id_contrato;
    res.status(201).json({
      data: { id_contrato, message: "Contrato creado correctamente." },
      meta: { location: `/api/v1/contratos/${id_contrato}` },
    });
  } catch (err) {
    console.error("ERROR_CREAR_CONTRATO", err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Error al crear contrato." },
    });
  }
}

//---FINIQUITAR CONTRATO---//
async function finiquitarContrato(req, res) {
  const contratoId = parseInt(req.params.id, 10);
  const { fecha_termino } = req.body || {};

  if (isNaN(contratoId)) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "ID inválida." },
    });
  }

  try {
    const existe = await query(
      `SELECT estado, fecha_inicio FROM contrato WHERE id_contrato = $1`,
      [contratoId]
    );
    if (existe.rowCount === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Contrato no encontrado." },
      });
    }

    if (existe.rows[0].estado === "finiquitado") {
      return res.json({
        data: {
          id_contrato: contratoId,
          message: "Contrato ya estaba finiquitado.",
        },
      });
    }

    const fechaTerminoFinal =
      fecha_termino || new Date().toISOString().slice(0, 10);
    if (new Date(fechaTerminoFinal) < new Date(existe.rows[0].fecha_inicio)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "fecha_termino no puede ser menor a fecha_inicio.",
        },
      });
    }

    const up = await query(
      `UPDATE contrato
       SET estado = 'finiquitado', fecha_termino = $1
       WHERE id_contrato = $2
       RETURNING id_contrato, estado, fecha_termino;`,
      [fechaTerminoFinal, contratoId]
    );

    res.json({
      data: {
        id_contrato: up.rows[0].id_contrato,
        estado: up.rows[0].estado,
        fecha_termino: up.rows[0].fecha_termino,
        message: "Contrato finiquitado.",
      },
    });
  } catch (err) {
    console.error("ERROR_FINIQUITAR_CONTRATO", err);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Error al finiquitar contrato.",
      },
    });
  }
}

module.exports = {
  listarContratos,
  contratoPorId,
  contratoIdEmpleado,
  crearContrato,
  finiquitarContrato,
};
