import PDFDocument from "pdfkit";
import { query } from "../../../db.js";

export async function renderCapacitacion(id_capacitacion, user) {
  // 1) Traer la capacitación + empleado
  const { rows } = await query(`
    SELECT
      c.id_capacitacion,
      c.id_empleado,
      c.titulo,
      c.fecha,
      c.tipo,
      c.descripcion,
      c.documento_url,
      c.creado_en,
      e.nombre AS nombre_empleado,
      (e.apellido_paterno || ' ' || COALESCE(e.apellido_materno,'')) AS apellidos_completos,
      (e.rut || '-' || COALESCE(e.digito_verificador,'')) AS rut
    FROM capacitaciones c
    JOIN empleados e ON e.id_empleado = c.id_empleado
    WHERE c.id_capacitacion = $1
  `, [id_capacitacion]);

  const cap = rows[0];
  if (!cap) return null;

  // 2) Autorización: empleado solo ve las suyas
  if (user?.rol === "empleado" && user.id_empleado !== cap.id_empleado) {
    return null;
  }

  // 3) Generar PDF (buffer)
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const end = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  // Encabezado
  const y = cap.fecha ? String(cap.fecha).slice(0, 10) : "—";
  doc.fontSize(18).text("Certificado de Capacitación", { align: "center" }).moveDown(0.5);
  doc.fontSize(10).fillColor("#666").text(`ID: ${cap.id_capacitacion}  •  Fecha: ${y}`, { align: "center" }).moveDown();

  // Datos del trabajador
  doc.fillColor("#000").fontSize(12).text("Datos del trabajador", { underline: true }).moveDown(0.4);
  doc.fontSize(11)
     .text(`Nombre: ${cap.nombre_empleado || ""} ${cap.apellidos_completos || ""}`)
     .text(`RUT: ${cap.rut || "—"}`)
     .moveDown();

  // Detalle de capacitación
  doc.fontSize(12).text("Detalle de la capacitación", { underline: true }).moveDown(0.4);
  doc.fontSize(11)
     .text(`Título: ${cap.titulo || "—"}`)
     .text(`Tipo: ${cap.tipo || "—"}`)
     .text(`Fecha: ${y}`)
     .moveDown(0.4);
  if (cap.descripcion) {
    doc.fontSize(11).text(String(cap.descripcion), { align: "justify" }).moveDown();
  } else {
    doc.moveDown();
  }

  // Cierre
  doc.fontSize(11).text(
    "El presente documento certifica la participación del trabajador en la actividad señalada.",
    { align: "justify" }
  );

  // Firmas
  doc.moveDown(2);
  doc.text("__________________________", 72);
  doc.text("__________________________", 330, doc.y - 15);
  doc.text("Empleador", 100).text("Trabajador", 360);

  doc.end();
  const buffer = await end;

  const filename = `Capacitacion_${y}_${cap.id_capacitacion}.pdf`;
  return { buffer, filename };
}