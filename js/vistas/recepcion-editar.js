/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   EDITAR RECEPCIÓN — la cuarta opción del menú de Recepción.

   Era la única que no estaba construida, y no por tiempo: una recepción es lo
   que el cliente firmó. Marco la pidió el 15-08-2026 y se construyó con tres
   respuestas que quedan anotadas para que el taller las confirme —están
   escritas al lado de la operación, en `corregir_recepcion`—:

     · **se versiona**, no se pisa;
     · la hace **quien tiene `ot.editar`** —recepción y administración—;
     · el papel firmado no se toca: el **impreso dice qué versión es**.

   Lo que se corrige acá: cliente, vehículo, los datos de la recepción y el
   checklist de los 28 ítems. ⚠️ Los **daños dibujados en la silueta** no se
   editan todavía: se corrigen volviendo a marcarlos, que es otra pantalla y
   está declarado como pendiente, no resuelto a medias.

   Vive en su propio archivo a propósito. `recepcion.js` lo está trabajando
   Benjamín en paralelo y dos manos en el mismo archivo terminan en conflicto;
   acá el enganche son cuatro líneas allá y todo lo demás está en éste.
   ──────────────────────────────────────────────────────────────────────── */

function editRec() {
  ui.editarRec = ui.editarRec || { otId: null, campos: null, inventario: {}, motivo: '', bloque: 'cliente' };
  return ui.editarRec;
}

/* Carga la orden en el formulario. Se hace UNA vez al entrar y no en cada
   pintado: si se recargara siempre, cada tecla que escribe el usuario se
   perdería con el siguiente render. */
function editRecCargar(o) {
  const e = editRec();
  e.otId = o.id;
  e.motivo = '';
  e.bloque = 'cliente';
  e.campos = {
    nombres: o.cliente || '', rut: o.rut || '', telefono: o.telefono || '',
    correo: o.correo || '', direccion: o.direccion || '',
    patente: o.patente || '', vin: o.vin || '', anio: o.anio || '',
    marca_id: o.marcaId || '', modelo_id: o.modeloId || '', color_id: o.colorId || '',
    km: (o.recepcion && o.recepcion.km) || '',
    combustible: (o.recepcion && o.recepcion.combustible != null) ? o.recepcion.combustible : '',
    observaciones: (o.recepcion && o.recepcion.observaciones) || ''
  };
  e.inventario = {};
  (o.inventario || []).forEach((i) => { if (i.itemId) e.inventario[i.itemId] = i.estado; });

  /* Copia de trabajo de los daños. Se COPIA y no se apunta a la del modelo:
     mientras el recepcionista raya y borra, la orden de verdad no se toca
     hasta que aprieta guardar — y si se arrepiente, «Descartar lo escrito»
     vuelve a la silueta que estaba firmada. */
  e.danos = (o.danos || []).map((d) => ({
    vista: d.vista, zona: d.zona, zonaNombre: d.zonaNombre,
    severidad: d.severidad, x: d.x, y: d.y,
    descripcion: d.descripcion || '',
    trazo: d.trazo ? d.trazo.map((p) => ({ x: p.x, y: p.y })) : null
  }));
}

const EDIT_REC_BLOQUES = [
  { id: 'cliente',    rot: 'Cliente' },
  { id: 'vehiculo',   rot: 'Vehículo' },
  { id: 'recepcion',  rot: 'Recepción' },
  { id: 'inventario', rot: 'Checklist' },
  { id: 'danos',      rot: 'Daños' }
];

