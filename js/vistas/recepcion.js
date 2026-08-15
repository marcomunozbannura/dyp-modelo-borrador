/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   NUEVO INGRESO — la pantalla más rica del sistema.

   Es la única que NO se puede probar en el sistema actual sin meter
   un vehículo real al taller, así que acá vale doble.

   Lo que se replica tal cual del original (`?ver=ingreso`):
     · El formulario POR PASOS, con Anterior y Siguiente.
     · Las seis secciones, con sus nombres: Recepción · Datos del cliente ·
       Solicitud de reparación · Datos del Vehículo · Estado descriptivo.
     · Los 28 ítems del checklist, con su campo de observación por ítem.
     · El combustible en NUEVE posiciones (0/8 a 8/8), no ocho.
     · 🔴 Y lo que nuestro diseño no tenía: los campos de la solicitud son
       ARREGLOS con botón `+`. **Una recepción puede generar varias órdenes**,
       cada una con su siniestro, su compañía y su deducible.

   Lo que se corrige:
     · Marca, modelo, color, compañía, prioridad y estado salen del CATÁLOGO,
       no de listas escritas en el HTML. Modelo depende de marca, y los tres
       primeros se ESCRIBEN: la lista se achica sola y, si el valor no está,
       se agrega al catálogo sin salir de la recepción.
     · La silueta es una sola vista, la superior. Antes ofrecía cinco pestañas
       y las cinco dibujaban lo mismo.
     · Sin firma en pantalla: el comprobante se firma en papel.
     · Las fotos se comprimen antes de guardar y el peso se muestra en
       pantalla — ver media.js.
     · El borrador se guarda solo. Un formulario de 90 campos que se pierde
       al recargar es una forma de perder el trabajo de la recepcionista.
   ──────────────────────────────────────────────────────────────────────── */

const RECEPCION_PASOS = [
  { id: 'vehiculo',   n: 'Datos del vehículo' },
  { id: 'cliente',    n: 'Datos del cliente' },
  { id: 'ordenes',    n: 'Solicitud de reparación' },
  { id: 'danos',      n: 'Estado descriptivo' },
  { id: 'inventario', n: 'Inventario' },
  { id: 'cierre',     n: 'Fotografías' }
];

const CLAVE_BORRADOR = 'dyp-recepcion-borrador';

/* ── Estado del formulario ─────────────────────────────────────────────── */

function bloqueVacio() {
  return { tipo_ingreso_id: 'ti-1', compania_id: 'co-1', siniestro: '', deducible: '',
           liquidador: '', prioridad_id: 'pri-1', estado: 'recibido', descripcion_danos: '',
           descripcion_estado: '', responsable_id: '' };
}

function rec() {
  if (!ui.recepcion || !ui.recepcion.bloques) {
    ui.recepcion = restaurarBorrador() || {
      paso: 'vehiculo',
      // La llave de idempotencia nace con el formulario: si el usuario aprieta
      // Guardar dos veces, la segunda devuelve lo mismo que la primera.
      llave: 'rec-' + Date.now().toString(36),
      campos: { patente: '', marca_id: '', modelo_id: '', color_id: '', anio: '', vin: '', km: '',
                combustible: '4', rut: '', nombres: '', apellidos: '', telefono: '', celular: '',
                correo: '', direccion: '', observaciones: '' },
      // Lo que se escribió en cada combo. Se guarda aparte del id porque
      // mientras se teclea todavía no calza con ninguna fila del catálogo.
      textos: {},
      bloques: [bloqueVacio()],
      danos: [], tipoDano: 'abolladura',
      inventario: {}, obsInventario: {},
      fotos: [], creadas: null
    };
  }
  return ui.recepcion;
}

/* El borrador se persiste sin las fotos crudas: de esas solo va la ficha, y
   los bytes ya están en IndexedDB. Por eso sobrevive a F5. */
function guardarBorrador() {
  try {
    const r = rec();
    localStorage.setItem(CLAVE_BORRADOR, JSON.stringify({
      paso: r.paso, llave: r.llave, campos: r.campos, bloques: r.bloques,
      danos: r.danos, tipoDano: r.tipoDano, textos: r.textos,
      inventario: r.inventario, obsInventario: r.obsInventario,
      fotos: r.fotos
    }));
  } catch (e) { /* sin almacenamiento: el formulario sigue vivo en memoria */ }
}

function restaurarBorrador() {
  try {
    const crudo = localStorage.getItem(CLAVE_BORRADOR);
    if (!crudo) return null;
    const d = JSON.parse(crudo);
    if (!d || !d.bloques) return null;
    return Object.assign({ creadas: null }, d);
  } catch (e) { return null; }
}

