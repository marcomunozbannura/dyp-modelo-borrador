/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   TALLER — dos apartados, y el que manda es el LISTADO.

   Pedido del cliente el 15-08-2026, mirando el sistema actual: *"el principal
   debe ser el mismo estilo de la imagen 1 donde salen en fila distintas OT y
   uno puede asignar etapas como acción"*, y el tablero por etapa *"debe ser un
   apartado aparte que uno aprieta"*.

   ── Por qué el listado va primero, y no es sólo obediencia ───────────────

   El tablero por etapa responde «cómo viene el taller»: es una foto para
   mirar. El listado responde «qué hago con este auto»: es una fila por orden
   con su acción al lado. En el mesón se trabaja orden por orden —llega la OT
   23506 y hay que decirle qué etapas aplican—, y en el tablero esa orden hay
   que ir a buscarla entre las columnas.

   Los dos sirven, y por eso ninguno se borra. Pero el que se abre primero
   tiene que ser el que se usa todo el día.

   ── Qué se copia del original ────────────────────────────────────────────

   · Las columnas y su orden: OT · Patente · Cliente · Marca · Modelo · Color ·
     Ingreso · Días · Estado · Etapa · Encargado · Fecha Entrega · Acción ·
     Datos. Verificado contra la pantalla `miembros.php?ver=taller`.
   · La acción `Asignar Etapas` en su propia columna, y la lupa de `Datos`.
   · Que la lista incluya también los vehículos FUERA de taller. En el original
     aparece la OT 23505 en «Fuera de taller / Espera repuesto»: la orden sigue
     viva y hay que poder trabajarla aunque el auto no esté ocupando un box.

   ── Qué se corrige ───────────────────────────────────────────────────────

   🔴 El original rotula SIEMPRE `Asignar Etapas`, aunque la orden ya las
      tenga asignadas y lo que corresponda sea cerrarlas. El enrutamiento por
      detrás sí distingue —pedir `taller-etapas-v2` sobre una OT sin etapas
      devuelve `taller-habilitar-etapas`—, o sea que el sistema sabe a dónde
      va y el rótulo no lo dice. Acá el rótulo dice a dónde lleva:
      `Asignar etapas` cuando no hay ninguna, `Finalizar etapas` cuando ya las
      hay. Es la misma regla del original, escrita en el botón.
   ──────────────────────────────────────────────────────────────────────── */

const TALLER_APARTADOS = [
  { id: 'listado', rot: 'Listado' },
  { id: 'tablero', rot: 'Por etapa' }
];

function tallerEstado() {
  ui.taller = ui.taller || { pantalla: 'listado', busqueda: '' };
  return ui.taller;
}

/* Las órdenes vivas, con las de adentro primero. Un vehículo fuera de taller
   se sigue trabajando —se le asignan etapas, se le piden repuestos— pero no
   es lo que hay que mirar al abrir la pantalla. */
function tallerOrdenes() {
  const t = tallerEstado();
  const q = String(t.busqueda || '').trim().toLowerCase();
  return Modelo.torre()
    .filter((o) => {
      if (!q) return true;
      return [o.numeroOT, o.patente, o.cliente, o.marca, o.modelo, o.etapaNombre, o.asignado]
        .join(' ').toLowerCase().indexOf(q) >= 0;
    })
    .sort((a, b) => (a.enTaller === b.enTaller ? b.numeroOT - a.numeroOT : (a.enTaller ? -1 : 1)));
}

/* La regla de enrutamiento del original, dicha en el rótulo del botón. */
const tallerAccionDe = (o) => (o.etapasAsignadas.length
  ? { modo: 'finalizar', rot: 'Finalizar etapas', permiso: 'etapa.finalizar' }
  : { modo: 'asignar', rot: 'Asignar etapas', permiso: 'etapa.asignar' });

function vTaller() {
  const t = tallerEstado();
  const m = Modelo.metricas();

  const chip = (a) => '<button class="chip' + (t.pantalla === a.id ? ' activo' : '') +
    '" data-tallerap="' + a.id + '">' + esc(a.rot) + '</button>';

  return `
  <div class="panel">
    <div class="cab">
      <div><h2>${ico('taller', 'g')}Taller</h2>
        <div class="desc">${m.enTaller} en taller · ${m.fueraDeTaller} más están fuera de taller y no ocupan box</div></div>
      <div class="chips">${TALLER_APARTADOS.map(chip).join('')}</div>
    </div>
    <div class="cuerpo">${t.pantalla === 'tablero' ? vTallerTablero() : vTallerListado()}</div>
  </div>
  ${t.pantalla === 'tablero' ? vTallerEtapasCatalogo() : ''}`;
}

/* ── El listado, que es la pantalla principal ──────────────────────────── */