function vRecepcionEditarFicha() {
  const e = editRec();
  const o = e.otId ? Modelo.otPorId(e.otId) : null;
  if (!o) {
    return '<div class="panel"><div class="cuerpo"><div class="vacio">' +
      '<div class="titulo">No se pudo abrir esa recepción</div>' +
      '<div class="texto">Vuelve a buscarla por patente.</div>' +
      '<div style="margin-top:9px"><button class="btn secundario" id="rec-volver">Volver</button></div>' +
      '</div></div></div>';
  }

  const correcciones = o.recepcion ? Modelo.correccionesDeRecepcion(o.recepcion.id) : [];
  const version = correcciones.length ? correcciones[0].version : 1;

  const pestana = (b) => '<button type="button" class="' + (e.bloque === b.id ? 'activo' : '') +
    '" data-edrec-bloque="' + b.id + '">' + esc(b.rot) + '</button>';

  return `
  <button class="btn volver" id="rec-volver"><span class="flecha-atras">&#8592;</span>
    Volver a buscar otra patente</button>
  <div class="panel">
    <div class="cab"><div><h2>${ico('documento', 'g')}Editar Recepción</h2>
      <div class="desc">OT ${o.numeroOT} · <span class="patente">${esc(o.patente)}</span> ·
        recibido el ${fFecha(o.fechaIngreso)}</div></div>
      <span class="et ${version > 1 ? 'azul' : 'gris'}">versión ${version}</span>
    </div>
    <div class="cuerpo">
      <div class="nota info">${ico('info')}
        <strong>Esto no borra lo anterior.</strong> La recepción se versiona, igual que el
        presupuesto: lo que estaba queda guardado con quién lo cambió, cuándo y por qué, y el
        comprobante impreso dice qué versión es. El papel que firmó el cliente sigue siendo el
        original — lo que se corrige es lo que el sistema dice de él.
      </div>

      <div class="tabs" style="margin:12px 0 10px">${EDIT_REC_BLOQUES.map(pestana).join('')}</div>

      ${e.bloque === 'inventario' ? vEditRecInventario()
        : e.bloque === 'danos' ? vEditRecDanos()
        : vEditRecCampos(e)}

      <div class="rejilla-campos" style="margin-top:12px">
        <div class="campo" style="grid-column:1/-1">
          <label>Motivo de la corrección <span style="color:var(--rojo)">*</span></label>
          <textarea rows="2" id="edrec-motivo"
            placeholder="Qué se equivocó y cómo se supo">${esc(e.motivo)}</textarea>
          <span class="ayuda">Obligatorio. Es lo único que separa una corrección de una
            alteración: sin motivo el registro dice qué se cambió, pero no por qué</span></div>
      </div>
      <div style="margin-top:9px;display:flex;gap:8px">
        <button class="btn" id="edrec-guardar">Guardar la corrección</button>
        <button class="btn secundario" id="edrec-deshacer">Descartar lo escrito</button>
      </div>

      ${correcciones.length ? `
      <h3 style="font-size:13px;margin:16px 0 6px">Correcciones anteriores</h3>
      <div class="grid-envoltorio"><table class="grid">
        <thead><tr><th style="width:70px">Versión</th><th style="width:110px">Fecha</th>
          <th style="width:150px">Quién</th><th>Qué cambió</th><th>Motivo</th></tr></thead>
        <tbody>${correcciones.map((c) => '<tr>' +
          '<td class="num">v' + c.version + '</td>' +
          '<td class="num">' + esc(fCorta(c.fecha)) + '</td>' +
          '<td>' + esc(c.quien) + '</td>' +
          '<td>' + c.cambios.map((x) => '<div class="ayuda" style="margin:0">' + esc(x.campo) +
            ': <s>' + esc(x.antes || '—') + '</s> → <strong>' + esc(x.despues || '—') +
            '</strong></div>').join('') + '</td>' +
          '<td>' + esc(c.motivo) + '</td></tr>').join('')}
        </tbody></table></div>` : ''}

      <div class="nota" style="margin-top:12px">
        <strong>La firma no se vuelve a pedir acá, y no es un pendiente técnico.</strong> Volver a
        firmar es tener al cliente otra vez adelante, y si hay que hacerlo o no es la pregunta que
        está sobre la mesa del taller: si el papel de la versión 1 sigue valiendo, o cada corrección
        se firma de nuevo. Mientras no se responda, la firma que hay es la de la versión 1 y el
        comprobante lo dice.
      </div>
    </div>
  </div>`;
}

/* Los tres bloques de campos. Se arman con la misma rejilla del ingreso para
   que sea la misma pantalla que el recepcionista ya conoce, no una nueva. */
