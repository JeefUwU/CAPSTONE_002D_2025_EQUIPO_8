const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middlewares/requireAuth");
const {
  crearFiniquito,
  listarFiniquitosPorEmpleado,
} = require("../controllers/finiquitos.controller");

// Crear finiquito 
router.post("/", requireAuth, requireRole("rrhh", "admin"), crearFiniquito);

// Listar finiquitos por empleado 
router.get("/:id_empleado", requireAuth, listarFiniquitosPorEmpleado);



module.exports = router;
