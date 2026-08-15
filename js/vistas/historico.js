/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   HISTÓRICO Y CONSOLIDADO.

   🔴 El Histórico NO es un listado: es un BUSCADOR. Al entrar no muestra
      ninguna fila y hay que filtrar por patente, cliente, marca, modelo,
      compañía, estado o rango de fechas. Nuestro borrador lo paginaba como
      tabla, y eso estaba mal: con 2.100 órdenes al año no se navega.

   El original trae 22 columnas: venta y costo abiertos en tres líneas y la
   utilidad por orden.

   🔶 SIN COSTOS NI UTILIDAD (decisión del 13-08-2026): el taller no los
      lleva por orden. Quedan las **tres líneas de venta** —mano de obra,
      repuestos y ToT— más el total. Es lo que se puede sostener con datos
      reales, y es lo que se ocupa: cuánto se vendió por vehículo.

   🔴 Lo que se corrige: el Histórico del original **no tiene columna de
      días**. Una vez entregada la orden el contador desaparece, y con él la
      posibilidad de saber si se cumplió la meta de 15 días. Acá los tres
      relojes sobreviven a la entrega — es la otra mitad del arreglo.

   ⚠️ `ToT` se deduce que son trabajos a terceros, por su correspondencia con
      el bloque `Externos` del presupuesto y con la pantalla `Valorizar TOT`
      de Bodega. **Es una deducción**, y está rotulada como tal. Pregunta 5.
   ──────────────────────────────────────────────────────────────────────── */

function historicoEstado() {
  ui.historico = ui.historico || {};
  const h = ui.historico;
  if (h.patente === undefined) {
    h.patente = ''; h.cliente = ''; h.compania_id = ''; h.estado = '';
    h.desde = ''; h.hasta = ''; h.pagina = 1; h.porPagina = 30; h.buscado = false;
  }
  return h;
}

/* La venta abierta por proceso: mano de obra, repuestos y ToT. Son las tres
   columnas de dinero que quedan del Histórico real. */
function plataDe(o) {
  const z = { ventaMO: 0, ventaRep: 0, ventaToT: 0 };
  o.presupuestos.forEach((p) => p.lineas.forEach((l) => {
    const venta = (l.cantidad || 1) * (l.precio_unitario || 0);
    if (l.proceso === 'reparar') z.ventaMO += venta;
    else if (l.proceso === 'cambio') z.ventaRep += venta;
    else z.ventaToT += venta;
  }));
  z.ventaTotal = z.ventaMO + z.ventaRep + z.ventaToT;
  return z;
}

