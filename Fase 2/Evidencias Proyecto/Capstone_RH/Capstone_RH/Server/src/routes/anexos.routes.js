const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middlewares/requireAuth");
const {
  anexosPorEmpleado,
  anexosPorContrato,
  crearAnexo,
} = require("../controllers/anexos.controller");

// 🔹 Anexos por empleado (lo usa el frontend)
router.get("/empleado/:id", requireAuth, anexosPorEmpleado);

// 🔹 Anexos por contrato
router.get("/contrato/:id", requireAuth, anexosPorContrato);

// 🔹 Crear anexo (solo RRHH/Admin)
router.post("/", requireAuth, crearAnexo);

module.exports = router;
