/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   LOS CUATRO DOCUMENTOS IMPRIMIBLES.

     1 · Comprobante de recepción — datos, silueta con daños, los 28 ítems
         del inventario y observaciones. Con fotos de ingreso y espacio para firmar.
     2 · Presupuesto / OR — número compuesto, versión, y las líneas como
         planilla: cada monto cae en su columna, con neto, IVA y total.
     3 · Ficha completa de la OT — historial con fecha, hora y responsable;
         repuestos con trazabilidad; los tres relojes. Con fotos por etapa.
     4 · Acta de entrega — cierre, fotos de salida, fecha y espacio para firmar.

   Se imprimen con `@media print` y `window.print()`, sin librerías: no hay
   CDN y no hace falta. Si más adelante la paginación no se deja controlar,
   ahí entra jsPDF — con `integrity` y `crossorigin`, no de cualquier manera.

   🔴 Y una corrección de seguridad heredada: el original escribe estos PDF en
      `/pdf/` con nombre deducible del número de orden —`recepcion-23446.pdf`,
      un correlativo de cinco dígitos— y llevan nombre, RUT, domicilio,
      teléfono, VIN y patente. Acá el documento se
      arma en el navegador desde los datos de la sesión: **no hay archivo en
      una ruta adivinable**, y nada se sirve sin sesión.
   ──────────────────────────────────────────────────────────────────────── */

const IMPRESOS = {
  recepcion:  { rot: 'Comprobante de recepción', archivo: (o) => 'recepcion-' + o.patente + '-' + o.numeroOT },
  presupuesto:{ rot: 'Presupuesto / OR',         archivo: (o, p) => 'presupuesto-' + (p ? p.numeroOR : o.numeroOT) },
  ficha:      { rot: 'Ficha completa de la OT',  archivo: (o) => 'ficha-completa-' + o.numeroOT },
  entrega:    { rot: 'Acta de entrega',          archivo: (o) => 'acta-entrega-' + o.patente + '-' + o.numeroOT },
  // El expediente se imprime porque es lo que se le entrega a la compañía
  // cuando pide cuenta de un vehículo. Es el documento, no un reporte.
  expediente: { rot: 'Expediente del vehículo',  archivo: (o) => 'expediente-' + o.patente + '-' + o.numeroOT }
};

/* El estilo del impreso va acá y no en estilos.css a propósito: es una hoja
   de papel, no una pantalla, y conviene que se lea junto al documento. */