function limpiarBorrador() {
  try { localStorage.removeItem(CLAVE_BORRADOR); } catch (e) { /* nada */ }
  ui.recepcion = null;
  rec();
}

/* ── Validación ────────────────────────────────────────────────────────── */

/* Los obligatorios son los que el original marca con asterisco, MENOS el VIN
   (decisión del 13-08-2026). El formulario del sistema actual lo exige, pero en
   el taller no siempre se tiene a mano al recibir el vehículo, y un campo
   obligatorio que no se puede llenar termina rellenándose con cualquier cosa
   —que es peor que dejarlo vacío—. El campo sigue estando y se puede completar
   después: lo que se sacó es el bloqueo, no el dato. */
const REC_OBLIGATORIOS = [
  ['patente', 'La patente', 'vehiculo'], ['km', 'El kilometraje', 'vehiculo'],
  ['rut', 'El RUT del cliente', 'cliente'], ['nombres', 'El nombre del cliente', 'cliente'],
  ['telefono', 'El teléfono', 'cliente'], ['direccion', 'El domicilio', 'cliente']
];

function recFaltantes() {
  const r = rec();
  const faltan = REC_OBLIGATORIOS
    .filter(([c]) => !String(r.campos[c] || '').trim())
    .map(([, rot, paso]) => ({ rot, paso }));
  r.bloques.forEach((b, i) => {
    const t = Modelo.catalogo('tipo_ingreso').find((x) => x.id === b.tipo_ingreso_id);
    if (t && t.exige_compania && !b.compania_id)
      faltan.push({ rot: 'La compañía de la orden ' + (i + 1), paso: 'ordenes' });
    if (t && t.exige_compania && !String(b.siniestro || '').trim())
      faltan.push({ rot: 'El N° de siniestro de la orden ' + (i + 1), paso: 'ordenes' });
  });
  return faltan;
}

/* ── La vista ──────────────────────────────────────────────────────────── */

function vRecepcion() {
  const r = rec();
  if (r.creadas) return vRecepcionResultado(r);

  /* El borrador se restaura de `localStorage`, y de ahí puede volver con un
     paso que ya no existe —una versión anterior del formulario, o el archivo
     tocado a mano—. Antes eso reventaba la pantalla entera y dejaba Recepción
     inservible hasta borrar los datos del navegador. Ahora vuelve al primero:
     el formulario está completo igual, solo cambia dónde se para. */
  if (!RECEPCION_PASOS.some((p) => p.id === r.paso)) r.paso = RECEPCION_PASOS[0].id;

  const i = RECEPCION_PASOS.findIndex((p) => p.id === r.paso);
  const cuerpo = {
    vehiculo: recVehiculo, cliente: recCliente, ordenes: recOrdenes,
    danos: recDanos, inventario: recInventario, cierre: recCierre
  }[r.paso]();

  const faltan = recFaltantes();

  return `
  <div class="panel">
    <div class="cab">
      <div><h2>${ico('recepcion', 'g')}Nuevo ingreso</h2>
        <div class="desc">Formulario por pasos, como el original. El borrador se guarda solo.</div></div>
      <div class="chips">
        ${RECEPCION_PASOS.map((p, k) => '<button class="chip' + (p.id === r.paso ? ' activo' : '') +
          '" data-paso="' + p.id + '">' + (k + 1) + ' · ' + esc(p.n) + '</button>').join('')}
      </div>
    </div>
    <div class="cuerpo">${cuerpo}</div>
  </div>

  <div class="panel">
    <div class="cuerpo" style="display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap">
      <span class="pie-nota" style="margin:0">
        ${faltan.length
          ? '<span style="color:var(--ambar)">Faltan ' + faltan.length + ' campos obligatorios: ' +
            esc(faltan.slice(0, 3).map((f) => f.rot).join(', ')) + (faltan.length > 3 ? '…' : '') + '</span>'
          : 'Listo para guardar. Se van a crear <strong>' + r.bloques.length + '</strong> ' +
            (r.bloques.length === 1 ? 'orden de trabajo' : 'órdenes de trabajo') + '.'}
      </span>
      <span style="display:flex;gap:8px">
        <button class="btn secundario" id="rec-limpiar">Descartar borrador</button>
        <button class="btn secundario" id="rec-ant" ${i <= 0 ? 'disabled' : ''}>Anterior</button>
        <button class="btn secundario" id="rec-sig" ${i >= RECEPCION_PASOS.length - 1 ? 'disabled' : ''}>Siguiente</button>
        <button class="btn" id="rec-guardar">Guardar recepción</button>
      </span>
    </div>
  </div>`;
}

/* Redibujar la pantalla mata el foco. Se devuelve al campo que se estaba
   escribiendo, con el cursor al final: si no, teclear se vuelve imposible. */
