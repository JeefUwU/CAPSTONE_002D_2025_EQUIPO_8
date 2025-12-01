const path = require("path");
const fs = require("fs");
function streamLocal(res, storageUrl, mime="application/pdf", filename="documento.pdf") {
  const rel = String(storageUrl || "").replace(/^\//, "");
  const abs = path.join(process.cwd(), rel);
  if (!fs.existsSync(abs)) return res.status(404).json({ error:{code:"NOT_FOUND", message:"Archivo no encontrado"}});
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(filename)}"`);
  fs.createReadStream(abs).pipe(res);
}
module.exports = { streamLocal };