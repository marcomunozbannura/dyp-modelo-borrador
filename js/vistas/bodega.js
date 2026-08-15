/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   BODEGA — cuatro pantallas, y dos de ellas están rotas en el original.

   Bodega NO es inventario de venta: es control de repuestos por orden de
   trabajo, y solo opera sobre vehículos que están en la torre. La razón es de
   negocio y se dio en la reunión: *"se obliga al bodeguero a cargar sí o sí
   mientras el auto está en el taller, porque yo no puedo facturar teniendo un
   pendiente"*.

   | Pantalla del original            | Estado hoy                          |
   |----------------------------------|-------------------------------------|
   | Check-list Repuestos Presupuestos| ❌ la búsqueda no devuelve nada     |
   | Seguimiento Repuestos            | ✅ 102 filas, 14 columnas           |
   | Costos de Reparación             | ✅ 98 filas                          |
   | Valorizar TOT                    | ❌ cuelga el navegador               |

   El check-list se construye funcionando: es la pantalla con la que el
   bodeguero tendría que trabajar todos los días y hoy no sirve. Se comprobó
   con dos patentes válidas, una de ellas con repuestos pendientes
   confirmados, y en los dos casos la página quedó igual, sin tabla y sin
   mensaje de error.

   ⚠️ `Valorizar TOT` NO se construye. Cuelga el navegador en los dos intentos
   y no se pudo ver qué hace. Construir a ciegas la pantalla que alimenta
   `Venta ToT` —una de las tres líneas de venta del Histórico— sería inventar.
   Es la pregunta 5, sin confirmar.
   ──────────────────────────────────────────────────────────────────────── */

const BODEGA_PANTALLAS = [
  { id: 'checklist',  n: 'Check-list de repuestos' },
  { id: 'seguimiento', n: 'Seguimiento de repuestos' },
  { id: 'costos',     n: 'Costos adicionales' },
  { id: 'tot',        n: 'Valorizar TOT' }
];

function bodegaEstado() {
  ui.bodega = ui.bodega || { pantalla: 'seguimiento', patente: '', otId: null, busqueda: '' };
  return ui.bodega;
}

function vBodega() {
  const b = bodegaEstado();
  const cuerpo = { checklist: bodegaChecklist, seguimiento: bodegaSeguimiento,
                   costos: bodegaCostos, tot: bodegaTot }[b.pantalla]();
  return `
  <div class="panel">
    <div class="cab">
      <div><h2>${ico('bodega', 'g')}Bodega - DyP</h2>
        <div class="desc">Control de repuestos por orden. No es inventario de venta</div></div>
      <div class="chips">${BODEGA_PANTALLAS.map((x) => '<button class="chip' +
        (b.pantalla === x.id ? ' activo' : '') + '" data-bod="' + x.id + '">' + esc(x.n) + '</button>').join('')}</div>
    </div>
    <div class="cuerpo">${cuerpo}</div>
  </div>`;
}

/* ── Check-list · la que está rota en el original ──────────────────────── */

function bodegaChecklist() {
  const b = bodegaEstado();
  const o = b.otId ? Modelo.otPorId(b.otId) : null;

  return `
  <div class="rejilla-campos">
    <div class="campo"><label>Buscar unidad para ver los repuestos del presupuesto</label>
      <input id="bod-patente" value="${esc(b.patente)}" placeholder="Patente"></div>
    <div class="campo"><label>&nbsp;</label><button class="btn" id="bod-buscar">Buscar patente</button></div>
  </div>

  ${o ? bodegaFichaRepuestos(o) : (b.patente
    ? '<div class="vacio"><div class="titulo">Sin resultados para “' + esc(b.patente) + '”</div>' +
      '<div class="texto">Bodega solo muestra vehículos que están en la torre: es a propósito, ' +
      'para que nadie cargue un repuesto olvidado después de cerrada la OT.</div></div>'
    : '<div class="vacio"><div class="titulo">Escribe una patente</div></div>')}`;
}

