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

/* 🟰 LA FILA QUE SE DESPLIEGA AL APRETAR `Ver` (15-08-2026).

   Es como funciona el original: `Ver` no abre otra pantalla, abre una línea
   DEBAJO de la orden con cada presupuesto y sus cuatro acciones —`Ver PDF`,
   `Editar Presupuesto`, `Enviar`, `Anular`—. Tiene sentido: una OT puede tener
   varias OR, y desde el listado hay que poder elegir sobre CUÁL se actúa sin
   perder de vista la lista.

   Cada acción se muestra solo si se puede hacer sobre ese presupuesto:
   `Editar` y `Enviar` mueren cuando deja de ser borrador —lo enviado no se
   edita, se versiona—, y `Anular` no aplica a lo ya resuelto ni a lo ya
   anulado. Se ocultan en vez de rechazarse porque acá no hay una regla que
   explicar: el estado del presupuesto ya está a la vista en su etiqueta. */
function filaDesplegada(o) {
  const veMontos = Modelo.puede('presupuesto.montos');
  const cols = 10;

  const acciones = (pr) => {
    const b = [];
    if (veMontos) b.push('<button class="btn secundario chico" data-pr-pdf="' + esc(pr.id) +
      '" data-pr-ot="' + esc(o.id) + '">' + ico('imprimir') + 'Ver PDF</button>');
    if (pr.estado === 'borrador') {
      b.push('<button class="btn secundario chico" data-pr-editar="' + esc(pr.id) +
        '" data-pr-ot="' + esc(o.id) + '">' + ico('editar') + 'Editar Presupuesto</button>');
      b.push('<button class="btn secundario chico" data-pr-enviar="' + esc(pr.id) + '">Enviar</button>');
    }
    if (pr.estado !== 'anulado' && pr.estado !== 'aprobado' && pr.estado !== 'rechazado')
      b.push('<button class="btn secundario chico" data-pr-anular="' + esc(pr.id) + '">Anular</button>');
    return b.join(' ');
  };

  return '<tr class="fila-presu-desplegada"><td colspan="' + cols + '">' +
    o.presupuestos.map((pr) => {
      const e = ESTADO_PRESUPUESTO[pr.estado] || { txt: pr.estado, clase: 'gris' };
      return '<div class="linea-presu">' +
        '<span class="cod">Presupuesto ' + esc(pr.numeroOR) + '</span>' +
        '<span class="et ' + esc(e.clase) + '">' + esc(e.txt) + '</span>' +
        '<span class="et gris">v' + pr.version + '</span>' +
        '<span class="monto">' + (veMontos ? fMonto(pr.total) : '•••••') + '</span>' +
        '<span class="acc">' + acciones(pr) + '</span></div>';
    }).join('') + '</td></tr>';
}

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
        return '<tr class="fila" data-ot="' + esc(o.numeroOT) + '"><td class="num"><strong>' + o.numeroOT + '</strong></td>' +
          '<td>' + esc(o.cliente) + '</td>' +
          '<td><span class="patente">' + esc(o.patente) + '</span></td>' +
          '<td>' + esc(o.marca || '—') + '</td><td>' + esc(o.modelo || '—') + '</td>' +
          '<td>' + esc(o.origenIngresoNombre || '—') + '</td>' +
          '<td class="num">' + fCorta(o.fechaIngreso) + '</td>' +
          // El mouse sobre la OR abre la etiqueta con monto, estado y fechas de
          // ese presupuesto: "que el usuario tenga el detalle ahí mismo y no
          // tenga que estar abriendo la OT". Textual del cliente, 15-08-2026.
          '<td class="num">' + (o.presupuestos.length
            ? '<span data-or="' + esc(o.presupuestos[o.presupuestos.length - 1].numeroOR) + '">' +
                esc(o.presupuestos[o.presupuestos.length - 1].numeroOR) + '</span>' +
              (o.presupuestos.length > 1 ? ' <span class="et gris">v' + o.presupuestos.length + '</span>' : '')
            : '<span class="et ambar">sin presupuesto</span>') + '</td>' +
          '<td class="num">' + (neto ? fMonto(neto) : '—') + '</td>' +
          '<td><span style="display:flex;gap:6px;flex-wrap:wrap">' +
            '<button class="btn secundario chico" data-presu-ot="' + esc(o.id) + '">' +
              ico('editar') + 'Generar</button>' +
            (o.presupuestos.length
              ? '<button class="btn secundario chico" data-presu-ver-fila="' + esc(o.id) + '">' +
                ico('imprimir') + 'Ver</button>'
              : '') +
          '</span></td></tr>' +
          (p.abierta === o.id ? filaDesplegada(o) : '');
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
      ${/* El título es el del original: `Editar presupuesto N° <OR>-<versión> -
           <PATENTE>`, y debajo el siniestro con su glosa. Se entra acá desde
           `Editar Presupuesto` del listado con una OR ya elegida, así que el
           encabezado tiene que decir CUÁL se está editando — si dice solo el
           número de orden, con varias OR no se sabe en cuál se está. */''}
      <div><h2>${ico('presupuesto', 'g')}${actual
        ? 'Editar presupuesto N° ' + esc(actual.numeroOR) + '-' +
          String(actual.version).padStart(3, '0') + ' · ' + esc(o.patente)
        : 'Generar presupuesto · Orden N° ' + o.numeroOT}</h2>
        <div class="desc">${o.siniestro
          ? esc(o.siniestro) + ' · ' + esc(o.origenIngresoNombre || '') + ' · '
          : ''}${esc(o.cliente)}${o.compania && o.compania !== '—' ? ' · ' + esc(o.compania) : ''}</div></div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn secundario" id="presu-volver">Volver al listado</button>
        ${actual && actual.estado === 'borrador'
          ? '<button class="btn secundario" id="presu-eliminar">Eliminar esta OR</button>' : ''}
        ${/* La pérdida total la declara el EVALUADOR, no el recepcionista, y
              se decide acá: es mirando el presupuesto donde se ve que reparar
              cuesta más que el auto. Sólo aparece si el rol puede declararla y
              si la orden sigue abierta. */
          Modelo.puede('perdida_total.declarar') && !o.esFinal
          ? '<button class="btn secundario" id="presu-pt" ' +
            'title="Declarar el vehículo como pérdida total. Cierra la orden.">Pérdida total</button>'
          : ''}
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

