// src/controllers/auth.controller.js
const { query } = require("../db");
const bcrypt = require("bcrypt");
const { normalizarCorreo } = require("../lib/normalizacion");
const tokens = require("../lib/token");
const sessionStore = require("../lib/sessionStore");

// --- LOGIN ---
async function login(req, res) {
  try {
    const { correo, contrasena } = req.body || {};
    const correoNorm = normalizarCorreo(correo);

    if (!correoNorm || !contrasena) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Correo y contraseña son obligatorios.",
        },
      });
    }

    // Usuario
    const { rows } = await query(
      `SELECT id_usuario, nombre_usuario, correo, contraseña AS hash, rol
         FROM usuarios
        WHERE correo = $1`,
      [correoNorm]
    );
    const user = rows[0];

    // Hash dummy para timing-safe
    const hash =
      user?.hash ||
      "$2b$10$DQw4w9WgXcQ8Q1wF4qJ9QO5aT1P3bF4Q9l7TqvVb0p0r1s2t3u4vW";
    const ok = await bcrypt.compare(contrasena, hash);
    if (!user || !ok) {
      return res.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Credenciales inválidas." },
      });
    }

    // id_empleado asociado (si existe)
    const { rows: empRows } = await query(
      `SELECT id_empleado FROM empleados WHERE id_usuario = $1`,
      [user.id_usuario]
    );
    const id_empleado = empRows[0]?.id_empleado ?? null;

    // Sesión y tokens (incluye emp en payload)
    const sid = sessionStore.createSession(user.id_usuario, user.rol);
    const accessToken = tokens.issueAccessToken({
      sub: user.id_usuario,
      role: user.rol,
      sid,
      emp: id_empleado,
    });
    const refreshToken = tokens.issueRefreshToken({
      sub: user.id_usuario,
      role: user.rol,
      sid,
      emp: id_empleado,
    });

    return res.json({
      data: {
        user: {
          id: user.id_usuario,
          id_empleado,
          nombre: user.nombre_usuario,
          rol: user.rol,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    console.error("❌ LOGIN_ERROR:", err);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Error interno del servidor." },
    });
  }
}

// --- REFRESH TOKEN ---
async function refresh(req, res) {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "refreshToken es obligatorio.",
        },
      });
    }

    let payload;
    try {
      payload = tokens.verifyRefreshToken(refreshToken); // <- usa verifyRefreshToken
    } catch {
      return res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Refresh token inválido o expirado.",
        },
      });
    }

    const { sub, sid, role, emp } = payload;

    // Valida sesión en memoria (anti-replay)
    const s = sessionStore.getSession(sid);
    if (!s || s.userId !== sub) {
      return res.status(401).json({
        error: {
          code: "SESSION_EXPIRED",
          message: "Sesión expirada o inválida.",
        },
      });
    }

    sessionStore.touchSession(sid);

    // Emite nuevo access con mismos role/emp
    const accessToken = tokens.issueAccessToken({
      sub,
      role: s.role ?? role,
      sid,
      emp,
    });
    return res.json({ data: { accessToken } });
  } catch (err) {
    console.error("❌ REFRESH_ERROR:", err);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Error interno del servidor." },
    });
  }
}

// --- LOGOUT ---
async function logout(req, res) {
  try {
    const auth = req.headers.authorization || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    let sid = null;

    // Intentar con access token
    if (bearer) {
      try {
        sid = tokens.verifyAccessToken(bearer).sid; // <- usa verifyAccessToken
      } catch {
        /* ignore */
      }
    }

    // Si no, intentar con refresh token
    if (!sid) {
      const { refreshToken } = req.body || {};
      if (refreshToken) {
        try {
          sid = tokens.verifyRefreshToken(refreshToken).sid; // <- usa verifyRefreshToken
        } catch {
          /* ignore */
        }
      }
    }

    if (!sid) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "No se pudo identificar la sesión a cerrar.",
        },
      });
    }

    sessionStore.revokeSession(sid);
    return res.json({ data: { loggedOut: true } });
  } catch (err) {
    console.error("❌ LOGOUT_ERROR:", err);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Error interno del servidor." },
    });
  }
}

module.exports = { login, refresh, logout };
