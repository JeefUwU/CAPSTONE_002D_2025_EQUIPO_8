const { query } = require("../db");
const { normalizarCorreo } = require("../lib/normalizacion");
const bcrypt = require("bcryptjs");

//---LISTAR TODOS LOS EMPLEADOS---//
async function listarEmpleados(req, res) {
  try {
    const resultado = await query(
      `SELECT e.id_empleado,
              e.nombre AS nombre_empleado,
              e.apellido_paterno || ' ' || e.apellido_materno AS apellidos_completos,
              e.rut || '-' || e.digito_verificador AS rut,
              e.direccion,
              e.telefono,
              e.correo,
              e.fecha_ingreso,
              e.cargo,
              e.sueldo_base,
              e.estado,
              a.nombre AS nombre_afp,
              s.nombre AS nombre_salud
       FROM empleados e
       INNER JOIN afp a ON e.id_afp = a.id_afp
       INNER JOIN salud s ON e.id_salud = s.id_salud
       ORDER BY e.id_empleado ASC;`
    );
    res.json({ data: resultado.rows });
  } catch (err) {
    console.error("ERROR_LISTAR_EMPLEADOS:", err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Error interno del servidor." },
    });
  }
}

//---OBTENER EMPLEADO POR ID---//
async function empleadoPorId(req, res) {
  const empleadoId = parseInt(req.params.id, 10);
  if (isNaN(empleadoId)) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "ID de empleado inválido." },
    });
  }

  try {
    const resultado = await query(
      `SELECT e.id_empleado,
              e.nombre AS nombre_empleado,
              e.apellido_paterno || ' ' || e.apellido_materno AS apellidos_completos,
              e.rut || '-' || e.digito_verificador AS rut,
              e.direccion,
              e.telefono,
              e.correo,
              e.fecha_ingreso,
              e.cargo,
              e.sueldo_base,
              e.estado,
              a.nombre AS nombre_afp,
              s.nombre AS nombre_salud
       FROM empleados e
       INNER JOIN afp a ON e.id_afp = a.id_afp
       INNER JOIN salud s ON e.id_salud = s.id_salud
       WHERE e.id_empleado = $1;`,
      [empleadoId]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Empleado no encontrado." },
      });
    }

    res.json({ data: resultado.rows[0] });
  } catch (err) {
    console.error("ERROR_EMPLEADO_POR_ID:", err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Error interno del servidor." },
    });
  }
}

//---CREAR NUEVO EMPLEADO ( + usuario + contrato )---//
async function crearEmpleado(req, res) {
  const {
    nombre,
    apellido_paterno,
    apellido_materno,
    rut,
    digito_verificador,
    direccion,
    telefono,
    correo,
    fecha_ingreso,
    cargo,
    sueldo_base,
    id_afp,
    id_salud,
    fecha_nacimiento,
  } = req.body || {};

  // 1) Validación de campos obligatorios
  if (
    !nombre ||
    !apellido_paterno ||
    !apellido_materno ||
    !rut ||
    !digito_verificador ||
    !direccion ||
    !telefono ||
    !correo ||
    !fecha_ingreso ||
    !cargo ||
    !sueldo_base ||
    !id_afp ||
    !id_salud ||
    !fecha_nacimiento
  ) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Faltan campos obligatorios.",
      },
    });
  }

  const correoNorm = normalizarCorreo(correo);
  const rutNorm = String(rut).replace(/\./g, "").replace(/\s+/g, "");

  try {
    // ===== INICIO TRANSACCIÓN =====
    await query("BEGIN");

    // ===============================
    // 1) CREAR / ASEGURAR USUARIO
    // ===============================
    const nombreUsuario = nombre; // o `${nombre} ${apellido_paterno}`
    const passwordPlano = `${rutNorm}${digito_verificador}`;
    const passwordHash = await bcrypt.hash(passwordPlano, 10);

    const insertUsuario = await query(
      `
      INSERT INTO usuarios (
        nombre_usuario,
        correo,
        contraseña,
        rol
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (correo)
      DO UPDATE SET
        nombre_usuario = EXCLUDED.nombre_usuario,
        rol            = EXCLUDED.rol
      RETURNING id_usuario;
      `,
      [nombreUsuario, correoNorm, passwordHash, "empleado"]
    );

    const nuevoIdUsuario = insertUsuario.rows[0].id_usuario;

    // ===============================
    // 2) CREAR EMPLEADO
    // ===============================
    const insertEmpleado = await query(
      `INSERT INTO empleados (
          nombre,
          apellido_paterno,
          apellido_materno,
          rut,
          digito_verificador,
          direccion,
          telefono,
          correo,
          fecha_ingreso,
          cargo,
          sueldo_base,
          id_afp,
          id_salud,
          fecha_nacimiento,
          estado
       ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'activo'
       )
       RETURNING id_empleado;`,
      [
        nombre,
        apellido_paterno,
        apellido_materno,
        rutNorm,
        digito_verificador,
        direccion,
        telefono,
        correoNorm,
        fecha_ingreso,
        cargo,
        sueldo_base,
        id_afp,
        id_salud,
        fecha_nacimiento,
      ]
    );

    const nuevoIdEmpleado = insertEmpleado.rows[0].id_empleado;

    // ===============================
    // 3) CREAR CONTRATO BASE (tabla contrato)
    // ===============================
    await query(
      `INSERT INTO contrato (
          id_empleado,
          fecha_inicio,
          cargo_contratado,
          sueldo_base_contrato
       ) VALUES ($1, $2, $3, $4)`,
      [nuevoIdEmpleado, fecha_ingreso, cargo, sueldo_base]
    );
    // tipo, jornada y estado usan sus DEFAULT:
    //  tipo     = 'indefinido'
    //  jornada  = 'completa'
    //  estado   = 'vigente'

    // ===== FIN TRANSACCIÓN =====
    await query("COMMIT");

    return res.status(201).json({
      data: {
        id_empleado: nuevoIdEmpleado,
        id_usuario: nuevoIdUsuario,
        message:
          "Empleado, usuario y contrato creados correctamente.",
      },
    });
  } catch (err) {
    console.error("ERROR_CREAR_EMPLEADO:", err);
    try {
      await query("ROLLBACK");
    } catch (_) {}

    if (err.code === "23505") {
      // unique_violation
      return res.status(409).json({
        error: {
          code: "DUPLICATE",
          message: "El correo ya está registrado.",
        },
      });
    }

    if (err.code === "23503") {
      // foreign_key_violation
      return res.status(400).json({
        error: {
          code: "FK_ERROR",
          message:
            "Alguna referencia (AFP / Salud / Usuario) no existe. Verifica los IDs.",
        },
      });
    }

    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Error al crear empleado." },
    });
  }
}