function enfocar(clave, posicion) {
  const el = document.querySelector('[data-combo="' + clave + '"]');
  if (!el || el.disabled) return;
  el.focus();
  try { el.setSelectionRange(posicion, posicion); } catch (e) { /* algunos tipos no lo permiten */ }
}

/* Campo de texto amarrado a `campos`. */
function recCampo(clave, rotulo, opciones) {
  const o = opciones || {};
  const r = rec();
  const v = r.campos[clave] == null ? '' : r.campos[clave];
  const obliga = REC_OBLIGATORIOS.some(([c]) => c === clave);
  return '<div class="campo"><label>' + esc(rotulo) +
    (obliga ? ' <span style="color:var(--rojo)">*</span>' : '') + '</label>' +
    '<input type="' + (o.tipo || 'text') + '" data-rec="' + clave + '" value="' + esc(v) + '"' +
    (o.marcador ? ' placeholder="' + esc(o.marcador) + '"' : '') + '>' +
    (o.ayuda ? '<span class="ayuda">' + esc(o.ayuda) + '</span>' : '') + '</div>';
}

function recSelect(clave, rotulo, filas, opciones) {
  const o = opciones || {};
  const v = rec().campos[clave];
  return '<div class="campo"><label>' + esc(rotulo) + '</label>' +
    '<select data-rec="' + clave + '">' +
    (o.vacio ? '<option value="">' + esc(o.vacio) + '</option>' : '') +
    filas.map((f) => '<option value="' + esc(f.id) + '"' + (String(v) === String(f.id) ? ' selected' : '') +
      '>' + esc(f.nombre) + '</option>').join('') + '</select>' +
    (o.ayuda ? '<span class="ayuda">' + esc(o.ayuda) + '</span>' : '') + '</div>';
}

/* Campo de catálogo que se ESCRIBE, no se elige de una lista larga.
   Marca tiene 73 valores y color 169: buscarlos con el mouse es más lento que
   teclear tres letras. Se escribe, la lista se va achicando sola, y si el
   valor no existe aparece el botón para agregarlo al catálogo sin salir de la
   recepción. El id se resuelve por nombre; mientras no calce, queda vacío. */
function recCombo(clave, rotulo, filas, tabla, opciones) {
  const o = opciones || {};
  const r = rec();
  const sel = filas.find((f) => String(f.id) === String(r.campos[clave]));
  const escrito = r.textos[clave] != null ? r.textos[clave] : (sel ? sel.nombre : '');
  const limpio = String(escrito).trim();
  const calza = filas.find((f) => String(f.nombre).toLowerCase() === limpio.toLowerCase());
  const obliga = REC_OBLIGATORIOS.some(([c]) => c === clave);
  const lista = 'dl-' + clave;

  return '<div class="campo"><label>' + esc(rotulo) +
    (obliga ? ' <span style="color:var(--rojo)">*</span>' : '') + '</label>' +
    '<input type="text" autocomplete="off" list="' + lista + '" data-combo="' + clave +
      '" data-tabla="' + esc(tabla) + '" value="' + esc(escrito) + '"' +
      (o.marcador ? ' placeholder="' + esc(o.marcador) + '"' : '') +
      (o.apagado ? ' disabled' : '') + '>' +
    '<datalist id="' + lista + '">' +
      filas.map((f) => '<option value="' + esc(f.nombre) + '">').join('') + '</datalist>' +
    (!o.apagado && limpio && !calza
      ? '<button class="btn secundario" style="margin-top:5px" data-combo-crear="' + clave +
        '" data-tabla="' + esc(tabla) + '">Agregar «' + esc(limpio) + '» al catálogo</button>'
      : '<span class="ayuda">' + esc(o.ayuda || (calza ? '✓ ' + calza.nombre : 'Escribe y elige de la lista')) + '</span>') +
    '</div>';
}

/* ── Paso 1 · Vehículo ─────────────────────────────────────────────────── */

