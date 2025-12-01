function normalizarCorreo(correo) {
  return String(correo || '').trim().toLowerCase();
}

module.exports = { normalizarCorreo };