function bodegaFichaRepuestos(o) {
  const pagos = Modelo.catalogo('responsable_pago');
  return `
  <div class="panel" style="margin-top:11px">
    <div class="cab"><div><h2>OT ${o.numeroOT} · ${esc(o.patente)}</h2>
      <div class="desc">${esc(o.cliente)} · ${esc(o.compania)} · ${o.enTaller ? 'en taller' : 'fuera de taller'}</div></div>
      <span class="et ${o.repuestos.some((r) => !r.fechaBodega) ? 'ambar' : 'verde'}">
        ${o.repuestos.filter((r) => r.fechaBodega).length} de ${o.repuestos.length} recibidos</span></div>
    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th>Cant.</th><th>Descripción</th><th>Quién paga</th><th>Solicitado</th>
        <th>Llegó a bodega</th><th>Entregado al área</th><th>Demoró</th><th>Acción</th></tr></thead>
      <tbody>${o.repuestos.length ? o.repuestos.map((r) =>
        '<tr><td class="num">' + r.cantidad + '</td><td>' + esc(r.descripcion) + '</td>' +
        '<td><select data-pago="' + esc(r.id) + '">' +
          pagos.map((x) => '<option value="' + esc(x.id) + '"' +
            (x.nombre === r.responsablePago ? ' selected' : '') + '>' + esc(x.nombre) + '</option>').join('') +
          '</select></td>' +
        '<td class="num">' + (r.fechaSolicitud ? fCorta(r.fechaSolicitud) : '—') + '</td>' +
        '<td class="num">' + (r.fechaBodega ? fCorta(r.fechaBodega) : '<span class="et ambar">pendiente</span>') + '</td>' +
        '<td class="num">' + (r.fechaEntregaArea ? fCorta(r.fechaEntregaArea) : '—') + '</td>' +
        '<td class="num">' + (r.diasEnLlegar === null ? '—' : r.diasEnLlegar + ' d') + '</td>' +
        '<td>' + (!r.fechaBodega
          ? '<button class="btn secundario" data-recibir="' + esc(r.id) + '">Llegó a bodega</button>'
          : (!r.fechaEntregaArea
            ? '<button class="btn secundario" data-entregararea="' + esc(r.id) + '">Entregar al área</button>'
            : '<span class="et verde">completo</span>')) + '</td></tr>').join('')
        : '<tr><td colspan="8"><div class="vacio"><div class="titulo">Sin repuestos en el presupuesto</div></div></td></tr>'}</tbody>
    </table></div>
    <div class="cuerpo">
      <fieldset class="bloque"><legend>Cargar un repuesto que no venía en el presupuesto</legend>
        <div class="rejilla-campos">
          <div class="campo"><label>Descripción</label><input id="bod-desc" placeholder="Como se escribe: sin código"></div>
          <div class="campo"><label>Cantidad</label><input type="number" id="bod-cant" value="1" min="1"></div>
          <div class="campo"><label>Quién paga</label><select id="bod-pago">${pagos.map((x) =>
            '<option value="' + esc(x.id) + '">' + esc(x.nombre) + '</option>').join('')}</select></div>
          <div class="campo"><label>&nbsp;</label><button class="btn" id="bod-cargar">Cargar</button></div>
        </div>
      </fieldset>
    </div>
  </div>`;
}

/* ── Seguimiento · 14 columnas ─────────────────────────────────────────── */

