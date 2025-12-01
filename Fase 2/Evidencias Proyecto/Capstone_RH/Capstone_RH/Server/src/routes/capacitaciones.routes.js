const express = require("express");
const router = express.Router();
const {
  requireAuth,
  requireOwnerOrRole,
} = require("../middlewares/requireAuth");
const {
  listarTodas,
  listarPorEmpleado,
  crearCapacitacion,
} = require("../controllers/capacitaciones.controller");

// GET /api/v1/capacitaciones (rrhh/admin ven todas)
router.get(
  "/",
  requireAuth,
  requireOwnerOrRole("rrhh", "admin"),
  listarTodas
);

// GET /api/v1/capacitaciones/empleado/:id
router.get(
  "/empleado/:id",
  requireAuth,
  requireOwnerOrRole("id", "rrhh", "admin"),
  listarPorEmpleado
);

// POST /api/v1/capacitaciones (solo rrhh/admin crean)
router.post(
  "/",
  requireAuth,
  requireOwnerOrRole("rrhh", "admin"),
  crearCapacitacion
);

module.exports = router;
