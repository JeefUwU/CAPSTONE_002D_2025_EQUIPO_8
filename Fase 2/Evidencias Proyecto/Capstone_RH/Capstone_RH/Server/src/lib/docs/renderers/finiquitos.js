import PDFDocument from "pdfkit";
import { query } from "../../../db.js";

export async function renderFiniquito(id_finiquito, user) {
  // 1) Trae finiquito + contrato + empleado
  const { rows } = await query(`
    SELECT 
      f.id_finiquito, f.id_contrato, f.fecha_finiquito, f.causal, f.monto_total, f.detalle,
      c.id_empleado, c.cargo_contratado, c.jornada, c.tipo, c.sueldo_base_contrato,
      c.fecha_inicio, c.fecha_termino,
      e.nombre AS nombre_empleado,
      (e.apellido_paterno || ' ' || COALESCE(e.apellido_materno,'')) AS apellidos_completos,
      (e.rut || '-' || COALESCE(e.digito_verificador,'')) AS rut
    FROM finiquitos f
    JOIN contrato c  ON c.id_contrato   = f.id_contrato
    JOIN empleados e ON e.id_empleado   = c.id_empleado
    WHERE f.id_finiquito = $1
  `, [id_finiquito]);

  const d = rows[0];
  if (!d) return null;

  // 2) Autorización: empleado solo su propio documento
  if (user?.rol === "empleado" && user.id_empleado !== d.id_empleado) return null;

  // 3) Datos empresa desde ENV (con fallback)
  const EMP = {
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
  const fmtYMD = (v)=>{
    if (!v) return "—";
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
    const dt = new Date(s);
    return isNaN(dt) ? "—" : dt.toISOString().slice(0,10);
  };
  const fechaLarga = (v)=>{
    if (!v) return "—";
    const dt = new Date(String(v));
    return isNaN(dt) ? "—" : dt.toLocaleDateString("es-CL",{year:"numeric",month:"long",day:"numeric"});
  };
  const vCLP = (n)=> Number.isFinite(Number(n)) ? `$${Number(n).toLocaleString("es-CL")}` : "—";
  const nombreCompleto = `${d.nombre_empleado||""} ${d.apellidos_completos||""}`.trim();
  const year = (()=>{ const s=String(d.fecha_finiquito||""); if(/^\d{4}/.test(s)) return s.slice(0,4); const dt=new Date(s); return isNaN(dt)?"s/f":String(dt.getUTCFullYear()); })();
  const filename = `Finiquito_${year}_${d.id_finiquito}.pdf`;

  // 5) PDF simple y seguro
  const doc = new PDFDocument({ size: "A4", margin: 56 });
  const chunks = [];
  doc.on("data", c => chunks.push(c));
  const end = new Promise(r => doc.on("end", () => r(Buffer.concat(chunks))));

  // Encabezado empresa
  doc.fontSize(10).fillColor("#111827").text(EMP.razon);
  doc.fontSize(8).fillColor("#374151")
     .text(`${EMP.giro} • RUT ${EMP.rut}`)
     .text(`${EMP.dir}, ${EMP.comuna} – ${EMP.ciudad}`);
  doc.moveDown(0.3);
  doc.moveTo(56, doc.y).lineTo(539, doc.y).strokeColor("#e5e7eb").lineWidth(1).stroke();
  doc.moveDown(0.8);

  // Título
  doc.fontSize(18).fillColor("#111827").text(`FINIQUITO DE CONTRATO ${year}`, { align:"center" });
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor("#6b7280").text(`ID Finiquito: ${d.id_finiquito} • ID Contrato: ${d.id_contrato}`, { align:"center" });
  doc.moveDown(1).fillColor("#111827");

  // Trabajador
  doc.fontSize(12).text("I. IDENTIFICACIÓN DEL TRABAJADOR", { underline:true });
  doc.moveDown(0.3);
  doc.fontSize(11)
     .text(`Nombre: ${nombreCompleto}`)
     .text(`RUT: ${d.rut}`);
  doc.moveDown(0.6);

  // Resumen del contrato
  doc.fontSize(12).text("II. RESUMEN DEL CONTRATO", { underline:true });
  doc.moveDown(0.3);
  const bullet = (t)=> doc.fontSize(11).text(`• ${t}`);
  bullet(`Cargo: ${d.cargo_contratado || "—"}`);
  bullet(`Jornada: ${d.jornada || "—"}`);
  bullet(`Tipo: ${d.tipo || "—"}`);
  bullet(`Sueldo base: ${vCLP(d.sueldo_base_contrato)}`);
  bullet(`Inicio: ${fmtYMD(d.fecha_inicio)} • Término: ${fmtYMD(d.fecha_termino)}`);
  doc.moveDown(0.6);

  // Detalle del finiquito
  doc.fontSize(12).text("III. DETALLES DEL FINIQUITO", { underline:true });
  doc.moveDown(0.3);
  bullet(`Fecha de finiquito: ${fmtYMD(d.fecha_finiquito)}`);
  bullet(`Causal: ${d.causal || "—"}`);
  bullet(`Monto total: ${vCLP(d.monto_total)}`);
  doc.moveDown(0.4);
  if (d.detalle) {
    doc.fontSize(11).text(`Observaciones: ${String(d.detalle)}`, { align:"justify" });
    doc.moveDown(0.6);
  }

  // Cierre y firmas
  doc.fontSize(12).text("IV. VIGENCIA Y FIRMAS", { underline:true });
  doc.moveDown(0.3);
  doc.fontSize(11).text(`Se firma en ${EMP.ciudad}, a ${fechaLarga(d.fecha_finiquito)}.`, { align:"justify" });
  doc.moveDown(1.4);
  const y = doc.y, x1=56, x2=320, w=200;
  doc.moveTo(x1,y).lineTo(x1+w,y).strokeColor("#111827").lineWidth(0.8).stroke();
  doc.moveTo(x2,y).lineTo(x2+w,y).stroke();
  doc.fontSize(10).text("EMPLEADOR", x1, y+4, { width:w, align:"center" });
  doc.text("TRABAJADOR", x2, y+4, { width:w, align:"center" });
  doc.fontSize(11).text(`${EMP.rep} • RUT ${EMP.repRut}`, x1, y+18, { width:w, align:"center" });
  doc.text(`${nombreCompleto} • RUT ${d.rut}`, x2, y+18, { width:w, align:"center" });

  doc.end();
  const buffer = await end;
  return { buffer, filename };
}