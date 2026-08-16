/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   ETAPAS — asignar y finalizar. Son DOS pantallas, no una.

   Así funciona el sistema actual y así se replica, porque es el mecanismo que
   se describió en la reunión: primero se declara QUÉ ETAPAS APLICAN al vehículo
   —"no toda la etapa se hace mecánica, hay unas que puede ser un tapabarro o
   un espejo y no tiene mecánica"—, y después se cierran una a una.

   El enrutamiento también se copia: una OT sin etapas asignadas cae en la
   pantalla de asignar; con etapas, en la de finalizar. Verificado pidiendo
   `taller-etapas-v2` sobre una OT sin asignar: el sistema devuelve
   `taller-habilitar-etapas`.

   ── Lo que se corrige ────────────────────────────────────────────────────

   🔴 La pantalla de asignar del original muestra las nueve casillas EN BLANCO
      aunque la OT ya tenga etapas cerradas. No refleja lo asignado, así que
      no hay forma de saber qué se marcó sin ir a la otra pantalla. Acá sí.

   · En el original la casilla de `Desarme` sobrevive al cierre en las tres OT
     examinadas, mientras las demás etapas completadas la pierden. Tiene pinta
     de error de renderizado en la primera fila del bucle. No se replica.

   · Se pueden cerrar VARIAS etapas en un mismo guardado, cada una con su
     responsable. Verificado: Preparación y Pintura quedaron cerradas en el
     mismo segundo.
   ──────────────────────────────────────────────────────────────────────── */

/* La regla de enrutamiento del original, tal cual. */
const modoEtapasPorDefecto = (o) => (o.etapasAsignadas.length ? 'finalizar' : 'asignar');

function vEtapas(o) {
  /* Asignar y finalizar son permisos distintos, y acá se nota: quien reparte
     el trabajo declara qué etapas aplican; quien lo hace, las cierra. Sin
     `etapa.asignar` no se ofrece el conmutador ni se puede caer en esa
     pantalla —el operario entraba y tenía a mano las nueve casillas—. */
  const puedeAsignar = Modelo.puede('etapa.asignar');
  const modo = puedeAsignar ? (ui.ficha.modoEtapas || modoEtapasPorDefecto(o)) : 'finalizar';
  const cuerpo = modo === 'asignar' ? vAsignarEtapas(o) : vFinalizarEtapas(o);

  return `
  <div class="panel">
    <div class="cab">
      <div><h2>${ico('taller', 'g')}${modo === 'asignar' ? 'Asignar etapas' : 'Finalizar etapas'}
        OR ${esc(o.presupuestos.length ? o.presupuestos[0].numeroOR : o.numeroOT)}</h2>
        <div class="desc">${modo === 'asignar'
          ? 'Qué etapas aplican a este vehículo. No todas aplican a todos.'
          : 'Cerrar etapas y fijar la entrega probable. Se pueden cerrar varias de una vez.'}</div></div>
      ${puedeAsignar ? `<div class="chips">
        <button class="chip${modo === 'asignar' ? ' activo' : ''}" data-modoetapa="asignar">Asignar</button>
        <button class="chip${modo === 'finalizar' ? ' activo' : ''}" data-modoetapa="finalizar">Finalizar</button>
      </div>` : ''}
    </div>
    <div class="cuerpo">${cuerpo}</div>
  </div>`;
}

/* ── Asignar ───────────────────────────────────────────────────────────── */

function vAsignarEtapas(o) {
  const asignadas = o.etapasAsignadas;
  const enc = (c) => asignadas.find((x) => x.codigo === c);

  return `
  <div class="grid-envoltorio"><table class="grid">
    <thead><tr><th style="width:34px"></th><th>Etapa</th><th>Aplica</th><th>Situación</th><th></th></tr></thead>
    <tbody>${ETAPAS.map((e) => {
      const a = enc(e.codigo);
      return '<tr><td style="text-align:center">' +
        '<input type="checkbox" data-asignar="' + esc(e.codigo) + '"' +
          (a ? ' checked' : '') + (a && a.finalizada ? ' disabled' : '') + '></td>' +
        '<td><i class="punto" style="background:' + e.color + '"></i><strong>' + esc(e.nombre) + '</strong></td>' +
        '<td>' + (e.opcional
          ? '<span class="et ambar" title="Un tapabarro o un espejo no pasa por mecánica">no siempre</span>'
          : '<span class="et gris">siempre</span>') + '</td>' +
        '<td>' + (!a ? '<span style="color:var(--gris-2)">sin asignar</span>'
          : a.finalizada ? '<span class="et verde">cerrada ' + fCorta(a.finalizadaAt) + '</span>'
          : '<span class="et azul">abierta</span>') + '</td>' +
        '<td>' + (a && !a.finalizada
          ? '<button class="btn secundario" data-quitaretapa="' + esc(e.codigo) + '">Quitar</button>' : '') +
        '</td></tr>';
    }).join('')}</tbody>
  </table></div>

  <div style="margin-top:11px;display:flex;gap:8px;align-items:center">
    <button class="btn" id="btn-asignar">Asignar las marcadas</button>
    <span class="pie-nota" style="margin:0">Una etapa ya cerrada no se puede desmarcar: el historial no se edita.</span>
  </div>`;
}

