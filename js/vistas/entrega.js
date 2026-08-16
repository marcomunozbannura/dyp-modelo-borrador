/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   SALIDA, REINGRESO Y ENTREGA — el cierre del ciclo.

   Tres cosas distintas que el sistema actual mezcla en una sola:

   1 · SALIDA. El vehículo se inspecciona, se presupuesta y **se devuelve al
       cliente** mientras llegan los repuestos. En el original esto no se
       registra: el campo `Fecha de salida` de la ficha existe y está vacío
       incluso en órdenes ya entregadas.

   2 · REINGRESO. Vuelve cuando llegan las piezas. En el original el único
       rastro es un `Cambio de estado: 'Recibido' a 'Recibido'` que además
       **reinicia el contador de días** — medido al día exacto en ocho
       órdenes.

   3 · ENTREGA. Cierra la orden. Acá sí existe pantalla, busca por patente y
       pide fecha obligatoria, observación y tipo de entrega.

   Acá las tres son hechos con fecha sobre `ot_estadia`, y por eso los relojes
   no se pueden reiniciar regrabando nada.
   ──────────────────────────────────────────────────────────────────────── */

function entregaEstado() {
  ui.entrega = ui.entrega || { patente: '', otId: null, obs: '', estado: null };
  return ui.entrega;
}

/* ── Qué significa "listo para entregar" ───────────────────────────────
   El cliente pidió el 15-08-2026 que al escribir aparezcan los vehículos que
   están listos para entregar. Listo no es una bandera del sistema: se deduce, y
   son tres condiciones a la vez.

   Se ofrecen TODAS las órdenes vivas igual, no sólo las listas. Ocultar las que
   no cumplen dejaría al recepcionista buscando una patente que sí está en el
   taller, sin saber por qué no aparece — y hay casos legítimos de entregar un
   auto con algo pendiente. Aparecen todas, marcadas. */
function listoParaEntregar(o) {
  const calidad = (o.etapasAsignadas || []).find((x) => x.codigo === 'calidad');
  return {
    enTaller: !!o.enTaller,
    calidadOk: !calidad || calidad.finalizada,
    sinPendientes: !o.repuestos.some((r) => !r.fechaBodega)
  };
}
const estaListo = (o) => { const c = listoParaEntregar(o); return c.enTaller && c.calidadOk && c.sinPendientes; };

function motivoNoListo(o) {
  const c = listoParaEntregar(o);
  const faltas = [];
  if (!c.enTaller) faltas.push('está fuera del taller');
  if (!c.calidadOk) faltas.push('control de calidad abierto');
  if (!c.sinPendientes) faltas.push(o.repuestos.filter((r) => !r.fechaBodega).length + ' repuestos por llegar');
  return faltas.join(' · ');
}

function vEntrega() {
  const e = entregaEstado();
  const o = e.otId ? Modelo.otPorId(e.otId) : null;
  const vivas = Modelo.torre();
  const listos = vivas.filter(estaListo);
  /* Sin búsqueda se muestran LAS LISTAS, no una pantalla vacía. Era un
     `datalist` que sólo aparecía al escribir, y para eso hay que saber de
     antemano qué patente se busca — el recepcionista muchas veces llega al
     revés: mira qué hay listo y de ahí elige. La búsqueda queda para filtrar
     o para llegar a una que no está en la lista. */
  const coincidencias = e.patente
    ? vivas.filter((x) => x.patente.indexOf(e.patente) >= 0 ||
        String(x.numeroOT).indexOf(e.patente) >= 0)
    : listos;

  return `
  <div class="panel">
    <div class="cab"><div><h2>${ico('check', 'g')}Buscar unidad para entrega</h2>
      <div class="desc">El cierre del ciclo. Se escribe la patente y el sistema propone las que están listas</div></div>
      <span class="et ${listos.length ? 'verde' : 'gris'}">${listos.length} listas para entregar</span></div>
    <div class="cuerpo">
      <div class="rejilla-campos">
        <div class="campo"><label>Patente u OT</label>
          <input id="ent-patente" list="ent-listas" autocomplete="off"
            value="${esc(e.patente)}" placeholder="Escribe y elige de la lista">
          <datalist id="ent-listas">
            ${listos.map((x) => '<option value="' + esc(x.patente) + '">OT ' + esc(x.numeroOT) +
              ' · ' + esc(x.cliente) + '</option>').join('')}
          </datalist>
          <span class="ayuda">Abajo están las ${listos.length} listas para entregar. Escribe
            para filtrar, o para llegar a una que todavía no lo está — aparece marcada con lo que
            le falta</span></div>
        <div class="campo"><label>&nbsp;</label><button class="btn" id="ent-buscar">Buscar patente</button></div>
      </div>

      ${e.patente && !coincidencias.length
        ? '<div class="vacio"><div class="titulo">Sin resultados para “' + esc(e.patente) + '”</div>' +
          '<div class="texto">Solo se ofrecen órdenes vivas: una orden ya cerrada no se vuelve a entregar.</div></div>'
        : ''}

      ${coincidencias.length ? `
      <h3 style="font-size:13px;margin:14px 0 6px">${e.patente
        ? 'Resultados de la patente &ldquo;' + esc(e.patente) + '&rdquo;'
        : 'Vehículos listos para entregar'}</h3>
      <div class="grid-envoltorio"><table class="grid">
        <thead><tr>
          <th>OT</th><th>Patente</th><th style="width:170px">Fecha Entrega</th>
          <th style="width:200px">Tipo de entrega</th><th>Observaciones</th><th style="width:96px"></th>
        </tr></thead>
        <tbody>${coincidencias.map((x) => filaEntrega(x, e)).join('')}</tbody>
      </table></div>` : ''}

      ${o ? vEntregaFicha(o) : ''}
    </div>
  </div>`;
}

