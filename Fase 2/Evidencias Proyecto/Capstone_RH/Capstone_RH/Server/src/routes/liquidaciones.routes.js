const express = require("express");
const router = express.Router();
const {
  listarPorEmpleado,
  listarGeneral,
  calcularLiquidacionEmpleado,
  cambiarEstado,
  generarPeriodoLiquidaciones,
} = require("../controllers/liquidaciones.controller");

const {
  requireAuth,
  requireRole,
  requireOwnerOrRole,
} = require("../middlewares/requireAuth");

router.use(requireAuth);

// ADMIN / RRHH
router.get("/admin", requireRole("admin", "rrhh"), listarGeneral);
router.post(
  "/admin/generar",
  requireRole("admin", "rrhh"),
  generarPeriodoLiquidaciones
);

// Por empleado
router.get("/:id", requireOwnerOrRole("id", "admin", "rrhh"), listarPorEmpleado);
router.get(
  "/:id/calcular",
  requireOwnerOrRole("id", "admin", "rrhh"),
  calcularLiquidacionEmpleado
);

// Cambiar estado
router.put("/:id/estado", requireRole("admin", "rrhh"), cambiarEstado);

module.exports = router;