/* ── Finalizar ─────────────────────────────────────────────────────────── */

function vFinalizarEtapas(o) {
  const asignadas = o.etapasAsignadas;
  if (!asignadas.length) {
    return '<div class="vacio"><div class="titulo">Esta orden no tiene etapas asignadas</div>' +
      '<div class="texto">Primero hay que declarar qué etapas aplican a este vehículo, ' +
      'en la pestaña <strong>Asignar</strong>.</div></div>';
  }

  const abiertas = asignadas.filter((x) => !x.finalizada);

  /* Quien reparte el trabajo cierra cualquier etapa y elige a nombre de quién.
     Quien lo hace con las manos cierra LA SUYA y a su nombre: no hay lista de
     personas que desplegar, porque no está eligiendo por nadie. */
  const reparte = Modelo.puede('etapa.asignar');
  const yo = Modelo.personaActual();
  const esMia = (a) => {
    if (reparte) return true;
    const etapa = Modelo.base().etapa.find((x) => x.codigo === a.codigo) || {};
    const oe = Modelo.base().ot_etapa.find((x) => x.ot_id === o.id && x.etapa_id === etapa.id && !x.salio_at);
    return !!(yo && oe && oe.persona_id === yo.id);
  };
  const mias = abiertas.filter(esMia);

  return `
  <div class="grid-envoltorio"><table class="grid">
    <thead><tr><th style="width:34px"></th><th>Estado</th><th>Etapa</th><th style="width:34%">Responsable</th><th>Cerrada</th></tr></thead>
    <tbody>${asignadas.map((a) => {
      const etapa = Modelo.base().etapa.find((x) => x.codigo === a.codigo) || {};
      const gente = Modelo.personasParaEtapa(etapa.id);
      const mia = esMia(a);
      return '<tr><td style="text-align:center">' +
        // La etapa cerrada PIERDE la casilla. En el original, `Desarme` la
        // conserva: es un error de renderizado que no se replica.
        (a.finalizada || !mia ? '' : '<input type="checkbox" data-cerrar="' + esc(a.codigo) + '">') + '</td>' +
        '<td>' + (a.finalizada
          ? '<span class="et verde">Completado</span>'
          : '<span class="et gris">Pendiente</span>') + '</td>' +
        '<td><i class="punto" style="background:' + a.color + '"></i><strong>' + esc(a.nombre) + '</strong></td>' +
        '<td>' + (a.finalizada
          ? '<span>' + esc(a.responsable || '—') + '</span>'
          : !reparte
            ? (mia ? '<span>' + esc(nombreCuenta(yo)) + '</span>'
                   : '<span style="color:var(--gris-2)">' + esc(a.responsable || 'de otra persona') + '</span>')
            : '<select data-resp="' + esc(a.codigo) + '">' +
              (gente.length
                ? gente.map((p) => '<option value="' + esc(p.id) + '">' + esc(p.nombre) + '</option>').join('')
                : '<option value="">Nadie habilitado para esta etapa</option>') + '</select>') + '</td>' +
        '<td class="num">' + (a.finalizadaAt ? fCorta(a.finalizadaAt) : '—') + '</td></tr>';
    }).join('')}</tbody>
  </table></div>

  ${Modelo.puede('foto.cargar') ? `<fieldset class="bloque" style="margin-top:12px"><legend>Fotografía del avance</legend>
    ${zonaFotos({ id: 'etapafoto', fotos: Modelo.mediaDe(o.id, 'proceso'),
      titulo: 'Agregar fotos del avance' })}
  </fieldset>` : ''}

  ${reparte ? `<div class="rejilla-campos" style="margin-top:12px">
    <div class="campo"><label>Fecha probable de entrega</label>
      <input type="date" id="f-compromiso" value="${o.fechaCompromiso ? isoFecha(o.fechaCompromiso) : ''}">
      <span class="ayuda">En el original el calendario está en inglés</span></div>
    <div class="campo"><label>&nbsp;</label>
      <button class="btn secundario" id="btn-compromiso">Guardar la fecha</button></div>
  </div>` : ''}

  <div style="margin-top:11px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
    <button class="btn" id="btn-finalizar" ${mias.length ? '' : 'disabled'}>Finalizar las marcadas</button>
    <span class="pie-nota" style="margin:0">
      ${mias.length
        ? (reparte ? 'Abiertas ahora: ' : 'Tuyas y abiertas: ') + '<strong>' +
          mias.map((a) => esc(a.nombre)).join(', ') + '</strong>. ' +
          'Se pueden cerrar varias en un mismo guardado.'
        : abiertas.length
          ? 'Las etapas abiertas de esta orden las tiene otra persona.'
          : 'Todas las etapas asignadas están cerradas.'}
    </span>
  </div>
`;
}