/* La fila de entrega, con los mismos campos que el sistema actual: OT, patente,
   fecha con hora, tipo de entrega, observaciones y el botón. Se entrega desde
   la propia fila — no hay que abrir nada más, que es como trabaja el
   recepcionista hoy.

   Lo que se agrega, y no estorba: si al vehículo le falta algo para estar listo
   se dice EN la fila. El original deja entregar igual y sin avisar; acá se
   avisa y se deja entregar igual, porque hay casos legítimos —un cliente que se
   lleva el auto a medias— y quien decide es el taller, no el sistema. */
function filaEntrega(x, e) {
  const finales = Modelo.catalogo('estado').filter((s) => (s.alcanzable_en || []).indexOf('entrega') >= 0);
  const listo = estaListo(x);
  const falta = listo ? '' : motivoNoListo(x);

  return '<tr class="fila" data-ot="' + esc(x.numeroOT) + '">' +
    '<td class="num"><strong>' + x.numeroOT + '</strong></td>' +
    '<td><span class="patente">' + esc(x.patente) + '</span>' +
      (listo ? ' <span class="et verde">lista</span>'
             : ' <span class="et ambar" title="' + esc(falta) + '">pendiente</span>') +
      '<div class="ayuda" style="margin:2px 0 0">' + esc(x.cliente) +
      (falta ? ' — ' + esc(falta) : '') + '</div></td>' +
    // La fecha lleva HORA, igual que el original: un taller entrega varios
    // autos el mismo día y el orden importa cuando hay un reclamo.
    '<td><input type="datetime-local" data-ent-campo="fecha" data-ot="' + esc(x.id) + '" ' +
      'value="' + esc(isoFechaHora(HOY)) + '"></td>' +
    '<td><select data-ent-campo="estado" data-ot="' + esc(x.id) + '">' +
      '<option value="">Seleccionar</option>' +
      finales.map((s) => '<option value="' + esc(s.codigo) + '">' + esc(s.nombre) + '</option>').join('') +
      '</select></td>' +
    '<td><textarea rows="2" data-ent-campo="obs" data-ot="' + esc(x.id) + '" ' +
      'placeholder="Observaciones de la entrega"></textarea></td>' +
    '<td><button class="btn" data-ent-entregar="' + esc(x.id) + '">Entregar</button></td></tr>';
}

/* `datetime-local` necesita `AAAA-MM-DDTHH:MM` en hora local. Con toISOString()
   sale en UTC y en Chile el campo aparece con horas de diferencia. */
function isoFechaHora(d) {
  const p = (n) => String(n).padStart(2, '0');
  const ahora = new Date();
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
    'T' + p(ahora.getHours()) + ':' + p(ahora.getMinutes());
}

function vEntregaFicha(o) {
  const e = entregaEstado();
  const finales = Modelo.catalogo('estado').filter((x) => (x.alcanzable_en || []).indexOf('entrega') >= 0);
  const noOfrecidos = Modelo.catalogo('estado').filter((x) => x.es_final &&
    !(x.alcanzable_en || []).length);
  const pend = o.repuestos.filter((r) => !r.fechaBodega);

  return `
  <div class="panel" style="margin-top:11px">
    <div class="cab"><div><h2>OT ${o.numeroOT} · ${esc(o.patente)}</h2>
      <div class="desc">${esc(o.cliente)} · ${esc(o.compania)}</div></div>
      <span class="et ${esc(o.estadoClase)}">${esc(o.estadoNombre)}</span></div>
    <div class="cuerpo">
      <div class="ficha-rejilla">
        <fieldset class="bloque"><legend>1 · Salida y reingreso</legend>
          <div class="dato"><span class="k">Situación</span><span class="v">${o.enTaller
            ? '<span class="et verde">En el taller</span>' : '<span class="et ambar">Fuera del taller</span>'}</span></div>
          <div class="dato"><span class="k">Fecha de salida</span><span class="v">${o.fechaSalida
            ? fFecha(o.fechaSalida) : '<span style="color:var(--gris-2)">todavía no salió</span>'}</span></div>
          <div class="dato"><span class="k">Días totales</span><span class="v"><strong>${o.diasTotales}</strong></span></div>
          <div class="dato"><span class="k">Reparación acumulada</span><span class="v">${o.diasReparacion}</span></div>
          <div class="dato"><span class="k">Estadía actual</span><span class="v">${o.diasEstadiaActual}</span></div>
          <div class="dato"><span class="k">Fuera del taller</span><span class="v">${o.diasFuera} días</span></div>
          <div style="margin-top:9px;display:flex;gap:8px">
            ${o.enTaller
              ? '<button class="btn secundario" data-ent-acc="salida">Sacar del taller</button>'
              : '<button class="btn" data-ent-acc="reingreso">Registrar reingreso</button>'}
          </div>
        </fieldset>

        <fieldset class="bloque"><legend>2 · Entrega</legend>
          <div class="rejilla-campos">
            <div class="campo"><label>Fecha de entrega <span style="color:var(--rojo)">*</span></label>
              <input type="date" id="ent-fecha" value="${isoFecha(HOY)}"></div>
            <div class="campo"><label>Tipo de entrega</label>
              <select id="ent-estado">${finales.map((x) => '<option value="' + esc(x.codigo) + '">' +
                esc(x.nombre) + '</option>').join('')}</select></div>
            <div class="campo" style="grid-column:1/-1"><label>Observaciones</label>
              <textarea rows="2" id="ent-obs">${esc(e.obs)}</textarea></div>
          </div>
          ${pend.length ? '<div class="nota" style="margin-top:8px">Esta orden tiene <strong>' +
            plural(pend.length, 'repuesto', 'repuestos') + ' sin llegar</strong>. Se puede entregar ' +
            'igual, pero conviene saberlo antes de facturar.</div>' : ''}
          <div style="margin-top:9px"><button class="btn" data-ent-acc="entregar">Entregar</button></div>
        </fieldset>
      </div>
    </div>
  </div>`;
}

