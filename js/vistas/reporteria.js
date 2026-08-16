/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   REPORTERÍA — la tercera hoja del Histórico.

   Pedido de Marco el 16-08-2026: *"me falta un panel de reportería BI, que se
   vean gráficos, estadísticas, tablas dinámicas"*.

   Tres cosas que conviene tener claras antes de mirarlo:

   1 · **Los gráficos están dibujados acá, en SVG.** Sin Chart.js, sin D3 y sin
       CDN. No es purismo: el modelo borrador tiene que abrirse en el mesón del
       taller aunque no haya internet, y una librería traída de afuera lo
       rompe justo el día de la demostración. Son barras, barras horizontales y
       una línea — que es lo que estos datos necesitan.

   2 · **La tabla dinámica es de verdad dinámica**: se elige qué agrupa las
       filas, qué abre las columnas y qué se suma adentro. No es una tabla fija
       con nombre bonito.

   3 · **Todo sale del mismo dato que el resto del sistema.** No hay una base
       de reportes aparte que alguien tenga que refrescar de noche: se calcula
       al mirarlo. Por eso no puede quedar viejo, y por eso también es honesto
       decir que con 2.100 órdenes al año esto se calcula rápido, pero que si
       algún día son 50.000 hay que precalcular.

   🔶 Para qué sirve de verdad, y es lo que hay que mostrarle al dueño: el
      gráfico de **días de reparación por mes contra la meta de 15** es la
      única vista del sistema donde se ve si el taller está cumpliendo o no.
      El sistema actual no la puede tener: al entregar, pierde el contador.
   ──────────────────────────────────────────────────────────────────────── */

function repEstado() {
  ui.reporteria = ui.reporteria || {
    desde: '', hasta: '', compania_id: '',
    // La tabla dinámica: qué agrupa, qué abre y qué se suma.
    filas: 'compania', columnas: '', medida: 'ordenes'
  };
  return ui.reporteria;
}

const REP_DIMENSIONES = [
  { id: 'compania', rot: 'Compañía',       de: (o) => o.compania === '—' ? 'Particular' : o.compania },
  { id: 'marca',    rot: 'Marca',          de: (o) => o.marca || 'Sin marca' },
  { id: 'modelo',   rot: 'Modelo',         de: (o) => o.modelo || 'Sin modelo' },
  { id: 'estado',   rot: 'Estado de cierre', de: (o) => o.estadoNombre },
  { id: 'tipo',     rot: 'Tipo de ingreso', de: (o) => o.origenIngresoNombre || 'Sin tipo' },
  { id: 'cliente',  rot: 'Cliente',        de: (o) => o.cliente },
  { id: 'mes',      rot: 'Mes de entrega', de: (o) => repMes(o.fechaEntrega) },
  { id: 'meta',     rot: 'Cumplió la meta', de: (o) =>
      o.diasReparacion <= Modelo.metricas().metaDias ? 'Dentro de la meta' : 'Sobre la meta' }
];

/* ⚠️ Los formatos van ENVUELTOS en una función, no puestos por referencia.
   `fmt: fMonto` parece más limpio y revienta: `fMonto` vive en `app.js`, que se
   carga al final —tiene que ser el último, porque al cargar ya pinta—, así que
   al evaluar esta constante todavía no existe. El error se come el resto del
   archivo y la pantalla queda en blanco sin decir por qué. Envuelto, la
   búsqueda del nombre ocurre recién cuando se usa. */
const REP_MEDIDAS = [
  { id: 'ordenes',  rot: 'Órdenes',              valor: () => 1,                         fmt: (n) => String(n),  suma: true },
  { id: 'venta',    rot: 'Venta total',          valor: (o) => plataDe(o).ventaTotal,    fmt: (n) => fMonto(n),  suma: true },
  { id: 'ventaProm', rot: 'Venta promedio',      valor: (o) => plataDe(o).ventaTotal,    fmt: (n) => fMonto(n),  suma: false },
  { id: 'dias',     rot: 'Días totales (prom.)', valor: (o) => o.diasTotales,            fmt: (n) => Math.round(n) + ' d', suma: false },
  { id: 'reparacion', rot: 'Días de reparación (prom.)', valor: (o) => o.diasReparacion, fmt: (n) => Math.round(n) + ' d', suma: false }
];