function recVehiculo() {
  const r = rec();
  const marcas = Modelo.catalogo('marca');
  const modelos = Modelo.catalogo('modelo').filter((m) => m.marca_id === r.campos.marca_id);
  const anios = [];
  for (let a = 2027; a >= 1979; a--) anios.push({ id: a, nombre: String(a) });

  return `
  <div class="rejilla-campos">
    ${recCampo('patente', 'Patente', { marcador: 'AABB11', ayuda: 'Se normaliza a mayúsculas, sin guiones' })}
    ${recCombo('marca_id', 'Marca', marcas, 'marca', { marcador: 'Escribe la marca' })}
    ${recCombo('modelo_id', 'Modelo', modelos, 'modelo', {
      marcador: r.campos.marca_id ? 'Escribe el modelo' : 'Primero la marca',
      apagado: !r.campos.marca_id,
      ayuda: r.campos.marca_id ? '' : 'Depende de la marca' })}
    ${recCombo('color_id', 'Color', Modelo.catalogo('color_vehiculo'), 'color_vehiculo', { marcador: 'Escribe el color' })}
    ${recSelect('anio', 'Año', anios, { vacio: 'Seleccionar' })}
    ${recCampo('vin', 'VIN (número de chasis)', { ayuda: 'Opcional: se puede completar después' })}
    ${recCampo('km', 'Kilometraje', { tipo: 'number' })}
  </div>

  <fieldset class="bloque" style="margin-top:12px"><legend>Combustible</legend>
    <div class="chips">
      ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => '<button class="chip' +
        (String(r.campos.combustible) === String(n) ? ' activo' : '') + '" data-comb="' + n + '">' +
        n + '/8' + (n === 8 ? ' lleno' : n === 0 ? ' vacío' : '') + '</button>').join('')}
    </div>
  </fieldset>`;
}

/* ── Paso 2 · Cliente ──────────────────────────────────────────────────── */

function recCliente() {
  return `
  <div class="rejilla-campos">
    ${recCampo('rut', 'RUT', { marcador: '11.111.111-1' })}
    ${recCampo('nombres', 'Nombre completo')}
    ${recCampo('apellidos', 'Apellidos', { ayuda: 'Separados de los nombres' })}
    ${recCampo('telefono', 'Teléfono')}
    ${recCampo('celular', 'Celular')}
    ${recCampo('correo', 'Correo')}
    ${recCampo('direccion', 'Domicilio')}
  </div>
`;
}

/* ── Paso 3 · Solicitud de reparación · VARIAS ÓRDENES ─────────────────── */

function recOrdenes() {
  const r = rec();
  const tipos = Modelo.catalogo('tipo_ingreso');
  const comps = Modelo.catalogo('compania').filter((c) => c.vigente !== false);
  const prios = Modelo.catalogo('prioridad');
  // Los estados que el original ofrece en el ingreso son cuatro, y son los
  // que el catálogo marca alcanzables desde esta pantalla.
  const estados = Modelo.catalogo('estado').filter((e) => (e.alcanzable_en || []).indexOf('ingreso') >= 0);

  const bloque = (b, i) => {
    const tipo = tipos.find((t) => t.id === b.tipo_ingreso_id) || {};
    return `
    <fieldset class="bloque" style="margin-bottom:12px">
      <legend>Orden ${i + 1} de ${r.bloques.length}${r.bloques.length > 1 ? ' · genera su propia OT' : ''}</legend>
      <div class="rejilla-campos">
        <div class="campo"><label>Tipo de ingreso</label>
          <select data-blq="${i}" data-campo="tipo_ingreso_id">
            ${tipos.map((t) => '<option value="' + esc(t.id) + '"' + (b.tipo_ingreso_id === t.id ? ' selected' : '') +
              '>' + esc(t.nombre) + '</option>').join('')}</select></div>
        <div class="campo"><label>Compañía${tipo.exige_compania ? ' <span style="color:var(--rojo)">*</span>' : ''}</label>
          <select data-blq="${i}" data-campo="compania_id">
            <option value="">${tipo.exige_compania ? 'Seleccionar' : 'Sin compañía'}</option>
            ${comps.map((c) => '<option value="' + esc(c.id) + '"' + (b.compania_id === c.id ? ' selected' : '') +
              '>' + esc(c.nombre) + '</option>').join('')}</select>
          <span class="ayuda">${tipo.exige_compania ? 'Obligatoria para este tipo de ingreso'
            : '24 de 102 órdenes vivas no tienen compañía'}</span></div>
        <div class="campo"><label>N° de siniestro${tipo.exige_compania ? ' <span style="color:var(--rojo)">*</span>' : ''}</label>
          <input data-blq="${i}" data-campo="siniestro" value="${esc(b.siniestro)}"></div>
        <div class="campo"><label>Deducible neto</label>
          <input type="number" data-blq="${i}" data-campo="deducible" value="${esc(b.deducible)}"></div>
        <div class="campo"><label>Liquidador / evaluador</label>
          <input data-blq="${i}" data-campo="liquidador" value="${esc(b.liquidador)}"></div>
        <div class="campo"><label>Prioridad</label>
          <select data-blq="${i}" data-campo="prioridad_id">
            ${prios.map((p) => '<option value="' + esc(p.id) + '"' + (b.prioridad_id === p.id ? ' selected' : '') +
              '>' + esc(p.nombre) + '</option>').join('')}</select></div>
        <div class="campo"><label>Estado de ingreso</label>
          <select data-blq="${i}" data-campo="estado">
            ${estados.map((e) => '<option value="' + esc(e.codigo) + '"' + (b.estado === e.codigo ? ' selected' : '') +
              '>' + esc(e.nombre) + '</option>').join('')}</select>
          <span class="ayuda">Del maestro, con su redacción exacta</span></div>
        <div class="campo"><label>Responsable de la orden</label>
          <select data-blq="${i}" data-campo="responsable_id">
            <option value="">Sin asignar todavía</option>
            ${Modelo.sesionesPosibles().map((p) => '<option value="' + esc(p.id) + '"' +
              (b.responsable_id === p.id ? ' selected' : '') + '>' + esc(p.nombre) + ' · ' +
              esc(p.cargo) + '</option>').join('')}</select>
          <span class="ayuda">Le aparece en su pantalla apenas se guarde</span></div>
      </div>
      <div class="rejilla-campos" style="margin-top:8px">
        <div class="campo" style="grid-column:1/-1"><label>Descripción de daños</label>
          <textarea rows="2" data-blq="${i}" data-campo="descripcion_danos">${esc(b.descripcion_danos)}</textarea></div>
      </div>
      ${r.bloques.length > 1
        ? '<div style="margin-top:8px"><button class="btn secundario" data-quitar-blq="' + i + '">Quitar esta orden</button></div>'
        : ''}
    </fieldset>`;
  };

  return `
  ${r.bloques.map(bloque).join('')}
  <button class="btn" id="rec-add-blq">+ Agregar otra orden a esta recepción</button>
`;
}

