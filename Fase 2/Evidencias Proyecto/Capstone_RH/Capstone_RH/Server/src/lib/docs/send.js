const { getById } = require("./index");
const { streamLocal } = require("./storage/local");

async function sendPdf(req, res) {
  const id = Number(req.params.id_documento);
  const doc = await getById(id);
  if (!doc) return res.status(404).json({ error:{code:"NOT_FOUND", message:"Documento no existe"} });

  // si guardaste URL absoluta (S3 u otra), redirige
  if (/^https?:\/\//i.test(doc.storage_url)) return res.redirect(doc.storage_url);

  // local
  return streamLocal(res, doc.storage_url, doc.mime_type || "application/pdf", doc.titulo || "documento.pdf");
}

module.exports = { sendPdf };