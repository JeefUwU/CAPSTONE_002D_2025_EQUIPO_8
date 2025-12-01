const { v4: uuidv4 } = require('uuid');

const SESSION_IDLE_MS = 90 * 1000;
const sessions = new Map(); // sid -> { userId, role, lastActivityAt, revoked:false }

function createSession(userId, role) {
  const sid = uuidv4();
  sessions.set(sid, { userId, role, lastActivityAt: Date.now(), revoked: false });
  return sid;
}
function getSession(sid) {
  const s = sessions.get(sid);
  if (!s) return null;
  const idle = Date.now() - s.lastActivityAt;
  if (idle > SESSION_IDLE_MS || s.revoked) {
    sessions.delete(sid);
    return null;
  }
  return s;
}
function touchSession(sid) {
  const s = getSession(sid);
  if (!s) return false;
  s.lastActivityAt = Date.now();
  sessions.set(sid, s);
  return true;
}
function revokeSession(sid) {
  const s = sessions.get(sid);
  if (!s) return;
  s.revoked = true;
  sessions.set(sid, s);
}

module.exports = { createSession, getSession, touchSession, revokeSession };