//---ACTUALIZAR EMPLEADO---//
async function actualizarEmpleado(req, res) {
  const empleadoId = parseInt(req.params.id, 10);
  if (isNaN(empleadoId)) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "ID inválido." },
    });
  }

  const {
    nombre,
    apellido_paterno,
    apellido_materno,
    rut,
    digito_verificador,
    direccion,
    telefono,
    correo,
    fecha_ingreso,
    cargo,
    sueldo_base,
    id_afp,
    id_salud,
    fecha_nacimiento,
  } = req.body || {};

  const correoNorm = correo ? normalizarCorreo(correo) : null;
  const rutNorm = rut
    ? String(rut).replace(/\./g, "").replace(/\s+/g, "")
    : null;

  try {
    const update = await query(
      `UPDATE empleados
       SET nombre = COALESCE($1, nombre),
           apellido_paterno = COALESCE($2, apellido_paterno),
           apellido_materno = COALESCE($3, apellido_materno),
           rut = COALESCE($4, rut),
           digito_verificador = COALESCE($5, digito_verificador),
           direccion = COALESCE($6, direccion),
           telefono = COALESCE($7, telefono),
           correo = COALESCE($8, correo),
           fecha_ingreso = COALESCE($9, fecha_ingreso),
           cargo = COALESCE($10, cargo),
           sueldo_base = COALESCE($11, sueldo_base),
           id_afp = COALESCE($12, id_afp),
           id_salud = COALESCE($13, id_salud),
           fecha_nacimiento = COALESCE($14, fecha_nacimiento)
       WHERE id_empleado = $15
       RETURNING id_empleado, nombre;`,
      [
        nombre,
        apellido_paterno,
        apellido_materno,
        rutNorm,
        digito_verificador,
        direccion,
        telefono,
        correoNorm,
        fecha_ingreso,
        cargo,
        sueldo_base,
        id_afp,
        id_salud,
        fecha_nacimiento,
        empleadoId,
      ]
    );

    if (update.rowCount === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Empleado no encontrado." },
      });
    }

    res.json({ data: { actualizado: true, id_empleado: empleadoId } });
  } catch (err) {
    console.error("ERROR_ACTUALIZAR_EMPLEADO:", err);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Error al actualizar empleado.",
      },
    });
  }
}

//---MARCAR EMPLEADO COMO FINIQUITADO---//
async function eliminarEmpleado(req, res) {
  const empleadoId = parseInt(req.params.id, 10);
  if (isNaN(empleadoId)) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "ID inválido." },
    });
  }

  try {
    const update = await query(
      `UPDATE empleados
       SET estado = 'finiquitado'
       WHERE id_empleado = $1
       RETURNING id_empleado, nombre, estado;`,
      [empleadoId]
    );

    if (update.rowCount === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Empleado no encontrado." },
      });
    }

    res.json({
      data: { finiquitado: true, id_empleado: empleadoId },
    });
  } catch (err) {
    console.error("ERROR_ELIMINAR_EMPLEADO:", err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Error al eliminar empleado." },
    });
  }
}

module.exports = {
  listarEmpleados,
  empleadoPorId,
  crearEmpleado,
  actualizarEmpleado,
  eliminarEmpleado,
};
