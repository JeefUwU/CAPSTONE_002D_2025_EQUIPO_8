// CommonJS
const { renderContrato } = require("./renderers/contratos");
const { renderAnexo } = require("./renderers/anexos");
const { renderLiquidacion } = require("./renderers/liquidaciones");
const { renderFiniquito } = require("./renderers/finiquitos");
// opcional
let renderCapacitacion = null;
try {
  ({ renderCapacitacion } = require("./renderers/capacitaciones"));
} catch {}

async function streamDocumentoPdf({ tipo, id, user }) {
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) return null;

  switch (tipo) {
    case "contratos":
      return await renderContrato(numericId, user);
    case "anexos":
      return await renderAnexo(numericId, user);
    case "liquidaciones":
      return await renderLiquidacion(numericId, user);
    case "finiquitos":
      return await renderFiniquito(numericId, user);
    case "capacitaciones":
      return renderCapacitacion
        ? await renderCapacitacion(numericId, user)
        : null;
    default:
      return null;
  }
}

module.exports = { streamDocumentoPdf };