/* ── Paso 4 · Estado descriptivo ───────────────────────────────────────── */

function recDanos() {
  const r = rec();
  return `
  <div class="silueta-zona">
    <div>
      <div class="lienzo">${svgSilueta()}</div>
    </div>
    <div>
      <h4 style="margin:0 0 9px;font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--gris)">Tipo de daño a marcar</h4>
      <div class="chips" id="chips-tipo" style="margin-bottom:14px">
        ${Modelo.tiposDano().map((t) => '<button class="chip' + (t.codigo === r.tipoDano ? ' activo' : '') +
          '" data-tipo="' + esc(t.codigo) + '"><i class="punto" style="background:' + t.color + '"></i>' +
          esc(t.nombre) + '</button>').join('')}
      </div>
      <h4 style="margin:0 0 9px;font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--gris)">
        Daños marcados <span id="n-danos">(0)</span></h4>
      <div class="lista-danos" id="lista-danos"></div>
    </div>
  </div>
`;
}

function pintarDanos() {
  const r = rec();
  const g = document.getElementById('marcas');
  const lista = document.getElementById('lista-danos');
  if (!g || !lista) return;
  const visibles = r.danos;

  g.innerHTML = visibles.map((d) =>
    '<g class="marca-dano"><circle cx="' + (d.x * 300).toFixed(1) + '" cy="' + (d.y * 470).toFixed(1) +
    '" r="9" fill="' + d.color + '" fill-opacity=".85" stroke-width="2"></circle></g>').join('');

  document.getElementById('n-danos').textContent = '(' + r.danos.length + ')';
  lista.innerHTML = r.danos.length
    ? r.danos.map((d, i) =>
        '<div class="item-dano"><span><i class="punto" style="background:' + d.color + '"></i>' +
        '<strong>' + esc(d.tipoNombre) + '</strong> · ' + esc(d.zonaNombre) +
        ' <span class="et gris">' + esc(d.vista.replace('_', ' ')) + '</span></span>' +
        '<button class="quitar" data-quitar="' + i + '" title="Quitar">&times;</button></div>').join('')
    : '<div style="color:var(--gris-2);font-size:12.5px;padding:8px 2px">Sin daños marcados todavía.</div>';

  lista.querySelectorAll('[data-quitar]').forEach((b) => b.addEventListener('click', () => {
    r.danos.splice(Number(b.dataset.quitar), 1);
    guardarBorrador(); pintarDanos();
  }));
}

/* ── Paso 5 · Inventario · los 28 ítems ────────────────────────────────── */

function recInventario() {
  const r = rec();
  const items = Modelo.catalogo('inventario_item');
  const n = Object.values(r.inventario).filter(Boolean).length;

  return `
  <div style="margin:10px 0;display:flex;gap:8px;align-items:center">
    <span class="et gris" id="n-inv">${n} de ${items.length}</span>
    <button class="btn secundario" id="inv-todos">Marcar todos</button>
    <button class="btn secundario" id="inv-ninguno">Desmarcar todos</button>
  </div>
  <div class="grid-envoltorio"><table class="grid">
    <thead><tr><th style="width:34px"></th><th>Elemento</th><th style="width:45%">Observación</th></tr></thead>
    <tbody>${items.map((it) =>
      '<tr><td style="text-align:center"><input type="checkbox" data-inv="' + esc(it.id) + '"' +
        (r.inventario[it.id] ? ' checked' : '') + '></td>' +
      '<td>' + esc(it.nombre) + ' <span class="cod" style="font-size:10.5px;color:var(--gris-2)">' +
        esc(it.codigo) + '</span></td>' +
      '<td><input data-obsinv="' + esc(it.id) + '" value="' + esc(r.obsInventario[it.id] || '') +
        '" placeholder="Sin observación"></td></tr>').join('')}</tbody>
  </table></div>`;
}

