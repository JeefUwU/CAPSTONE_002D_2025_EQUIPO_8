const { query } = require("../db");

// GET lista general
async function listarTodas(req, res) {
  try {
    const { rows } = await query(
      `
      SELECT 
        c.id_capacitacion,
        c.id_empleado,
        c.titulo,
        c.fecha,
        c.tipo,
        c.descripcion,
        c.documento_url,
        c.creado_en,
        e.nombre AS emp_nombre,
        e.apellido_paterno AS emp_apellido_paterno,
        e.apellido_materno AS emp_apellido_materno
      FROM capacitaciones c
      LEFT JOIN empleados e ON e.id_empleado = c.id_empleado
      ORDER BY c.fecha DESC, c.id_capacitacion DESC
      `
    );

    const data = rows.map((r) => ({
      id_capacitacion: r.id_capacitacion,
      id_empleado: r.id_empleado,
      titulo: r.titulo,
      fecha: r.fecha,
      tipo: r.tipo,
      descripcion: r.descripcion,
      documento_url: r.documento_url,
      creado_en: r.creado_en,
      empleado_nombre: [
        r.emp_nombre,
        r.emp_apellido_paterno,
        r.emp_apellido_materno,
      ]
        .filter(Boolean)
        .join(" ")
        .trim(),
    }));

    return res.json({ data });
  } catch (err) {
    console.error("CAP_LIST_ALL_ERROR", err);
    return res
      .status(500)
      .json({ error: { code: "INTERNAL_ERROR", message: "Error interno" } });
  }
}

// GET lista por empleado
async function listarPorEmpleado(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id))
      return res
        .status(400)
        .json({ error: { code: "VALIDATION_ERROR", message: "ID inválido" } });
    const { rows } = await query(
      `
      SELECT id_capacitacion, id_empleado, titulo, fecha, tipo, descripcion, documento_url, creado_en
      FROM capacitaciones
      WHERE id_empleado = $1
      ORDER BY fecha DESC, id_capacitacion DESC
    `,
      [id]
    );
    return res.json({ data: rows });
  } catch (err) {
    console.error("CAP_LIST_EMPL_ERROR", err);
    return res
      .status(500)
      .json({ error: { code: "INTERNAL_ERROR", message: "Error interno" } });
  }
}

// POST crear (rrhh/admin)
async function crearCapacitacion(req, res) {
  try {
    const { id_empleado, titulo, fecha, tipo, descripcion } = req.body || {};
    if (!id_empleado || !titulo || !fecha || !tipo) {
      return res
        .status(400)
        .json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Faltan campos obligatorios",
          },
        });
    }
    const ins = await query(
      `
      INSERT INTO capacitaciones (id_empleado, titulo, fecha, tipo, descripcion, documento_url)
      VALUES ($1,$2,$3,$4,$5,NULL)
      RETURNING id_capacitacion
    `,
      [
        id_empleado,
        titulo.trim(),
        fecha,
        tipo.trim(),
        descripcion?.trim() ?? null,
      ]
    );
    return res
      .status(201)
      .json({
        data: {
          id_capacitacion: ins.rows[0].id_capacitacion,
          message: "Capacitación creada",
        },
      });
  } catch (err) {
    console.error("CAP_CREATE_ERROR", err);
    return res
      .status(500)
      .json({ error: { code: "INTERNAL_ERROR", message: "Error interno" } });
  }
}

module.exports = { listarTodas, listarPorEmpleado, crearCapacitacion };