function bodegaSeguimiento() {
  const b = bodegaEstado();
  const q = b.busqueda.trim().toLowerCase();
  const filas = Modelo.torre().filter((o) => !q ||
    [o.numeroOT, o.patente, o.cliente, o.siniestro].join(' ').toLowerCase().includes(q));
  const conPend = filas.filter((o) => o.repuestos.some((r) => !r.fechaBodega));

  const lista = (o, pendientes) => o.repuestos.filter((r) => pendientes ? !r.fechaBodega : r.fechaBodega)
    .map((r) => esc(r.descripcion) + ' <span class="et gris">' + esc(r.responsablePago || 's/d') + '</span>')
    .join('<br>') || '<span style="color:var(--gris-2)">—</span>';

  return `
  <div class="indicadores" style="margin-bottom:11px">
    <div class="ind aviso"><div class="rot">Unidades con repuestos pendientes</div>
      <div class="val">${conPend.length}<span style="font-size:14px;color:var(--gris)">/${filas.length}</span></div>
      <div class="sub">Es la tarjeta que la portada del original enlaza acá</div></div>
    <div class="ind"><div class="rot">Piezas sin llegar</div>
      <div class="val">${Modelo.metricas().repuestosPendientes}</div><div class="sub">En total</div></div>
    <div class="ind"><div class="rot">Las paga el taller</div>
      <div class="val">${filas.reduce((s, o) => s + o.repuestos.filter((r) => r.pagaTaller && !r.fechaBodega).length, 0)}</div>
      <div class="sub">Plata de DyP, no de la compañía</div></div>
  </div>

  <div class="filtros" style="margin-bottom:8px">
    <input type="search" id="bod-q" placeholder="OT, patente, cliente o siniestro" value="${esc(b.busqueda)}">
    <button class="btn secundario" data-pendiente="DESCARGAR LISTADO TOTAL|6|la exportación es un permiso aparte y queda en la traza">Descargar listado total</button>
  </div>

  <div class="grid-envoltorio"><table class="grid">
    <thead><tr><th>OT</th><th>OR</th><th>Cliente</th><th>Compañia</th><th>Patente</th><th>Siniestro</th>
      <th>Marca</th><th>Modelo</th><th>Color</th><th>Ingreso</th><th>Días</th><th>Alerta</th>
      <th>Rep Pend.</th><th>Rep OK.</th></tr></thead>
    <tbody>${filas.slice(0, 60).map((o) =>
      '<tr class="fila" data-ot="' + esc(o.numeroOT) + '"><td class="num"><strong>' + o.numeroOT + '</strong></td>' +
      '<td class="num">' + esc(o.presupuestos.length ? o.presupuestos[0].numeroOR : '—') + '</td>' +
      '<td>' + esc(o.cliente) + '</td><td>' + esc(o.compania) + '</td>' +
      '<td><span class="patente">' + esc(o.patente) + '</span></td>' +
      '<td class="num">' + esc(o.siniestro || '—') + '</td>' +
      '<td>' + esc(o.marca || '—') + '</td><td>' + esc(o.modelo || '—') + '</td>' +
      '<td>' + esc(o.color || '—') + '</td>' +
      '<td class="num">' + fCorta(o.fechaIngreso) + '</td>' +
      '<td class="num">' + o.diasKpi + '</td>' +
      '<td>' + (o.alertas.length ? o.alertas.map((a) => '<span class="cod">' + esc(a.letra) + '</span>').join('') : '—') + '</td>' +
      '<td style="max-width:220px">' + lista(o, true) + '</td>' +
      '<td style="max-width:220px">' + lista(o, false) + '</td></tr>').join('')}</tbody>
  </table></div>
  <div class="pie-grid"><div class="info">Mostrando ${Math.min(60, filas.length)} de ${filas.length}</div></div>
`;
}

/* ── Costos adicionales ────────────────────────────────────────────────── */