const CSS_IMPRESO = `
.velo-impreso{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9000;overflow:auto;padding:20px}
.impreso{background:#fff;color:#111;width:210mm;min-height:297mm;margin:0 auto;padding:14mm 13mm;
  box-shadow:0 10px 40px rgba(0,0,0,.4);font-family:Arial,Helvetica,sans-serif;font-size:11px;
  position:relative;display:flex;flex-direction:column}
.impreso h1{font-size:17px;margin:0;color:#292D78;letter-spacing:.3px}
.impreso .logo-doc{height:34px;width:auto;display:block;margin-bottom:2px}
.impreso h2{font-size:11px;margin:14px 0 5px;color:#292D78;text-transform:uppercase;letter-spacing:.7px;
  border-bottom:1.5px solid #292D78;padding-bottom:3px}
.impreso .cab-doc{display:flex;justify-content:space-between;align-items:flex-start;
  border-bottom:2.5px solid #292D78;padding-bottom:8px}
.impreso .cab-doc .der{text-align:right;font-size:10px;color:#444}
.impreso .rej{display:grid;grid-template-columns:repeat(4,1fr);gap:3px 10px}
.impreso .rej.dos{grid-template-columns:repeat(2,1fr)}
.impreso .c{border-bottom:1px dotted #bbb;padding:2px 0;display:flex;justify-content:space-between;gap:6px}
.impreso .c .k{color:#666;font-size:9.5px;text-transform:uppercase;letter-spacing:.3px}
.impreso .c .v{font-weight:700;text-align:right}
.impreso table{width:100%;border-collapse:collapse;font-size:10px;margin-top:4px}
.impreso th{background:#eef0f7;color:#292D78;text-align:left;padding:3px 5px;border:1px solid #ccd;
  font-size:9px;text-transform:uppercase;letter-spacing:.3px}
.impreso td{padding:3px 5px;border:1px solid #ddd}
.impreso td.n{text-align:right}
.impreso .inv{display:grid;grid-template-columns:repeat(4,1fr);gap:1px 8px;font-size:9.5px}
.impreso .inv span{border-bottom:1px dotted #ddd;padding:1px 0}
/* Las cuatro marcas del inventario. Son cuatro estados, no un sí/no, así que
   son cuatro signos distintos: el cliente firma este papel y tiene que poder
   distinguir "no estaba" de "estaba roto" y de "no se alcanzó a revisar". */
.impreso .marca{color:#0a8a2a;font-weight:700}
.impreso .falta{color:#b00;font-weight:700}
.impreso .danado{color:#a35a00;font-weight:700}
.impreso .sinver{color:#888;font-weight:700}
.impreso .leyenda-inv{font-size:8.5px;color:#666;margin-top:3px}
/* Recuadro en blanco: el documento se imprime y se firma a mano. */
.impreso .firma{border:1px solid #999;height:26mm}
.impreso .fotos{display:flex;gap:4px;flex-wrap:wrap}
.impreso .fotos img{width:44mm;height:32mm;object-fit:cover;border:1px solid #ccc}
/* El sello va AL PIE de la hoja, no cruzado en diagonal sobre el texto.

   Estaba como marca de agua rotada en el medio: aunque iba por detrás —z-index
   0 contra 1—, se leía encima de las condiciones del presupuesto y del bloque
   de totales, y en el PDF quedaba un "MODELO BO" gris atravesando el
   documento. Un rótulo que estorba lo que tiene que rotular está mal puesto.

   Abajo cumple lo mismo —nadie confunde este papel con uno real— y no se cruza
   con nada. Sigue siendo lo último que se lee antes de cerrar la hoja. */
.impreso .nota-legal{margin-top:8px;font-size:9.5px;color:#555;border-top:1px solid #ddd;
  padding-top:5px;line-height:1.45}
.impreso .sello{margin-top:6px;text-align:center;font-size:13px;font-weight:800;
  letter-spacing:7px;color:#9aa;border-top:1px solid #dde;padding-top:6px;pointer-events:none}
/* El pie en el FLUJO de la hoja, empujado abajo con margin-top:auto. Estaba en
   position:absolute con bottom:8mm, y cuando el documento crecía se montaba
   encima del contenido: en el presupuesto quedaba escrito sobre la barra azul
   del TOTAL. Sacado del posicionamiento absoluto, eso no puede volver a pasar. */
.impreso .pie{margin-top:auto;border-top:1px solid #ccd;padding-top:4px;
  font-size:8.5px;color:#777;display:flex;justify-content:space-between;gap:10px}
.impreso .contenido{position:relative;z-index:1;display:flex;flex-direction:column;flex:1}
.barra-impreso{position:sticky;top:0;z-index:9100;display:flex;gap:8px;justify-content:center;
  padding:0 0 14px}
.barra-impreso button{font-family:inherit;font-size:12px;padding:6px 14px;border-radius:3px;cursor:pointer;
  border:1px solid #292D78;background:#292D78;color:#fff;font-weight:600}
.barra-impreso button.sec{background:#fff;color:#292D78}

/* ── El presupuesto, que es el documento que sale del taller ──────────────
   Se lee como planilla: columnas fijas, números tabulares y alineados a la
   derecha, bandas por bloque. Todo lo comparable queda en la misma columna. */
.impreso .cab-presu{display:flex;justify-content:space-between;align-items:flex-start;gap:10mm;
  border-bottom:3px solid #292D78;padding-bottom:6px;margin-bottom:7px}
.impreso .cab-presu .giro{font-size:10px;color:#555;margin-top:1px}
.impreso .cab-presu .dir{font-size:8.5px;color:#888;margin-top:1px}
.impreso .folio{border:1.5px solid #292D78;border-radius:2px;min-width:62mm}
.impreso .folio .tit{background:#292D78;color:#fff;font-size:11px;font-weight:800;letter-spacing:2px;
  text-align:center;padding:3px 8px}
.impreso .folio-t{width:100%;border-collapse:collapse;margin:0;font-size:9.5px}
.impreso .folio-t td{border:none;border-bottom:1px solid #e6e8f2;padding:2.4px 7px}
.impreso .folio-t td:first-child{color:#666;text-transform:uppercase;font-size:8px;letter-spacing:.4px}
.impreso .folio-t td:last-child{text-align:right;font-variant-numeric:tabular-nums}
.impreso .folio-t tr:last-child td{border-bottom:none}

.impreso .fichas{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin:6px 0 9px}
.impreso .ficha-doc{border:1px solid #d6d9e6;border-radius:2px;padding:5px 7px 6px}
.impreso .ficha-tit{font-size:8px;text-transform:uppercase;letter-spacing:.9px;color:#292D78;
  font-weight:800;border-bottom:1px solid #d6d9e6;padding-bottom:2px;margin-bottom:3px}
.impreso .ficha-doc .f{display:flex;justify-content:space-between;gap:5px;font-size:9.5px;
  padding:1.6px 0;border-bottom:1px dotted #e8eaf2}
.impreso .ficha-doc .f:last-child{border-bottom:none}
.impreso .ficha-doc .f span:first-child{color:#777;white-space:nowrap}
.impreso .ficha-doc .f span:last-child{text-align:right;font-weight:600}

.impreso table.detalle{width:100%;border-collapse:collapse;font-size:10px;margin:0}
.impreso table.detalle th{background:#292D78;color:#fff;border:1px solid #292D78;padding:4px 5px;
  font-size:8px;text-transform:uppercase;letter-spacing:.5px;text-align:left}
.impreso table.detalle th:nth-child(n+3){text-align:right}
.impreso table.detalle td{border:1px solid #dcdfe9;padding:4.2px 6px;vertical-align:top}
.impreso table.detalle td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.impreso table.detalle td.c{text-align:center;color:#666}
.impreso table.detalle td.destaca{font-weight:700}
.impreso table.detalle tbody tr:nth-child(even) td{background:#fafbfe}
/* La cabecera de dos pisos separa el detalle de la valorización. */
.impreso table.detalle tr.grupos th{text-align:center;font-size:8px;letter-spacing:1.2px}
.impreso table.detalle tr.grupos th.izq{text-align:left}
/* Todas las columnas del mismo color: el monto se distingue por dónde CAE, no
   por un fondo distinto. El rayado por fila alcanza para no perder la línea. */
.impreso table.detalle td.puesto{font-weight:600}
.impreso table.detalle tfoot td{background:#eef0f8 !important;font-weight:700;color:#292D78;
  border-top:1.5px solid #292D78;padding:4px 5px}
.impreso table.detalle tfoot td.rot{text-transform:uppercase;font-size:8px;letter-spacing:.8px}
.impreso table.detalle tfoot td.destaca{background:#292D78 !important;color:#fff;font-size:11px}

.impreso .cierre{display:grid;grid-template-columns:1fr 62mm;gap:6mm;margin-top:8px;align-items:start}
.impreso .condiciones ul{margin:3px 0 0;padding-left:12px;font-size:8.6px;color:#555;line-height:1.5}
.impreso .totales{border:1.5px solid #292D78;border-radius:2px;overflow:hidden}
.impreso .totales .lin{display:flex;justify-content:space-between;gap:8px;padding:3px 8px;
  font-size:9.5px;border-bottom:1px solid #e6e8f2;font-variant-numeric:tabular-nums}
.impreso .totales .lin span:first-child{color:#666}
.impreso .totales .lin span:last-child{font-weight:700}
.impreso .totales .lin.total{background:#292D78;color:#fff;border-bottom:none;padding:5px 8px;
  font-size:12px;font-weight:800}
.impreso .totales .lin.total span:first-child{color:#fff;letter-spacing:1px}

/* El presupuesto no lleva firmas: se aprueba por la compañía y queda el
   estado registrado. Quien firma en papel es el comprobante de recepción y el
   acta de entrega, que sí tienen su recuadro. */
@media print{
  /* 🔴 LOS COLORES. El navegador, al imprimir o al "Guardar como PDF", DESCARTA
     los fondos por omisión para ahorrar tinta: la barra azul del TOTAL salía
     blanca, la cabecera de la tabla perdía el fondo y el documento llegaba a la
     compañía en blanco y negro, sin la marca del taller.

     print-color-adjust:exact es la única forma de decirle que los respete, y
     hay que ponerlo en TODO el árbol —no basta en el contenedor—, con el
     prefijo -webkit- porque Edge y Chrome todavía lo piden.

     OJO al editar este bloque: es un template literal de JavaScript, así que
     un acento grave dentro de un comentario CSS lo termina y el archivo entero
     deja de cargar. Acá se escribe sin acentos graves. */
  *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}

  /* El papel es BLANCO. Sin esto, el fondo oscuro de la aplicación se asoma
     bajo la hoja —el documento no llega hasta el borde de la página— y el PDF
     sale con una franja negra abajo. Hay que forzarlo en html y en body: el
     tema oscuro pinta los dos. */
  html,body{background:#fff !important;color:#111 !important}
  body>*{display:none !important}
  body>.velo-impreso{display:block !important;position:static;background:#fff !important;
    padding:0;margin:0;overflow:visible;inset:auto;height:auto}
  .velo-impreso .barra-impreso{display:none !important}
  /* min-height y margin en CERO: la hoja de pantalla mide 297mm de alto y eso,
     sumado al margen de @page, empujaba un par de milímetros fuera de la página
     y el PDF salía con una segunda hoja en blanco. En papel la altura la pone
     el contenido, no nosotros. */
  .impreso{width:auto;min-height:0;height:auto;box-shadow:none;padding:0;margin:0;
    background:#fff !important;display:block}
  .impreso .contenido{display:block}
  /* El pie y el sello van donde caigan al final del documento. Estaban en
     position:fixed, que en papel los clava en la esquina de CADA página y los
     monta encima de lo que haya ahí — así se metía sobre la barra del TOTAL. */
  .impreso .pie{margin-top:14px}
  .impreso .sello{margin-top:8px}
  /* Que la tabla no se parta dejando una fila huérfana al dar vuelta la hoja. */
  .impreso table{page-break-inside:auto}
  .impreso tr{page-break-inside:avoid}
  .impreso thead{display:table-header-group}
  .impreso tfoot{display:table-footer-group}
  @page{size:A4;margin:14mm 13mm}
}`;

