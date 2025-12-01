const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middlewares/requireAuth");

const {
  listarEmpleados,
  empleadoPorId,
  crearEmpleado,
  actualizarEmpleado,
  eliminarEmpleado,
} = require("../controllers/empleados.controller");

// Solo RRHH/Admin pueden ver todos o modificar
router.get("/", requireAuth, requireRole('rrhh','admin'), listarEmpleados);
router.get("/:id", requireAuth, empleadoPorId);
router.post("/", requireAuth, requireRole('rrhh','admin'), crearEmpleado);
router.put("/:id", requireAuth, requireRole('rrhh','admin'), actualizarEmpleado);
router.delete("/:id", requireAuth, requireRole('rrhh','admin'), eliminarEmpleado);

module.exports = router;