const REP_MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function repMes(f) {
  if (!f) return 'Sin fecha';
  return f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0');
}
const repMesCorto = (clave) => {
  const p = String(clave).split('-');
  return p.length === 2 ? REP_MESES[Number(p[1]) - 1] + ' ' + p[0].slice(2) : clave;
};

/* El universo del panel: las órdenes ya entregadas, recortadas por el período
   y la compañía. Se usa el mismo `Modelo.historico` que el buscador para que
   los dos digan lo mismo. */
function repUniverso() {
  const r = repEstado();
  const f = { todo: true };
  let lista = Modelo.historico(f);
  if (r.desde) { const [a, m, d] = r.desde.split('-').map(Number); const x = new Date(a, m - 1, d);
    lista = lista.filter((o) => o.fechaEntrega && o.fechaEntrega >= x); }
  if (r.hasta) { const [a, m, d] = r.hasta.split('-').map(Number); const x = new Date(a, m - 1, d, 23, 59);
    lista = lista.filter((o) => o.fechaEntrega && o.fechaEntrega <= x); }
  if (r.compania_id) lista = lista.filter((o) => o.companiaId === r.compania_id);
  return lista;
}

/* ═══════════ LOS GRÁFICOS, EN SVG ═══════════
   Todos comparten la misma idea: una caja de 100 unidades de alto, la escala
   sale del máximo de los datos, y el texto va en la propia caja para que se
   pueda imprimir sin que se descuadre. */

function svgBarras(datos, op) {
  const o = op || {};
  const max = Math.max(1, ...datos.map((d) => d.v));
  const n = datos.length || 1;
  const W = 720, H = 200, PIE = 26, TOPE = 14;
  const ancho = W / n;
  const alto = (v) => (H - PIE - TOPE) * (v / max);

  return '<svg class="graf" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
    // Tres líneas de referencia. Sin ejes con números: el valor va sobre la barra.
    [0.25, 0.5, 0.75].map((p) => '<line x1="0" x2="' + W + '" y1="' + (TOPE + (H - PIE - TOPE) * p) +
      '" y2="' + (TOPE + (H - PIE - TOPE) * p) + '" class="graf-guia"/>').join('') +
    datos.map((d, i) => {
      const h = alto(d.v);
      const x = i * ancho + ancho * 0.18;
      const w = ancho * 0.64;
      const y = H - PIE - h;
      return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + Math.max(h, 1) +
        '" class="graf-barra' + (d.alerta ? ' alerta' : '') + '"><title>' + esc(d.k + ': ' + d.rot) + '</title></rect>' +
        (n <= 24 ? '<text x="' + (x + w / 2) + '" y="' + (y - 3) + '" class="graf-valor">' +
          esc(d.corto || d.rot) + '</text>' : '') +
        '<text x="' + (x + w / 2) + '" y="' + (H - 8) + '" class="graf-eje">' + esc(d.etiqueta || d.k) + '</text>';
    }).join('') +
    (o.meta ? '<line x1="0" x2="' + W + '" y1="' + (H - PIE - alto(o.meta)) + '" y2="' +
      (H - PIE - alto(o.meta)) + '" class="graf-meta"/>' +
      '<text x="6" y="' + (H - PIE - alto(o.meta) - 4) + '" class="graf-meta-rot">meta ' + o.meta + ' días</text>' : '') +
    '</svg>';
}

function svgBarrasH(datos) {
  const max = Math.max(1, ...datos.map((d) => d.v));
  return '<div class="barrasH">' + datos.map((d) => {
    const p = Math.round((d.v / max) * 100);
    return '<div class="fila-barra"><span class="rot" title="' + esc(d.k) + '">' + esc(d.k) + '</span>' +
      '<span class="pista"><span class="relleno" style="width:' + p + '%"></span></span>' +
      '<span class="val">' + esc(d.rot) + '</span></div>';
  }).join('') + '</div>';
}