function bodegaCostos() {
  const b = bodegaEstado();
  const o = b.otId ? Modelo.otPorId(b.otId) : null;
  const filas = Modelo.torre();
  const pagos = Modelo.catalogo('responsable_pago');

  if (o) {
    const costos = Modelo.costosDe(o.id);
    const total = costos.reduce((s, c) => s + c.monto, 0);
    const delTaller = costos.filter((c) => c.pagaTaller).reduce((s, c) => s + c.monto, 0);
    return `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:11px">
      <button class="btn secundario" id="bod-volver">Volver al listado</button>
      <strong>OT ${o.numeroOT} · ${esc(o.patente)}</strong>
      <span style="flex:1"></span>
      <span class="et gris">Total ${fMonto(total)}</span>
      <span class="et roja">Lo pone DyP: ${fMonto(delTaller)}</span>
    </div>
    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th>Fecha</th><th>Descripción</th><th>Quién paga</th><th>Monto</th></tr></thead>
      <tbody>${costos.length ? costos.map((c) =>
        '<tr><td class="num">' + fCorta(c.fecha) + '</td><td>' + esc(c.descripcion) + '</td>' +
        '<td><span class="et ' + (c.pagaTaller ? 'roja' : 'gris') + '">' + esc(c.responsable) + '</span></td>' +
        '<td class="num">' + fMonto(c.monto) + '</td></tr>').join('')
        : '<tr><td colspan="4"><div class="vacio"><div class="titulo">Sin costos adicionales</div></div></td></tr>'}</tbody>
    </table></div>
    <fieldset class="bloque" style="margin-top:11px"><legend>Agregar costo</legend>
      <div class="rejilla-campos">
        <div class="campo"><label>Descripción</label><input id="ca-desc" placeholder="Flete, grúa, insumos…"></div>
        <div class="campo"><label>Monto</label><input type="number" id="ca-monto"></div>
        <div class="campo"><label>Quién paga</label><select id="ca-pago">${pagos.map((x) =>
          '<option value="' + esc(x.id) + '">' + esc(x.nombre) + '</option>').join('')}</select></div>
        <div class="campo"><label>&nbsp;</label><button class="btn" id="ca-agregar">Agregar</button></div>
      </div>
    </fieldset>
`;
  }

  return `
  <div class="grid-envoltorio"><table class="grid">
    <thead><tr><th>OT</th><th>Cliente</th><th>Patente</th><th>Marca</th><th>Modelo</th>
      <th>Costos</th><th>Los pone DyP</th><th>Acción</th></tr></thead>
    <tbody>${filas.slice(0, 60).map((o2) => {
      const c = Modelo.costosDe(o2.id);
      const taller = c.filter((x) => x.pagaTaller).reduce((s, x) => s + x.monto, 0);
      return '<tr class="fila" data-ot="' + esc(o2.numeroOT) + '"><td class="num"><strong>' + o2.numeroOT + '</strong></td>' +
        '<td>' + esc(o2.cliente) + '</td>' +
        '<td><span class="patente">' + esc(o2.patente) + '</span></td>' +
        '<td>' + esc(o2.marca || '—') + '</td><td>' + esc(o2.modelo || '—') + '</td>' +
        '<td class="num">' + (c.length ? fMonto(c.reduce((s, x) => s + x.monto, 0)) : '—') + '</td>' +
        '<td class="num">' + (taller ? '<span style="color:var(--rojo)">' + fMonto(taller) + '</span>' : '—') + '</td>' +
        '<td><button class="btn secundario" data-costos-ot="' + esc(o2.id) + '">Ver / cargar</button></td></tr>';
    }).join('')}</tbody>
  </table></div>
  <div class="pie-grid"><div class="info">Mostrando ${Math.min(60, filas.length)} de ${filas.length}</div></div>`;
}

/* ── Valorizar TOT · declarada, no construida ──────────────────────────── */

function bodegaTot() {
  return `
  <div class="vacio">
    ${ico('alerta')}
    <div class="titulo">No sabemos qué hace Valorizar TOT</div>
    <div class="texto" style="max-width:640px;margin:0 auto;text-align:left">
      En el sistema actual <strong>cuelga el navegador</strong>. Dos intentos independientes, con 3 y
      5 segundos de espera: en los dos el motor de renderizado dejó de responder y hubo que abandonar
      la pestaña. Ninguna otra de las 39 pantallas hace esto. <em>El comportamiento es el hallazgo.</em>
      <br><br>
      Y no es una pantalla menor: <span class="cod">Venta ToT</span> es <strong>una de las tres
      líneas de venta</strong> que muestra el Histórico, junto a mano de obra y repuestos. Sin
      saber qué la alimenta, esa columna queda a medias.
      <br><br>
      La deducción —no confirmada— es que <strong>ToT sean trabajos a terceros</strong>, por su
      correspondencia con la sección <span class="cod">Externos</span> del presupuesto y con esta
      pantalla de Bodega. Pero es una deducción, y construir sobre ella sería inventar.
      <br><br>
      <strong>Es la pregunta 5:</strong> ¿qué hace Valorizar TOT y qué es "ToT"?
      Mientras tanto, el bloque <span class="cod">Externos</span> del presupuesto ya captura el
      trabajo a terceros con su venta y su costo.
    </div>
  </div>`;
}

