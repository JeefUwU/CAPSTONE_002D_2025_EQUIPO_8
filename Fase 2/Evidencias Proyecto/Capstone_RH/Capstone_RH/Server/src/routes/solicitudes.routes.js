const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middlewares/requireAuth");
const ctrl = require("../controllers/solicitudes.controller");

// Crear 
router.post("/", requireAuth, ctrl.crearSolicitud);

// Listar MIS solicitudes 
router.get("/mias", requireAuth, ctrl.listarPorEmpleado);

// Listar por empleado específico (rrhh/admin o dueño)
router.get("/empleado/:id_empleado", requireAuth, ctrl.listarPorEmpleado);

// Listado general (rrhh/admin)
router.get("/", requireAuth, ctrl.listarTodas);

// Detalle una (rrhh/admin o dueño)
router.get("/:id_solicitud", requireAuth, ctrl.obtenerUna);

// Actualizar estado/respuesta (rrhh/admin)
router.patch("/:id_solicitud", requireAuth, ctrl.actualizar);

// Eliminar (rrhh/admin)
router.delete("/:id_solicitud", requireAuth, ctrl.eliminar);

module.exports = router;