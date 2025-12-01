// ===================================================================
//                  DOCUMENTOS (Contratos + Anexos)
// ===================================================================

const rootDocs = () => $("#docsListContainer");
let docsInflight = false;

function docsSkeleton() {
  const r = rootDocs();
  if (!r) return;
  r.innerHTML = `
    <section class="emp-block">
      <header class="emp-head"><div class="emp-meta" style="gap:12px;">
        <div class="emp-avatar skel" style="width:32px;height:32px;"></div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <div class="skel" style="width:180px;"></div>
          <div class="skel" style="width:120px;"></div>
        </div>
      </div></header>
      <div class="emp-body">
        <div class="skel" style="height:48px;"></div>
        <div class="skel" style="height:48px;"></div>
        <div class="skel" style="height:48px;"></div>
      </div>
    </section>`;
}

function docsError(msg) {
  const r = rootDocs();
  if (!r) return;
  r.innerHTML = `<pre style="background:#fee2e2;border:1px solid #ef4444;border-radius:8px;padding:12px;white-space:pre-wrap;color:#991b1b;font-size:.9rem;">${msg}</pre>`;
}

async function apiContratos() {
  return await getJSON("/contratos");
}

async function apiAnexosDeContrato(id) {
  try {
    return await getJSON(`/anexos/contrato/${id}`);
  } catch {
    return [];
  }
}

function renderDocs(contratos, anexos) {
  const r = rootDocs();
  if (!r) return;

  if (!Array.isArray(contratos) || contratos.length === 0) {
    r.innerHTML = `<div class="muted">No hay documentos para mostrar.</div>`;
    return;
  }

  const anexosByContrato = anexos.reduce((acc, a) => {
    (acc[a.id_contrato] ||= []).push(a);
    return acc;
  }, {});

  Object.values(anexosByContrato).forEach((list) =>
    list.sort(
      (A, B) =>
        new Date(B.fecha || B.creado_en || 0) -
        new Date(A.fecha || A.creado_en || 0)
    )
  );

  contratos.sort(
    (A, B) =>
      new Date(B.fecha_inicio || B.creado_en || 0) -
      new Date(A.fecha_inicio || A.creado_en || 0)
  );

  const html = contratos
    .map((c) => {
      const anexosDelContrato = anexosByContrato[c.id_contrato] || [];
      const numAnexos = anexosDelContrato.length;

      const anexosHTML = anexosDelContrato
        .map(
          (a) => `
        <div class="doc" style="margin-left:22px">
          <div>
            <strong>Anexo ${yearOf(a.fecha)} – ${
            a.tipo_cambio || "cambio"
          }</strong>
            <div class="small">Fecha: ${toYMD(a.fecha)} • Contrato: ${
            a.id_contrato
          }</div>
          </div>
          <div class="doc-actions">
            <button class="btn small" data-open-anexo="${
              a.id_anexo
            }">Ver PDF</button>
            <button class="btn small ghost" data-dl-anexo="${
              a.id_anexo
            }">Descargar</button>
          </div>
        </div>
      `
        )
        .join("");

      return `
        <div class="doc-group">
          <div class="doc contract-toggle-target" data-id-contrato="${
            c.id_contrato
          }">
            <div>
              <div class="small" style="font-weight:600;color:#555;margin-bottom:5px;">
                Empleado: ${c.full_name} (ID: ${c.id_empleado || "—"})
              </div>
              <div style="display:flex;gap:8px;align-items:center;">
                <strong>Contrato ${yearOf(c.fecha_inicio)} (ID: ${
        c.id_contrato
      })</strong>
                <span class="chip ${(c.estado || "vigente").toLowerCase()}">${
        c.estado || "vigente"
      }</span>
              </div>
              <div class="small">
                Inicio: ${toYMD(c.fecha_inicio)} | Término: ${toYMD(
        c.fecha_termino
      )}
                ${c.cargo_contratado ? `| Cargo: ${c.cargo_contratado}` : ``}
                ${c.jornada ? `| Jornada: ${c.jornada}` : ``}
              </div>
            </div>
            <div class="doc-actions">
              <button class="btn small" data-open-contrato="${
                c.id_contrato
              }">Ver PDF</button>
              <button class="btn small ghost" data-dl-contrato="${
                c.id_contrato
              }">Descargar</button>
              ${
                numAnexos > 0
                  ? `
                <div class="anexos-label">
                  Anexos (${numAnexos})
                  <svg class="chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="m7 10l5 5l5-5z"/></svg>
                </div>
              `
                  : ``
              }
            </div>
          </div>
          <div class="anexos-list" id="anexos-for-${c.id_contrato}">
            ${
              numAnexos
                ? anexosHTML
                : `<div class="small muted" style="margin-left:22px">Sin anexos.</div>`
            }
          </div>
        </div>
      `;
    })
    .join("");

  r.innerHTML = html;

  r.onclick = async (e) => {
    const pdfBtn = e.target.closest(
      "[data-open-contrato],[data-dl-contrato],[data-open-anexo],[data-dl-anexo]"
    );
    if (pdfBtn) {
      try {
        if (pdfBtn.dataset.openContrato || pdfBtn.dataset.dlContrato) {
          await abrirPdf(
            "contratos",
            pdfBtn.dataset.openContrato || pdfBtn.dataset.dlContrato
          );
        } else if (pdfBtn.dataset.openAnexo || pdfBtn.dataset.dlAnexo) {
          await abrirPdf(
            "anexos",
            pdfBtn.dataset.openAnexo || pdfBtn.dataset.dlAnexo
          );
        }
      } catch (err) {
        alert("No se pudo abrir/descargar el PDF.");
      }
      return;
    }

    const doc = e.target.closest(".doc.contract-toggle-target");
    if (doc) {
      const id = doc.dataset.idContrato;
      const box = document.querySelector(`#anexos-for-${id}`);
      const chev = doc.querySelector(".chevron");
      if (box) {
        box.classList.toggle("visible");
        chev?.classList.toggle("open");
      }
    }
  };
}