/* ── Paso 6 · Fotografías ──────────────────────────────────────────────
   La firma en pantalla se sacó (decisión del 13-08-2026): el comprobante se
   firma en papel y ese papel se archiva. Duplicarla acá no agregaba nada. */

function recCierre() {
  const r = rec();

  return `
  <fieldset class="bloque"><legend>Fotografías de ingreso</legend>
    ${zonaFotos({ id: 'recfoto', fotos: r.fotos, titulo: 'Agregar fotos del vehículo' })}
  </fieldset>

  <div class="rejilla-campos" style="margin-top:12px">
    <div class="campo" style="grid-column:1/-1"><label>Observaciones de la recepción</label>
      <textarea rows="2" data-rec="observaciones">${esc(r.campos.observaciones)}</textarea></div>
  </div>`;
}

/* ── Resultado ─────────────────────────────────────────────────────────── */

function vRecepcionResultado(r) {
  return `
  <div class="panel">
    <div class="cab"><h2>${ico('check', 'g')}Recepción guardada</h2></div>
    <div class="cuerpo">
      <div class="nota info">
        <strong>Un ingreso, ${r.creadas.length} ${r.creadas.length === 1 ? 'orden' : 'órdenes'} de trabajo.</strong>
        ${r.creadas.length > 1
          ? 'El vehículo entró con ' + r.creadas.length + ' siniestros distintos y cada uno tiene su propia OT, ' +
            'con su compañía y su deducible. Comparten vehículo, cliente, checklist, daños y fotos.'
          : 'La orden quedó abierta y el contador de días partió en cero.'}
      </div>
      <div class="grid-envoltorio"><table class="grid">
        <thead><tr><th>OT</th><th>Patente</th><th>Estado</th><th>Días</th><th></th></tr></thead>
        <tbody>${r.creadas.map((c) => {
          const o = Modelo.otPorId(c.ot_id);
          return '<tr><td class="num"><strong>' + c.numero_ot + '</strong></td>' +
            '<td><span class="patente">' + esc(o ? o.patente : '') + '</span></td>' +
            '<td><span class="et ' + (o ? o.estadoClase : 'gris') + '">' + esc(o ? o.estadoNombre : '') + '</span></td>' +
            '<td class="num">' + (o ? o.diasTotales : 0) + '</td>' +
            '<td><button class="btn secundario" data-abrir-ot="' + c.numero_ot + '">Abrir la ficha</button></td></tr>';
        }).join('')}</tbody>
      </table></div>
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn" id="rec-nueva">Registrar otro ingreso</button>
        <button class="btn secundario" id="rec-ir-torre">Ver en la torre de control</button>
      </div>
    </div>
  </div>`;
}

/* ── Cableado ──────────────────────────────────────────────────────────── */