function vEditRecCampos(e) {
  const c = e.campos;
  const campo = (clave, rot, extra) => '<div class="campo"><label>' + esc(rot) + '</label>' +
    '<input data-edrec="' + clave + '" value="' + esc(c[clave] == null ? '' : c[clave]) + '" ' +
    (extra || '') + '></div>';
  const cat = (clave, rot, tabla) => {
    let filas = Modelo.catalogo(tabla).filter((x) => x.activo !== false);
    // Los modelos son de una marca. Ofrecer los 60 con la marca ya elegida es
    // la forma más simple de que alguien guarde un Corolla marca Nissan.
    if (tabla === 'modelo' && c.marca_id) filas = filas.filter((x) => x.marca_id === c.marca_id);
    return '<div class="campo"><label>' + esc(rot) + '</label>' +
      '<select data-edrec="' + clave + '"><option value="">Sin definir</option>' +
      filas.map((f) => '<option value="' + esc(f.id) + '"' +
        (String(c[clave]) === String(f.id) ? ' selected' : '') + '>' + esc(f.nombre) + '</option>').join('') +
      '</select></div>';
  };

  if (e.bloque === 'cliente') {
    return '<div class="rejilla-campos" style="margin-top:11px">' +
      campo('nombres', 'Nombre del cliente') +
      campo('rut', 'RUT') +
      campo('telefono', 'Teléfono') +
      campo('correo', 'Correo') +
      '<div class="campo" style="grid-column:1/-1">' +
        '<label>Dirección</label><input data-edrec="direccion" value="' +
        esc(c.direccion || '') + '"></div>' +
      '</div>';
  }

  if (e.bloque === 'vehiculo') {
    return '<div class="rejilla-campos" style="margin-top:11px">' +
      campo('patente', 'Patente', 'maxlength="' + PATENTE_LARGO + '" autocomplete="off"') +
      campo('vin', 'VIN', 'maxlength="' + VIN_LARGO + '" autocomplete="off"') +
      cat('marca_id', 'Marca', 'marca') +
      cat('modelo_id', 'Modelo', 'modelo') +
      cat('color_id', 'Color', 'color_vehiculo') +
      campo('anio', 'Año', 'type="number" min="1950" max="2035"') +
      '</div>';
  }

  // Recepción: kilometraje, combustible y observaciones.
  const combustible = [];
  for (let i = 0; i <= 8; i++) combustible.push(i);
  return '<div class="rejilla-campos" style="margin-top:11px">' +
    campo('km', 'Kilometraje', 'type="number" min="0"') +
    '<div class="campo"><label>Combustible</label><select data-edrec="combustible">' +
      '<option value="">Sin registrar</option>' +
      combustible.map((n) => '<option value="' + n + '"' +
        (String(c.combustible) === String(n) ? ' selected' : '') + '>' + n + '/8</option>').join('') +
      '</select></div>' +
    '<div class="campo" style="grid-column:1/-1"><label>Observaciones de la recepción</label>' +
      '<textarea rows="3" data-edrec="observaciones">' + esc(c.observaciones || '') + '</textarea></div>' +
    '</div>';
}

/* El checklist, con los mismos cuatro estados que el ingreso. `sin_verificar`
   se ofrece igual: si un ítem se marcó por error, poder devolverlo a "nadie lo
   miró" es tan necesario como marcarlo. */
function vEditRecInventario() {
  const e = editRec();
  const estados = Modelo.inventarioEstados();
  const items = Modelo.catalogo('inventario_item');

  // Los mismos cuatro botones del ingreso, con las mismas clases y los mismos
  // iconos. Es el mismo gesto: si acá fuera otra cosa, habría que aprender dos.
  const fila = (it) => {
    const v = e.inventario[it.id] || 'sin_verificar';
    return '<tr><td>' + esc(it.nombre) +
      ' <span class="cod" style="font-size:10.5px;color:var(--gris-2)">' + esc(it.codigo) + '</span></td>' +
      '<td><span class="inv-botones">' +
        estados.map((s) => '<button type="button" class="inv-btn ' + s.clase +
          (v === s.codigo ? ' activo' : '') + '" data-edrec-inv="' + esc(it.id) +
          '" data-estado="' + esc(s.codigo) + '" title="' + esc(s.nombre) + '" ' +
          'aria-label="' + esc(it.nombre + ': ' + s.nombre) + '">' +
          ico(s.icono) + '</button>').join('') +
      '</span></td></tr>';
  };

  return '<div class="grid-envoltorio" style="margin-top:11px"><table class="grid">' +
    '<thead><tr><th>Elemento</th><th style="width:290px">Estado</th></tr></thead>' +
    '<tbody>' + items.map(fila).join('') + '</tbody></table></div>';
}

