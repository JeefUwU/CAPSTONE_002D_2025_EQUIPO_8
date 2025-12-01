const safe = (v, fallback = "—") => (v == null || v === "" ? fallback : String(v));
const ymd = (v) => {
  if (!v) return "s/f";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "s/f" : d.toISOString().slice(0, 10);
};
const yearOf = (v) => ymd(v).slice(0, 4);

function contratoTemplate({
  id_contrato,
  id_empleado,
  fecha_inicio,
  fecha_termino,
  cargo,
  jornada,
  storage_url,           // '/uploads/contratos/123.pdf' o 'https://...'
  mime_type = 'application/pdf'
}) {
  const anio = yearOf(fecha_inicio) || "s/f";
  const titulo = `Contrato ${anio} – #${id_contrato}`;
  const filename = `Contrato_${anio}_${id_contrato}.pdf`;
  const metadata = {
    fecha_inicio: ymd(fecha_inicio),
    fecha_termino: ymd(fecha_termino),
    cargo: safe(cargo, null),
    jornada: safe(jornada, null)
  };
  return {
    modulo: "contratos",
    entidad_id: Number(id_contrato),
    id_empleado_owner: Number(id_empleado),
    titulo,
    filename,
    mime_type,
    storage_url: storage_url || null,
    metadata
  };
}

function anexoTemplate({
  id_anexo,
  id_empleado,
  fecha,                  // o fecha_emision
  tipo_cambio,            // p.ej. "sueldo", "cargo", "jornada"
  detalle,                // texto opcional
  storage_url,
  mime_type = 'application/pdf'
}) {
  const f = ymd(fecha);
  const anio = yearOf(fecha) || "s/f";
  const titulo = `Anexo ${anio} – Cambio de ${safe(tipo_cambio, "condición")} – #${id_anexo}`;
  const filename = `Anexo_${anio}_${id_anexo}.pdf`;
  const metadata = {
    fecha: f,
    tipo_cambio: safe(tipo_cambio, null),
    detalle: safe(detalle, null)
  };
  return {
    modulo: "anexos",
    entidad_id: Number(id_anexo),
    id_empleado_owner: Number(id_empleado),
    titulo,
    filename,
    mime_type,
    storage_url: storage_url || null,
    metadata
  };
}

function liquidacionTemplate({
  id_liquidacion,
  id_empleado,
  periodo,               // 'YYYY-MM'
  sueldo_base,
  descuentos,
  sueldo_liquido,
  storage_url,
  mime_type = 'application/pdf'
}) {
  const p = safe(periodo, "s/p");
  const titulo = `Liquidación ${p} – #${id_liquidacion}`;
  const filename = `Liquidacion_${p}_${id_liquidacion}.pdf`;
  const metadata = {
    periodo: p,
    sueldo_base: Number(sueldo_base ?? 0),
    descuentos: Number(descuentos ?? 0),
    sueldo_liquido: Number(sueldo_liquido ?? 0)
  };
  return {
    modulo: "liquidaciones",
    entidad_id: Number(id_liquidacion),
    id_empleado_owner: Number(id_empleado),
    titulo,
    filename,
    mime_type,
    storage_url: storage_url || null,
    metadata
  };
}

function capacitacionTemplate({
  id_capacitacion,
  id_empleado,
  tema,
  fecha,                 // 'YYYY-MM-DD'
  duracion_horas,        // número
  proveedor,             // empresa/OTEC
  storage_url,
  mime_type = 'application/pdf'
}) {
  const f = ymd(fecha);
  const anio = yearOf(fecha) || "s/f";
  const titulo = `Capacitación ${safe(tema)} (${f}) – #${id_capacitacion}`;
  const filename = `Capacitacion_${anio}_${id_capacitacion}.pdf`;
  const metadata = {
    fecha: f,
    tema: safe(tema),
    duracion_horas: Number(duracion_horas ?? 0),
    proveedor: safe(proveedor, null)
  };
  return {
    modulo: "capacitaciones",
    entidad_id: Number(id_capacitacion),
    id_empleado_owner: Number(id_empleado),
    titulo,
    filename,
    mime_type,
    storage_url: storage_url || null,
    metadata
  };
}

/**
 * Helper opcional para construir ruta local estandarizada
 * buildLocalPath('contratos', id_contrato, filename) => '/uploads/contratos/2025/Contrato_2025_12.pdf'
 */
function buildLocalPath(modulo, id, filename, year = new Date().getFullYear()) {
  return `/uploads/${modulo}/${year}/${filename}`; // ajusta a tu estructura real
}

module.exports = {
  contratoTemplate,
  anexoTemplate,
  liquidacionTemplate,
  capacitacionTemplate,
  buildLocalPath
};