/* ── Cableado ──────────────────────────────────────────────────────────── */

function pBodega() {
  // Doble clic abre la orden en pestaña nueva, igual que en la torre.
  dobleClicPorFilas();
  const b = bodegaEstado();

  document.querySelectorAll('[data-bod]').forEach((x) => x.addEventListener('click', () => {
    b.pantalla = x.dataset.bod; b.otId = null; render();
  }));

  const buscar = document.getElementById('bod-buscar');
  const campo = document.getElementById('bod-patente');
  const hacerBusqueda = () => {
    b.patente = campo.value.trim().toUpperCase();
    // Bodega solo opera sobre órdenes vivas: es a propósito.
    const o = Modelo.torre().find((x) => x.patente === b.patente);
    b.otId = o ? o.id : null;
    render();
  };
  if (buscar) buscar.addEventListener('click', hacerBusqueda);
  if (campo) campo.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') hacerBusqueda(); });

  const q = document.getElementById('bod-q');
  if (q) q.addEventListener('input', () => {
    b.busqueda = q.value; render();
    const n = document.getElementById('bod-q');
    n.focus(); n.setSelectionRange(n.value.length, n.value.length);
  });

  document.querySelectorAll('[data-recibir]').forEach((x) => x.addEventListener('click', () =>
    ejecutar(() => Modelo.recibir_repuesto(x.dataset.recibir), 'Repuesto recibido en bodega, con fecha.')));
  document.querySelectorAll('[data-entregararea]').forEach((x) => x.addEventListener('click', () =>
    ejecutar(() => Modelo.entregar_repuesto_area(x.dataset.entregararea), 'Entregado al área, con fecha.')));
  document.querySelectorAll('[data-pago]').forEach((x) => x.addEventListener('change', () =>
    ejecutar(() => Modelo.fijar_responsable_pago(x.dataset.pago, x.value), 'Responsable de pago guardado.')));

  const cargar = document.getElementById('bod-cargar');
  if (cargar) cargar.addEventListener('click', () => ejecutar(() => Modelo.cargar_repuesto(b.otId, {
    descripcion: document.getElementById('bod-desc').value,
    cantidad: Number(document.getElementById('bod-cant').value) || 1,
    responsable_pago_id: document.getElementById('bod-pago').value
  }), 'Repuesto cargado.'));

  document.querySelectorAll('[data-costos-ot]').forEach((x) => x.addEventListener('click', () => {
    b.otId = x.dataset.costosOt; render();
  }));
  const volver = document.getElementById('bod-volver');
  if (volver) volver.addEventListener('click', () => { b.otId = null; render(); });

  const agregarCosto = document.getElementById('ca-agregar');
  if (agregarCosto) agregarCosto.addEventListener('click', () => ejecutar(() =>
    Modelo.agregar_costo_adicional(b.otId, {
      descripcion: document.getElementById('ca-desc').value,
      monto: document.getElementById('ca-monto').value,
      responsable_pago_id: document.getElementById('ca-pago').value
    }), 'Costo adicional cargado.'));

  document.querySelectorAll('[data-pendiente]').forEach((x) => x.addEventListener('click', () => {
    const [rot, tanda, nota] = x.dataset.pendiente.split('|');
    avisar({ ok: false, motivo: '"' + rot + '" se construye en la tanda ' + tanda + (nota ? ' — ' + nota : '') + '.' });
  }));
}
