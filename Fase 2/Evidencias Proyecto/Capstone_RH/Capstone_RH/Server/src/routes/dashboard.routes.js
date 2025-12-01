const express = require("express");
const router = express.Router();

const { getDashboardResumen } = require("../controllers/dashboard.controller");
const { requireAuth, requireRole } = require("../middlewares/requireAuth");

router.use(requireAuth);

// Dashboard solo para admin / rrhh
router.get("/", requireRole("admin", "rrhh"), getDashboardResumen);

module.exports = router;