function pRecepcion() {
  const r = rec();

  if (r.creadas) {
    document.querySelectorAll('[data-abrir-ot]').forEach((b) => b.addEventListener('click', () =>
      abrirFicha(b.dataset.abrirOt)));
    const nueva = document.getElementById('rec-nueva');
    if (nueva) nueva.addEventListener('click', () => { limpiarBorrador(); render(); });
    const torre = document.getElementById('rec-ir-torre');
    if (torre) torre.addEventListener('click', () => { limpiarBorrador(); ir('torre'); });
    return;
  }

  // Navegación entre pasos
  document.querySelectorAll('[data-paso]').forEach((b) => b.addEventListener('click', () => {
    r.paso = b.dataset.paso; guardarBorrador(); render();
  }));
  const mover = (d) => {
    const i = RECEPCION_PASOS.findIndex((p) => p.id === r.paso);
    const j = Math.max(0, Math.min(RECEPCION_PASOS.length - 1, i + d));
    r.paso = RECEPCION_PASOS[j].id; guardarBorrador(); render();
  };
  const ant = document.getElementById('rec-ant'), sig = document.getElementById('rec-sig');
  if (ant) ant.addEventListener('click', () => mover(-1));
  if (sig) sig.addEventListener('click', () => mover(1));

  // Campos simples. Se guarda al escribir, sin repintar: repintar en cada
  // tecla haría perder el foco y el cursor.
  document.querySelectorAll('[data-rec]').forEach((el) => el.addEventListener('input', () => {
    r.campos[el.dataset.rec] = el.value;
    guardarBorrador();
  }));
  // Los desplegables sí repintan: marca cambia la lista de modelos.
  document.querySelectorAll('select[data-rec]').forEach((el) => el.addEventListener('change', () => {
    r.campos[el.dataset.rec] = el.value;
    if (el.dataset.rec === 'marca_id') r.campos.modelo_id = '';
    guardarBorrador(); render();
  }));

  /* Los combos que se escriben. El id se resuelve por nombre en cada tecla; si
     todavía no calza con ninguna fila, queda vacío y aparece el botón para
     agregarlo. No se redibuja en cada letra —se perdería el cursor—, salvo
     cuando el valor pasa de calzar a no calzar, que es cuando ese botón tiene
     que aparecer o desaparecer. */
  const filasDe = (tabla) => tabla === 'modelo'
    ? Modelo.catalogo('modelo').filter((m) => m.marca_id === r.campos.marca_id)
    : Modelo.catalogo(tabla);

  document.querySelectorAll('[data-combo]').forEach((el) => el.addEventListener('input', () => {
    const clave = el.dataset.combo;
    const antes = r.campos[clave];
    r.textos[clave] = el.value;
    const t = el.value.trim().toLowerCase();
    const fila = filasDe(el.dataset.tabla).find((f) => String(f.nombre).toLowerCase() === t);
    r.campos[clave] = fila ? fila.id : '';
    // Cambiar de marca invalida el modelo elegido.
    if (clave === 'marca_id' && r.campos.marca_id !== antes) {
      r.campos.modelo_id = ''; r.textos.modelo_id = '';
    }
    guardarBorrador();
    if (!!fila !== !!antes || clave === 'marca_id') { render(); enfocar(clave, el.value.length); }
  }));

  document.querySelectorAll('[data-combo-crear]').forEach((b) => b.addEventListener('click', () => {
    const clave = b.dataset.comboCrear;
    const nombre = String(r.textos[clave] || '').trim();
    if (!nombre) return;
    const fila = { nombre, codigo: nombre.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 18) };
    // El modelo cuelga de la marca: sin marca elegida no se puede crear.
    if (b.dataset.tabla === 'modelo') {
      if (!r.campos.marca_id) return avisar({ ok: false, motivo: 'Primero hay que elegir la marca.' });
      fila.marca_id = r.campos.marca_id;
    }
    const res = Modelo.guardar_catalogo(b.dataset.tabla, fila);
    if (!avisar(res, '«' + nombre + '» quedó en el catálogo y ya está elegido.')) return;
    const creada = filasDe(b.dataset.tabla).find((f) => String(f.nombre).toLowerCase() === nombre.toLowerCase());
    if (creada) r.campos[clave] = creada.id;
    guardarBorrador(); render();
  }));

  document.querySelectorAll('[data-comb]').forEach((b) => b.addEventListener('click', () => {
    r.campos.combustible = b.dataset.comb; guardarBorrador(); render();
  }));

  // Bloques de orden
  document.querySelectorAll('[data-blq]').forEach((el) => {
    const ev = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(ev, () => {
      r.bloques[Number(el.dataset.blq)][el.dataset.campo] = el.value;
      guardarBorrador();
      if (ev === 'change') render();   // el tipo de ingreso habilita la compañía
    });
  });
  const add = document.getElementById('rec-add-blq');
  if (add) add.addEventListener('click', () => { r.bloques.push(bloqueVacio()); guardarBorrador(); render(); });
  document.querySelectorAll('[data-quitar-blq]').forEach((b) => b.addEventListener('click', () => {
    r.bloques.splice(Number(b.dataset.quitarBlq), 1); guardarBorrador(); render();
  }));

  // Silueta
  document.querySelectorAll('[data-tipo]').forEach((b) => b.addEventListener('click', () => {
    r.tipoDano = b.dataset.tipo;
    document.querySelectorAll('[data-tipo]').forEach((x) => x.classList.toggle('activo', x.dataset.tipo === r.tipoDano));
  }));
  const svg = document.getElementById('silueta');
  if (svg) {
    svg.addEventListener('click', (ev) => {
      const zona = ev.target.dataset && ev.target.dataset.zona;
      if (!zona) return;
      const caja = svg.getBoundingClientRect();
      const t = Modelo.tiposDano().find((x) => x.codigo === r.tipoDano) || Modelo.tiposDano()[0];
      r.danos.push({
        vista: 'superior', zona, zonaNombre: ev.target.dataset.nombre,
        tipo: t.codigo, tipoNombre: t.nombre, color: t.color, severidad: 2,
        x: Number(((ev.clientX - caja.left) / caja.width).toFixed(4)),
        y: Number(((ev.clientY - caja.top) / caja.height).toFixed(4))
      });
      guardarBorrador(); pintarDanos();
    });
    pintarDanos();
  }

  // Inventario
  document.querySelectorAll('[data-inv]').forEach((cb) => cb.addEventListener('change', () => {
    r.inventario[cb.dataset.inv] = cb.checked;
    const n = Object.values(r.inventario).filter(Boolean).length;
    const rot = document.getElementById('n-inv');
    if (rot) rot.textContent = n + ' de ' + Modelo.catalogo('inventario_item').length;
    guardarBorrador();
  }));
  document.querySelectorAll('[data-obsinv]').forEach((el) => el.addEventListener('input', () => {
    r.obsInventario[el.dataset.obsinv] = el.value; guardarBorrador();
  }));
  const todos = document.getElementById('inv-todos');
  if (todos) todos.addEventListener('click', () => {
    Modelo.catalogo('inventario_item').forEach((i) => { r.inventario[i.id] = true; });
    guardarBorrador(); render();
  });
  const ninguno = document.getElementById('inv-ninguno');
  if (ninguno) ninguno.addEventListener('click', () => { r.inventario = {}; guardarBorrador(); render(); });

  montarFotos();

  const limpiar = document.getElementById('rec-limpiar');
  if (limpiar) limpiar.addEventListener('click', () => {
    if (!confirm('¿Descartar el borrador de esta recepción? Las fotos ya subidas se borran.')) return;
    Promise.all(r.fotos.map((f) => Media.eliminar(f.id).catch(() => null)))
      .then(() => { limpiarBorrador(); render(); });
  });

  const guardar = document.getElementById('rec-guardar');
  if (guardar) guardar.addEventListener('click', guardarRecepcion);

  Media.pintar();
}