function vHistorico() {
  const h = historicoEstado();
  const hayFiltro = !!(h.patente || h.cliente || h.compania_id || h.estado || h.desde || h.hasta);
  const universo = Modelo.historico({ todo: true });

  const filtro = { patente: h.patente, cliente: h.cliente, compania_id: h.compania_id,
    estado: h.estado };
  if (h.desde) { const [a, m, d] = h.desde.split('-').map(Number); filtro.desde = new Date(a, m - 1, d); }
  if (h.hasta) { const [a, m, d] = h.hasta.split('-').map(Number); filtro.hasta = new Date(a, m - 1, d, 23, 59); }

  const todas = hayFiltro ? Modelo.historico(filtro) : [];
  const totalPag = Math.max(1, Math.ceil(todas.length / h.porPagina));
  if (h.pagina > totalPag) h.pagina = totalPag;
  const desde = (h.pagina - 1) * h.porPagina;
  const pagina = todas.slice(desde, desde + h.porPagina);

  const suma = todas.reduce((s, o) => ({ venta: s.venta + plataDe(o).ventaTotal }), { venta: 0 });

  return `
  <div class="indicadores">
    <div class="ind"><div class="rot">Entregados en la demostración</div><div class="val">${universo.length}</div>
      <div class="sub">El buscador no los lista: hay que filtrar</div></div>
    <div class="ind"><div class="rot">Ciclo promedio</div>
      <div class="val">${universo.length ? Math.round(universo.reduce((s, o) => s + o.diasTotales, 0) / universo.length) : 0}</div>
      <div class="sub">días totales, ingreso a entrega</div></div>
    <div class="ind"><div class="rot">Reparación promedio</div>
      <div class="val">${universo.length ? Math.round(universo.reduce((s, o) => s + o.diasReparacion, 0) / universo.length) : 0}</div>
      <div class="sub">🔴 el original pierde este dato al entregar</div></div>
    <div class="ind"><div class="rot">Venta del filtro</div><div class="val" style="font-size:20px">${fMonto(suma.venta)}</div>
      <div class="sub">De las ${todas.length} órdenes que salieron</div></div>
  </div>

  <div class="panel">
    <div class="cab"><div><h2>${ico('historico', 'g')}Registro Histórico DyP</h2>
      <div class="desc">Es un buscador: sin filtro no muestra nada, igual que el original</div></div></div>
    <div class="cuerpo">
      <div class="rejilla-campos">
        <div class="campo"><label>Patente</label><input id="h-patente" value="${esc(h.patente)}"></div>
        <div class="campo"><label>Cliente</label><input id="h-cliente" value="${esc(h.cliente)}"></div>
        <div class="campo"><label>Compañía</label>
          <select id="h-compania"><option value="">Todas</option>${Modelo.catalogo('compania').map((c) =>
            '<option value="' + esc(c.id) + '"' + (h.compania_id === c.id ? ' selected' : '') + '>' +
            esc(c.nombre) + '</option>').join('')}</select></div>
        <div class="campo"><label>Estado</label>
          <select id="h-estado"><option value="">Todos</option>${Modelo.catalogo('estado')
            .filter((e) => e.es_final).map((e) => '<option value="' + esc(e.codigo) + '"' +
            (h.estado === e.codigo ? ' selected' : '') + '>' + esc(e.nombre) + '</option>').join('')}</select>
          <span class="ayuda">Los cinco marcados "Estado final", igual que el original</span></div>
        <div class="campo"><label>Desde</label><input type="date" id="h-desde" value="${esc(h.desde)}"></div>
        <div class="campo"><label>Hasta</label><input type="date" id="h-hasta" value="${esc(h.hasta)}"></div>
        <div class="campo"><label>&nbsp;</label>
          <span style="display:flex;gap:6px"><button class="btn" id="h-buscar">Buscar</button>
          <button class="btn secundario" id="h-limpiar">Limpiar</button></span></div>
      </div>
    </div>

    <div class="grid-envoltorio"><table class="grid">
      <thead><tr>
        <th>OT</th><th title="Cantidad de repuestos">Qty Rep</th><th>Patente</th><th>Cliente</th>
        <th>Marca</th><th>Modelo</th><th>Color</th><th>Ingreso</th><th>Tipo</th><th>Estado</th>
        <th>Fecha Entrega</th>
        <th title="El original NO tiene esta columna: al entregar, el contador desaparece">Días tot.</th>
        <th title="Tampoco existe allá">Reparación</th>
        <th>Venta MO</th><th>Venta Rep</th><th title="Deducción: trabajos a terceros. Pregunta 5">Venta ToT</th><th>Venta Total</th>
      </tr></thead>
      <tbody>${pagina.length ? pagina.map((o) => {
        const z = plataDe(o);
        return '<tr class="fila"><td class="num"><strong>' + o.numeroOT + '</strong></td>' +
          '<td class="num">' + o.repuestos.length + '</td>' +
          '<td><span class="patente">' + esc(o.patente) + '</span></td>' +
          '<td>' + esc(o.cliente) + '</td>' +
          '<td>' + esc(o.marca || '—') + '</td><td>' + esc(o.modelo || '—') + '</td>' +
          '<td>' + esc(o.color || '—') + '</td>' +
          '<td class="num">' + fCorta(o.fechaIngreso) + '</td>' +
          '<td>' + esc(o.origenIngresoNombre || '—') + '</td>' +
          '<td><span class="et ' + esc(o.estadoClase) + '">' + esc(o.estadoNombre) + '</span></td>' +
          '<td class="num">' + fCorta(o.fechaEntrega) + '</td>' +
          '<td class="num"><strong>' + o.diasTotales + '</strong></td>' +
          '<td class="num" style="color:' + (o.diasReparacion > Modelo.metricas().metaDias ? 'var(--ambar)' : 'inherit') + '">' +
            o.diasReparacion + '</td>' +
          '<td class="num">' + fMonto(z.ventaMO) + '</td><td class="num">' + fMonto(z.ventaRep) + '</td>' +
          '<td class="num">' + fMonto(z.ventaToT) + '</td>' +
          '<td class="num"><strong>' + fMonto(z.ventaTotal) + '</strong></td></tr>';
      }).join('') : '<tr><td colspan="17"><div class="vacio"><div class="titulo">' +
        (hayFiltro ? 'Sin resultados' : 'Escribe un filtro y aprieta Buscar') + '</div>' +
        (hayFiltro ? '' : '<div class="texto">El Histórico es un buscador, no un listado. ' +
          'Así es el sistema actual y así se replica.</div>') + '</div></td></tr>'}</tbody>
      ${todas.length ? '<tfoot><tr><td colspan="16" style="text-align:right">Venta de las ' +
        todas.length + ' órdenes filtradas</td>' +
        '<td class="num"><strong>' + fMonto(suma.venta) + '</strong></td></tr></tfoot>' : ''}
    </table></div>
    ${todas.length > h.porPagina ? `<div class="pie-grid">
      <div class="info">Mostrando ${desde + 1}–${Math.min(desde + h.porPagina, todas.length)} de ${todas.length}</div>
      <div class="ctrl">
        <button class="btn secundario" id="h-ant" ${h.pagina <= 1 ? 'disabled' : ''}>Anterior</button>
        <span class="info">Página ${h.pagina} de ${totalPag}</span>
        <button class="btn secundario" id="h-sig" ${h.pagina >= totalPag ? 'disabled' : ''}>Siguiente</button>
      </div></div>` : ''}
  </div>
`;
}

