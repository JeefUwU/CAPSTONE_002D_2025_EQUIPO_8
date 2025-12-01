const express = require("express");
const router = express.Router();

const {
  marcarDia,
  listarDias,
  resumenMensual,
  editarDia,
  agregarDia,
  eliminarDia,
  listarGeneral,
} = require("../controllers/asistencia.controller");

const {
  requireAuth,
  requireRole,
  requireOwnerOrRole,
} = require("../middlewares/requireAuth");

router.use(requireAuth);

// ================== ADMIN / RRHH ================== //
// Listado general por mes/día/rango
router.get(
  "/asistencia/admin",
  requireRole("admin", "rrhh"),
  listarGeneral
);
// Agregar un día manualmente
router.post(
  "/asistencia/admin",
  requireRole("admin", "rrhh"),
  agregarDia
);
// Editar un registro específico (por id_asistencia)
router.put(
  "/asistencia/:id_asistencia",
  requireRole("admin", "rrhh"),
  editarDia
);
// Eliminar un registro específico
router.delete(
  "/asistencia/:id_asistencia",
  requireRole("admin", "rrhh"),
  eliminarDia
);

// ================== EMPLEADO ================== //
// Listar días de un empleado concreto
router.get(
  "/asistencia/:id_empleado/dias",
  requireOwnerOrRole("id_empleado", "admin", "rrhh"),
  listarDias
);
// Resumen mensual por empleado
router.get(
  "/asistencia/:id_empleado/resumen",
  requireOwnerOrRole("id_empleado", "admin", "rrhh"),
  resumenMensual
);
// Marcar entrada/salida (empleado autenticado)
router.post(
  "/asistencia/marcar",
  requireRole("empleado", "admin", "rrhh"),
  marcarDia
);

module.exports = router;