function vTallerListado() {
  const t = tallerEstado();
  const filas = tallerOrdenes();
  // La compañía es dato de negocio; quien no ve la ficha completa igual tiene
  // que reconocer el auto, y para eso están marca y modelo.
  const verCliente = Modelo.puede('ficha.completa');

  const fila = (o) => {
    const acc = tallerAccionDe(o);
    return '<tr class="fila" data-ot="' + esc(o.numeroOT) + '">' +
      '<td class="num"><strong>' + o.numeroOT + '</strong></td>' +
      '<td><span class="patente">' + esc(o.patente) + '</span></td>' +
      '<td>' + (verCliente ? esc(o.cliente) : '<span style="color:var(--gris-2)">—</span>') + '</td>' +
      '<td>' + esc(o.marca || '—') + '</td>' +
      '<td>' + esc(o.modelo || '—') + '</td>' +
      '<td>' + esc(o.color || '—') + '</td>' +
      '<td>' + fCorta(o.fechaIngreso) + '</td>' +
      /* El reloj que se muestra es el de REPARACIÓN, no el del original. El
         original muestra días desde el último cambio de estado, que es el bug
         que este sistema corrige — ver C-1. Poner ese número acá sería copiar
         el defecto en la pantalla donde se decide el trabajo del día. */
      '<td class="num"' + (o.sobreMeta ? ' style="color:var(--rojo-texto)"' : '') + '>' +
        o.diasReparacion + '</td>' +
      '<td><span class="et ' + esc(o.estadoClase) + '">' + esc(o.estadoNombre) + '</span></td>' +
      '<td>' + (o.etapa
        ? '<i class="punto" style="background:' + esc(colorEtapa(o.etapa)) + '"></i>' + esc(o.etapaNombre)
        : '<span style="color:var(--gris-2)">Pendiente</span>') + '</td>' +
      '<td>' + (o.asignado
        ? esc(o.asignado) : '<span style="color:var(--gris-2)">Sin asignar</span>') + '</td>' +
      '<td>' + (o.fechaCompromiso ? fCorta(o.fechaCompromiso)
        : '<span style="color:var(--gris-2)">—</span>') + '</td>' +
      '<td><button class="btn secundario chico" data-etapasde="' + esc(o.numeroOT) + '">' +
        ico('check') + esc(acc.rot) + '</button></td>' +
      '<td style="text-align:center"><button class="btn secundario chico" data-datosde="' + esc(o.numeroOT) + '" ' +
        'title="Abrir la orden ' + o.numeroOT + '" aria-label="Abrir la orden ' + o.numeroOT + '">' +
        ico('buscar') + '</button></td></tr>';
  };

  return `
  <div class="filtros" style="margin-bottom:10px">
    <input type="search" id="q-taller" placeholder="OT, patente, cliente, marca o etapa"
      value="${esc(t.busqueda)}">
    <span class="pie-nota" style="margin:0">${filas.length}
      ${filas.length === 1 ? 'orden' : 'órdenes'}${t.busqueda ? ' de ' + Modelo.torre().length : ''}</span>
  </div>

  ${filas.length ? `<div class="grid-envoltorio"><table class="grid">
    <thead><tr>
      <th>OT</th><th>Patente</th><th>Cliente</th><th>Marca</th><th>Modelo</th><th>Color</th>
      <th>Ingreso</th><th>Días</th><th>Estado</th><th>Etapa</th><th>Encargado</th>
      <th>Fecha Entrega</th><th>Acción</th><th>Datos</th>
    </tr></thead>
    <tbody>${filas.map(fila).join('')}</tbody>
  </table></div>` : `<div class="vacio">${ico('buscar')}
    <div class="titulo">Ninguna orden con «${esc(t.busqueda)}»</div>
    <div class="texto">Se busca por número de OT, patente, cliente, marca, modelo o etapa.</div></div>`}

  <div class="pie-nota">La columna <strong>Días</strong> es la reparación acumulada, no los días desde
    el último cambio de estado. Es la corrección del contador — ver el manual.</div>`;
}

const colorEtapa = (codigo) => (ETAPAS.find((e) => e.codigo === codigo) || {}).color || 'var(--gris)';

/* ── El tablero, que pasa a ser el segundo apartado ────────────────────── */