/* ── La grilla del presupuesto ─────────────────────────────────────────
   Punto 8, pedido el 15-08-2026. El cliente dijo que le gusta el PDF que ya
   sale —"hace como un Excel por columna"— y que la pantalla de carga no se
   parece en nada: se carga en un formulario aparte y el resultado se ve en
   otro lado.

   Así que la pantalla pasa a ser el documento. Una sola tabla, cada monto en
   la columna de su tipo, los subtotales por columna al pie y la última fila
   sirve para escribir. Se carga SOBRE la grilla y se ve al tiro dónde cae.

   Y la pregunta que pidió: **¿el trabajo requiere repuestos?** Si la respuesta
   es no, la columna no se dibuja y hay una cosa menos que mirar. Es la mitad
   de la simplificación que pedía: no sacar funciones, sacar de la vista lo que
   este trabajo no usa. */
function requiereRepuestos(pr) {
  const p = presuEstado();
  // Si ya hay líneas de repuestos, la respuesta está dada por los hechos.
  if ((pr.lineas || []).some((l) => l.proceso === 'cambio')) return true;
  return p.conRepuestos !== false;
}

function grillaPresupuesto(o, pr, editable, $) {
  const p = presuEstado();
  const conRep = requiereRepuestos(pr);
  const hayLineasRep = (pr.lineas || []).some((l) => l.proceso === 'cambio');

  // Una columna por bloque, como el documento que sale.
  const cols = [{ codigo: 'reparar', bloque: 'Mano de Obra' }]
    .concat(conRep ? [{ codigo: 'cambio', bloque: 'Repuestos' }] : [])
    .concat([{ codigo: 'externo', bloque: 'Externos' }]);

  const monto = (l, codigo) => (l.proceso === codigo ? l.cantidad * l.precio_unitario : null);
  const subtotal = (codigo) => (pr.lineas || [])
    .filter((l) => l.proceso === codigo)
    .reduce((s, l) => s + l.cantidad * l.precio_unitario, 0);

  const filas = (pr.lineas || []).map((l) =>
    '<tr><td>' + esc(l.descripcion) + '</td>' +
    '<td class="num">' + l.cantidad + '</td>' +
    '<td class="num">' + (l.horas ? String(l.horas).replace('.', ',') : '—') + '</td>' +
    cols.map((c) => {
      const m = monto(l, c.codigo);
      return '<td class="num' + (m === null ? ' apagada' : '') + '">' +
        (m === null ? '' : $(m)) + '</td>';
    }).join('') +
    '<td>' + (editable ? '<button class="quitar" data-quitarlinea="' + esc(l.id) + '">&times;</button>' : '') +
    '</td></tr>').join('');

  // La fila de carga vive DENTRO de la tabla: se escribe donde se va a ver.
  const filaCarga = editable ? '<tr class="fila-carga">' +
    '<td><input id="l-desc" value="' + esc(p.linea.descripcion) + '" ' +
      'placeholder="Descripción — tal como se escribe, sin código"></td>' +
    '<td><input type="number" id="l-cant" value="' + esc(p.linea.cantidad) + '" min="1" title="Cantidad"></td>' +
    '<td><input type="number" id="l-horas" step="0.5" value="' + esc(p.linea.horas) + '" ' +
      'title="Horas — sólo para estimar, no multiplica" ' +
      (p.linea.proceso === 'reparar' ? '' : 'disabled') + '></td>' +
    cols.map((c) => '<td><input type="number" data-venta="' + c.codigo + '" ' +
      'value="' + (p.linea.proceso === c.codigo ? esc(p.linea.precio_unitario) : '') + '" ' +
      'placeholder="0" title="Escribe el monto en la columna que corresponde"></td>').join('') +
    '<td><button class="btn" id="l-agregar" title="Agregar la línea">+</button></td></tr>' : '';

  return `
  <fieldset class="bloque"><legend>Detalle del presupuesto</legend>
    ${editable ? `
    <div class="pregunta-rep">
      <span>¿Este trabajo requiere repuestos?</span>
      <button class="chip${conRep ? ' activo' : ''}" data-conrep="si">Sí</button>
      <button class="chip${!conRep ? ' activo' : ''}" data-conrep="no"
        ${hayLineasRep ? 'disabled title="Ya hay repuestos cargados: quítalos primero"' : ''}>No</button>
      ${hayLineasRep ? '<span class="ayuda">Ya hay repuestos en el presupuesto.</span>' : ''}
    </div>` : ''}

    <div class="grid-envoltorio"><table class="grid grilla-presu">
      <thead><tr>
        <th>Descripción</th><th style="width:60px">Cant.</th><th style="width:64px">Horas</th>
        ${cols.map((c) => '<th class="num">' + esc(c.bloque) + '</th>').join('')}
        <th style="width:44px"></th>
      </tr></thead>
      <tbody>
        ${filas || (editable ? '' : '<tr><td colspan="' + (cols.length + 4) +
          '" style="color:var(--gris-2);padding:8px">Este presupuesto no tiene líneas.</td></tr>')}
        ${filaCarga}
      </tbody>
      <tfoot>
        <tr><td colspan="3" style="text-align:right"><strong>Subtotales</strong></td>
          ${cols.map((c) => '<td class="num"><strong>' + $(subtotal(c.codigo)) + '</strong></td>').join('')}
          <td></td></tr>
        <tr class="fila-total"><td colspan="3" style="text-align:right"><strong>Neto</strong></td>
          <td class="num" colspan="${cols.length}"><strong>${$(pr.neto)}</strong></td><td></td></tr>
      </tfoot>
    </table></div>
    ${editable ? '<span class="ayuda">Escribe el monto en la columna del tipo de trabajo. ' +
      'Las horas son sólo para estimar: no multiplican nada ni salen en el documento.</span>' : ''}
  </fieldset>`;
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

  ${grillaPresupuesto(o, pr, editable, $)}

  ${editable ? '' : `
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
  // Doble clic abre la orden en pestaña nueva, igual que en la torre.
  dobleClicPorFilas();
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

  /* 🔴 LOS BOTONES DE FILA CORTAN EL EVENTO. La fila entera abre la orden con
     doble clic, así que sin `stopPropagation` apretar dos veces seguidas
     `Ver` —para abrir y cerrar, que es lo natural— abría además la ventana de
     la orden encima. Se vio probando. */
  document.querySelectorAll('[data-presu-ot]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    p.otId = b.dataset.presuOt; p.presupuestoId = null; render();
  }));

  /* `Ver` despliega la línea de abajo, y vuelve a apretarse para cerrarla. Se
     abre una a la vez: con 60 filas, dejarlas todas abiertas convierte el
     listado en una lista de presupuestos y se pierde la lista de órdenes. */
  document.querySelectorAll('[data-presu-ver-fila]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const id = b.dataset.presuVerFila;
    p.abierta = (p.abierta === id) ? null : id;
    render();
  }));

  document.querySelectorAll('[data-pr-pdf]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    abrirImpreso('presupuesto', b.dataset.prOt, b.dataset.prPdf);
  }));

  // `Editar Presupuesto` entra a ESE presupuesto, no al último de la orden:
  // desde el listado se eligió cuál, y perder esa elección sería hacérsela
  // repetir adentro.
  document.querySelectorAll('[data-pr-editar]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    p.otId = b.dataset.prOt; p.presupuestoId = b.dataset.prEditar; render();
  }));

  document.querySelectorAll('[data-pr-enviar]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    ejecutar(() => Modelo.cambiar_estado_presupuesto(b.dataset.prEnviar, 'enviado'),
      'Presupuesto enviado a la compañía.');
  }));

  /* Anular pregunta. Es la única de las cuatro que no se deshace sola: deja la
     OR fuera de la venta del taller, y si fue por error hay que crear otra. */
  document.querySelectorAll('[data-pr-anular]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (!confirm('¿Anular este presupuesto?\n\nLa OR deja de contar en la venta de la orden y ' +
                 'del taller. No se reactiva: si fue un error, hay que generar otra.\n\n' +
                 'Se puede deshacer con Ctrl+Z.')) return;
    ejecutar(() => Modelo.cambiar_estado_presupuesto(b.dataset.prAnular, 'anulado'),
      'Presupuesto anulado. Salió de la venta parada.');
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

  /* La pregunta del cliente: ¿este trabajo requiere repuestos? Si no, la
     columna no se dibuja. */
  /* Declarar la pérdida total. Pide el fundamento por escrito y avisa que
     cierra la orden: es un estado terminal y no se vuelve atrás — regla del
     propio cliente, "esa vez se cerró como rechazado y tengo que reingresar el
     vehículo". */
  const bpt = document.getElementById('presu-pt');
  if (bpt) bpt.addEventListener('click', () => {
    const o = Modelo.otPorId(p.otId);
    if (!o) return;
    const motivo = prompt('Declarar la OT ' + o.numeroOT + ' (' + o.patente + ') como PÉRDIDA TOTAL. ' +
      'Esto CIERRA la orden y no se puede deshacer. Escribe el fundamento:');
    if (motivo === null) return;
    ejecutar(() => Modelo.declarar_perdida_total(p.otId, motivo),
      'Declarada pérdida total. La orden quedó cerrada y el fundamento está en el expediente.',
      () => { p.otId = null; p.presupuestoId = null; render(); });
  });

  document.querySelectorAll('[data-conrep]').forEach((b) => b.addEventListener('click', () => {
    p.conRepuestos = b.dataset.conrep === 'si';
    render();
  }));

  /* El proceso ya no se elige en un desplegable: sale de EN QUÉ COLUMNA se
     escribió el monto, que es como se lee el documento. Escribir en una
     columna limpia las otras — una línea es de un tipo, no de dos. */
  document.querySelectorAll('[data-venta]').forEach((inp) => {
    inp.addEventListener('input', () => {
      p.linea.proceso = inp.dataset.venta;
      p.linea.precio_unitario = inp.value;
      document.querySelectorAll('[data-venta]').forEach((otro) => {
        if (otro !== inp) otro.value = '';
      });
      // Las horas sólo aplican a mano de obra.
      const h = document.getElementById('l-horas');
      if (h) h.disabled = inp.dataset.venta !== 'reparar';
    });
  });

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
    const campoVenta = document.querySelector('[data-venta="' + p.linea.proceso + '"]');
    const venta = String(campoVenta ? campoVenta.value : '').trim();
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
