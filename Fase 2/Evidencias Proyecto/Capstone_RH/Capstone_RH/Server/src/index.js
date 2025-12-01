require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { ping } = require("./db");

const authRouter = require("./routes/auth.routes");
const empleadosRouter = require("./routes/empleados.routes");
const contratosRouter = require("./routes/contratos.routes");
const anexosRouter = require("./routes/anexos.routes");
const finiquitosRouter = require("./routes/finiquitos.routes");
const asistenciaRouter = require("./routes/asistencia.routes");
const liquidacionesRouter = require("./routes/liquidaciones.routes");
const documentosRoutes = require("./routes/documentos.routes");
const capacitacionesRouter = require("./routes/capacitaciones.routes");
const solicitudesRouter = require("./routes/solicitudes.routes");
const dashboardRouter = require("./routes/dashboard.routes")

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const FRONT_ORIGIN = process.env.FRONT_ORIGIN || "";
const ALLOWED_ORIGINS = FRONT_ORIGIN.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH","DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 📂 Servir carpeta /uploads antes de las rutas API
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 🛠️ RUTAS PRINCIPALES DE LA API
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/empleados", empleadosRouter);
app.use("/api/v1/contratos", contratosRouter);
app.use("/api/v1/anexos", anexosRouter);
app.use("/api/v1/finiquitos", finiquitosRouter);
app.use("/api/v1", asistenciaRouter);
app.use("/api/v1/liquidaciones", liquidacionesRouter);
app.use("/api/v1/documentos", documentosRoutes);
app.use("/api/v1/capacitaciones", capacitacionesRouter);
app.use("/api/v1/solicitudes", solicitudesRouter);
app.use("/api/v1/dashboard", dashboardRouter);

// ❤️ HEALTH CHECK
app.get("/health", async (req, res) => {
  try {
    const dbOk = await ping();
    res.json({
      status: "ok",
      db: dbOk ? "connected" : "disconnected",
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// 🚀 ARRANQUE DEL SERVIDOR
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  process.stdout.write(`🚀 API escuchando en http://localhost:${PORT}\n`);
  try {
    const dbOk = await ping();
    process.stdout.write(
      `🗄️  PostgreSQL: ${dbOk ? "conectado ✅" : "desconectado ❌"}\n`
    );
  } catch (e) {
    process.stdout.write(`🗄️  Error conectando a DB: ${e.message}\n`);
  }
});