function vTallerTablero() {
  const enTaller = Modelo.torre().filter((o) => o.enTaller);
  const conCompania = Modelo.puede('ficha.completa');

  return `
  <div class="tablero">
    ${ETAPAS.map((e) => {
      const ots = enTaller.filter((o) => o.etapa === e.codigo);
      return '<div class="columna"><div class="titulo"><span><i class="punto" style="background:' + e.color + '"></i>' +
        esc(e.nombre) + '</span><span class="n">' + ots.length + '</span></div>' +
        (ots.length ? ots.map((o) =>
          '<div class="tarjeta-ot' + (tieneRepuestoPendiente(o) ? ' detenida' : '') + '" data-ficha="' + esc(o.id) + '">' +
          '<div class="ot">OT ' + o.numeroOT + '</div><div class="pat">' + esc(o.patente) + '</div>' +
          '<div class="meta"><span>' + esc(conCompania ? o.compania
            : ([o.marca, o.modelo].filter(Boolean).join(' ') || '—')) +
          '</span><span>' + o.diasReparacion + ' d</span></div></div>').join('')
          : '<div style="font-size:12px;color:var(--gris-2);padding:6px 2px">Sin vehículos</div>') +
        '</div>';
    }).join('')}
  </div>`;
}

function vTallerEtapasCatalogo() {
  const enTaller = Modelo.torre().filter((o) => o.enTaller);
  return `
  <div class="panel">
    <div class="cab"><div><h2>Las nueve etapas</h2>
      <div class="desc">Los nombres son los del sistema actual. Se editan en Configuración</div></div></div>
    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th>#</th><th>Etapa</th><th>Aplica siempre</th><th>Bloquea si faltan repuestos</th><th>Vehículos</th></tr></thead>
      <tbody>${ETAPAS.map((e) => '<tr><td class="num">' + e.orden + '</td>' +
        '<td><i class="punto" style="background:' + e.color + '"></i>' + esc(e.nombre) + '</td>' +
        '<td>' + (e.opcional ? '<span class="et gris">No siempre</span>' : '<span class="et verde">Sí</span>') + '</td>' +
        '<td>' + (e.reqRepuestos ? '<span class="et ambar">Sí</span>' : '<span class="et gris">No</span>') + '</td>' +
        '<td class="num">' + enTaller.filter((o) => o.etapa === e.codigo).length + '</td></tr>').join('')}</tbody>
    </table></div>
  </div>`;
}

/* ── Cableado ──────────────────────────────────────────────────────────── */

function pTaller() {
  const t = tallerEstado();

  document.querySelectorAll('[data-tallerap]').forEach((b) => b.addEventListener('click', () => {
    t.pantalla = b.dataset.tallerap; render();
  }));

  const q = document.getElementById('q-taller');
  if (q) q.addEventListener('input', () => {
    t.busqueda = q.value;
    render();
    const otro = document.getElementById('q-taller');
    if (otro) { otro.focus(); otro.setSelectionRange(otro.value.length, otro.value.length); }
  });

  /* La acción de la fila. Abre la orden PARADA EN SUS ETAPAS, que es el gesto
     del original: el enlace de la lista va derecho a la pantalla de etapas y
     no a la ficha para que después alguien busque la pestaña. */
  document.querySelectorAll('[data-etapasde]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const o = Modelo.otPorNumero(b.dataset.etapasde);
    const acc = o ? tallerAccionDe(o) : null;

    /* La regla la rechaza el motor, no el botón: sin el permiso se aprieta
       igual y se dice quién sí puede. Esconderlo dejaría al operario con una
       columna vacía sin saber por qué. */
    if (acc && !Modelo.puede(acc.permiso)) {
      return avisar({ ok: false, motivo: '«' + acc.rot + '» no es de este perfil. El rol ' +
        (Modelo.rolActual().nombre || '—') + ' no tiene el permiso «' + acc.permiso +
        '». Se administra en Configuración → Roles y permisos.' });
    }
    abrirFicha(b.dataset.etapasde, 'etapas');
  }));

  document.querySelectorAll('[data-datosde]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    abrirFicha(b.dataset.datosde);
  }));

  // El doble clic sobre la fila abre la orden, igual que en todos los paneles.
  dobleClicPorFilas('[data-ot]');

  document.querySelectorAll('[data-ficha]').forEach((f) => f.addEventListener('click', () => {
    /* La tarjeta del tablero llevaba SIEMPRE a la torre, y hay cuentas que no
       tienen torre: el operario apretaba y no pasaba nada visible. Sin
       `torre.ver` se abre la orden en su propia ventana, que es a donde quería
       llegar igual. */
    if (!Modelo.puede('torre.ver')) {
      const o = Modelo.otPorId(f.dataset.ficha);
      if (o) abrirFicha(o.numeroOT);
      return;
    }
    ui.torre.abierta = f.dataset.ficha;
    ui.torre.situacion = 'piso'; ui.torre.busqueda = ''; ui.torre.etapa = 'todas';
    ui.torre.pagina = 1;
    const idx = filtrarTorre().findIndex((o) => o.id === f.dataset.ficha);
    if (idx >= 0) ui.torre.pagina = Math.floor(idx / ui.torre.porPagina) + 1;
    ir('torre');
  }));
}
