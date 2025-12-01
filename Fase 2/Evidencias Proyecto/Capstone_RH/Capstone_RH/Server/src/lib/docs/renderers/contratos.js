import PDFDocument from "pdfkit";
import { query } from "../../../db.js";

export async function renderContrato(id_contrato, user) {
  // 1) Traer datos existentes (solo columnas reales)
  const { rows } = await query(
    `
    SELECT 
      c.id_contrato, c.id_empleado, c.tipo, c.jornada, c.cargo_contratado,
      c.sueldo_base_contrato, c.estado, c.fecha_inicio, c.fecha_termino,
      e.nombre AS nombre_empleado,
      (e.apellido_paterno || ' ' || COALESCE(e.apellido_materno,'')) AS apellidos_completos,
      (e.rut || '-' || COALESCE(e.digito_verificador,'')) AS rut
    FROM contrato c
    JOIN empleados e ON e.id_empleado = c.id_empleado
    WHERE c.id_contrato = $1
    `,
    [id_contrato]
  );
  const d = rows[0];
  if (!d) return null;

  // 2) Autorización
  if (user?.rol === "empleado" && user.id_empleado !== d.id_empleado) return null;

  // 3) Datos empresa desde .env (con fallback)
  const EMPRESA = {
    razon:  process.env.EMPRESA_RAZON   || "Empresa Ejemplo SpA",
    rut:    process.env.EMPRESA_RUT     || "76.123.456-7",
    giro:   process.env.EMPRESA_GIRO    || "Servicios",
    dir:    process.env.EMPRESA_DIR     || "Av. Siempre Viva 123",
    comuna: process.env.EMPRESA_COMUNA  || "Santiago",
    ciudad: process.env.EMPRESA_CIUDAD  || "Santiago",
    rep:    process.env.EMPRESA_REP     || "Juan Pérez",
    repRut: process.env.EMPRESA_REP_RUT || "12.345.678-9",
  };

  // 4) Helpers
  const fmtYMD = (v) => {
    if (!v) return "—";
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const dt = new Date(s);
    return isNaN(dt) ? "—" : dt.toISOString().slice(0, 10);
  };
  const vCLP = (n) => Number.isFinite(Number(n)) ? `$${Number(n).toLocaleString("es-CL")}` : "—";
  const nombreCompleto = `${d.nombre_empleado || ""} ${d.apellidos_completos || ""}`.trim();
  const year = (() => {
    const s = String(d.fecha_inicio || "");
    if (/^\d{4}/.test(s)) return s.slice(0, 4);
    const dt = new Date(s);
    return isNaN(dt) ? "s/f" : String(dt.getUTCFullYear());
  })();
  const filename = `Contrato_${year}_${d.id_contrato}.pdf`;

  // 5) Crear PDF (sin listeners, sin on('pageAdded'))
  const doc = new PDFDocument({ size: "A4", margin: 56 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const end = new Promise((r) => doc.on("end", () => r(Buffer.concat(chunks))));

  // Header simple
  doc.fontSize(10).fillColor("#111827").text(EMPRESA.razon, { align: "left" });
  doc.fontSize(8).fillColor("#374151")
     .text(`${EMPRESA.giro} • RUT ${EMPRESA.rut}`)
     .text(`${EMPRESA.dir}, ${EMPRESA.comuna} – ${EMPRESA.ciudad}`);
  doc.moveDown(0.3);
  doc.moveTo(56, doc.y).lineTo(539, doc.y).strokeColor("#e5e7eb").lineWidth(1).stroke();
  doc.moveDown(0.8);

  // Título
  doc.fontSize(18).fillColor("#111827").text("CONTRATO DE TRABAJO", { align: "center" });
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor("#6b7280")
     .text(`ID Contrato: ${d.id_contrato} • Estado: ${d.estado || "—"}`, { align: "center" });
  doc.moveDown(1.0).fillColor("#111827");

  // I. Partes
  doc.fontSize(12).text("I. IDENTIFICACIÓN DE LAS PARTES", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(11).text(
    `Entre ${EMPRESA.razon}, RUT ${EMPRESA.rut}, domiciliada en ${EMPRESA.dir}, ${EMPRESA.comuna}, ${EMPRESA.ciudad}, representada por ${EMPRESA.rep}, RUT ${EMPRESA.repRut}, en adelante “el Empleador”; y don(ña) ${nombreCompleto}, RUT ${d.rut}, en adelante “el Trabajador”, se ha convenido el siguiente Contrato de Trabajo:`,
    { align: "justify" }
  );
  doc.moveDown(0.8);

  // II. Condiciones
  doc.fontSize(12).text("II. CONDICIONES DEL CONTRATO", { underline: true });
  doc.moveDown(0.3);
  const bullet = (t) => doc.fontSize(11).text(`• ${t}`);
  bullet(`Cargo contratado: ${d.cargo_contratado || "—"}`);
  bullet(`Tipo de contrato: ${d.tipo || "—"}`);
  bullet(`Jornada: ${d.jornada || "—"}`);
  bullet(`Fecha de inicio: ${fmtYMD(d.fecha_inicio)}`);
  bullet(`Fecha de término: ${d.fecha_termino ? fmtYMD(d.fecha_termino) : "No aplica (indefinido)"}`);
  doc.moveDown(0.8);

  // III. Remuneraciones
  doc.fontSize(12).text("III. REMUNERACIONES", { underline: true });
  doc.moveDown(0.3);
  const line = (k, v) => {
    doc.fontSize(11);
    doc.text(k, { continued: true });
    doc.text(` ${v}`, { align: "right" });
  };
  line("Sueldo base:", vCLP(d.sueldo_base_contrato));
  line("Gratificación (si aplica):", "Según ley/política interna");
  line("Asignaciones (si aplica):", "—");
  line("Otros haberes:", "—");
  doc.moveDown(0.8);

  // IV. Cláusulas
  doc.fontSize(12).text("IV. CLÁUSULAS", { underline: true });
  doc.moveDown(0.3);
  const p = (t) => doc.fontSize(11).text(t, { align: "justify" }).moveDown(0.2);
  p("1) El Trabajador se obliga a desempeñar las funciones propias del cargo, cumpliendo las instrucciones del Empleador y la normativa interna vigente.");
  p("2) Las horas extraordinarias deberán pactarse por escrito y se pagarán con el recargo legal.");
  p("3) Las remuneraciones se pagarán mensualmente en moneda nacional dentro de los primeros cinco días hábiles del mes siguiente.");
  p("4) Serán descuentos obligatorios los previstos por ley (previsión, salud, impuestos, etc.).");
  p("5) Las modificaciones a este contrato deberán constar por escrito en anexo firmado por ambas partes.");
  p(`6) Para todos los efectos legales, las partes fijan domicilio en la comuna de ${EMPRESA.comuna}.`);
  doc.moveDown(0.8);

  // V. Vigencia y firmas
  doc.fontSize(12).text("V. VIGENCIA Y FIRMA", { underline: true });
  doc.moveDown(0.3);
  const fechaLarga = (v) => {
    if (!v) return "—";
    const dt = new Date(String(v));
    if (isNaN(dt)) return "—";
    return dt.toLocaleDateString("es-CL", { year: "numeric", month: "long", day: "numeric" });
  };
  doc.fontSize(11).text(
    `El presente contrato se firma en ${EMPRESA.ciudad}, a ${fechaLarga(d.fecha_inicio)}.`,
    { align: "justify" }
  );
  doc.moveDown(1.6);

  // Líneas de firma (sin cálculos raros)
  const y = doc.y;
  const x1 = 56, x2 = 320, w = 200;
  doc.moveTo(x1, y).lineTo(x1 + w, y).strokeColor("#111827").lineWidth(0.8).stroke();
  doc.moveTo(x2, y).lineTo(x2 + w, y).strokeColor("#111827").lineWidth(0.8).stroke();
  doc.fontSize(10).fillColor("#111827");
  doc.text("EMPLEADOR", x1, y + 4, { width: w, align: "center" });
  doc.text("TRABAJADOR", x2, y + 4, { width: w, align: "center" });
  doc.fontSize(11);
  doc.text(EMPRESA.rep, x1, y + 18, { width: w, align: "center" });
  doc.text(nombreCompleto, x2, y + 18, { width: w, align: "center" });
  doc.fontSize(9).fillColor("#6b7280");
  doc.text(EMPRESA.razon, x1, y + 34, { width: w, align: "center" });
  doc.text(d.rut, x2, y + 34, { width: w, align: "center" });

  // Footer simple de 1 página (sin eventos)
  doc.switchToPage(0);
  doc.end();

  const buffer = await end;
  return { buffer, filename };
}