function svgSiluetaImpresa(danos) {
  const marcas = (danos || []).map((d) =>
    '<circle cx="' + (d.x * 300).toFixed(1) + '" cy="' + (d.y * 470).toFixed(1) +
    '" r="9" fill="' + d.color + '" fill-opacity=".8" stroke="#111" stroke-width="1.5"></circle>').join('');
  // Se reusa la misma silueta de pantalla, con los colores forzados para papel.
  return '<div style="width:52mm">' +
    svgSilueta().replace('<svg ', '<svg style="width:100%;height:auto" ')
      .replace('<g id="marcas"></g>', '<g>' + marcas + '</g>')
      .replace(/class="zona"/g, 'class="zona" fill="#f4f5fa" stroke="#aab" stroke-width="1"')
      .replace(/class="zona-rotulo"/g, 'class="zona-rotulo" fill="#889" font-size="8"')
      .replace(/class="rueda"/g, 'class="rueda" fill="#ccc"') +
    '</div>';
}

/* El logo va en los cuatro impresos y se toma solo del archivo del taller.
   Si `img/logo-dyp.png` no está, el bloque cae al nombre en texto: nunca se
   dibuja una imitación del logo. Es el mismo criterio de la barra superior. */
function logoImpreso() {
  return '<img src="img/logo-dyp.png" alt="Automotora D y P" class="logo-doc" ' +
    'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'">' +
    '<h1 style="display:none">Automotora D y P</h1>';
}

function cabeceraImpreso(o, titulo, extra) {
  return `
  <div class="cab-doc">
    <div>
      ${logoImpreso()}
      <div style="font-size:10px;color:#555">Desabolladura y pintura</div>
      <div style="margin-top:5px;font-size:13px;font-weight:700">${esc(titulo)}</div>
    </div>
    <div class="der">
      ${/* En el comprobante que se imprime antes de guardar no hay número de OT
           todavía, y va rotulado en vez de inventado. */''}
      <div><strong>OT N° ${esc(String(o.numeroOT))}</strong></div>
      <div>Patente <strong>${esc(o.patente || 'sin patente')}</strong></div>
      ${extra || ''}
      <div>Emitido ${fFecha(HOY)}</div>
    </div>
  </div>`;
}

function pieImpreso() {
  return '<div class="pie"><span>Automotora D y P · documento generado por el sistema de control de taller</span>' +
    '<span>Arttmize SpA · modelo borrador</span></div>';
}

const campoImpreso = (k, v) => '<div class="c"><span class="k">' + esc(k) + '</span><span class="v">' + v + '</span></div>';

/* ── 1 · Comprobante de recepción ──────────────────────────────────────── */

/* `o` puede ser una OT de verdad o el BORRADOR del formulario de recepción, que
   todavía no creó nada: en ese caso trae `fotosIngreso` con las fotos del
   borrador y `numeroOT` rotulado, no un número inventado. El documento es el
   mismo, y eso es lo importante — lo que el cliente firma en el mesón tiene que
   ser lo que queda guardado. */