/* ═══════════ LA TABLA DINÁMICA ═══════════
   Agrupa por una dimensión, opcionalmente abre por otra, y suma o promedia la
   medida elegida. Los totales van en el margen, como en cualquier planilla. */
function repDinamica(lista) {
  const r = repEstado();
  const dimF = REP_DIMENSIONES.find((d) => d.id === r.filas) || REP_DIMENSIONES[0];
  const dimC = r.columnas ? REP_DIMENSIONES.find((d) => d.id === r.columnas) : null;
  const med = REP_MEDIDAS.find((m) => m.id === r.medida) || REP_MEDIDAS[0];

  const celdas = new Map();   // "fila|columna" → { s: suma, n: cuenta }
  const filas = new Map(), columnas = new Map();
  const acumular = (mapa, k, v) => {
    const c = mapa.get(k) || { s: 0, n: 0 };
    c.s += v; c.n++; mapa.set(k, c);
  };

  lista.forEach((o) => {
    const f = dimF.de(o);
    const c = dimC ? dimC.de(o) : '—';
    const v = med.valor(o);
    acumular(celdas, f + '|' + c, v);
    acumular(filas, f, v);
    acumular(columnas, c, v);
  });

  const valor = (c) => (!c || !c.n) ? null : (med.suma ? c.s : c.s / c.n);
  const orden = (m) => [...m.entries()].sort((a, b) => {
    // Los meses se ordenan por fecha; el resto, por el valor de mayor a menor.
    if (dimF.id === 'mes' || dimC && dimC.id === 'mes') return String(a[0]).localeCompare(String(b[0]));
    return (valor(b[1]) || 0) - (valor(a[1]) || 0);
  });

  return { dimF, dimC, med, celdas, valor,
    filasOrd: orden(filas).slice(0, 40), columnasOrd: dimC ? orden(columnas).slice(0, 12) : [['—', null]],
    totalGeneral: valor([...lista].reduce((acc, o) => {
      acc.s += med.valor(o); acc.n++; return acc;
    }, { s: 0, n: 0 })) };
}