/* ── Fotos ─────────────────────────────────────────────────────────────── */

function montarFotos() {
  const r = rec();
  montarZonaFotos({
    id: 'recfoto', momento: 'ingreso',
    alSubir: (fichas) => { r.fotos.push.apply(r.fotos, fichas); guardarBorrador(); render(); },
    alQuitar: (i) => {
      const f = r.fotos[i];
      if (!f) return;
      Media.eliminar(f.id).catch(() => null).then(() => {
        r.fotos.splice(i, 1); guardarBorrador(); render();
      });
    }
  });
}

/* ── Guardar ───────────────────────────────────────────────────────────── */

function guardarRecepcion() {
  const r = rec();
  const faltan = recFaltantes();
  if (faltan.length) {
    r.paso = faltan[0].paso;
    render();
    return avisar({ ok: false, motivo: faltan[0].rot + ' es obligatorio. Faltan ' + faltan.length +
      ' campos: ' + faltan.map((f) => f.rot).join(', ') + '.' });
  }

  const zonas = Modelo.zonasDano(), tipos = Modelo.tiposDano();
  const inventario = Modelo.catalogo('inventario_item').map((i) => !!r.inventario[i.id]);

  const ficha = Object.assign({}, r.campos, {
    anio: r.campos.anio ? Number(r.campos.anio) : null,
    km: r.campos.km ? Number(r.campos.km) : null,
    combustible: Number(r.campos.combustible),
    inventario,
    danos: r.danos.map((d) => ({
      vista: d.vista, severidad: d.severidad, x: d.x, y: d.y,
      zona_id: (zonas.find((z) => z.codigo === d.zona) || {}).id || null,
      tipo_id: (tipos.find((t) => t.codigo === d.tipo) || {}).id || null
    })),
    demo: true
  });

  const bloques = r.bloques.map((b) => Object.assign({}, b, {
    deducible: b.deducible ? Number(b.deducible) : 0,
    compania_id: b.compania_id || null,
    responsable_id: b.responsable_id || null
  }));

  Promise.resolve().then(() => {
    const res = Modelo.crear_ot_desde_recepcion(ficha, bloques, r.llave);
    if (!res.ok) return avisar(res);

    // Las fotos se amarran a la recepción y a todas sus órdenes.
    Modelo.adjuntar_media(res.recepcion_id, res.ordenes.map((o) => o.ot_id), r.fotos);

    r.creadas = res.ordenes;
    try { localStorage.removeItem(CLAVE_BORRADOR); } catch (e) { /* nada */ }
    render();
    avisar({ ok: true, motivo: '' },
      res.repetida
        ? 'Esta recepción ya estaba guardada: se devolvió la misma orden, no se creó otra.'
        : res.ordenes.length + (res.ordenes.length === 1 ? ' orden creada' : ' órdenes creadas') +
          ' desde un solo ingreso.');
  });
}
