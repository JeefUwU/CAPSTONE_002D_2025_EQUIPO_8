import PDFDocument from "pdfkit";
import { query } from "../../../db.js";

export async function renderLiquidacion(id_liquidacion, user) {
  // 1) Trae liquidación + empleado
  const { rows } = await query(
    `
    SELECT 
      l.*,
      e.id_empleado, e.nombre AS nombre_empleado,
      (e.apellido_paterno || ' ' || COALESCE(e.apellido_materno,'')) AS apellidos_completos,
      (e.rut || '-' || COALESCE(e.digito_verificador,'')) AS rut
    FROM liquidaciones l
    JOIN empleados e ON e.id_empleado = l.id_empleado
    WHERE l.id_liquidacion = $1
  `,
    [id_liquidacion]
  );
  const d = rows[0];
  if (!d) return null;

  // 2) Autorización
  if (user?.rol === "empleado" && user.id_empleado !== d.id_empleado)
    return null;

  // 3) Empresa (ENV)
  const EMP = {
    razon: process.env.EMPRESA_RAZON || "Empresa Ejemplo SpA",
    rut: process.env.EMPRESA_RUT || "76.123.456-7",
    giro: process.env.EMPRESA_GIRO || "Servicios",
    dir: process.env.EMPRESA_DIR || "Av. Siempre Viva 123",
    comuna: process.env.EMPRESA_COMUNA || "Santiago",
    ciudad: process.env.EMPRESA_CIUDAD || "Santiago",
  };

  // 4) Helpers
  const vCLP = (n) =>
    Number.isFinite(Number(n)) ? `$${Number(n).toLocaleString("es-CL")}` : "$0";
  const nombreCompleto = `${d.nombre_empleado || ""} ${
    d.apellidos_completos || ""
  }`.trim();
  const periodo = d.periodo?.trim() || "s/p";
  const filename = `Liquidacion_${periodo}_${d.id_liquidacion}.pdf`;

  // 5) PDF seguro
  const doc = new PDFDocument({ size: "A4", margin: 56 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const end = new Promise((r) => doc.on("end", () => r(Buffer.concat(chunks))));

  // Header
  doc.fontSize(10).fillColor("#111827").text(EMP.razon);
  doc
    .fontSize(8)
    .fillColor("#374151")
    .text(`${EMP.giro} • RUT ${EMP.rut}`)
    .text(`${EMP.dir}, ${EMP.comuna} – ${EMP.ciudad}`);
  doc.moveDown(0.3);
  doc
    .moveTo(56, doc.y)
    .lineTo(539, doc.y)
    .strokeColor("#e5e7eb")
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.8);

  // Título
  doc
    .fontSize(18)
    .fillColor("#111827")
    .text(`LIQUIDACIÓN ${periodo}`, { align: "center" });
  doc.moveDown(0.2);
  doc
    .fontSize(10)
    .fillColor("#6b7280")
    .text(
      `ID: ${d.id_liquidacion} • Generado: ${String(d.generado_en || "").slice(
        0,
        10
      )}`,
      { align: "center" }
    );
  doc.moveDown(1).fillColor("#111827");

  // Trabajador
  doc.fontSize(12).text("I. DATOS DEL TRABAJADOR", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(11).text(`Nombre: ${nombreCompleto}`).text(`RUT: ${d.rut}`);
  doc.moveDown(0.6);

  // Resumen haberes
  doc.fontSize(12).text("II. HABERES", { underline: true });
  doc.moveDown(0.3);
  const line = (k, v) => {
    doc.fontSize(11);
    doc.text(k, { continued: true });
    doc.text(` ${v}`, { align: "right" });
  };
  line("Días trabajados:", d.dias_trabajados ?? 0);
  line("Sueldo base:", vCLP(d.sueldo_base));
  line("Horas extra:", `${Number(d.horas_extra || 0)} h`);
  line("Monto horas extra:", vCLP(d.monto_horas_extra));
  line("Gratificación:", vCLP(d.gratificacion));
  line("Otros haberes:", vCLP(d.otros_haberes));
  line("Imponible:", vCLP(d.imponible));
  doc.moveDown(0.6);

  // Descuentos
  doc.fontSize(12).text("III. DESCUENTOS", { underline: true });
  doc.moveDown(0.3);
  line("AFP:", vCLP(d.afp_desc));
  line("Salud:", vCLP(d.salud_desc));
  line("Otros descuentos:", vCLP(d.otros_descuentos));
  line("No imponibles:", vCLP(d.no_imponibles));
  line("Tributable:", vCLP(d.tributable));
  line("Impuesto:", vCLP(d.impuesto));
  doc.moveDown(0.6);

  // Líquido
  doc
    .fontSize(12)
    .text(`Sueldo Líquido: ${vCLP(d.sueldo_liquido)}`, { underline: true });
  doc.moveDown(0.8);

  // Observación
  if (d.observacion) {
    doc.fontSize(11).text("Observaciones:", { underline: true }).moveDown(0.2);
    doc.text(String(d.observacion), { align: "justify" });
  }

  doc.end();
  const buffer = await end;
  return { buffer, filename };
}
