/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   TORRE DE CONTROL — la pantalla de entrada y la que el dueño mira todos los
   días.

   Las DIECISIETE columnas son las del sistema real, en su orden:
     OT · OR · Patente · N° Siniestro · Cliente · Compañia · Marca · Modelo ·
     Color · Ingreso · Tipo · Días · Estado · Etapa · Encargado ·
     Fecha Entrega · Alerta,  más la lupa.
   Nuestro borrador anterior mostraba doce y con otros nombres.

   Tres cosas que se corrigen sin cambiar la forma de la pantalla:

   🔴 `Días`. En el original es UN contador y no mide días en el taller: mide
      días desde el último cambio de estado. Verificado al día exacto en ocho
      órdenes, todas con el evento `'Recibido' a 'Recibido'`. Acá esa columna
      muestra el reloj que Configuración haya elegido, y al lado va el total,
      que nunca se reinicia.

   · `Alerta`. Las letras son la INICIAL del asunto de cada mensaje de
     bitácora: E(nvio) · A(utorizado) · O(tro) · R(epuestos) ·
     C(orrecciones) · P(resupuesto). El orden en que salen no significa nada.

   · `Estado` sale del maestro con su redacción exacta. El original tiene
     cuatro vocabularios distintos para lo mismo.
   ──────────────────────────────────────────────────────────────────────── */