function impresoRecepcion(o) {
  const inv = o.inventario;
  const fotos = o.fotosIngreso || Modelo.mediaDe(o.id).filter((m) => m.momento === 'ingreso');
  const MARCA_INV = {
    presente:     '<span class="marca">✔</span>',
    no_presente:  '<span class="falta">✘</span>',
    danado:       '<span class="danado">△</span>',
    sin_verificar:'<span class="sinver">–</span>'
  };
  const cuenta = (cod) => inv.filter((i) => (i.estado || (i.presente ? 'presente' : 'no_presente')) === cod).length;
  /* La firma: de la OT sale de los adjuntos, con su propio momento; del
     borrador viene ya resuelta como URL, porque todavía no está guardada. */
  const firma = o.firmaSrc
    ? { src: o.firmaSrc }
    : (o.id ? Modelo.mediaDe(o.id).find((m) => m.momento === 'firma') : null);
  return cabeceraImpreso(o, 'Comprobante de recepción') + `
  <h2>Datos del cliente y del vehículo</h2>
  <div class="rej">
    ${campoImpreso('Cliente', esc(o.cliente))}
    ${campoImpreso('RUT', esc(o.rut || '—'))}
    ${campoImpreso('Teléfono', esc(o.telefono || '—'))}
    ${campoImpreso('Dirección', esc(o.direccion || '—'))}
    ${campoImpreso('Patente', esc(o.patente))}
    ${campoImpreso('Marca', esc(o.marca || '—'))}
    ${campoImpreso('Modelo', esc(o.modelo || '—'))}
    ${campoImpreso('Año', o.anio || '—')}
    ${campoImpreso('Color', esc(o.color || '—'))}
    ${campoImpreso('VIN', o.vin
      ? esc(o.vin)
      : (o.vinPendiente ? 'Pendiente — ' + esc(o.vinMotivo || 'no viene a la vista') : '—'))}
    ${campoImpreso('Kilometraje', fKm(o.recepcion && o.recepcion.km))}
    ${campoImpreso('Combustible', fComb(o.recepcion && o.recepcion.combustible))}
    ${campoImpreso('Tipo de ingreso', esc(o.origenIngresoNombre || '—'))}
    ${campoImpreso('Compañía', esc(o.compania))}
    ${campoImpreso('N° siniestro', esc(o.siniestro || '—'))}
    ${campoImpreso('Fecha de ingreso', fFecha(o.fechaIngreso))}
  </div>

  <h2>Estado descriptivo</h2>
  <div style="display:flex;gap:10px">
    ${svgSiluetaImpresa(o.danos)}
    <div style="flex:1">
      <table><thead><tr><th>Zona</th><th>Daño</th><th>Severidad</th><th>Comentario</th></tr></thead><tbody>
      ${o.danos.length ? o.danos.map((d) => '<tr><td>' + esc(d.zonaNombre) + '</td><td>' +
        esc(d.tipoNombre) + '</td><td>' + '●'.repeat(d.severidad || 1) + '</td><td>' +
        esc(d.descripcion || '—') + '</td></tr>').join('')
        : '<tr><td colspan="4">Sin daños marcados</td></tr>'}
      </tbody></table>
    </div>
  </div>

  <h2>Inventario del vehículo · ${inv.length} ítems</h2>
  <div class="inv">
    ${inv.map((i) => {
      const cod = i.estado || (i.presente ? 'presente' : 'no_presente');
      return '<span>' + (MARCA_INV[cod] || MARCA_INV.sin_verificar) + ' ' + esc(i.item) +
        (String(i.observacion || '').trim() ? ' <em>(' + esc(i.observacion) + ')</em>' : '') + '</span>';
    }).join('')}
  </div>
  <div class="leyenda-inv">
    <span class="marca">✔</span> presente ${cuenta('presente')} ·
    <span class="falta">✘</span> no presente ${cuenta('no_presente')} ·
    <span class="danado">△</span> dañado ${cuenta('danado')} ·
    <span class="sinver">–</span> sin verificar ${cuenta('sin_verificar')}
  </div>

  ${o.recepcion && o.recepcion.observaciones ?
    '<h2>Observaciones</h2><div>' + esc(o.recepcion.observaciones) + '</div>' : ''}

  ${fotos.length ? '<h2>Fotografías de ingreso</h2><div class="fotos">' +
    fotos.slice(0, 6).map((f) => '<img data-media="' + esc(f.id) + '" alt="">').join('') + '</div>' : ''}

  ${/* 🔶 LA FIRMA SE ESTAMPA (15-08-2026). El cliente pidió las dos mitades:
       firmar en pantalla Y que esa firma salga impresa. Estaba construida la
       primera y el recuadro seguía saliendo en blanco.

       Si no hay firma tomada, el recuadro queda vacío como antes: el
       comprobante se puede seguir imprimiendo para firmarlo a mano, que es como
       trabaja el taller cuando el cliente no está con el teléfono en la mano. */''}
  <h2>Firma del cliente</h2>
  <div class="rej dos" style="align-items:end">
    <div class="firma">${firma
      ? '<img ' + (firma.src ? 'src="' + esc(firma.src) + '"' : 'data-media="' + esc(firma.id) + '"') +
        ' alt="Firma del cliente" style="height:100%;width:auto;display:block;margin:0 auto">'
      : ''}</div>
    <div>
      ${campoImpreso('Nombre', esc(o.cliente))}
      ${campoImpreso('RUT', esc(o.rut || '—'))}
      ${campoImpreso('Fecha', fFecha(o.fechaIngreso))}
    </div>
  </div>
  <div style="font-size:8.5px;color:#666;margin-top:6px">
    El cliente declara haber revisado el inventario y el estado descriptivo del vehículo.
    Los datos personales se tratan conforme a la Ley 21.719.
  </div>` + pieImpreso();
}

/* ── 2 · Presupuesto / OR ──────────────────────────────────────────────── */