function vReporteria() {
  const r = repEstado();
  const lista = repUniverso();
  const meta = Modelo.metricas().metaDias;

  const prom = (f) => lista.length ? lista.reduce((s, o) => s + f(o), 0) / lista.length : 0;
  const venta = lista.reduce((s, o) => s + plataDe(o).ventaTotal, 0);
  const dentro = lista.filter((o) => o.diasReparacion <= meta).length;

  // ── Entregas por mes, con el promedio de reparación de cada mes ──
  const porMes = new Map();
  lista.forEach((o) => {
    const k = repMes(o.fechaEntrega);
    const c = porMes.get(k) || { n: 0, dias: 0 };
    c.n++; c.dias += o.diasReparacion; porMes.set(k, c);
  });
  const meses = [...porMes.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))).slice(-12);

  const entregasMes = meses.map(([k, c]) => ({ k, v: c.n, rot: c.n + ' entregas',
    corto: String(c.n), etiqueta: repMesCorto(k) }));
  const diasMes = meses.map(([k, c]) => {
    const d = Math.round(c.dias / c.n);
    return { k, v: d, rot: d + ' días', corto: String(d), etiqueta: repMesCorto(k), alerta: d > meta };
  });

  const top = (dim, n) => {
    const m = new Map();
    lista.forEach((o) => { const k = dim.de(o); m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
      .map(([k, v]) => ({ k, v, rot: v + (v === 1 ? ' orden' : ' órdenes') }));
  };
  const dimDe = (id) => REP_DIMENSIONES.find((d) => d.id === id);

  const ventaPorCompania = (() => {
    const m = new Map();
    lista.forEach((o) => {
      const k = dimDe('compania').de(o);
      m.set(k, (m.get(k) || 0) + plataDe(o).ventaTotal);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ k, v, rot: fMonto(v) }));
  })();

  const d = repDinamica(lista);
  const selDim = (id, valorActual, conVacio) => '<select id="' + id + '">' +
    (conVacio ? '<option value="">Sin abrir</option>' : '') +
    REP_DIMENSIONES.map((x) => '<option value="' + x.id + '"' +
      (valorActual === x.id ? ' selected' : '') + '>' + esc(x.rot) + '</option>').join('') + '</select>';

  return `
  <button class="btn volver" id="rep-volver"><span class="flecha-atras">&#8592;</span>
    Volver al buscador del histórico</button>

  <div class="panel">
    <div class="cab"><div><h2>${ico('consolidado', 'g')}Reportería</h2>
      <div class="desc">Sobre las ${lista.length} órdenes entregadas del período. Todo se calcula
        al mirarlo: no hay un reporte que alguien tenga que refrescar</div></div>
      <button class="btn secundario" id="rep-pdf">${ico('imprimir')}PDF</button></div>
    <div class="cuerpo">
      <div class="rejilla-campos">
        <div class="campo"><label>Entregadas desde</label>
          <input type="date" id="rep-desde" value="${esc(r.desde)}"></div>
        <div class="campo"><label>Hasta</label>
          <input type="date" id="rep-hasta" value="${esc(r.hasta)}"></div>
        <div class="campo"><label>Compañía</label>
          <select id="rep-compania"><option value="">Todas</option>${Modelo.catalogo('compania')
            .map((c) => '<option value="' + esc(c.id) + '"' + (r.compania_id === c.id ? ' selected' : '') +
            '>' + esc(c.nombre) + '</option>').join('')}</select></div>
        <div class="campo"><label>&nbsp;</label>
          <button class="btn secundario" id="rep-limpiar">Todo el período</button></div>
      </div>
    </div>
  </div>

  <div class="indicadores" style="margin-top:11px">
    <div class="ind"><div class="rot">Órdenes entregadas</div><div class="val">${lista.length}</div>
      <div class="sub">en el período elegido</div></div>
    <div class="ind"><div class="rot">Venta</div><div class="val" style="font-size:20px">${fMonto(venta)}</div>
      <div class="sub">${lista.length ? fMonto(venta / lista.length) : '—'} por orden</div></div>
    <div class="ind"><div class="rot">Reparación promedio</div>
      <div class="val" style="color:${prom((o) => o.diasReparacion) > meta ? 'var(--rojo)' : 'var(--verde)'}">
        ${Math.round(prom((o) => o.diasReparacion))}</div>
      <div class="sub">contra una meta de ${meta} días</div></div>
    <div class="ind"><div class="rot">Dentro de la meta</div>
      <div class="val">${lista.length ? Math.round((dentro / lista.length) * 100) : 0}%</div>
      <div class="sub">${dentro} de ${lista.length} órdenes</div></div>
  </div>

  <div class="panel" style="margin-top:11px">
    <div class="cab"><div><h2>Días de reparación por mes</h2>
      <div class="desc">🔴 La vista que el sistema actual no puede tener: al entregar pierde el
        contador. La barra roja es un mes que se pasó de la meta</div></div></div>
    <div class="cuerpo">${meses.length
      ? svgBarras(diasMes, { meta })
      : '<div class="vacio"><div class="titulo">Sin entregas en el período</div></div>'}</div>
  </div>

  <div class="panel" style="margin-top:11px">
    <div class="cab"><div><h2>Entregas por mes</h2>
      <div class="desc">Cuántos vehículos salieron cada mes</div></div></div>
    <div class="cuerpo">${meses.length
      ? svgBarras(entregasMes)
      : '<div class="vacio"><div class="titulo">Sin entregas en el período</div></div>'}</div>
  </div>

  <div class="ficha-rejilla" style="margin-top:11px">
    <div class="panel">
      <div class="cab"><div><h2>Modelos más siniestrados</h2></div></div>
      <div class="cuerpo">${svgBarrasH(top(dimDe('modelo'), 10))}</div>
    </div>
    <div class="panel">
      <div class="cab"><div><h2>Venta por compañía</h2></div></div>
      <div class="cuerpo">${svgBarrasH(ventaPorCompania)}</div>
    </div>
    <div class="panel">
      <div class="cab"><div><h2>Clientes con más vehículos</h2></div></div>
      <div class="cuerpo">${svgBarrasH(top(dimDe('cliente'), 10))}</div>
    </div>
    <div class="panel">
      <div class="cab"><div><h2>Marcas</h2></div></div>
      <div class="cuerpo">${svgBarrasH(top(dimDe('marca'), 10))}</div>
    </div>
  </div>

  <div class="panel" style="margin-top:11px">
    <div class="cab"><div><h2>${ico('consolidado', 'g')}Tabla dinámica</h2>
      <div class="desc">Se elige qué agrupa las filas, qué abre las columnas y qué se suma adentro</div></div></div>
    <div class="cuerpo">
      <div class="rejilla-campos">
        <div class="campo"><label>Agrupar filas por</label>${selDim('rep-filas', r.filas)}</div>
        <div class="campo"><label>Abrir columnas por</label>${selDim('rep-columnas', r.columnas, true)}</div>
        <div class="campo"><label>Medida</label>
          <select id="rep-medida">${REP_MEDIDAS.map((m) => '<option value="' + m.id + '"' +
            (r.medida === m.id ? ' selected' : '') + '>' + esc(m.rot) + '</option>').join('')}</select>
          <span class="ayuda">${d.med.suma ? 'Se suma' : 'Se promedia'} dentro de cada celda</span></div>
      </div>
      ${repTablaDinamica(d)}
    </div>
  </div>`;
}

