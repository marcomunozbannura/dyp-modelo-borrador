/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   PRESUPUESTO — y la OR, que es "el apellido de la OT".

   Del original se copian los tres bloques (`Mano de Obra` · `Repuestos` ·
   `Externos` · `Observación`) y los tres procesos (`Cambio` · `Reparar` ·
   `Externo`).

   🔶 SIN TEMPARIO (decisión del 13-08-2026). Estaba como selector en el
      formulario y proponía la venta multiplicando las horas por una tarifa de
      $10.000. Se saca por lo mismo que se sacó la columna de horas del
      documento impreso: el taller no cobra por hora, cotiza un precio por
      trabajo, y tener la tarifa a la vista invita a que la compañía divida el
      monto por las horas y discuta un valor hora que no existe. La venta
      ahora se escribe.

   Lo que se corrige:

   🔴 La OR es COMPUESTA — `<OT>-<id_reparación>-<NNN>` — y el correlativo es
      por orden, no global. Nuestro diseño anterior la trataba como un
      consecutivo del sistema.

   🔴 El presupuesto se VERSIONA en vez de editarse encima. Cuando la
      aseguradora rechaza y pide ajustar, nace la versión 2 y la 1 queda
      intacta. Eso es lo que hace auditable la discusión con la compañía, y
      es imposible con el PDF actual — que además es el dolor #2 que el
      cliente nombró.

   🔶 SIN COSTOS NI UTILIDAD (decisión del 13-08-2026). El taller no lleva
      costos por orden, así que el presupuesto es la VENTA y nada más. Lo que
      sí gana valor con eso: la **venta parada**, que es la suma de lo
      presupuestado en órdenes que todavía no se entregan.
   ──────────────────────────────────────────────────────────────────────── */

const PROCESOS = [
  { codigo: 'cambio',  nombre: 'Cambio',  bloque: 'Repuestos',    ayuda: 'La pieza se reemplaza. Genera pedido a bodega' },
  { codigo: 'reparar', nombre: 'Reparar', bloque: 'Mano de Obra', ayuda: 'La pieza se repara. Se cotiza un precio por el trabajo' },
  { codigo: 'externo', nombre: 'Externo', bloque: 'Externos',     ayuda: 'Trabajo a terceros' }
];

function presuEstado() {
  ui.presupuesto = ui.presupuesto || { otId: null, presupuestoId: null, busqueda: '',
    linea: { proceso: 'reparar', descripcion: '', cantidad: 1, horas: '', precio_unitario: '' } };
  return ui.presupuesto;
}

function vPresupuesto() {
  const p = presuEstado();
  return p.otId ? vPresupuestoOT(Modelo.otPorId(p.otId)) : vPresupuestoListado();
}

/* ── Listado ───────────────────────────────────────────────────────────── */