/* El presupuesto es el documento que sale del taller y llega a la aseguradora
   o al cliente, así que es el único que se ve por fuera. El del sistema actual
   es un PDF antiguo, no editable, y fue el dolor #2 de la reunión.

   Este se rehizo entero (decisión del 13-08-2026) con un criterio: que se lea
   como una planilla. Una fila por trabajo, y el monto CAE EN LA COLUMNA de su
   tipo —repuesto, mano de obra o externo—, con los totales de cada columna al
   pie. Se lee en las dos direcciones: a lo largo, qué se le hace a cada pieza;
   a lo alto, cuánto pesa cada tipo de trabajo.

   Todo lo que se compara va alineado a la derecha y con cifras de ancho fijo,
   que es lo que permite leer una columna de números de un vistazo. Y solo hay
   siete columnas: cada una que se agrega es una que hay que explicar. */

function impresoPresupuesto(o, p) {
  if (!p) return '<div style="padding:20mm;text-align:center">Esta orden no tiene presupuestos.</div>';

  const BLOQUES = [
    { rot: 'Repuestos',    proc: 'cambio',  pie: 'Piezas que se reemplazan' },
    { rot: 'Mano de obra', proc: 'reparar', pie: 'Trabajo del taller' },
    { rot: 'Externos',     proc: 'externo', pie: 'Trabajos a terceros' }
  ];
  const iva = Reglas.parametro(Modelo.base(), 'iva', 19);
  const estado = ESTADO_PRESUPUESTO[p.estado] ? ESTADO_PRESUPUESTO[p.estado].txt : p.estado;

  /* Una fila por trabajo, y el monto cae en LA COLUMNA que le corresponde:
     repuesto, mano de obra o externo. Así se lee de dos maneras a la vez —a lo
     largo, qué se le hace a cada pieza; a lo alto, cuánto pesa cada tipo de
     trabajo en el total— y el pie de la tabla suma cada columna.

     Es el formato de planilla que se usa en el rubro, y reemplaza al de tres
     listas apiladas: ahí, para saber cuánto era mano de obra, había que ir a
     buscar el subtotal de un bloque en medio del documento. */
  const COLS = [
    { proc: 'cambio',  rot: 'Repuestos' },
    { proc: 'reparar', rot: 'Mano de obra' },
    { proc: 'externo', rot: 'Externos' }
  ];

  // Se ordenan por tipo para que las columnas se lean en diagonal, sin bandas.
  const orden = { cambio: 0, reparar: 1, externo: 2 };
  const lineas = p.lineas.slice().sort((a, b) => (orden[a.proceso] || 0) - (orden[b.proceso] || 0));

  const acum = { cambio: 0, reparar: 0, externo: 0 };
  const filas = lineas.map((l, i) => {
    const monto = l.cantidad * l.precio_unitario;
    acum[l.proceso] = (acum[l.proceso] || 0) + monto;
    return '<tr>' +
      '<td class="c">' + (i + 1) + '</td>' +
      '<td>' + esc(l.descripcion) + '</td>' +
      '<td class="n">' + l.cantidad + '</td>' +
      COLS.map((c) => '<td class="n' + (l.proceso === c.proc ? ' puesto' : '') + '">' +
        (l.proceso === c.proc ? fMonto(monto) : '') + '</td>').join('') +
      '<td class="n destaca">' + fMonto(monto) + '</td></tr>';
  }).join('');

  /* Sin columna de HORAS (decisión del 13-08-2026). El taller no cobra por
     hora y el valor hora se sacó del sistema, así que mostrarlas sueltas
     invita a dividir el monto por las horas y sacar una tarifa que no existe.
     Las horas siguen cargándose en la pantalla del presupuesto —sirven para
     estimar el trabajo—; lo que no van es al documento que sale del taller. */
  const pie = '<tr class="cierre-t">' +
    '<td colspan="2" class="rot">Totales por tipo de trabajo</td>' +
    '<td class="n">' + lineas.reduce((s, l) => s + l.cantidad, 0) + '</td>' +
    COLS.map((c) => '<td class="n">' + fMonto(acum[c.proc] || 0) + '</td>').join('') +
    '<td class="n destaca">' + fMonto(p.neto) + '</td></tr>';

  const resumen = COLS.filter((c) => acum[c.proc])
    .map((c) => '<div class="lin"><span>' + esc(c.rot) + '</span><span>' +
      fMonto(acum[c.proc]) + '</span></div>').join('');

  return `
  <div class="cab-presu">
    <div class="marca">
      ${logoImpreso()}
      <div class="giro">Desabolladura y pintura</div>
      <div class="dir">Taller de reparación automotriz · Chile</div>
    </div>
    <div class="folio">
      <div class="tit">PRESUPUESTO</div>
      <table class="folio-t">
        <tr><td>N° OR</td><td><strong>${esc(p.numeroOR)}</strong></td></tr>
        <tr><td>Versión</td><td>${p.version}</td></tr>
        <tr><td>Orden de trabajo</td><td>${o.numeroOT}</td></tr>
        <tr><td>Fecha</td><td>${fFecha(HOY)}</td></tr>
        <tr><td>Estado</td><td><strong>${esc(estado)}</strong></td></tr>
      </table>
    </div>
  </div>

  <div class="fichas">
    <div class="ficha-doc">
      <div class="ficha-tit">Cliente</div>
      <div class="f"><span>Nombre</span><span>${esc(o.cliente)}</span></div>
      <div class="f"><span>RUT</span><span>${esc(o.rut || '—')}</span></div>
      <div class="f"><span>Teléfono</span><span>${esc(o.telefono || '—')}</span></div>
      <div class="f"><span>Domicilio</span><span>${esc(o.direccion || '—')}</span></div>
    </div>
    <div class="ficha-doc">
      <div class="ficha-tit">Vehículo</div>
      <div class="f"><span>Patente</span><span><strong>${esc(o.patente)}</strong></span></div>
      <div class="f"><span>Marca y modelo</span><span>${esc([o.marca, o.modelo].filter(Boolean).join(' ') || '—')}</span></div>
      <div class="f"><span>Año</span><span>${o.anio || '—'}</span></div>
      <div class="f"><span>VIN</span><span>${esc(o.vin || '—')}</span></div>
    </div>
    <div class="ficha-doc">
      <div class="ficha-tit">Siniestro</div>
      <div class="f"><span>Compañía</span><span>${esc(o.compania)}</span></div>
      <div class="f"><span>N° siniestro</span><span>${esc(o.siniestro || '—')}</span></div>
      <div class="f"><span>Deducible</span><span>${fMonto(o.deducible)}</span></div>
      <div class="f"><span>Liquidador</span><span>${esc(o.liquidador || '—')}</span></div>
    </div>
  </div>

  <table class="detalle">
    <thead>
      <tr class="grupos">
        <th colspan="3" class="izq">Detalle del trabajo</th>
        <th colspan="3">Valorización por tipo de trabajo</th>
        <th rowspan="2" style="width:28mm">Total línea</th>
      </tr>
      <tr>
        <th style="width:10mm">Ítem</th>
        <th>Descripción</th>
        <th style="width:14mm">Cant.</th>
        <th style="width:27mm">Repuestos</th>
        <th style="width:27mm">Mano de obra</th>
        <th style="width:26mm">Externos</th>
      </tr>
    </thead>
    <tbody>${filas || '<tr><td colspan="7" style="text-align:center;padding:8mm;color:#888">' +
      'Este presupuesto todavía no tiene líneas cargadas.</td></tr>'}</tbody>
    ${lineas.length ? '<tfoot>' + pie + '</tfoot>' : ''}
  </table>

  <div class="cierre">
    <div class="condiciones">
      <div class="ficha-tit">Condiciones</div>
      <ul>
        <li>Valores en pesos chilenos. Deducible de ${fMonto(o.deducible)} a cargo del cliente,
            contra la entrega.</li>
        <li>Los repuestos se piden una vez aprobado; los plazos dependen del proveedor.</li>
        <li>Todo trabajo no descrito acá se presupuesta aparte antes de ejecutarse.</li>
        <li>Válido por 30 días corridos desde la emisión.</li>
      </ul>
    </div>
    <div class="totales">
      ${resumen}
      <div class="lin"><span>Neto</span><span>${fMonto(p.neto)}</span></div>
      <div class="lin"><span>IVA ${iva}%</span><span>${fMonto(p.iva)}</span></div>
      <div class="lin total"><span>TOTAL</span><span>${fMonto(p.total)}</span></div>
    </div>
  </div>

` + pieImpreso();
}