function repTablaDinamica(d) {
  if (!d.filasOrd.length) {
    return '<div class="vacio" style="margin-top:11px"><div class="titulo">Sin datos en el período</div></div>';
  }
  const cel = (f, c) => {
    const v = d.valor(d.celdas.get(f + '|' + c));
    return v === null ? '<span style="color:var(--gris-2)">—</span>' : d.med.fmt(v);
  };

  return '<div class="grid-envoltorio" style="margin-top:11px"><table class="grid">' +
    '<thead><tr><th>' + esc(d.dimF.rot) + '</th>' +
    (d.dimC ? d.columnasOrd.map(([c]) => '<th class="num">' +
      esc(d.dimC.id === 'mes' ? repMesCorto(c) : c) + '</th>').join('') : '') +
    '<th class="num">' + esc(d.med.rot) + '</th></tr></thead><tbody>' +
    d.filasOrd.map(([f, tot]) => '<tr><td>' +
      esc(d.dimF.id === 'mes' ? repMesCorto(f) : f) + '</td>' +
      (d.dimC ? d.columnasOrd.map(([c]) => '<td class="num">' + cel(f, c) + '</td>').join('') : '') +
      '<td class="num"><strong>' + d.med.fmt(d.valor(tot)) + '</strong></td></tr>').join('') +
    '</tbody><tfoot><tr><td><strong>Total</strong></td>' +
    (d.dimC ? d.columnasOrd.map(() => '<td></td>').join('') : '') +
    '<td class="num"><strong>' + (d.totalGeneral === null ? '—' : d.med.fmt(d.totalGeneral)) +
    '</strong></td></tr></tfoot></table></div>' +
    (d.med.suma ? '' : '<div class="pie-nota">Es un <strong>promedio</strong>: el total de abajo ' +
      'promedia todas las órdenes del período, no la suma de la columna. Sumar promedios da un ' +
      'número que no significa nada.</div>');
}