/* ── Los daños de la silueta ───────────────────────────────────────────
   El pendiente que quedó declarado el 15-08-2026 y que se cierra acá.

   Se raya igual que en el ingreso —el mismo dibujo, el mismo gesto— pero con
   los handlers escritos en este archivo y no reutilizando los de
   `recepcion.js`: aquéllos están amarrados al borrador del formulario
   (`rec().danos`, `guardarBorrador()`), y hacerlos genéricos era meter mano en
   el archivo que Benjamín está trabajando. Lo que sí se reutiliza es lo que ya
   es común: el SVG, la ubicación por coordenada y el trazado.

   La corrección reemplaza la lista ENTERA, porque así es el gesto: se raya y
   se borra lo que se rayó de más. Lo que había queda guardado completo en la
   fila de corrección, con sus trazos, así que la silueta firmada se puede
   volver a dibujar. */
function vEditRecDanos() {
  const e = editRec();
  const n = e.danos.length;

  const lista = n
    ? '<div class="grid-envoltorio"><table class="grid">' +
      '<thead><tr><th style="width:34px">#</th><th>Dónde cayó la marca</th>' +
      '<th>Observación</th><th style="width:84px"></th></tr></thead><tbody>' +
      e.danos.map((d, i) => '<tr><td class="num">' + (i + 1) + '</td>' +
        '<td>' + esc(d.zonaNombre || 'Sin zona identificada') +
          '<div class="ayuda" style="margin:2px 0 0">' +
          esc(SILUETA_NOMBRE_VISTA[d.vista] || d.vista || '—') + '</div></td>' +
        '<td><input data-edrec-dano="' + i + '" value="' + esc(d.descripcion || '') + '" ' +
          'placeholder="Qué es la marca"></td>' +
        '<td><button class="btn secundario" data-edrec-quitar="' + i + '">Quitar</button></td></tr>').join('') +
      '</tbody></table></div>'
    : '<div class="nota" style="margin-top:9px">La recepción quedó <strong>sin marcas</strong> en la ' +
      'silueta. Si el auto entró con daños y no se marcaron, se marcan acá.</div>';

  return `
  <div class="estado-descriptivo" style="margin-top:11px">
    <div class="ed-dibujo">
      <div class="lienzo">${svgSilueta()}</div>
      <div class="ed-barra">
        <span class="ayuda">Raya sobre el auto para agregar una marca. <span id="n-marcas-ed">${
          n ? plural(n, 'marca', 'marcas') : 'sin marcas'}</span></span>
        <span style="display:flex;gap:6px">
          <button class="btn secundario" id="edrec-dano-deshacer">Deshacer el último</button>
          <button class="btn secundario" id="edrec-dano-borrar">Borrar todo</button>
        </span>
      </div>
    </div>
    <div class="ed-lado">${lista}</div>
  </div>`;
}

/* Redibuja las marcas dentro del SVG. Es la misma idea que `pintarDanos()` del
   ingreso, sobre la copia de trabajo de esta pantalla. */
function pintarDanosEditor() {
  const e = editRec();
  const g = document.getElementById('marcas');
  if (!g) return;
  g.innerHTML = e.danos.map((d, i) => {
    const p = (d.trazo && d.trazo.length) ? d.trazo : [siluetaPuntoDeZona(d.vista, d.zona)];
    return '<path class="trazo-dano" data-trazo="' + i + '" d="' + siluetaTrazoD(p) + '"></path>';
  }).join('');
  const n = document.getElementById('n-marcas-ed');
  if (n) n.textContent = e.danos.length ? plural(e.danos.length, 'marca', 'marcas') : 'sin marcas';
}