/* ── 3 · Ficha completa ────────────────────────────────────────────────── */

function impresoFicha(o) {
  const eventos = Modelo.historialDe(o.id);
  const fotos = Modelo.mediaDe(o.id);

  return cabeceraImpreso(o, 'Ficha completa de la orden') + `
  <h2>Resumen</h2>
  <div class="rej">
    ${campoImpreso('Cliente', esc(o.cliente))}
    ${campoImpreso('Patente', esc(o.patente))}
    ${campoImpreso('Vehículo', esc([o.marca, o.modelo].filter(Boolean).join(' ') || '—'))}
    ${campoImpreso('Compañía', esc(o.compania))}
    ${campoImpreso('Estado', esc(o.estadoNombre))}
    ${campoImpreso('Etapa actual', esc(o.etapaNombre))}
    ${campoImpreso('Ingreso', fFecha(o.fechaIngreso))}
    ${campoImpreso('Salida', o.fechaSalida ? fFecha(o.fechaSalida) : 'sin registrar')}
  </div>

  <h2>Los tres relojes</h2>
  <div class="rej">
    ${campoImpreso('Días desde el ingreso', o.diasTotales)}
    ${campoImpreso('Reparación acumulada', o.diasReparacion)}
    ${campoImpreso('Estadía actual', o.diasEstadiaActual)}
    ${campoImpreso('Fuera del taller', o.diasFuera)}
  </div>
  <div style="font-size:8.5px;color:#666">El reloj de reparación se detiene cuando el vehículo sale
  y se reanuda al reingresar. Ningún contador se reinicia al regrabar un estado.</div>

  <h2>Etapas</h2>
  <table><thead><tr><th>Etapa</th><th>Situación</th><th>Responsable</th><th style="width:24mm">Cerrada</th></tr></thead>
  <tbody>${o.etapasAsignadas.length ? o.etapasAsignadas.map((e) =>
    '<tr><td>' + esc(e.nombre) + '</td><td>' + (e.finalizada ? 'Completado' : 'Pendiente') + '</td>' +
    '<td>' + esc(e.responsable || '—') + '</td><td class="n">' +
    (e.finalizadaAt ? fFecha(e.finalizadaAt) : '—') + '</td></tr>').join('')
    : '<tr><td colspan="4">Sin etapas asignadas</td></tr>'}</tbody></table>

  <h2>Repuestos</h2>
  <table><thead><tr><th>Descripción</th><th style="width:12mm">Cant.</th><th style="width:22mm">Paga</th>
    <th style="width:22mm">Solicitado</th><th style="width:22mm">A bodega</th><th style="width:22mm">Al área</th></tr></thead>
  <tbody>${o.repuestos.length ? o.repuestos.map((r) =>
    '<tr><td>' + esc(r.descripcion) + '</td><td class="n">' + r.cantidad + '</td>' +
    '<td>' + esc(r.responsablePago || '—') + '</td>' +
    '<td class="n">' + (r.fechaSolicitud ? fCorta(r.fechaSolicitud) : '—') + '</td>' +
    '<td class="n">' + (r.fechaBodega ? fCorta(r.fechaBodega) : 'pendiente') + '</td>' +
    '<td class="n">' + (r.fechaEntregaArea ? fCorta(r.fechaEntregaArea) : '—') + '</td></tr>').join('')
    : '<tr><td colspan="6">Sin repuestos</td></tr>'}</tbody></table>

  <h2>Historial</h2>
  <table><thead><tr><th style="width:32mm">Fecha</th><th>Detalle</th><th style="width:26mm">Tipo</th>
    <th style="width:34mm">Responsable</th></tr></thead>
  <tbody>${eventos.slice(0, 24).map((e) => {
    const t = TIPO_EVENTO[e.tipo] || { txt: e.tipo };
    return '<tr><td>' + fFecha(e.fecha) + '</td><td>' +
      esc(e.tipo === 'etapa' ? e.etapa : e.detalle) + '</td><td>' + esc(t.txt) + '</td>' +
      '<td>' + esc(e.usuario) + '</td></tr>';
  }).join('')}</tbody></table>

  ${fotos.length ? '<h2>Fotografías</h2><div class="fotos">' +
    fotos.slice(0, 6).map((f) => '<img data-media="' + esc(f.id) + '" alt="">').join('') + '</div>' : ''}
  ` + pieImpreso();
}

