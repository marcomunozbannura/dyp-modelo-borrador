/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   LA SILUETA DEL VEHÍCULO. Se usa en dos lados —la recepción, donde se marca,
   y la ficha de la orden, donde se consulta—, así que vive aparte.

   Por qué es un SVG con zonas y no un dibujo: cada marca guarda **zona, tipo,
   severidad y coordenada normalizada**. Un dibujo no se puede consultar; esto
   sí. Es lo que después permite preguntarle al sistema cuántos vehículos de
   SURA llegaron con daño en la puerta delantera izquierda.
   ──────────────────────────────────────────────────────────────────────── */

/* Una sola vista: la superior (decisión del 13-08-2026). Antes había cinco
   pestañas —lateral, frontal, trasera— y las cinco dibujaban este mismo
   croquis, así que cambiar de pestaña no cambiaba nada. */

function svgSilueta() {
  const z = (x, y, w, h, zona, rot, r) =>
    '<rect class="zona" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (r || 4) +
    '" data-zona="' + zona + '" data-nombre="' + esc(rot) + '"></rect>' +
    '<text class="zona-rotulo" x="' + (x + w / 2) + '" y="' + (y + h / 2 + 3) + '" text-anchor="middle">' + esc(rot) + '</text>';

  return '<svg viewBox="0 0 300 470" id="silueta">' +
    // ruedas
    '<rect class="rueda" x="26" y="95" width="18" height="46" rx="7"></rect>' +
    '<rect class="rueda" x="256" y="95" width="18" height="46" rx="7"></rect>' +
    '<rect class="rueda" x="26" y="320" width="18" height="46" rx="7"></rect>' +
    '<rect class="rueda" x="256" y="320" width="18" height="46" rx="7"></rect>' +
    // carrocería
    z(45, 18, 210, 32, 'paragolpes_del', 'Paragolpes del.', 10) +
    z(45, 52, 48, 68, 'tapabarro_izq', 'Tapab. izq.') +
    z(95, 52, 110, 68, 'capo', 'Capó') +
    z(207, 52, 48, 68, 'tapabarro_der', 'Tapab. der.') +
    z(70, 122, 160, 40, 'parabrisas', 'Parabrisas') +
    z(45, 164, 48, 88, 'puerta_del_izq', 'P. del. izq.') +
    z(95, 164, 110, 140, 'techo', 'Techo') +
    z(207, 164, 48, 88, 'puerta_del_der', 'P. del. der.') +
    z(45, 254, 48, 88, 'puerta_tra_izq', 'P. tras. izq.') +
    z(207, 254, 48, 88, 'puerta_tra_der', 'P. tras. der.') +
    z(70, 306, 160, 36, 'luneta', 'Luneta') +
    z(45, 344, 48, 62, 'costado_tra_izq', 'Cost. izq.') +
    z(95, 344, 110, 62, 'maletero', 'Maletero') +
    z(207, 344, 48, 62, 'costado_tra_der', 'Cost. der.') +
    z(45, 408, 210, 32, 'paragolpes_tra', 'Paragolpes tras.', 10) +
    '<g id="marcas"></g></svg>';
}
