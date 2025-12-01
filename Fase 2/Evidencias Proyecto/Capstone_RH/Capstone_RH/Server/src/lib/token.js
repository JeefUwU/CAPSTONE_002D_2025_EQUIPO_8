// src/lib/token.js
const jwt = require("jsonwebtoken");

const ACCESS_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
const ISSUER = process.env.JWT_ISSUER || "capstone-rh";
const AUDIENCE = process.env.JWT_AUDIENCE || "capstone-rh-front";

if (!ACCESS_SECRET) throw new Error("JWT_SECRET no configurado");
if (!REFRESH_SECRET)
  throw new Error("JWT_REFRESH_SECRET/JWT_SECRET no configurado");

function signAccessToken(payload, opts = {}) {
  // payload esperado: { sub, role, sid, emp }
  const options = {
    algorithm: "HS256",
    expiresIn: process.env.ACCESS_TTL || "10m",
    issuer: ISSUER,
    audience: AUDIENCE,
    ...opts,
  };
  return jwt.sign(payload, ACCESS_SECRET, options);
}

function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET, {
    algorithms: ["HS256"],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

function signRefreshToken(payload, opts = {}) {
  // incluye role y emp para NO consultar BD en refresh
  const options = {
    algorithm: "HS256",
    expiresIn: process.env.REFRESH_TTL || "1d",
    issuer: ISSUER,
    audience: AUDIENCE,
    ...opts,
  };
  return jwt.sign(payload, REFRESH_SECRET, options);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET, {
    algorithms: ["HS256"],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

// ✅ Aliases (compatibilidad con tus controladores)
const issueAccessToken = signAccessToken;
const issueRefreshToken = signRefreshToken;

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  issueAccessToken,
  issueRefreshToken,
};
