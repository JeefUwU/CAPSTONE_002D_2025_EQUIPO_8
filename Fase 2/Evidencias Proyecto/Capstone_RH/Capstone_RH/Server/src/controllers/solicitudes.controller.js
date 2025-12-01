const { query } = require("../db");
const multer = require("multer");
const { saveSolicitudFile } = require("../lib/saveFileLocal");

const upload = multer({ storage: multer.memoryStorage() });

/** Crear solicitud */
const crearSolicitud = [
  upload.single("adjunto"), // si viene archivo
  async (req, res) => {
    try {
      const idEmpleado = req.user?.id_empleado;
      if (!idEmpleado) {
        return res.status(401).json({
          error: {
            code: "UNAUTHENTICATED",
            message: "Empleado no autenticado.",
          },
        });
      }

      const body = req.body || {};
      const tipo = (body.tipo || "").trim();
      const asunto = (body.asunto || "").trim();
      const mensaje = (body.mensaje || "").trim();

      if (!tipo || !asunto || !mensaje) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "tipo, asunto y mensaje son obligatorios.",
          },
        });
      }

      // adjunto opcional
      let adjunto_url = null;
      if (req.file?.buffer && req.file?.originalname) {
        adjunto_url = await saveSolicitudFile({
          filename: req.file.originalname,
          buffer: req.file.buffer,
        });
      }

      const ins = await query(
        `INSERT INTO solicitudes (id_empleado, tipo, asunto, mensaje, adjunto_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [idEmpleado, tipo, asunto, mensaje, adjunto_url]
      );

      return res.status(201).json({ data: ins.rows[0] });
    } catch (err) {
      console.error("SOLICITUD_CREAR_ERROR", err);
      return res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "No se pudo crear la solicitud.",
        },
      });
    }
  },
];

/** Listado del empleado autenticado  */
async function listarPorEmpleado(req, res) {
  try {
    const rol = req.user?.rol;
    const yo = req.user?.id_empleado;

    let idEmpleado = parseInt(req.params.id_empleado || yo, 10);
    if (!Number.isInteger(idEmpleado)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "ID de empleado inválida.",
        },
      });
    }

    // Si es empleado, solo puede ver las suyas
    if (rol === "empleado" && yo !== idEmpleado) {
      return res
        .status(403)
        .json({ error: { code: "FORBIDDEN", message: "No autorizado." } });
    }

    const { rows } = await query(
      `SELECT * FROM solicitudes
       WHERE id_empleado = $1
       ORDER BY creado_en DESC, id_solicitud DESC`,
      [idEmpleado]
    );

    return res.json({ data: rows });
  } catch (err) {
    console.error("SOLICITUD_LIST_EMP_ERROR", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Error al listar solicitudes.",
      },
    });
  }
}

/** Listado general (RRHH/Admin) */
async function listarTodas(req, res) {
  try {
    if (!["admin", "rrhh"].includes(req.user?.rol)) {
      return res
        .status(403)
        .json({ error: { code: "FORBIDDEN", message: "No autorizado." } });
    }

    const estado = (req.query.estado || "").trim();

    let sql = `
      SELECT s.*, e.nombre AS nombre_empleado
      FROM solicitudes s
      JOIN empleados e USING(id_empleado)
    `;
    const params = [];

    if (estado) {
      sql += ` WHERE s.estado = $1`;
      params.push(estado);
    }

    sql += ` ORDER BY s.creado_en DESC, s.id_solicitud DESC`;

    const { rows } = await query(sql, params);

    return res.json({ data: rows });
  } catch (err) {
    console.error("SOLICITUD_LIST_ALL_ERROR", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Error al listar solicitudes.",
      },
    });
  }
}

/** Detalle (RRHH/Admin o dueño de la solicitud) */
async function obtenerUna(req, res) {
  try {
    const id = parseInt(req.params.id_solicitud, 10);

    if (!Number.isInteger(id)) {
      return res
        .status(400)
        .json({ error: { code: "VALIDATION_ERROR", message: "ID inválida." } });
    }

    const { rows } = await query(
      `SELECT * FROM solicitudes WHERE id_solicitud = $1`,
      [id]
    );
    const s = rows[0];

    if (!s) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "No encontrada." } });
    }

    const rol = req.user?.rol;
    const yo = req.user?.id_empleado;

    if (rol === "empleado" && s.id_empleado !== yo) {
      return res
        .status(403)
        .json({ error: { code: "FORBIDDEN", message: "No autorizado." } });
    }

    return res.json({ data: s });
  } catch (err) {
    console.error("SOLICITUD_GET_ERROR", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Error al obtener solicitud.",
      },
    });
  }
}

/** Actualizar (RRHH/Admin) – estado y comentario_resolucion */
async function actualizar(req, res) {
  try {
    const rol = req.user?.rol;
    const idUsuario = req.user?.id_usuario; // ⚠️ IMPORTANTE: id_usuario, no id_empleado

    if (!["admin", "rrhh"].includes(rol)) {
      return res
        .status(403)
        .json({ error: { code: "FORBIDDEN", message: "No autorizado." } });
    }

    const id = parseInt(req.params.id_solicitud, 10);
    if (!Number.isInteger(id)) {
      return res
        .status(400)
        .json({ error: { code: "VALIDATION_ERROR", message: "ID inválida." } });
    }

    const { estado, comentario_resolucion } = req.body || {};

    if (!estado && !comentario_resolucion) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Nada para actualizar.",
        },
      });
    }

    // vamos a marcar fecha_resolucion solo cuando el estado sea "final"
    const estadosFinales = ["aprobada", "rechazada", "aceptada", "cancelada"];

    const { rows } = await query(
      `
      UPDATE solicitudes
      SET
        estado = COALESCE($2, estado),
        comentario_resolucion = COALESCE($3, comentario_resolucion),
        resuelto_por = CASE
          WHEN $4::int IS NULL THEN resuelto_por
          ELSE $4::int
        END,
        fecha_resolucion = CASE
          WHEN $2 IS NULL THEN fecha_resolucion
          WHEN $2 = ANY($5) THEN
            COALESCE(fecha_resolucion, now())
          ELSE fecha_resolucion
        END
      WHERE id_solicitud = $1
      RETURNING *;
      `,
      [
        id,
        estado || null,
        comentario_resolucion || null,
        idUsuario || null,
        estadosFinales,
      ]
    );

    if (!rows[0]) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "No encontrada." },
      });
    }

    return res.json({ data: rows[0] });
  } catch (err) {
    console.error("SOLICITUD_UPD_ERROR", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "No se pudo actualizar.",
      },
    });
  }
}

/** Eliminar (RRHH/Admin) */
async function eliminar(req, res) {
  try {
    if (!["admin", "rrhh"].includes(req.user?.rol)) {
      return res
        .status(403)
        .json({ error: { code: "FORBIDDEN", message: "No autorizado." } });
    }

    const id = parseInt(req.params.id_solicitud, 10);
    if (!Number.isInteger(id)) {
      return res
        .status(400)
        .json({ error: { code: "VALIDATION_ERROR", message: "ID inválida." } });
    }

    await query(`DELETE FROM solicitudes WHERE id_solicitud = $1`, [id]);

    return res.json({ data: { deleted: true } });
  } catch (err) {
    console.error("SOLICITUD_DEL_ERROR", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "No se pudo eliminar.",
      },
    });
  }
}

module.exports = {
  crearSolicitud,
  listarPorEmpleado,
  listarTodas,
  obtenerUna,
  actualizar,
  eliminar,
};