function pEntrega() {
  // Doble clic abre la orden en pestaña nueva, igual que en la torre.
  dobleClicPorFilas();
  const e = entregaEstado();
  const campo = document.getElementById('ent-patente');
  const buscar = () => { e.patente = campo.value.trim().toUpperCase(); e.otId = null; render(); };
  const btn = document.getElementById('ent-buscar');
  if (btn) btn.addEventListener('click', buscar);
  if (campo) campo.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') buscar(); });

  // El autocompletado: elegir de la lista busca al tiro, sin apretar el botón.
  if (campo) campo.addEventListener('change', () => {
    if (campo.value && campo.value !== e.patente) buscar();
  });

  document.querySelectorAll('[data-ent-ot]').forEach((b) => b.addEventListener('click', () => {
    e.otId = b.dataset.entOt; render();
  }));

  /* Entregar desde la propia fila. Los tres campos se leen de la fila del
     botón, no de un formulario aparte: pueden verse varias unidades a la vez y
     hay que entregar la que se apretó, no la última que se tocó. */
  document.querySelectorAll('[data-ent-entregar]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.entEntregar;
    const dame = (c) => {
      const el = document.querySelector('[data-ent-campo="' + c + '"][data-ot="' + id + '"]');
      return el ? el.value : '';
    };
    const cuando = dame('fecha');
    const tipo = dame('estado');
    if (!cuando) return avisar({ ok: false, motivo: 'La fecha de entrega es obligatoria.' });
    if (!tipo) return avisar({ ok: false, motivo: 'Falta elegir el tipo de entrega. ' +
      'No es un detalle: define con qué estado se cierra la orden, y un estado final no se corrige después.' });

    const [f, h] = cuando.split('T');
    const [a, m, d] = f.split('-').map(Number);
    const [hh, mm] = (h || '00:00').split(':').map(Number);

    ejecutar(() => Modelo.registrar_entrega(id, {
      estado: tipo, fecha: new Date(a, m - 1, d, hh || 0, mm || 0), observacion: dame('obs')
    }), 'Unidad entregada. La orden quedó cerrada y el vehículo salió de la torre.',
      () => { e.otId = null; e.patente = ''; render(); });
  }));

  const obs = document.getElementById('ent-obs');
  if (obs) obs.addEventListener('input', () => { e.obs = obs.value; });

  document.querySelectorAll('[data-ent-acc]').forEach((b) => b.addEventListener('click', () => {
    const v = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    switch (b.dataset.entAcc) {
      case 'salida':
        return ejecutar(() => Modelo.registrar_salida(e.otId, 'espera_repuesto'),
          'Salida registrada con fecha. El reloj de reparación quedó detenido.');
      case 'reingreso':
        return ejecutar(() => Modelo.registrar_reingreso(e.otId),
          'Reingreso registrado. La reparación se reanudó; la estadía actual partió de cero.');
      case 'entregar': {
        const f = v('ent-fecha');
        if (!f) return avisar({ ok: false, motivo: 'La fecha de entrega es obligatoria.' });
        const [a, m, d] = f.split('-').map(Number);
        return ejecutar(() => Modelo.registrar_entrega(e.otId, {
          estado: v('ent-estado'), fecha: new Date(a, m - 1, d), observacion: v('ent-obs')
        }), 'Orden entregada. Fecha de salida escrita y los relojes conservados en el Histórico.',
          () => { e.otId = null; e.obs = ''; render(); });
      }
    }
  }));
}