function pEditRecDanos() {
  const e = editRec();
  const svg = document.querySelector('.lienzo svg');
  if (!svg) return;
  const zonas = Modelo.zonasDano();

  /* El trazo se dibuja en vivo dentro del propio SVG y recién al soltar se
     convierte en una marca.

     ⚠️ Las coordenadas van de 0 a 1, NO en píxeles de la caja. Es la convención
     de `silueta.js` —`siluetaUbicar` y `siluetaTrazoD` multiplican ellos por
     `SILUETA_CAJA`— y es la correcta: la misma raya tiene que caer en la misma
     pieza en el computador del mesón y en el teléfono del jefe de taller.
     Escrito al revés la primera vez, la marca se dibujaba fuera de la lámina y
     `zonaNombre` volvía siempre nulo. */
  let puntos = null, vivo = null;
  const donde = (ev) => {
    const c = svg.getBoundingClientRect();
    return { x: Number(((ev.clientX - c.left) / c.width).toFixed(4)),
             y: Number(((ev.clientY - c.top) / c.height).toFixed(4)) };
  };

  svg.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    puntos = [donde(ev)];
    vivo = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    vivo.setAttribute('class', 'trazo-dano');
    svg.appendChild(vivo);
    if (svg.setPointerCapture) { try { svg.setPointerCapture(ev.pointerId); } catch (x) { /* nada */ } }
  });

  svg.addEventListener('pointermove', (ev) => {
    if (!puntos) return;
    puntos.push(donde(ev));
    if (vivo) vivo.setAttribute('d', siluetaTrazoD(puntos));
  });

  const soltar = () => {
    if (!puntos) return;
    const p = puntos;
    puntos = null;
    if (vivo && vivo.parentNode) vivo.parentNode.removeChild(vivo);
    vivo = null;
    // Un toque suelto no es una raya: sin esto, cualquier clic para mirar el
    // dibujo dejaba una marca en la recepción de un auto.
    if (p.length < 2) return pintarDanosEditor();

    // El centro del trazo decide la zona, con el promedio: una raya que cruza
    // dos piezas pertenece a la que más recorre.
    const cx = p.reduce((s, q) => s + q.x, 0) / p.length;
    const cy = p.reduce((s, q) => s + q.y, 0) / p.length;
    const u = siluetaUbicar(cx, cy);
    const z = u.zona ? zonas.find((x) => x.codigo === u.zona) : null;

    e.danos.push({
      vista: u.vista, zona: u.zona, zonaNombre: z ? z.nombre : null,
      severidad: 2, descripcion: '',
      x: Number(cx.toFixed(4)), y: Number(cy.toFixed(4)), trazo: p
    });
    render();
  };
  svg.addEventListener('pointerup', soltar);
  svg.addEventListener('pointerleave', soltar);
  svg.addEventListener('pointercancel', soltar);

  pintarDanosEditor();

  document.querySelectorAll('[data-edrec-quitar]').forEach((b) => b.addEventListener('click', () => {
    e.danos.splice(Number(b.dataset.edrecQuitar), 1);
    render();
  }));
  document.querySelectorAll('[data-edrec-dano]').forEach((el) => el.addEventListener('input', () => {
    e.danos[Number(el.dataset.edrecDano)].descripcion = el.value;
  }));

  const deshacer = document.getElementById('edrec-dano-deshacer');
  if (deshacer) deshacer.addEventListener('click', () => {
    if (!e.danos.length) return avisar({ ok: false, motivo: 'No hay ninguna marca.' });
    e.danos.pop(); render();
  });
  const borrar = document.getElementById('edrec-dano-borrar');
  if (borrar) borrar.addEventListener('click', () => {
    if (!e.danos.length) return avisar({ ok: false, motivo: 'No hay nada que borrar.' });
    if (!confirm('¿Borrar las ' + e.danos.length + ' marcas de la silueta?')) return;
    e.danos = []; render();
  });
}