function vPresupuestoListado() {
  const p = presuEstado();
  const q = p.busqueda.trim().toLowerCase();
  const filas = Modelo.torre()
    .filter((o) => !p.soloSin || !o.presupuestos.length)
    .filter((o) => !q ||
      [o.numeroOT, o.patente, o.cliente, o.presupuestos.map((x) => x.numeroOR).join(' ')]
        .join(' ').toLowerCase().includes(q));

  const vivas = Modelo.torre();
  const parada = vivas.reduce((s, o) => s + totalOT(o), 0);
  const sinPresupuesto = vivas.filter((o) => !o.presupuestos.length);
  const enviados = vivas.reduce((s, o) => s + o.presupuestos.filter((x) => x.estado === 'enviado')
    .reduce((t, x) => t + x.total, 0), 0);
  const aprobados = vivas.reduce((s, o) => s + o.presupuestos.filter((x) => x.estado === 'aprobado')
    .reduce((t, x) => t + x.total, 0), 0);
  const $$ = (n) => (Modelo.puede('presupuesto.montos') ? fMonto(n) : '•••••');

  return `
  <div class="indicadores">
    <div class="ind"><div class="rot">Venta parada en el taller</div>
      <div class="val" style="font-size:21px">${$$(parada)}</div>
      <div class="sub">${vivas.length} órdenes sin entregar</div></div>
    <div class="ind aviso"><div class="rot">Esperando aprobación</div>
      <div class="val" style="font-size:21px">${$$(enviados)}</div>
      <div class="sub">Enviado a la compañía y sin respuesta</div></div>
    <div class="ind"><div class="rot">Aprobado y por ejecutar</div>
      <div class="val" style="font-size:21px">${$$(aprobados)}</div>
      <div class="sub">Se puede trabajar</div></div>
    <div class="ind ${sinPresupuesto.length ? 'alerta' : ''}"><div class="rot">Sin presupuesto todavía</div>
      <div class="val">${sinPresupuesto.length}</div>
      <div class="sub">Órdenes que no se pueden cobrar</div></div>
  </div>

  <div class="panel">
    <div class="cab">
      <div><h2>${ico('presupuesto', 'g')}Presupuesto</h2>
        <div class="desc">Las 9 columnas del original, con el total neto por orden</div></div>
      <div class="filtros"><input type="search" id="q-presu" placeholder="OT, OR, patente o cliente" value="${esc(p.busqueda)}">
        <button class="btn secundario" id="presu-solo-sin" title="Ver solo las órdenes sin presupuesto">Sin presupuesto</button></div>
    </div>
    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th>OT</th><th>Cliente</th><th>Patente</th><th>Marca</th><th>Modelo</th>
        <th>Tipo</th><th>Fecha Ingreso</th><th>OR</th><th>Total neto</th><th>Acción</th></tr></thead>
      <tbody>${filas.slice(0, 60).map((o) => {
        const neto = o.presupuestos.reduce((s, x) => s + x.neto, 0);
        return '<tr class="fila"><td class="num"><strong>' + o.numeroOT + '</strong></td>' +
          '<td>' + esc(o.cliente) + '</td>' +
          '<td><span class="patente">' + esc(o.patente) + '</span></td>' +
          '<td>' + esc(o.marca || '—') + '</td><td>' + esc(o.modelo || '—') + '</td>' +
          '<td>' + esc(o.origenIngresoNombre || '—') + '</td>' +
          '<td class="num">' + fCorta(o.fechaIngreso) + '</td>' +
          '<td class="num">' + (o.presupuestos.length
            ? esc(o.presupuestos[o.presupuestos.length - 1].numeroOR) +
              (o.presupuestos.length > 1 ? ' <span class="et gris">v' + o.presupuestos.length + '</span>' : '')
            : '<span class="et ambar">sin presupuesto</span>') + '</td>' +
          '<td class="num">' + (neto ? fMonto(neto) : '—') + '</td>' +
          '<td><button class="btn secundario" data-presu-ot="' + esc(o.id) + '">Generar presupuesto</button></td></tr>';
      }).join('')}</tbody>
    </table></div>
    <div class="pie-grid"><div class="info">Mostrando ${Math.min(60, filas.length)} de ${filas.length}</div></div>
  </div>
`;
}

/* ── Presupuesto de una orden ──────────────────────────────────────────── */