/* ── 4 · Acta de entrega ───────────────────────────────────────────────── */

/* El expediente impreso. Es el documento que el taller le manda a la compañía
   cuando le piden cuenta de un vehículo, así que no se resume: van todos los
   hechos, con su fecha y con quién los hizo. Un expediente recortado no sirve
   para lo que se usa. */
function impresoExpediente(o) {
  const ex = Modelo.expedienteDe(o.numeroOT);
  if (!ex) return cabeceraImpreso(o, 'Expediente del vehículo') +
    '<h2>Sin datos</h2><p>No se pudo armar el expediente de esta orden.</p>';

  const r = ex.resumen;

  // Agrupado por día, igual que en pantalla: es como se lee y como se discute.
  const porDia = [];
  ex.hechos.forEach((h) => {
    const clave = fCorta(h.fecha);
    const ultimo = porDia[porDia.length - 1];
    if (ultimo && ultimo.clave === clave) ultimo.hechos.push(h);
    else porDia.push({ clave, fecha: h.fecha, hechos: [h] });
  });

  return cabeceraImpreso(o, 'Expediente del vehículo') + `
  <h2>Identificación</h2>
  <div class="rej">
    ${campoImpreso('Patente', esc(o.patente))}
    ${campoImpreso('Orden de trabajo', esc(o.numeroOT))}
    ${campoImpreso('Vehículo', esc([o.marca, o.modelo, o.color].filter(Boolean).join(' ') || '—'))}
    ${campoImpreso('VIN', esc(o.vin || '—'))}
    ${campoImpreso('Cliente', esc(o.cliente))}
    ${campoImpreso('RUT', esc(o.rut || '—'))}
    ${campoImpreso('Compañía', esc(o.compania && o.compania !== '—' ? o.compania : 'Particular'))}
    ${campoImpreso('N° de siniestro', esc(o.siniestro || '—'))}
    ${campoImpreso('Ingreso', fFecha(o.fechaIngreso))}
    ${campoImpreso('Estado', esc(o.estadoNombre))}
  </div>

  <h2>Resumen del expediente</h2>
  <div class="rej">
    ${campoImpreso('Hechos registrados', r.hechos)}
    ${campoImpreso('Período', fCorta(r.desde) + ' al ' + fCorta(r.hasta))}
    ${campoImpreso('Etapas cerradas', r.etapasCerradas + ' de ' + r.etapas)}
    ${campoImpreso('Presupuestos', r.presupuestos)}
    ${campoImpreso('Repuestos', r.repuestos)}
    ${campoImpreso('Archivos adjuntos', r.archivos)}
  </div>

  <h2>Historia del vehículo</h2>
  <table>
    <thead><tr>
      <th style="width:20mm">Fecha</th>
      <th style="width:38mm">Hecho</th>
      <th>Detalle</th>
      <th style="width:30mm">Quién</th>
    </tr></thead>
    <tbody>${porDia.map((d) => d.hechos.map((h, i) =>
      '<tr><td class="n">' + (i === 0 ? fCorta(h.fecha) : '') + '</td>' +
      '<td>' + esc(h.titulo) + '</td>' +
      '<td>' + esc(h.detalle || '—') + '</td>' +
      '<td>' + esc(h.quien || 'sin autor registrado') + '</td></tr>').join('')).join('') ||
      '<tr><td colspan="4">Sin hechos registrados</td></tr>'}</tbody>
  </table>

  <p class="nota-legal">Este expediente se genera desde el registro de hechos del sistema. Los
  hechos se agregan y no se editan ni se eliminan: cada línea conserva la fecha en que ocurrió y
  quién la ejecutó.</p>`;
}

function impresoEntrega(o) {
  const fotos = Modelo.mediaDe(o.id).filter((m) => m.momento === 'entrega' || m.momento === 'ingreso');

  return cabeceraImpreso(o, 'Acta de entrega') + `
  <h2>Entrega del vehículo</h2>
  <div class="rej">
    ${campoImpreso('Cliente', esc(o.cliente))}
    ${campoImpreso('RUT', esc(o.rut || '—'))}
    ${campoImpreso('Patente', esc(o.patente))}
    ${campoImpreso('Vehículo', esc([o.marca, o.modelo].filter(Boolean).join(' ') || '—'))}
    ${campoImpreso('Tipo de entrega', esc(o.estadoNombre))}
    ${campoImpreso('Fecha de entrega', o.fechaEntrega ? fFecha(o.fechaEntrega) : '—')}
    ${campoImpreso('Fecha de ingreso', fFecha(o.fechaIngreso))}
    ${campoImpreso('Días en el taller', o.diasReparacion)}
  </div>

  <h2>Trabajo realizado</h2>
  <table><thead><tr><th>Etapa</th><th style="width:34mm">Responsable</th><th style="width:26mm">Cerrada</th></tr></thead>
  <tbody>${o.etapasAsignadas.filter((e) => e.finalizada).map((e) =>
    '<tr><td>' + esc(e.nombre) + '</td><td>' + esc(e.responsable || '—') + '</td>' +
    '<td class="n">' + fFecha(e.finalizadaAt) + '</td></tr>').join('') ||
    '<tr><td colspan="3">Sin etapas cerradas</td></tr>'}</tbody></table>

  ${fotos.length ? '<h2>Fotografías</h2><div class="fotos">' +
    fotos.slice(0, 4).map((f) => '<img data-media="' + esc(f.id) + '" alt="">').join('') + '</div>' : ''}

  <h2>Conformidad</h2>
  <div class="rej dos" style="align-items:end">
    <div class="firma"></div>
    <div>
      ${campoImpreso('Recibe', esc(o.cliente))}
      ${campoImpreso('RUT', esc(o.rut || '—'))}
      ${campoImpreso('Fecha', o.fechaEntrega ? fFecha(o.fechaEntrega) : fFecha(HOY))}
    </div>
  </div>
  <div style="font-size:8.5px;color:#666;margin-top:6px">
    El cliente declara recibir el vehículo conforme al trabajo detallado en esta acta.
  </div>` + pieImpreso();
}

