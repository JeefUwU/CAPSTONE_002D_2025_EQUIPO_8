const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middlewares/requireAuth");
const { streamDocumentoPdf } = require("../lib/docs/index");

router.get("/:tipo/:id/pdf", requireAuth, async (req, res) => {
  try {
    const { tipo, id } = req.params;
    const okTypes = new Set([
      "contratos",
      "anexos",
      "liquidaciones",
      "finiquitos",
      "capacitaciones",
    ]);
    if (!okTypes.has(tipo)) {
      return res.status(400).json({
        error: { code: "BAD_TIPO", message: "Tipo de documento inválido." },
      });
    }
    const result = await streamDocumentoPdf({ tipo, id, user: req.user });
    if (!result) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Documento no encontrado o no autorizado.",
        },
      });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${result.filename || "documento.pdf"}"`
    );
    if (result.stream) return result.stream.pipe(res);
    return res.send(result.buffer);
  } catch (err) {
    console.error("DOCS_PDF_ERROR", err);
    return res.status(500).json({
      error: { code: "INTERNAL", message: "No se pudo generar el PDF." },
    });
  }
});

module.exports = router;