function vPresupuestoOT(o) {
  const p = presuEstado();
  if (!o) { p.otId = null; return vPresupuestoListado(); }

  const actual = p.presupuestoId
    ? o.presupuestos.find((x) => x.id === p.presupuestoId)
    : o.presupuestos[o.presupuestos.length - 1];

  return `
  <div class="panel">
    <div class="cab">
      <div><h2>${ico('presupuesto', 'g')}Generar presupuesto Orden N° ${o.numeroOT}</h2>
        <div class="desc">${esc(o.patente)} · ${esc(o.cliente)} · ${esc(o.compania)}</div></div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn secundario" id="presu-volver">Volver al listado</button>
        ${actual && actual.estado === 'borrador'
          ? '<button class="btn secundario" id="presu-eliminar">Eliminar esta OR</button>' : ''}
        <button class="btn" id="presu-nuevo">Agregar OR</button>
      </div>
    </div>
    <div class="cuerpo">
      ${o.presupuestos.length ? `
      <div class="chips" style="margin-bottom:11px">
        ${o.presupuestos.map((x) => '<button class="chip' + (actual && x.id === actual.id ? ' activo' : '') +
          '" data-presu-ver="' + esc(x.id) + '">OR ' + esc(x.numeroOR) + ' · v' + x.version + '</button>').join('')}
      </div>` : ''}
      ${actual ? vPresupuestoDetalle(o, actual) : `
      <div class="vacio"><div class="titulo">Esta orden no tiene presupuestos</div>
      <div class="texto">Aprieta <strong>Agregar OR</strong>. Cada presupuesto genera su propia OR:
      la OT es el nombre y el presupuesto el apellido.</div></div>`}
    </div>
  </div>`;
}

