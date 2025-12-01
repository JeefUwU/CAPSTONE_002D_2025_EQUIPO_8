const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middlewares/requireAuth");
const {
  listarContratos,
  contratoPorId,
  contratoIdEmpleado,
  crearContrato,
  finiquitarContrato,
} = require("../controllers/contratos.controller");

// 🔹 RRHH/Admin: listar todos
router.get("/", requireAuth, listarContratos);

// 🔹 Contrato por ID
router.get("/:id", requireAuth, contratoPorId);

// 🔹 Contratos por empleado (lo usa el frontend)
router.get("/empleado/:id", requireAuth, contratoIdEmpleado);

// 🔹 Crear contrato (solo admin o rrhh)
router.post("/", requireAuth, crearContrato);

// 🔹 Finiquitar contrato
router.put("/:id/finiquitar", requireAuth, finiquitarContrato);

module.exports = router;