const { verifyAccessToken } = require('../lib/token');
const { query } = require('../db');


async function requireAuth(req, res, next) {
  try {
    const hdr = req.headers.authorization || '';
    const [, token] = hdr.split(' ');
    if (!token) {
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Falta token.' }});
    }

    const payload = verifyAccessToken(token); // { sub, role, sid, iat, exp }
    if (!payload?.sub || !payload?.role) {
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Token inválido.' }});
    }

    // Resuelve id_empleado (si existe) a partir de id_usuario
    let idEmpleado = null;
    const r = await query(
      'SELECT id_empleado FROM empleados WHERE id_usuario = $1',
      [payload.sub]
    );
    if (r.rowCount > 0) idEmpleado = r.rows[0].id_empleado;

    req.user = {
      id_usuario: payload.sub,
      rol: payload.role,
      sid: payload.sid,
      id_empleado: idEmpleado
    };

    return next();
  } catch (err) {
    console.error('REQUIRE_AUTH_ERROR', err);
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Token inválido o expirado.' }});
  }
}

// Helpers de autorización por rol/propiedad
function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (rolesPermitidos.includes(req.user?.rol)) return next();
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'No tienes permisos para esta operación.' }});
  };
}

// Verifica que el recurso sea del empleado autenticado o que tenga rol permitido
function requireOwnerOrRole(paramName, ...rolesPermitidos) {
    return (req, res, next) => {
    const requestedId = parseInt(req.params[paramName], 10);
    if (rolesPermitidos.includes(req.user?.rol)) return next();
    if (req.user?.rol === 'empleado' && Number.isInteger(requestedId) && req.user.id_empleado === requestedId) {
      return next();
    }
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'No puedes acceder a recursos de otros empleados.' }});
  };
}

module.exports = { requireAuth, requireRole, requireOwnerOrRole };

