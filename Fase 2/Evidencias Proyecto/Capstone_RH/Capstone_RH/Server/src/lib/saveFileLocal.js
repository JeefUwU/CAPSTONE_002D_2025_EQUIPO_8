const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

async function saveSolicitudFile({ filename, buffer }) {
  const baseDir = path.join(__dirname, '..', 'uploads', 'solicitudes');
  ensureDir(baseDir);
  const safe = filename.replace(/[^\w.\-]/g, '_');
  const finalName = `${Date.now()}_${safe}`;
  const abs = path.join(baseDir, finalName);
  await fs.promises.writeFile(abs, buffer);
  return `/uploads/solicitudes/${finalName}`;
}

module.exports = { saveSolicitudFile };