function filtrarTorre() {
  const f = ui.torre;
  const q = f.busqueda.trim().toLowerCase();
  return Modelo.torre().filter((o) => {
    if (f.compania !== 'todas' && o.compania !== f.compania) return false;
    if (f.etapa !== 'todas' && o.etapa !== f.etapa) return false;
    if (f.situacion === 'fuera' && !o.fueraDeTaller) return false;
    if (f.situacion === 'taller' && !o.enTaller) return false;
    if (f.situacion === 'repuesto' && !tieneRepuestoPendiente(o)) return false;
    if (f.situacion === 'sinetapa' && o.etapasAsignadas.length) return false;
    if (f.situacion === 'sobremeta' && !(o.enTaller && o.sobreMeta)) return false;
    if (q) {
      const ors = o.presupuestos.map((p) => p.numeroOR).join(' ');
      const heno = [o.numeroOT, ors, o.patente, o.siniestro, o.cliente, o.marca, o.modelo].join(' ').toLowerCase();
      if (!heno.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => b.fechaIngreso - a.fechaIngreso);
}

function vTorre() {
  const f = ui.torre;
  const m = Modelo.metricas();
  const todas = filtrarTorre();
  const totalPag = Math.max(1, Math.ceil(todas.length / f.porPagina));
  if (f.pagina > totalPag) f.pagina = totalPag;
  const desde = (f.pagina - 1) * f.porPagina;
  const pagina = todas.slice(desde, desde + f.porPagina);

  const kpiNombre = m.kpi === 'estadia_actual' ? 'estadía actual' : 'reparación acumulada';

  return `
  <div class="indicadores">
    <div class="ind"><div class="rot">En la torre de control</div><div class="val">${m.enTorre}</div>
      <div class="sub">${m.enTaller} en taller · ${m.fueraDeTaller} fuera de taller</div></div>
    <div class="ind aviso"><div class="rot">Con repuesto pendiente</div><div class="val">${m.conRepuestoPendiente}</div>
      <div class="sub">${m.repuestosPendientes} piezas sin llegar · <strong>no es lo mismo que estar fuera</strong></div></div>
    <div class="ind"><div class="rot">Sin etapa asignada</div><div class="val">${m.sinEtapa}</div>
      <div class="sub">Van a la pantalla de asignar, no a la de finalizar</div></div>
    <div class="ind alerta"><div class="rot">Sobre la meta</div><div class="val">${m.sobreMeta}</div>
      <div class="sub">Más de ${m.metaDias} días de ${esc(kpiNombre)}</div></div>
    <div class="ind aviso"><div class="rot">Esperando repuesto</div><div class="val" style="font-size:22px">${fMonto(m.valorEsperandoRepuesto)}</div>
      <div class="sub">Presupuestado y sin poder cerrar</div></div>
  </div>

  <div class="panel">
    <div class="cab">
      <div><h2>${ico('torre', 'g')}Torre de control</h2>
        <div class="desc">Las 17 columnas del sistema actual. Un clic despliega el expandible; doble clic abre la orden</div></div>
      <div class="filtros">
        <input type="search" id="q-torre" placeholder="OT, OR, patente, siniestro o cliente" value="${esc(f.busqueda)}">
        <select id="s-compania"><option value="todas">Todas las compañías</option>
          ${COMPANIAS.map((c) => '<option value="' + esc(c.codigo) + '"' + (f.compania === c.codigo ? ' selected' : '') + '>' + esc(c.nombre) + '</option>').join('')}</select>
        <select id="s-etapa"><option value="todas">Todas las etapas</option>
          ${ETAPAS.map((e) => '<option value="' + esc(e.codigo) + '"' + (f.etapa === e.codigo ? ' selected' : '') + '>' + esc(e.nombre) + '</option>').join('')}</select>
      </div>
    </div>
    <div class="cuerpo" style="padding-bottom:0">
      <div class="chips" id="chips-sit">
        ${[['piso', 'Todos'], ['taller', 'En taller'], ['fuera', 'Fuera de taller'],
           ['repuesto', 'Con repuesto pendiente'], ['sinetapa', 'Sin etapa asignada'],
           ['sobremeta', 'Sobre los ' + m.metaDias + ' días']]
          .map(([k, n]) => '<button class="chip' + (f.situacion === k ? ' activo' : '') + '" data-sit="' + k + '">' + esc(n) + '</button>').join('')}
      </div>
    </div>
    <div class="grid-envoltorio">
      <table class="grid">
        <thead><tr>
          <th style="width:26px"></th>
          <th>OT</th><th>OR</th><th>Patente</th><th>N° Siniestro</th><th>Cliente</th>
          <th>Compañia</th><th>Marca</th><th>Modelo</th><th>Color</th><th>Ingreso</th><th>Tipo</th>
          <th title="El reloj elegido en Configuración: ${esc(kpiNombre)}. En el original hay uno solo y se reinicia al regrabar el estado.">Días</th>
          <th title="Días desde el ingreso. Nunca se reinicia.">Días tot.</th>
          <th>Estado</th><th>Etapa</th><th>Encargado</th><th>Fecha Entrega</th>
          <th title="La inicial del asunto de cada mensaje de bitácora">Alerta</th>
        </tr></thead>
        <tbody>${pagina.length ? pagina.map(filaTorre).join('') :
          '<tr><td colspan="19"><div class="vacio"><div class="titulo">Sin resultados</div>' +
          '<div class="texto">Ninguna orden coincide con el filtro.</div></div></td></tr>'}</tbody>
      </table>
    </div>
    <div class="pie-grid">
      <div class="info">Mostrando ${todas.length ? desde + 1 : 0}–${Math.min(desde + f.porPagina, todas.length)} de ${todas.length}</div>
      <div class="ctrl">
        <button class="btn secundario" id="pag-ant" ${f.pagina <= 1 ? 'disabled' : ''}>Anterior</button>
        <span class="info">Página ${f.pagina} de ${totalPag}</span>
        <button class="btn secundario" id="pag-sig" ${f.pagina >= totalPag ? 'disabled' : ''}>Siguiente</button>
      </div>
    </div>
  </div>
`;
}

/* La columna Alerta. Cada mensaje de bitácora enciende la bandera de su
   asunto; la letra es su inicial y las seis son distintas entre sí, así que
   no hay colisión. Se muestran en el orden del catálogo — en el original el
   orden varía entre filas y no significa nada. */
function chipsAlerta(o) {
  if (!o.alertas.length) return '<span style="color:var(--gris-2)">—</span>';
  return o.alertas.map((a) =>
    '<span class="cod" title="' + esc(a.asunto) + '" style="display:inline-block;width:15px;height:15px;' +
    'line-height:15px;text-align:center;border:1px solid var(--borde-fuerte);border-radius:2px;' +
    'margin-right:2px;font-size:10px">' + esc(a.letra) + '</span>').join('');
}

function filaTorre(o) {
  const e = o.etapa ? etapaPorCodigo(o.etapa) : null;
  const fuera = o.fueraDeTaller;
  const pend = o.repuestos.filter((r) => !r.fechaBodega).length;
  const sobreMeta = !fuera && o.sobreMeta;
  const abierta = ui.torre.abierta === o.id;

  // La OR es "el apellido" de la OT y la genera cada presupuesto: puede haber
  // varias, y por eso el original muestra la cantidad en esta columna.
  const ors = o.presupuestos.map((p) => p.numeroOR);

  let html = '<tr class="fila' + (abierta ? ' abierta' : '') + '" data-ot="' + esc(o.id) + '">' +
    '<td><span class="flecha">&#9656;</span></td>' +
    '<td class="num"><strong>' + o.numeroOT + '</strong></td>' +
    '<td class="num" title="' + esc(ors.join(' · ')) + '">' + esc(ors[0] || '—') +
      (ors.length > 1 ? ' <span class="et gris">+' + (ors.length - 1) + '</span>' : '') + '</td>' +
    '<td><span class="patente">' + esc(o.patente) + '</span></td>' +
    '<td class="num">' + (o.siniestro ? esc(o.siniestro) : '<span style="color:var(--gris-2)">—</span>') + '</td>' +
    '<td>' + esc(o.cliente) +
      (o.prioridad === 'express' ? ' <span class="et roja">Express</span>' : '') + '</td>' +
    '<td>' + (o.compania === '—' ? '<span style="color:var(--gris-2)">—</span>'
      : '<span class="et ' + (o.compania === 'SURA' ? 'azul' : 'violeta') + '">' + esc(o.compania) + '</span>') + '</td>' +
    '<td>' + esc(o.marca || '—') + '</td>' +
    '<td>' + esc(o.modelo || '—') + '</td>' +
    '<td>' + esc(o.color || '—') + '</td>' +
    '<td class="num">' + fCorta(o.fechaIngreso) + '</td>' +
    '<td>' + esc(o.origenIngresoNombre || '—') + '</td>' +
    '<td class="num">' + (fuera ? '<span style="color:var(--gris)">0</span>'
      : (sobreMeta ? '<strong style="color:var(--ambar)">' + o.diasKpi + '</strong>' : o.diasKpi)) + '</td>' +
    '<td class="num" style="color:var(--gris)">' + o.diasTotales + '</td>' +
    '<td><span class="et ' + esc(o.estadoClase) + '">' + esc(o.estadoNombre) + '</span></td>' +
    // "Pendiente" no es una etapa del maestro: es lo que muestra el listado
    // cuando la OT no tiene ninguna asignada. Hoy son 53 de 102.
    '<td>' + (e ? '<i class="punto" style="background:' + e.color + '"></i>' + esc(e.nombre)
      : '<span class="et gris">Pendiente</span>') + '</td>' +
    '<td>' + (o.asignado ? esc(o.asignado) : '<span class="et gris">Sin Asignar</span>') + '</td>' +
    '<td class="num">' + (o.fechaCompromiso ? fCorta(o.fechaCompromiso) : '—') + '</td>' +
    '<td>' + chipsAlerta(o) + (pend ? ' <span class="et roja" title="' + pend +
      ' repuestos por llegar">' + pend + '</span>' : '') + '</td></tr>';

  if (abierta) html += '<tr class="detalle"><td colspan="19">' + detalleOT(o) + '</td></tr>';
  return html;
}

function detalleOT(o) {
  const e = o.etapa ? etapaPorCodigo(o.etapa) : null;
  const pend = o.repuestos.filter((r) => !r.fechaBodega);
  const dato = (k, v) => '<div class="dato"><span class="k">' + esc(k) + '</span><span class="v">' + v + '</span></div>';
  const fuera = o.fueraDeTaller;

  const hitos = ETAPAS.map((et) => {
    const asignada = o.etapasAsignadas.find((x) => x.codigo === et.codigo);
    const cls = !asignada ? '' : asignada.finalizada ? 'hecho' : 'actual';
    return '<div class="hito ' + cls + '" title="' + esc(et.nombre) +
      (asignada ? (asignada.finalizada ? ' · cerrada' : ' · abierta') : ' · no asignada') + '"></div>';
  }).join('');

  const fotos = Modelo.mediaDe(o.id).filter((m) => m.momento === 'ingreso');

  return '<div class="ficha-detalle"><div class="ficha-rejilla">' +
    '<fieldset class="bloque"><legend>Vehículo</legend>' +
      dato('Patente', '<span class="patente">' + esc(o.patente) + '</span>') +
      dato('Marca y modelo', esc([o.marca, o.modelo].filter(Boolean).join(' ') || '—')) +
      dato('Año', o.anio || '—') + dato('Color', esc(o.color || '—')) +
      dato('VIN', esc(o.vin || '—')) +
      dato('Kilometraje', fKm(o.recepcion && o.recepcion.km)) +
      dato('Combustible', fComb(o.recepcion && o.recepcion.combustible)) + '</fieldset>' +

    '<fieldset class="bloque"><legend>Cliente y siniestro</legend>' +
      dato('Cliente', esc(o.cliente)) +
      // 🔴 El RUT y el domicilio se enmascaran por rol. Acá está MODELADO;
      // se garantiza en la base con RLS, no en el navegador.
      dato('RUT', '<span title="Enmascarado por rol">' + esc(String(o.rut || '').replace(/\d(?=.{4})/g, '•')) + '</span>') +
      dato('Teléfono', esc(o.telefono || '—')) +
      dato('Viene por', esc(o.origenIngresoNombre || '—')) +
      (o.siniestro ? dato('Compañía', esc(o.compania)) + dato('Siniestro', esc(o.siniestro)) +
        dato('Deducible', fMonto(o.deducible)) + dato('Liquidador', esc(o.liquidador || '—')) : '') +
      dato('Prioridad', o.prioridad === 'express'
        ? '<span class="et roja">Express</span>' : '<span class="et gris">Normal</span>') + '</fieldset>' +

    '<fieldset class="bloque"><legend>Los tres relojes</legend>' +
      dato('Situación', fuera
        ? '<span class="et ambar">Fuera de taller</span>'
        : '<span class="et verde">En taller</span>') +
      (e ? dato('Etapa actual', '<i class="punto" style="background:' + e.color + '"></i>' + esc(e.nombre))
         : dato('Etapa actual', '<span class="et gris">Sin asignar</span>')) +
      dato('Días desde el ingreso', '<strong>' + o.diasTotales + '</strong> · nunca se reinicia') +
      dato('Reparación acumulada', o.diasReparacion + ' · se reanuda al reingresar') +
      dato('Estadía actual', fuera
        ? '<span style="color:var(--gris)">0 · detenido</span>'
        : o.diasEstadiaActual + ' · vuelve a cero al reingresar') +
      dato('Contra la meta', o.sobreMeta
        ? '<span style="color:var(--ambar)">' + o.diasKpi + ' de ' + META_DIAS_REPARACION + ' · sobre la meta</span>'
        : o.diasKpi + ' de ' + META_DIAS_REPARACION) +
      (fuera ? dato('Fuera de taller hace', '<span style="color:var(--ambar)">' + o.diasFuera + ' días</span>') : '') +
      dato('Ingreso', fFecha(o.fechaIngreso)) +
      '<div class="linea-tiempo">' + hitos + '</div></fieldset>' +

    '<fieldset class="bloque"><legend>Repuestos, presupuestos y fotos</legend>' +
      dato('Repuestos pendientes', pend.length
        ? '<span style="color:var(--rojo)">' + pend.length + ' de ' + o.repuestos.length + '</span>'
        : (o.repuestos.length ? 'Todos recibidos' : 'No requiere')) +
      (pend.length ? pend.slice(0, 3).map((r) =>
        '<div class="dato"><span class="k" style="padding-left:8px">' + esc(r.descripcion) + '</span>' +
        '<span class="v"><span class="et gris">' + esc(r.responsablePago || 'sin pagador') + '</span></span></div>').join('') : '') +
      o.presupuestos.map((p) => '<div class="dato"><span class="k">OR ' + esc(p.numeroOR) + '</span>' +
        '<span class="v">' + fMonto(p.total) + ' <span class="et ' + ESTADO_PRESUPUESTO[p.estado].clase +
        '">' + esc(ESTADO_PRESUPUESTO[p.estado].txt) + '</span></span></div>').join('') +
      dato('Total de la OT', '<strong>' + fMonto(totalOT(o)) + '</strong>') +
      dato('Daños registrados', o.danos.length) +
      dato('Fotografías', fotos.length
        ? fotos.length + ' · ' + Media.fPeso(Media.resumen(fotos).bytes)
        : '<span style="color:var(--gris-2)">ninguna</span>') +
      (fotos.length ? '<div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap">' +
        fotos.slice(0, 6).map((f) => '<img data-media="' + esc(f.id) +
          '" alt="" style="width:52px;height:40px;object-fit:cover;border-radius:3px;border:1px solid var(--borde)">').join('') +
        '</div>' : '') + '</fieldset>' +
    '</div>' +

    '<div class="acciones-ficha">' +
      '<button class="btn" data-abrir="' + o.numeroOT + '">Abrir en pestaña nueva</button>' +
      '<button class="btn secundario" data-ver="taller">Ver en Taller</button>' +
      '<button class="btn secundario" data-ver="repuestos">Ver repuestos</button>' +
      '<button class="btn secundario" data-ver="presupuesto">Ver presupuesto</button>' +
    '</div></div>';
}

function pTorre() {
  const q = document.getElementById('q-torre');
  if (q) {
    q.addEventListener('input', () => {
      ui.torre.busqueda = q.value; ui.torre.pagina = 1; ui.torre.abierta = null;
      render();
      const nq = document.getElementById('q-torre');
      nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length);
    });
  }
  const sc = document.getElementById('s-compania');
  if (sc) sc.addEventListener('change', () => { ui.torre.compania = sc.value; ui.torre.pagina = 1; render(); });
  const se = document.getElementById('s-etapa');
  if (se) se.addEventListener('change', () => { ui.torre.etapa = se.value; ui.torre.pagina = 1; render(); });

  document.querySelectorAll('[data-sit]').forEach((b) => b.addEventListener('click', () => {
    ui.torre.situacion = b.dataset.sit; ui.torre.pagina = 1; ui.torre.abierta = null; render();
  }));
  /* Un clic despliega la fila; DOBLE clic abre la OT en una pestaña nueva, que
     es como se trabaja hoy.

     El detalle que lo tenía roto: el primer clic vuelve a dibujar la tabla, y
     al reemplazarse la fila el navegador ya no puede emitir `dblclick` — los
     dos clics caen sobre elementos distintos. Por eso el doble clic se cuenta
     acá, con la hora del clic anterior, y el despliegue no pierde velocidad.
     El `dblclick` nativo queda igual por si el redibujo no alcanza a ocurrir. */
  const VENTANA_DOBLE_CLIC = 450;
  ui.torre.ultimoClic = ui.torre.ultimoClic || { ot: null, t: 0 };

  const abrirPorFila = (tr) => {
    const o = Modelo.torre().find((x) => x.id === tr.dataset.ot);
    if (o) { abrirFicha(o.numeroOT); return true; }
    return false;
  };

  document.querySelectorAll('tr.fila').forEach((tr) => {
    tr.addEventListener('click', () => {
      const ahora = new Date().getTime();
      const previo = ui.torre.ultimoClic;
      if (previo.ot === tr.dataset.ot && ahora - previo.t < VENTANA_DOBLE_CLIC) {
        ui.torre.ultimoClic = { ot: null, t: 0 };
        if (abrirPorFila(tr)) return;
      }
      ui.torre.ultimoClic = { ot: tr.dataset.ot, t: ahora };
      ui.torre.abierta = ui.torre.abierta === tr.dataset.ot ? null : tr.dataset.ot;
      render();
    });
    tr.addEventListener('dblclick', (ev) => { ev.preventDefault(); abrirPorFila(tr); });
    tr.title = 'Un clic despliega la orden · doble clic la abre en una pestaña nueva';
  });
  document.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation(); ir(b.dataset.ver);
  }));
  document.querySelectorAll('[data-abrir]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation(); abrirFicha(b.dataset.abrir);
  }));

  const ant = document.getElementById('pag-ant'), sig = document.getElementById('pag-sig');
  if (ant) ant.addEventListener('click', () => { ui.torre.pagina--; ui.torre.abierta = null; render(); });
  if (sig) sig.addEventListener('click', () => { ui.torre.pagina++; ui.torre.abierta = null; render(); });

  Media.pintar();
}
