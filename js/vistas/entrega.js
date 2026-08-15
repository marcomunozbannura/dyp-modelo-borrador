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

function vEntrega() {
  const e = entregaEstado();
  const o = e.otId ? Modelo.otPorId(e.otId) : null;
  const coincidencias = e.patente
    ? Modelo.torre().filter((x) => x.patente.indexOf(e.patente) >= 0)
    : [];

  return `
  <div class="panel">
    <div class="cab"><div><h2>${ico('check', 'g')}Buscar unidad para entrega</h2>
      <div class="desc">El cierre del ciclo. Busca por patente, igual que el original</div></div></div>
    <div class="cuerpo">
      <div class="rejilla-campos">
        <div class="campo"><label>Patente</label>
          <input id="ent-patente" value="${esc(e.patente)}" placeholder="AABB11"></div>
        <div class="campo"><label>&nbsp;</label><button class="btn" id="ent-buscar">Buscar patente</button></div>
      </div>

      ${e.patente && !coincidencias.length
        ? '<div class="vacio"><div class="titulo">Sin resultados para “' + esc(e.patente) + '”</div>' +
          '<div class="texto">Solo se ofrecen órdenes vivas: una orden ya cerrada no se vuelve a entregar.</div></div>'
        : ''}

      ${coincidencias.length ? `
      <div class="grid-envoltorio" style="margin-top:11px"><table class="grid">
        <thead><tr><th>OT</th><th>Patente</th><th>Cliente</th><th>Estado</th><th>Etapa</th>
          <th>Días</th><th>Repuestos</th><th></th></tr></thead>
        <tbody>${coincidencias.map((x) =>
          '<tr class="fila' + (o && o.id === x.id ? ' abierta' : '') + '">' +
          '<td class="num"><strong>' + x.numeroOT + '</strong></td>' +
          '<td><span class="patente">' + esc(x.patente) + '</span></td>' +
          '<td>' + esc(x.cliente) + '</td>' +
          '<td><span class="et ' + esc(x.estadoClase) + '">' + esc(x.estadoNombre) + '</span></td>' +
          '<td>' + esc(x.etapaNombre) + '</td>' +
          '<td class="num">' + x.diasKpi + '</td>' +
          '<td>' + (x.repuestos.some((r) => !r.fechaBodega)
            ? '<span class="et roja">' + x.repuestos.filter((r) => !r.fechaBodega).length + ' por llegar</span>'
            : '<span class="et verde">al día</span>') + '</td>' +
          '<td><button class="btn secundario" data-ent-ot="' + esc(x.id) + '">Trabajar sobre esta</button></td></tr>').join('')}
        </tbody></table></div>` : ''}

      ${o ? vEntregaFicha(o) : ''}
    </div>
  </div>`;
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
  const e = entregaEstado();
  const campo = document.getElementById('ent-patente');
  const buscar = () => { e.patente = campo.value.trim().toUpperCase(); e.otId = null; render(); };
  const btn = document.getElementById('ent-buscar');
  if (btn) btn.addEventListener('click', buscar);
  if (campo) campo.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') buscar(); });

  document.querySelectorAll('[data-ent-ot]').forEach((b) => b.addEventListener('click', () => {
    e.otId = b.dataset.entOt; render();
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