/* ── Abrir un impreso ──────────────────────────────────────────────────── */

/* Qué permiso pide cada documento. Los cuatro llevan el nombre y el RUT del
   cliente impresos en la cabecera, así que abrirlos es ver la ficha completa
   aunque se llegue por otro camino. El presupuesto pide además el permiso de
   los MONTOS: es el documento comercial, con los valores línea por línea. */
const PERMISO_IMPRESO = {
  recepcion:   'ficha.completa',
  presupuesto: 'presupuesto.montos',
  ficha:       'ficha.completa',
  entrega:     'ficha.completa',
  expediente:  'ficha.completa'
};

function abrirImpreso(tipo, ot_id, presupuesto_id) {
  // Acepta el id de la orden o su número: el expediente trabaja con el número
  // —es lo que el usuario escribe— y el resto de las pantallas con el id.
  const o = Modelo.otPorId(ot_id) || Modelo.otPorNumero(ot_id);
  if (!o) return avisar({ ok: false, motivo: 'Esa orden no existe o no está asignada a ti.' });
  const pide = PERMISO_IMPRESO[tipo];
  if (pide && !Modelo.puede(pide)) {
    return avisar({ ok: false, motivo: 'El rol ' + (Modelo.rolActual().nombre || '—') +
      ' no puede abrir este documento: lleva los datos del cliente' +
      (tipo === 'presupuesto' ? ' y los valores del presupuesto' : '') +
      '. Se administra en Configuración → Roles y permisos.' });
  }
  const meta = IMPRESOS[tipo];
  const pr = presupuesto_id ? o.presupuestos.find((x) => x.id === presupuesto_id)
                            : o.presupuestos[o.presupuestos.length - 1];

  const cuerpo = { recepcion: () => impresoRecepcion(o), presupuesto: () => impresoPresupuesto(o, pr),
                   ficha: () => impresoFicha(o), entrega: () => impresoEntrega(o),
                   expediente: () => impresoExpediente(o) }[tipo]();

  mostrarImpreso(cuerpo, meta.archivo(o, pr));
}

/* Poner un documento en pantalla. Está separado de `abrirImpreso` porque hay un
   caso que no viene de una OT: el comprobante que la recepción imprime ANTES de
   guardar, desde el paso Verificar. Ahí no hay orden todavía —y no la puede
   haber: el papel se revisa con el cliente delante y recién después se ingresa—
   así que el cuerpo lo arma quien llama y esta función solo lo muestra. */
function mostrarImpreso(cuerpo, nombre) {
  if (!document.getElementById('css-impreso')) {
    const s = document.createElement('style');
    s.id = 'css-impreso'; s.textContent = CSS_IMPRESO;
    document.head.appendChild(s);
  }

  document.querySelectorAll('.velo-impreso').forEach((v) => v.remove());
  const velo = document.createElement('div');
  velo.className = 'velo-impreso';
  velo.innerHTML =
    '<div class="barra-impreso">' +
      '<button id="imp-print">Imprimir o guardar como PDF</button>' +
      '<button class="sec" id="imp-cerrar">Cerrar</button>' +
    '</div>' +
    /* El sello va ÚLTIMO en el HTML, no primero. Estaba arriba y se lo ponía
       abajo con `order` de flexbox, pero al imprimir `.impreso` pasa a
       `display:block` —hace falta para que las páginas se partan bien— y ahí
       `order` deja de existir: en el PDF el rótulo salía en la cabecera. Puesto
       al final del documento, queda abajo en la pantalla y en el papel. */
    '<div class="impreso">' +
    '<div class="contenido">' + cuerpo + '</div>' +
    '<div class="sello">MODELO BORRADOR</div></div>';
  document.body.appendChild(velo);
  Media.pintar(velo);

  // El nombre del archivo que propone el navegador sale del título del
  // documento. Es lo que hace que el guion pueda decir cuál debe quedar.
  const tituloPrevio = document.title;

  const cerrar = () => { velo.remove(); document.title = tituloPrevio; };
  velo.querySelector('#imp-cerrar').addEventListener('click', cerrar);
  velo.addEventListener('click', (ev) => { if (ev.target === velo) cerrar(); });
  velo.querySelector('#imp-print').addEventListener('click', () => {
    document.title = nombre;
    // Las imágenes se resuelven de IndexedDB: hay que darles un respiro.
    setTimeout(() => { window.print(); document.title = tituloPrevio; }, 250);
  });
  document.addEventListener('keydown', function esc_(ev) {
    if (ev.key === 'Escape') { cerrar(); document.removeEventListener('keydown', esc_); }
  });

  avisar({ ok: true, motivo: '' }, 'Al guardar como PDF, el archivo debería quedar como “' + nombre + '.pdf”.');
}