function pHistorico() {
  const h = historicoEstado();
  const leer = () => {
    h.patente = (document.getElementById('h-patente') || {}).value || '';
    h.cliente = (document.getElementById('h-cliente') || {}).value || '';
    h.compania_id = (document.getElementById('h-compania') || {}).value || '';
    h.estado = (document.getElementById('h-estado') || {}).value || '';
    h.desde = (document.getElementById('h-desde') || {}).value || '';
    h.hasta = (document.getElementById('h-hasta') || {}).value || '';
    h.pagina = 1;
  };
  const buscar = document.getElementById('h-buscar');
  if (buscar) buscar.addEventListener('click', () => { leer(); render(); });
  const limpiar = document.getElementById('h-limpiar');
  if (limpiar) limpiar.addEventListener('click', () => {
    h.patente = h.cliente = h.compania_id = h.estado = h.desde = h.hasta = '';
    h.pagina = 1; render();
  });
  ['h-patente', 'h-cliente'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { leer(); render(); } });
  });
  const ant = document.getElementById('h-ant'), sig = document.getElementById('h-sig');
  if (ant) ant.addEventListener('click', () => { h.pagina--; render(); });
  if (sig) sig.addEventListener('click', () => { h.pagina++; render(); });

  document.querySelectorAll('tbody tr.fila').forEach((tr, i) => {
    tr.addEventListener('dblclick', () => {
      const n = tr.querySelector('td strong');
      if (n) abrirFicha(n.textContent.trim());
    });
    tr.title = 'Doble clic para abrir la orden';
  });
}

/* ── Consolidado ───────────────────────────────────────────────────────── */