function vPresupuestoDetalle(o, pr) {
  const p = presuEstado();
  const editable = pr.estado === 'borrador';

  /* Dos niveles de permiso: ve las líneas / ve los montos.
     "Tiene el presupuesto y no puede ver los valores."
     ⚠️ Acá está MODELADO: el dato igual llegó al navegador. Se garantiza en
     PostgreSQL con RLS. */
  const veMontos = Modelo.puede('presupuesto.montos');
  const $ = (n) => (veMontos ? fMonto(n) : '<span title="Este rol no ve los montos">•••••</span>');
  const porBloque = {};
  PROCESOS.forEach((x) => { porBloque[x.bloque] = pr.lineas.filter((l) => l.proceso === x.codigo); });

  const bloque = (nombre) => {
    const lineas = porBloque[nombre] || [];
    const sub = lineas.reduce((s, l) => s + l.cantidad * l.precio_unitario, 0);
    return '<fieldset class="bloque" style="margin-bottom:10px"><legend>' + esc(nombre) + '</legend>' +
      (lineas.length ? '<div class="grid-envoltorio"><table class="grid">' +
        '<thead><tr><th>Descripción</th><th>Cant.</th><th>Horas</th><th>Unitario</th>' +
        '<th>Subtotal</th><th></th></tr></thead><tbody>' +
        lineas.map((l) => '<tr><td>' + esc(l.descripcion) + '</td>' +
          '<td class="num">' + l.cantidad + '</td>' +
          '<td class="num">' + (l.horas ? String(l.horas).replace('.', ',') : '—') + '</td>' +
          '<td class="num">' + $(l.precio_unitario) + '</td>' +
          '<td class="num"><strong>' + $(l.cantidad * l.precio_unitario) + '</strong></td>' +
          '<td>' + (editable ? '<button class="quitar" data-quitarlinea="' + esc(l.id) + '">&times;</button>' : '') +
          '</td></tr>').join('') +
        '<tr><td colspan="4" style="text-align:right"><strong>Subtotal ' + esc(nombre) + '</strong></td>' +
        '<td class="num"><strong>' + $(sub) + '</strong></td><td></td></tr>' +
        '</tbody></table></div>'
        : '<div style="color:var(--gris-2);font-size:12.5px;padding:6px 2px">Sin líneas en este bloque.</div>') +
      '</fieldset>';
  };

  const repuestosPedidos = o.repuestos.filter((r) => pr.lineas.some((l) => l.id === r.presupuesto_linea_id));

  return `
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:11px">
    <span class="et ${ESTADO_PRESUPUESTO[pr.estado] ? ESTADO_PRESUPUESTO[pr.estado].clase : 'gris'}">
      ${esc(ESTADO_PRESUPUESTO[pr.estado] ? ESTADO_PRESUPUESTO[pr.estado].txt : pr.estado)}</span>
    <span class="cod">OR ${esc(pr.numeroOR)}</span>
    <span class="et gris">versión ${pr.version}</span>
    <span style="flex:1"></span>
    ${editable ? '<button class="btn" data-presu-estado="enviado">Enviar a la compañía</button>' : ''}
    ${pr.estado === 'enviado' ? '<button class="btn" data-presu-estado="aprobado">Marcar aprobado</button>' +
      '<button class="btn secundario" data-presu-estado="rechazado">Marcar rechazado</button>' : ''}
    <button class="btn secundario" id="presu-version">Crear versión nueva</button>
    ${Modelo.puede('presupuesto.montos')
      ? '<button class="btn secundario" id="presu-pdf" data-pr="' + esc(pr.id) + '">' +
        ico('imprimir') + 'Ver el documento</button>'
      : ''}
  </div>

  ${bloque('Mano de Obra')}
  ${bloque('Repuestos')}
  ${bloque('Externos')}

  ${editable ? `
  <fieldset class="bloque"><legend>Agregar línea</legend>
    <div class="rejilla-campos">
      <div class="campo"><label>Proceso</label>
        <select id="l-proceso">${PROCESOS.map((x) => '<option value="' + x.codigo + '"' +
          (p.linea.proceso === x.codigo ? ' selected' : '') + '>' + esc(x.nombre) + ' — ' + esc(x.bloque) + '</option>').join('')}</select>
        <span class="ayuda">${esc((PROCESOS.find((x) => x.codigo === p.linea.proceso) || {}).ayuda || '')}</span></div>
      <div class="campo"><label>Descripción</label><input id="l-desc" value="${esc(p.linea.descripcion)}"
        placeholder="Tal como se escribe: no hay código de repuesto"></div>
      <div class="campo"><label>Cantidad</label><input type="number" id="l-cant" value="${esc(p.linea.cantidad)}" min="1"></div>
      <div class="campo"><label>Horas</label><input type="number" id="l-horas" step="0.5" value="${esc(p.linea.horas)}"
        ${p.linea.proceso === 'reparar' ? '' : 'disabled placeholder="solo en Reparar"'}>
        <span class="ayuda">Para estimar el trabajo. No multiplica nada ni sale en el documento</span></div>
      <div class="campo"><label>Venta</label><input type="number" id="l-venta" value="${esc(p.linea.precio_unitario)}">
        <span class="ayuda">Lo que se le cobra a la compañía por esta línea</span></div>
      <div class="campo"><label>&nbsp;</label><button class="btn" id="l-agregar">Agregar línea</button></div>
    </div>
  </fieldset>` : `
  <div class="nota">Este presupuesto está <strong>${esc(pr.estado)}</strong> y no se edita.
  Para cambiarlo se crea una versión nueva: así queda auditable qué se le mandó a la compañía y cuándo.</div>`}

  <div class="panel" style="margin-top:11px"><div class="cuerpo">
    <div class="ficha-rejilla">
      <fieldset class="bloque"><legend>Totales</legend>
        <div class="dato"><span class="k">Neto</span><span class="v">${$(pr.neto)}</span></div>
        <div class="dato"><span class="k">IVA ${Reglas.parametro(Modelo.base(), 'iva', 19)}%</span><span class="v">${$(pr.iva)}</span></div>
        <div class="dato"><span class="k">Total</span><span class="v"><strong>${$(pr.total)}</strong></span></div>
        ${veMontos ? '' : '<div class="pie-nota" style="margin-top:6px">Estás mirando como <strong>' +
          esc(Modelo.rolActual().nombre) + '</strong>: este rol ve las líneas pero no los valores.</div>'}
      </fieldset>
      <fieldset class="bloque"><legend>Qué significa esta OR para el taller</legend>
        <div class="dato"><span class="k">Estado</span><span class="v">
          <span class="et ${ESTADO_PRESUPUESTO[pr.estado] ? ESTADO_PRESUPUESTO[pr.estado].clase : 'gris'}">
          ${esc(ESTADO_PRESUPUESTO[pr.estado] ? ESTADO_PRESUPUESTO[pr.estado].txt : pr.estado)}</span></span></div>
        <div class="dato"><span class="k">Venta de esta OR</span><span class="v"><strong>${$(pr.total)}</strong></span></div>
        <div class="dato"><span class="k">Venta total de la OT</span><span class="v">${$(totalOT(o))}</span></div>
        <div class="dato"><span class="k">¿Está entregada?</span><span class="v">${o.esFinal
          ? '<span class="et gris">sí, ya facturable</span>'
          : '<span class="et ambar">no · esta venta está parada</span>'}</span></div>
      </fieldset>
    </div>
  </div></div>

  <fieldset class="bloque" style="margin-top:11px"><legend>Pedido a bodega</legend>
    ${repuestosPedidos.length
      ? '<div class="grid-envoltorio"><table class="grid"><thead><tr><th>Repuesto</th><th>Paga</th>' +
        '<th>Solicitado</th><th>Llegó</th></tr></thead><tbody>' +
        repuestosPedidos.map((r) => '<tr><td>' + esc(r.descripcion) + '</td>' +
          '<td><span class="et ' + (r.pagaTaller ? 'roja' : 'gris') + '">' + esc(r.responsablePago) + '</span></td>' +
          '<td class="num">' + fCorta(r.fechaSolicitud) + '</td>' +
          '<td class="num">' + (r.fechaBodega ? fCorta(r.fechaBodega) : '<span class="et ambar">pendiente</span>') +
          '</td></tr>').join('') + '</tbody></table></div>'
      : '<div style="color:var(--gris-2);font-size:12.5px;padding:6px 2px">Todavía no se pidió nada a bodega.</div>'}
  </fieldset>`;
}