function pReporteria() {
  const r = repEstado();
  const volver = document.getElementById('rep-volver');
  if (volver) volver.addEventListener('click', () => {
    historicoEstado().vista = 'buscador'; render();
  });

  const leer = () => {
    r.desde = (document.getElementById('rep-desde') || {}).value || '';
    r.hasta = (document.getElementById('rep-hasta') || {}).value || '';
    r.compania_id = (document.getElementById('rep-compania') || {}).value || '';
    r.filas = (document.getElementById('rep-filas') || {}).value || 'compania';
    r.columnas = (document.getElementById('rep-columnas') || {}).value || '';
    r.medida = (document.getElementById('rep-medida') || {}).value || 'ordenes';
  };
  ['rep-desde', 'rep-hasta', 'rep-compania', 'rep-filas', 'rep-columnas', 'rep-medida']
    .forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => { leer(); render(); });
    });

  const limpiar = document.getElementById('rep-limpiar');
  if (limpiar) limpiar.addEventListener('click', () => {
    r.desde = r.hasta = r.compania_id = ''; render();
  });

  const pdf = document.getElementById('rep-pdf');
  if (pdf) pdf.addEventListener('click', () => mostrarImpreso(impresoReporteria(), 'Reportería'));
}

/* El PDF de la reportería. Los gráficos van tal cual —son SVG, y el SVG se
   imprime nítido a cualquier tamaño, que es la otra razón para dibujarlos acá
   en vez de traer una librería que pinta sobre un lienzo de píxeles. */
function impresoReporteria() {
  const lista = repUniverso();
  const d = repDinamica(lista);
  const meta = Modelo.metricas().metaDias;
  const venta = lista.reduce((s, o) => s + plataDe(o).ventaTotal, 0);
  const dentro = lista.filter((o) => o.diasReparacion <= meta).length;
  const r = repEstado();

  const periodo = (r.desde || r.hasta)
    ? (r.desde || 'el inicio') + ' a ' + (r.hasta || 'hoy')
    : 'Todo el período';

  const cel = (f, c) => {
    const v = d.valor(d.celdas.get(f + '|' + c));
    return v === null ? '—' : d.med.fmt(v);
  };

  return `
  <div class="cab-doc">
    <div>${logoImpreso()}
      <div style="font-size:10px;color:#555">Desabolladura y pintura</div>
      <div style="margin-top:5px;font-size:13px;font-weight:700">Reportería</div></div>
    <div class="der"><div><strong>${lista.length} órdenes entregadas</strong></div>
      <div>${esc(periodo)}</div><div>Emitido ${fFecha(HOY)}</div></div>
  </div>

  <h2>Indicadores</h2>
  <div class="rej">
    ${campoImpreso('Órdenes entregadas', lista.length)}
    ${campoImpreso('Venta', fMonto(venta))}
    ${campoImpreso('Reparación promedio', lista.length
      ? Math.round(lista.reduce((s, o) => s + o.diasReparacion, 0) / lista.length) + ' días' : '—')}
    ${campoImpreso('Dentro de la meta de ' + meta + ' días',
      (lista.length ? Math.round((dentro / lista.length) * 100) : 0) + '%')}
  </div>

  <h2>${esc(d.med.rot)} por ${esc(d.dimF.rot.toLowerCase())}${
    d.dimC ? ', abierto por ' + esc(d.dimC.rot.toLowerCase()) : ''}</h2>
  <table><thead><tr><th>${esc(d.dimF.rot)}</th>
    ${d.dimC ? d.columnasOrd.map(([c]) => '<th class="n">' +
      esc(d.dimC.id === 'mes' ? repMesCorto(c) : c) + '</th>').join('') : ''}
    <th class="n">${esc(d.med.rot)}</th></tr></thead><tbody>
    ${d.filasOrd.map(([f, tot]) => '<tr><td>' +
      esc(d.dimF.id === 'mes' ? repMesCorto(f) : f) + '</td>' +
      (d.dimC ? d.columnasOrd.map(([c]) => '<td class="n">' + cel(f, c) + '</td>').join('') : '') +
      '<td class="n"><strong>' + d.med.fmt(d.valor(tot)) + '</strong></td></tr>').join('')}
  </tbody></table>
  ${pieImpreso()}`;
}