// El nombre para mostrar de una cuenta. Las cuentas de rol no tienen apellido.
const nombreCuenta = (p) => (p ? [p.nombres, p.apellidos].filter(Boolean).join(' ') : '—');

/* ── Cableado ──────────────────────────────────────────────────────────── */

function pEtapas(o) {
  document.querySelectorAll('[data-modoetapa]').forEach((b) => b.addEventListener('click', () => {
    ui.ficha.modoEtapas = b.dataset.modoetapa; refrescarFicha();
  }));

  const asignar = document.getElementById('btn-asignar');
  if (asignar) asignar.addEventListener('click', () => {
    const yaAsignadas = o.etapasAsignadas.map((x) => x.codigo);
    const codigos = Array.from(document.querySelectorAll('[data-asignar]:checked'))
      .map((c) => c.dataset.asignar)
      .filter((c) => yaAsignadas.indexOf(c) < 0);
    if (!codigos.length)
      return avisar({ ok: false, motivo: 'No hay ninguna etapa nueva marcada. Las que ya estaban asignadas no se vuelven a asignar.' });
    const ids = codigos.map((c) => (Modelo.base().etapa.find((e) => e.codigo === c) || {}).id);
    ejecutar(() => Modelo.asignar_etapas(o.id, ids),
      plural(codigos.length, 'etapa asignada', 'etapas asignadas') + '.');
  });

  document.querySelectorAll('[data-quitaretapa]').forEach((b) => b.addEventListener('click', () =>
    ejecutar(() => Modelo.quitar_etapa(o.id, b.dataset.quitaretapa), 'Etapa quitada.')));

  const finalizar = document.getElementById('btn-finalizar');
  if (finalizar) finalizar.addEventListener('click', () => {
    const yo = Modelo.personaActual();
    const asignaciones = Array.from(document.querySelectorAll('[data-cerrar]:checked')).map((c) => {
      const sel = document.querySelector('[data-resp="' + c.dataset.cerrar + '"]');
      // Sin lista de personas —el que solo cierra lo suyo— la etapa se cierra
      // a nombre de quien entró. Es su firma en el historial.
      return { codigo: c.dataset.cerrar,
        persona_id: sel && sel.value ? sel.value : (yo ? yo.id : null) };
    });
    if (!asignaciones.length)
      return avisar({ ok: false, motivo: 'No marcaste ninguna etapa para finalizar.' });
    ejecutar(() => Modelo.finalizar_etapas(o.id, asignaciones),
      plural(asignaciones.length, 'etapa finalizada', 'etapas finalizadas') + ' en un solo guardado.');
  });

  // Las fotos del avance se suben apenas se sueltan: son del trabajo, no del
  // guardado. Quien no tiene `foto.cargar` no ve el bloque y no hay nada que
  // cablear.
  if (Modelo.puede('foto.cargar')) montarZonaFotos({
    id: 'etapafoto', momento: 'proceso', ot_id: o.id,
    alSubir: (fichas) => {
      Modelo.adjuntar_media(null, [o.id], fichas.map((x) => Object.assign(x, { ot_id: o.id })));
      refrescarFicha();
    }
  });

  const guardarFecha = document.getElementById('btn-compromiso');
  if (guardarFecha) guardarFecha.addEventListener('click', () => {
    const v = document.getElementById('f-compromiso').value;
    if (!v) return avisar({ ok: false, motivo: 'Hay que elegir una fecha.' });
    // El input date entrega 'aaaa-mm-dd'; se arma la fecha local para que no
    // se corra un día por la zona horaria.
    const [a, m, d] = v.split('-').map(Number);
    ejecutar(() => Modelo.fijar_fecha_compromiso(o.id, new Date(a, m - 1, d)), 'Fecha probable guardada.');
  });
}

const isoFecha = (d) => d.getFullYear() + '-' +
  String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