function pRecepcionEditarFicha() {
  const e = editRec();
  const volver = document.getElementById('rec-volver');
  if (volver) volver.addEventListener('click', () => {
    rec().pantalla = 'editar'; ui.editarRec = null; render();
  });

  document.querySelectorAll('[data-edrec-bloque]').forEach((b) => b.addEventListener('click', () => {
    e.bloque = b.dataset.edrecBloque; render();
  }));

  if (e.bloque === 'danos') pEditRecDanos();

  /* Se guarda en el estado a cada tecla, no al pintar: el usuario puede saltar
     entre los cuatro bloques antes de guardar y no puede perder lo escrito en
     el anterior. La patente se normaliza igual que en el ingreso — la misma
     patente escrita de dos formas es dos vehículos. */
  document.querySelectorAll('[data-edrec]').forEach((el) => {
    const clave = el.dataset.edrec;
    el.addEventListener('input', () => {
      e.campos[clave] = clave === 'patente' ? normalizarPatente(el.value) : el.value;
      if (clave === 'patente' && el.value !== e.campos[clave]) el.value = e.campos[clave];
    });
    el.addEventListener('change', () => { e.campos[clave] = el.value; });
  });

  document.querySelectorAll('[data-edrec-inv]').forEach((b) => b.addEventListener('click', () => {
    e.inventario[b.dataset.edrecInv] = b.dataset.estado;
    render();
  }));

  const motivo = document.getElementById('edrec-motivo');
  if (motivo) motivo.addEventListener('input', () => { e.motivo = motivo.value; });

  const descartar = document.getElementById('edrec-deshacer');
  if (descartar) descartar.addEventListener('click', () => {
    const o = Modelo.otPorId(e.otId);
    if (o) editRecCargar(o);
    render();
    avisar({ ok: true, motivo: 'Se descartó lo escrito. La recepción quedó como estaba.' });
  });

  const guardar = document.getElementById('edrec-guardar');
  if (guardar) guardar.addEventListener('click', () => {
    const c = e.campos;
    const zonas = Modelo.zonasDano();
    const o = Modelo.otPorId(e.otId);
    if (!o) return avisar({ ok: false, motivo: 'La orden ya no está abierta.' });

    /* Los dos largos se exigen SOBRE LO QUE SE ESTÁ CAMBIANDO, no sobre lo que
       ya estaba. Si no, corregir un teléfono obligaba a arreglar de paso un VIN
       que alguien digitó corto hace tres meses, y eso deja al recepcionista sin
       poder guardar nada — que es peor que el dato corto. Lo viejo se arregla
       el día que alguien lo toque a propósito. */
    if (c.patente !== o.patente && c.patente.length !== PATENTE_LARGO)
      return avisar({ ok: false, motivo: 'La patente tiene ' + c.patente.length +
        ' caracteres y son ' + PATENTE_LARGO + '.' });
    if (c.vin !== (o.vin || '') && c.vin && c.vin.length !== VIN_LARGO)
      return avisar({ ok: false, motivo: 'El VIN tiene ' + c.vin.length + ' caracteres y son ' +
        VIN_LARGO + ' (norma ISO 3779).' });

    const cambios = {
      cliente: { nombres: c.nombres, rut: c.rut, telefono: c.telefono,
                 correo: c.correo, direccion: c.direccion },
      vehiculo: { patente: c.patente, vin: c.vin, anio: c.anio === '' ? null : Number(c.anio),
                  marca_id: c.marca_id || null, modelo_id: c.modelo_id || null,
                  color_id: c.color_id || null },
      recepcion: { km: c.km === '' ? null : Number(c.km),
                   combustible: c.combustible === '' ? null : Number(c.combustible),
                   observaciones: c.observaciones },
      inventario: e.inventario,
      // La zona viaja como código mientras se dibuja —es lo que devuelve la
      // silueta— y se resuelve a su id recién acá, igual que en el ingreso.
      danos: e.danos.map((d) => ({
        vista: d.vista, zona_id: (zonas.find((z) => z.codigo === d.zona) || {}).id || null,
        tipo_id: null, severidad: d.severidad || 2,
        zonaNombre: d.zonaNombre, x: d.x, y: d.y,
        descripcion: d.descripcion || '', trazo: d.trazo || null
      }))
    };

    ejecutar(() => Modelo.corregir_recepcion(e.otId, cambios, e.motivo),
      'Recepción corregida. Quedó como versión nueva, con lo que decía antes, quién lo cambió y ' +
      'por qué — y el comprobante impreso ahora dice qué versión es.',
      () => {
        const o = Modelo.otPorId(e.otId);
        if (o) editRecCargar(o);
        render();
      });
  });
}