function vConsolidado() {
  const filas = Modelo.torre();
  const suma = filas.reduce((s, o) => ({ venta: s.venta + plataDe(o).ventaTotal }), { venta: 0 });
  const m = Modelo.metricas();
  const entregadas = Modelo.historico({ todo: true });
  const enPlazo = entregadas.filter((o) => o.diasReparacion <= m.metaDias).length;

  return `
  <div class="indicadores">
    <div class="ind"><div class="rot">Órdenes en la torre</div><div class="val">${filas.length}</div>
      <div class="sub">${m.enTaller} adentro · ${m.fueraDeTaller} afuera</div></div>
    <div class="ind"><div class="rot">Venta parada en el taller</div><div class="val" style="font-size:20px">${fMonto(suma.venta)}</div>
      <div class="sub">Presupuestado y sin entregar</div></div>
    <div class="ind ${filas.filter((o) => !o.presupuestos.length).length ? 'alerta' : ''}">
      <div class="rot">Sin presupuesto</div>
      <div class="val">${filas.filter((o) => !o.presupuestos.length).length}</div>
      <div class="sub">Órdenes que todavía no se pueden cobrar</div></div>
    <div class="ind ${enPlazo / Math.max(1, entregadas.length) > 0.6 ? '' : 'alerta'}">
      <div class="rot">Cumplimiento de la meta</div>
      <div class="val">${entregadas.length ? Math.round(enPlazo / entregadas.length * 100) : 0}%</div>
      <div class="sub">${enPlazo} de ${entregadas.length} entregadas bajo ${m.metaDias} días</div></div>
  </div>

  <div class="panel">
    <div class="cab"><div><h2>${ico('consolidado', 'g')}Consolidado</h2>
      <div class="desc">Las 17 columnas de la Torre más el dinero</div></div>
      <button class="btn secundario" data-pendiente="Exportar el consolidado|6|la exportación es un permiso aparte y queda en la traza">Exportar</button></div>
    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th>OT</th><th>OR</th><th>Patente</th><th>Siniestro</th><th>Cliente</th><th>Compañia</th>
        <th>Marca</th><th>Modelo</th><th>Ingreso</th><th>Tipo</th><th>Días</th><th>Estado</th><th>Etapa</th>
        <th>Venta</th><th>Rep Pend.</th><th>Rep OK.</th></tr></thead>
      <tbody>${filas.slice(0, 60).map((o) => {
        const z = plataDe(o);
        return '<tr class="fila"><td class="num"><strong>' + o.numeroOT + '</strong></td>' +
          '<td class="num">' + esc(o.presupuestos.length ? o.presupuestos[0].numeroOR : '—') + '</td>' +
          '<td><span class="patente">' + esc(o.patente) + '</span></td>' +
          '<td class="num">' + esc(o.siniestro || '—') + '</td>' +
          '<td>' + esc(o.cliente) + '</td><td>' + esc(o.compania) + '</td>' +
          '<td>' + esc(o.marca || '—') + '</td><td>' + esc(o.modelo || '—') + '</td>' +
          '<td class="num">' + fCorta(o.fechaIngreso) + '</td>' +
          '<td>' + esc(o.origenIngresoNombre || '—') + '</td>' +
          '<td class="num">' + o.diasKpi + '</td>' +
          '<td><span class="et ' + esc(o.estadoClase) + '">' + esc(o.estadoNombre) + '</span></td>' +
          '<td>' + esc(o.etapaNombre) + '</td>' +
          '<td class="num"><strong>' + fMonto(z.ventaTotal) + '</strong></td>' +
          '<td class="num">' + o.repuestos.filter((r) => !r.fechaBodega).length + '</td>' +
          '<td class="num">' + o.repuestos.filter((r) => r.fechaBodega).length + '</td></tr>';
      }).join('')}</tbody>
      <tfoot><tr><td colspan="13" style="text-align:right">Venta parada en las ${filas.length} órdenes vivas</td>
        <td class="num"><strong>${fMonto(suma.venta)}</strong></td><td colspan="2"></td></tr></tfoot>
    </table></div>
    <div class="pie-grid"><div class="info">Mostrando ${Math.min(60, filas.length)} de ${filas.length}</div></div>
  </div>`;
}

function pConsolidado() {
  document.querySelectorAll('[data-pendiente]').forEach((b) => b.addEventListener('click', () => {
    const [rot, tanda, nota] = b.dataset.pendiente.split('|');
    avisar({ ok: false, motivo: '"' + rot + '" se construye en la tanda ' + tanda + (nota ? ' — ' + nota : '') + '.' });
  }));
  document.querySelectorAll('tbody tr.fila').forEach((tr) => {
    tr.addEventListener('dblclick', () => {
      const n = tr.querySelector('td strong');
      if (n) abrirFicha(n.textContent.trim());
    });
  });
}