/* ── Cableado ──────────────────────────────────────────────────────────── */

function pPresupuesto() {
  const p = presuEstado();

  const q = document.getElementById('q-presu');
  if (q) q.addEventListener('input', () => {
    p.busqueda = q.value; render();
    const n = document.getElementById('q-presu');
    n.focus(); n.setSelectionRange(n.value.length, n.value.length);
  });

  const soloSin = document.getElementById('presu-solo-sin');
  if (soloSin) {
    soloSin.classList.toggle('activo', !!p.soloSin);
    soloSin.addEventListener('click', () => { p.soloSin = !p.soloSin; render(); });
  }

  document.querySelectorAll('[data-presu-ot]').forEach((b) => b.addEventListener('click', () => {
    p.otId = b.dataset.presuOt; p.presupuestoId = null; render();
  }));
  /* Eliminar una OR creada por equivocación. Solo en borrador, y preguntando:
     es la única acción del presupuesto que borra en vez de versionar. */
  const eliminar = document.getElementById('presu-eliminar');
  if (eliminar) eliminar.addEventListener('click', () => {
    const o = Modelo.otPorId(p.otId);
    const actual = p.presupuestoId ? o.presupuestos.find((x) => x.id === p.presupuestoId)
                                   : o.presupuestos[o.presupuestos.length - 1];
    if (!actual) return;
    if (!confirm('¿Eliminar la OR ' + actual.numeroOR + ' con sus líneas?\n\nNo se puede recuperar, ' +
                 'pero sí se puede deshacer con Ctrl+Z.')) return;
    ejecutar(() => Modelo.eliminar_presupuesto(actual.id), 'OR eliminada.', () => { p.presupuestoId = null; });
  });

  const volver = document.getElementById('presu-volver');
  if (volver) volver.addEventListener('click', () => { p.otId = null; p.presupuestoId = null; render(); });

  document.querySelectorAll('[data-presu-ver]').forEach((b) => b.addEventListener('click', () => {
    p.presupuestoId = b.dataset.presuVer; render();
  }));

  const nuevo = document.getElementById('presu-nuevo');
  if (nuevo) nuevo.addEventListener('click', () =>
    ejecutar(() => Modelo.crear_presupuesto(p.otId, { lineas: [] }), 'OR creada.',
      (r) => { p.presupuestoId = r.presupuesto_id; render(); }));

  /* Ver el documento sin salir de la pantalla. El botón decía "PDF · tanda 7"
     y solo avisaba que estaba pendiente: quien acaba de armar un presupuesto
     quiere ver CÓMO le va a llegar a la compañía antes de mandarlo, y tenía
     que irse a la ficha de la orden a buscarlo. Se abre la versión que está a
     la vista, no la última: si se está mirando la v1, se ve la v1. */
  const pdf = document.getElementById('presu-pdf');
  if (pdf) pdf.addEventListener('click', () => abrirImpreso('presupuesto', p.otId, pdf.dataset.pr));

  const version = document.getElementById('presu-version');
  if (version) version.addEventListener('click', () => {
    const o = Modelo.otPorId(p.otId);
    const actual = p.presupuestoId ? o.presupuestos.find((x) => x.id === p.presupuestoId)
                                   : o.presupuestos[o.presupuestos.length - 1];
    if (!actual) return avisar({ ok: false, motivo: 'No hay presupuesto del cual sacar una versión.' });
    ejecutar(() => Modelo.nueva_version_presupuesto(actual.id),
      'Versión nueva. La anterior queda intacta.', (r) => { p.presupuestoId = r.presupuesto_id; render(); });
  });

  document.querySelectorAll('[data-presu-estado]').forEach((b) => b.addEventListener('click', () => {
    const o = Modelo.otPorId(p.otId);
    const actual = p.presupuestoId ? o.presupuestos.find((x) => x.id === p.presupuestoId)
                                   : o.presupuestos[o.presupuestos.length - 1];
    ejecutar(() => Modelo.cambiar_estado_presupuesto(actual.id, b.dataset.presuEstado), 'Presupuesto actualizado.');
  }));

  const proc = document.getElementById('l-proceso');
  if (proc) proc.addEventListener('change', () => { p.linea.proceso = proc.value; render(); });

  const agregar = document.getElementById('l-agregar');
  if (agregar) agregar.addEventListener('click', () => {
    const o = Modelo.otPorId(p.otId);
    const actual = p.presupuestoId ? o.presupuestos.find((x) => x.id === p.presupuestoId)
                                   : o.presupuestos[o.presupuestos.length - 1];
    const v = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    /* La venta se escribe, no se calcula. El tempario salió del presupuesto
       (decisión del 13-08-2026): multiplicaba las horas por una tarifa de
       $10.000 para proponer el monto, y este taller no cotiza así — cotiza un
       precio por trabajo. Dejar la tarifa a la vista invitaba a que la
       compañía dividiera el monto por las horas y discutiera un valor hora que
       no existe. Las horas quedan como estimación del trabajo, sin multiplicar
       nada y sin salir en el documento. */
    const horas = Number(v('l-horas')) || null;
    // El campo vacío viaja como `null` para que el motor lo distinga de un 0
    // escrito a propósito. Uno es un olvido; el otro, una decisión.
    const venta = String(v('l-venta')).trim();
    ejecutar(() => Modelo.agregar_linea_presupuesto(actual.id, {
      proceso: p.linea.proceso, descripcion: v('l-desc'),
      cantidad: Number(v('l-cant')) || 1, horas,
      precio_unitario: venta === '' ? null : Number(venta)
    }), 'Línea agregada.');
  });

  document.querySelectorAll('[data-quitarlinea]').forEach((b) => b.addEventListener('click', () =>
    ejecutar(() => Modelo.quitar_linea_presupuesto(b.dataset.quitarlinea), 'Línea quitada.')));

  document.querySelectorAll('[data-pendiente]').forEach((b) => b.addEventListener('click', () => {
    const [rot, tanda, nota] = b.dataset.pendiente.split('|');
    avisar({ ok: false, motivo: '"' + rot + '" se construye en la tanda ' + tanda +
      (nota ? ' (' + nota + ')' : '') + '.' });
  }));
}