async function loadDocs({ force = false } = {}) {
  const inContratos = $("#contratos")?.classList.contains("active");
  if (!inContratos && !force) return;

  const container = rootDocs();
  if (!container) return;
  if (docsInflight) return;

  docsInflight = true;
  docsSkeleton();

  try {
    const contratos = await apiContratos();
    const anexosLists = await Promise.all(
      (contratos || []).map((c) => apiAnexosDeContrato(c.id_contrato))
    );
    const anexos = anexosLists.flat();

    const mappedContratos = (contratos || []).map((c) => ({
      kind: "contrato",
      id_contrato: c.id_contrato,
      id_empleado: c.id_empleado ?? c.empleado_id ?? null,
      nombre_empleado: c.nombre_empleado || null,
      full_name: (() => {
        const n = c.nombre || c.nombres || c.nombre_empleado || "";
        const ap = c.apellido_paterno || c.paterno || "";
        const am = c.apellido_materno || c.materno || "";
        const joined = [n, ap, am].filter(Boolean).join(" ").trim();
        return joined || c.empleado_nombre || "Empleado";
      })(),
      cargo_contratado: c.cargo_contratado || c.cargo || "",
      jornada: c.jornada || "",
      fecha_inicio: c.fecha_inicio,
      fecha_termino: c.fecha_termino,
      estado: (c.estado || "vigente").toLowerCase(),
      archivo_pdf: c.archivo_pdf || null,
    }));

    const mappedAnexos = (anexos || []).map((a) => ({
      kind: "anexo",
      id_anexo: a.id_anexo,
      id_contrato: a.id_contrato,
      id_empleado: a.id_empleado ?? a.empleado_id ?? null,
      nombre_empleado: a.nombre_empleado || null,
      tipo_cambio: a.tipo_cambio || "cambio",
      fecha: a.fecha,
      documento_url: a.documento_url || null,
    }));

    renderDocs(mappedContratos, mappedAnexos);
  } catch (err) {
    docsError(`No se pudieron cargar documentos.\n${err.message || err}`);
  } finally {
    docsInflight = false;
  }
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest('.access-btn[data-target="contratos"]');
  if (btn) loadDocs({ force: true });
});