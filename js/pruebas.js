/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   LAS PRUEBAS NEGATIVAS. Son el criterio de aceptación del motor.

   Cada una intenta hacer algo que el negocio prohíbe y tiene que fallar POR
   LA REGLA, con un mensaje que explique el motivo — no por un botón
   deshabilitado ni por una excepción de JavaScript.

   Corren contra los procedimientos de verdad (`Modelo.*`), no contra una
   imitación, pero dentro de un aislamiento que se descarta al terminar: no
   tocan los datos con los que está trabajando el usuario.

   Se ejecutan desde la barra de menú, en Procesos → Probar reglas de negocio.
   ──────────────────────────────────────────────────────────────────────── */

const Pruebas = (function () {

  /* Cada prueba devuelve { nombre, intento, esperado, paso, detalle }. */

  function correr() {
    return Modelo.sandbox(function () {
      const db = Modelo.base();
      const res = [];
      const push = (o) => res.push(o);

      /* Las pruebas parten de un estado de sesión CONOCIDO, y no del que haya
         dejado quien estaba usando el sistema.

         Sin esto dependían de con qué cuenta estuvieras: corriéndolas como
         Pintura —que no puede cargar repuestos ni cerrar órdenes— caían nueve
         de golpe con "falta el permiso", y parecía que el motor estaba roto
         cuando lo que fallaba era el punto de partida. Se prueban las REGLAS,
         no el reparto de permisos: para eso está la prueba 17. */
      const sesionPrevia = (Modelo.personaActual() || {}).id || null;
      const rolPrevio = (Modelo.rolActual() || {}).id || null;
      Modelo.fijar_persona_actual(null);
      Modelo.fijar_rol_actual('ro-6');           // dueño: ve y puede todo
      const restaurarSesion = () => {
        if (sesionPrevia) Modelo.fijar_persona_actual(sesionPrevia);
        else { Modelo.fijar_persona_actual(null); if (rolPrevio) Modelo.fijar_rol_actual(rolPrevio); }
      };

      const abiertaCualquiera = () => db.orden_trabajo.find((o) => Reglas.estaAbierta(db, o.estado));

      /* ── 1 · Una patente, una orden abierta ─────────────────────────── */
      (function () {
        const o = abiertaCualquiera();
        const r = Reglas.puedeCrearOT(db, { vehiculo_id: o.vehiculo_id });
        push({
          nombre: 'Una patente no puede tener dos órdenes abiertas',
          intento: 'Abrir una segunda OT para un vehículo que ya tiene la orden ' + o.numero_ot,
          esperado: 'Rechazo, nombrando la orden existente',
          paso: !r.ok && r.motivo.indexOf(String(o.numero_ot)) >= 0,
          detalle: r.motivo || 'La regla permitió crearla: NO debería.'
        });
      })();

      /* ── 2 · 🔴 REGRABAR UN ESTADO NO MUEVE NINGÚN CONTADOR ──────────
         La corrección central. En el sistema actual, volver a grabar
         'Recibido' sobre 'Recibido' reinicia el contador de días: medido al
         día exacto en ocho órdenes reales. */
      (function () {
        const o = db.orden_trabajo.find((x) => x.estado === 'recibido');
        const antes = Reglas.calcularRelojes(db, o.id, HOY);
        const evAntes = db.evento.filter((e) => e.ot_id === o.id).length;
        const r = Modelo.cambiar_estado_ot(o.id, 'recibido');
        const dsp = Reglas.calcularRelojes(db, o.id, HOY);
        const evDsp = db.evento.filter((e) => e.ot_id === o.id).length;
        const quieto = antes.dias_totales === dsp.dias_totales &&
                       antes.dias_reparacion === dsp.dias_reparacion &&
                       antes.dias_estadia_actual === dsp.dias_estadia_actual &&
                       evAntes === evDsp;
        push({
          nombre: '🔴 Regrabar el mismo estado no mueve ningún contador',
          intento: "Grabar 'Recibido' sobre la OT " + o.numero_ot + ", que ya está en 'Recibido'",
          esperado: 'Rechazo, y los tres relojes intactos (' + antes.dias_totales + ' / ' +
                    antes.dias_reparacion + ' / ' + antes.dias_estadia_actual + ' días)',
          paso: !r.ok && quieto,
          detalle: !quieto
            ? 'ALGO SE MOVIÓ: ' + dsp.dias_totales + ' / ' + dsp.dias_reparacion + ' / ' +
              dsp.dias_estadia_actual + ', eventos ' + evAntes + '→' + evDsp
            : (r.motivo || 'Dejó regrabarlo sin decir nada.')
        });
      })();

      /* ── 3 · 🔴 EL RELOJ SE REANUDA, Y ADEMÁS SE OFRECEN LOS DOS ─────
         No es una prueba negativa, es la demostración del arreglo: sale del
         taller, vuelve, y ninguno de los tres números se pierde. */
      (function () {
        const o = db.orden_trabajo.find((x) => x.estado === 'recibido' &&
          Reglas.calcularRelojes(db, x.id, HOY).dias_reparacion > 3);
        if (!o) return push({ nombre: 'El reloj de reparación se reanuda al reingresar',
          intento: '—', esperado: '—', paso: false,
          detalle: 'No se encontró en la semilla una OT en taller con días suficientes.' });

        const antes = Reglas.calcularRelojes(db, o.id, HOY);
        const salida = Modelo.registrar_salida(o.id, 'espera_repuesto');
        const fuera = Reglas.calcularRelojes(db, o.id, HOY);
        const vuelta = Modelo.registrar_reingreso(o.id);
        const dsp = Reglas.calcularRelojes(db, o.id, HOY);

        // Al salir, la reparación queda congelada. Al volver, la acumulada
        // conserva lo de antes y la estadía actual arranca de cero.
        const ok = salida.ok && vuelta.ok &&
          fuera.dias_estadia_actual === 0 &&
          dsp.dias_reparacion >= antes.dias_reparacion &&
          dsp.dias_estadia_actual === 0 &&
          dsp.dias_totales === antes.dias_totales;
        push({
          nombre: '🔴 El reloj se reanuda al reingresar, y el otro vuelve a cero',
          intento: 'Sacar la OT ' + o.numero_ot + ' del taller y reingresarla',
          esperado: 'Totales intactos, reparación acumulada conservada, estadía actual en 0',
          paso: ok,
          detalle: 'Antes ' + antes.dias_totales + '/' + antes.dias_reparacion + '/' + antes.dias_estadia_actual +
                   ' → después ' + dsp.dias_totales + '/' + dsp.dias_reparacion + '/' + dsp.dias_estadia_actual +
                   '  (totales / reparación / estadía actual)'
        });
      })();

      /* ── 4 · Un estado que cierra la orden no se reabre ──────────────── */
      (function () {
        const o = abiertaCualquiera();
        const cerrar = Modelo.cambiar_estado_ot(o.id, 'entrega_cliente');
        const r = Modelo.cambiar_estado_ot(o.id, 'recibido');
        push({
          nombre: 'Una orden entregada no se reabre',
          intento: 'Cerrar la OT ' + o.numero_ot + " como 'Entrega Cliente' y volver a aceptarla",
          esperado: 'Rechazo: hay que reingresar el vehículo con una orden nueva',
          paso: cerrar.ok && !r.ok && /reingresar/i.test(r.motivo),
          detalle: !cerrar.ok ? 'No se pudo ni siquiera cerrarla: ' + cerrar.motivo
                              : (r.motivo || 'Dejó reabrirla: NO debería.')
        });
      })();

      /* ── 5 · Doble clic en crear no crea dos órdenes ─────────────────── */
      (function () {
        const antes = db.orden_trabajo.length;
        const ficha = { patente: 'ZZZZ99', nombres: 'Cliente', apellidos: 'de Prueba',
          rut: '11.111.111-1', demo: true };
        const bloques = [{ tipo_ingreso_id: 'ti-2' }];
        const uno = Modelo.crear_ot_desde_recepcion(ficha, bloques, 'prueba-doble-clic');
        const dos = Modelo.crear_ot_desde_recepcion(ficha, bloques, 'prueba-doble-clic');
        const creadas = db.orden_trabajo.length - antes;
        push({
          nombre: 'Doble clic en crear no genera dos órdenes',
          intento: 'Guardar dos veces seguidas la misma recepción',
          esperado: 'Una sola OT; la segunda devuelve la primera',
          paso: uno.ok && dos.ok && dos.repetida === true && creadas === 1,
          detalle: creadas !== 1
            ? 'Se crearon ' + creadas + ' órdenes: debía ser exactamente 1.'
            : 'La segunda llamada devolvió la OT ' +
              ((dos.ordenes && dos.ordenes[0] && dos.ordenes[0].numero_ot) || '—') + ' sin escribir nada.'
        });
      })();

      /* ── 6 · Bodega no carga sobre una orden ya cerrada ──────────────── */
      (function () {
        const cerrada = db.orden_trabajo.find((o) => Reglas.esFinal(db, o.estado));
        const r = Modelo.cargar_repuesto(cerrada.id, { descripcion: 'Paragolpes delantero' });
        push({
          nombre: 'Bodega no carga repuestos a una orden cerrada',
          intento: 'Agregar un repuesto a la OT ' + cerrada.numero_ot + ', ya entregada',
          esperado: 'Rechazo: no se puede facturar teniendo un pendiente',
          paso: !r.ok && /torre de control|abiertas/i.test(r.motivo),
          detalle: r.motivo || 'Dejó cargar el repuesto: NO debería.'
        });
      })();

      /* ── 7 · Sin texto libre donde debe haber catálogo ────────────────
         Es la regla que evita que CARDIF vuelva a convivir con CADIF, CARDF
         y CDIF, que es lo que hay hoy en el sistema real. */
      (function () {
        const r = Modelo.guardar_catalogo('compania', { nombre: 'Sura Seguros', codigo: 'SURA' });
        const r2 = Modelo.cargar_repuesto(abiertaCualquiera().id,
          { descripcion: 'Foco derecho', responsable_pago_id: 'inventado' });
        push({
          nombre: 'No se guarda una compañía repetida ni un pagador fuera del catálogo',
          intento: 'Crear la compañía "Sura Seguros" con el código SURA, y cargar un repuesto ' +
                   'con un responsable de pago que no existe',
          esperado: 'Los dos rechazados: una sola fuente por concepto',
          paso: !r.ok && !r2.ok,
          detalle: [r.motivo, r2.motivo].filter(Boolean).join('  ·  ') || 'Dejó guardar: NO debería.'
        });
      })();

      /* ── 8 · El presupuesto es la VENTA parada ────────────────────────
         Sumando lo presupuestado de las órdenes sin entregar, el taller sabe
         cuánta venta tiene en el piso. Es lo que reemplazó a la utilidad. */
      (function () {
        const vivas = db.orden_trabajo.filter((o) => Reglas.estaAbierta(db, o.estado));
        const total = vivas.reduce((s, o) => s + db.presupuesto
          .filter((p) => p.ot_id === o.id).reduce((t, p) => t + p.total, 0), 0);
        const sinPresu = vivas.filter((o) => !db.presupuesto.some((p) => p.ot_id === o.id)).length;
        push({
          nombre: 'La venta parada se puede calcular en cualquier momento',
          intento: 'Sumar lo presupuestado de las ' + vivas.length + ' órdenes sin entregar',
          esperado: 'Un total mayor que cero y el conteo de las que no tienen presupuesto',
          paso: total > 0 && vivas.length > 0,
          detalle: 'Venta parada: $' + Math.round(total).toLocaleString('es-CL') +
                   ' en ' + vivas.length + ' órdenes · ' + sinPresu + ' todavía sin presupuesto.'
        });
      })();

      /* ── 9 · Exportar es un permiso aparte ───────────────────────────── */
      (function () {
        const ope = Modelo.permisosDe('ro-3');
        const adm = Modelo.permisosDe('ro-5');
        const ok = ope.indexOf('exportar') < 0 && adm.indexOf('exportar') >= 0;
        push({
          nombre: 'Exportar el padrón es un permiso separado',
          intento: 'Comprobar que el operario no tiene "exportar" y administración sí',
          esperado: 'Permiso propio, no incluido en "ver"',
          paso: ok,
          detalle: ok
            ? 'Hoy el sistema actual tiene botón Exportar en Torre, Taller, padrón de clientes y ' +
              'nómina, y un clic entrega la tabla completa. ⚠️ La TRAZA de la exportación (A-10) ' +
              'es de la tanda 7 y todavía no está: acá solo se comprueba el permiso.'
            : 'El permiso de exportación no está separado.'
        });
      })();

      /* ── 10 · La precedencia funciona cuando se enciende ──────────────
         Está apagada por defecto porque no sabemos si existe en el original.
         Esta prueba la enciende y comprueba que bloquea. */
      (function () {
        const o = db.orden_trabajo.find((x) => x.estado === 'recibido');
        const desarme = Reglas.etapaPorCodigo(db, 'desarme');
        const desab = Reglas.etapaPorCodigo(db, 'desabolladura');
        db.ot_etapa = db.ot_etapa.filter((x) => x.ot_id !== o.id);
        db.ot_etapa.push({ id: 'oe-p1', ot_id: o.id, etapa_id: desarme.id, asignada_at: HOY, salio_at: null, persona_id: null, observacion: '' });
        db.ot_etapa.push({ id: 'oe-p2', ot_id: o.id, etapa_id: desab.id, asignada_at: HOY, salio_at: null, persona_id: null, observacion: '' });

        const apagada = Modelo.finalizar_etapa(o.id, 'desabolladura');   // debe DEJAR
        db.ot_etapa.find((x) => x.id === 'oe-p2').salio_at = null;       // se reabre
        desab.exige_precedencia = true;
        const encendida = Modelo.finalizar_etapa(o.id, 'desabolladura'); // debe RECHAZAR
        desab.exige_precedencia = false;

        push({
          nombre: 'La precedencia está construida y apagada: encendida, bloquea',
          intento: 'Cerrar Desabolladura sin Desarme, primero con el interruptor apagado y ' +
                   'después encendido, sobre la OT ' + o.numero_ot,
          esperado: 'Apagada deja; encendida rechaza nombrando Desarme',
          paso: apagada.ok && !encendida.ok && /Desarme/.test(encendida.motivo),
          detalle: 'Apagada: ' + (apagada.ok ? 'dejó cerrar ✓' : 'rechazó ✗ ' + apagada.motivo) +
                   '  ·  Encendida: ' + (encendida.ok ? 'dejó cerrar ✗' : encendida.motivo)
        });
      })();

      /* ── 11 · No se arma un círculo de precedencias ───────────────────── */
      (function () {
        const a = Reglas.etapaPorCodigo(db, 'desarme');
        const b = Reglas.etapaPorCodigo(db, 'desabolladura');
        const r = Modelo.agregar_prerrequisito(a.id, b.id);   // ya existe b←a
        push({
          nombre: 'No se puede armar un círculo de precedencias',
          intento: 'Hacer que Desarme exija Desabolladura, cuando Desabolladura ya exige Desarme',
          esperado: 'Rechazo: ninguna de las dos se podría cerrar nunca',
          paso: !r.ok && /círculo|circulo/i.test(r.motivo),
          detalle: r.motivo || 'Dejó armar el círculo: NO debería.'
        });
      })();

      /* ── 12 · Un presupuesto enviado no se edita encima ───────────────
         Se versiona. Es lo que hace auditable la discusión con la compañía. */
      (function () {
        const o = abiertaCualquiera();
        const cr = Modelo.crear_presupuesto(o.id, { lineas: [] });
        Modelo.agregar_linea_presupuesto(cr.presupuesto_id,
          { proceso: 'reparar', descripcion: 'Desabolladura', horas: 4, precio_unitario: 40000 });
        const env = Modelo.cambiar_estado_presupuesto(cr.presupuesto_id, 'enviado');
        const r = Modelo.agregar_linea_presupuesto(cr.presupuesto_id,
          { proceso: 'reparar', descripcion: 'Otra cosa', precio_unitario: 10000 });
        const v2 = Modelo.nueva_version_presupuesto(cr.presupuesto_id);
        /* Hasta el 15-08-2026 esta prueba exigía que la versión nueva tuviera
           una OR DISTINTA: con el correlativo, la v1 era `-001` y la v2 `-002`.
           Sacado el correlativo a pedido del cliente, la regla se da vuelta y
           lo correcto es que la OR sea LA MISMA —es el mismo trabajo, discutido
           otra vez con la compañía— y que lo que cambie sea la versión. */
        const p1 = Modelo.base().presupuesto.find((x) => x.id === cr.presupuesto_id) || {};
        const p2 = Modelo.base().presupuesto.find((x) => x.numero_or === v2.numero_or &&
                     x.version > (p1.version || 0)) || {};
        push({
          nombre: 'Un presupuesto enviado no se edita: se versiona',
          intento: 'Agregar una línea al presupuesto ' + cr.numero_or + ' después de enviarlo',
          esperado: 'Rechazo. La versión nueva se crea, conserva la OR y sube la versión',
          paso: env.ok && !r.ok && v2.ok &&
                v2.numero_or === cr.numero_or && (p2.version || 0) > (p1.version || 0),
          detalle: (r.motivo || 'Dejó editarlo: NO debería.') +
                   (v2.ok ? '  ·  Versión nueva: ' + v2.numero_or +
                     ' (v' + (p1.version || '?') + ' → v' + (p2.version || '?') + ')' : '')
        });
      })();

      /* ── 13 · No se desactiva a alguien con etapas abiertas ───────────── */
      (function () {
        const fila = db.ot_etapa.find((x) => x.persona_id && !x.salio_at);
        if (!fila) return push({ nombre: 'No se desactiva a alguien con etapas abiertas',
          intento: '—', esperado: '—', paso: false, detalle: 'La semilla no dejó ninguna etapa abierta con responsable.' });
        const p = db.persona.find((x) => x.id === fila.persona_id);
        const r = Modelo.dar_de_baja_persona(fila.persona_id);
        push({
          nombre: 'No se desactiva a un trabajador con etapas abiertas',
          intento: 'Dar de baja a ' + p.nombres + ', que tiene trabajo asignado sin cerrar',
          esperado: 'Rechazo: hay que reasignar primero',
          paso: !r.ok && /abierta/i.test(r.motivo),
          detalle: r.motivo || 'Dejó desactivarlo: NO debería.'
        });
      })();

      /* ── 14 · El operario ve las líneas pero no los montos ───────────── */
      (function () {
        const nivel = (rol) => {
          const ps = Modelo.permisosDe(rol);
          return [ps.indexOf('presupuesto.ver') >= 0,
                  ps.indexOf('presupuesto.montos') >= 0].map((x) => (x ? '1' : '0')).join('');
        };
        const ope = nivel('ro-3'), rec = nivel('ro-1'), due = nivel('ro-6');
        push({
          nombre: 'El operario ve las líneas del presupuesto pero no los montos',
          intento: 'Comparar operario, recepción y dueño sobre ver / montos',
          esperado: 'Operario 10 · Recepción 11 · Dueño 11',
          paso: ope === '10' && rec === '11' && due === '11',
          detalle: 'Operario ' + ope + ' · Recepción ' + rec + ' · Dueño ' + due +
                   '  ·  ⚠️ En el navegador está MODELADO; se garantiza con RLS en PostgreSQL.'
        });
      })();

      /* ── 15 · No se carga un costo adicional a una orden cerrada ──────── */
      (function () {
        const cerrada = db.orden_trabajo.find((o) => Reglas.esFinal(db, o.estado));
        const r = Modelo.agregar_costo_adicional(cerrada.id, { descripcion: 'Grúa', monto: 40000 });
        push({
          nombre: 'No se cargan costos a una orden ya cerrada',
          intento: 'Agregar un costo adicional a la OT ' + cerrada.numero_ot + ', ya entregada',
          esperado: 'Rechazo',
          paso: !r.ok,
          detalle: r.motivo || 'Dejó cargarlo: NO debería.'
        });
      })();

      /* ── 16 · No se borra un catálogo en uso ──────────────────────────── */
      (function () {
        const sura = db.compania.find((c) => c.codigo === 'SURA');
        const r = Modelo.eliminar_catalogo('compania', sura.id);
        const baja = Modelo.dar_de_baja_catalogo('compania', sura.id);
        push({
          nombre: 'No se elimina un catálogo en uso: se da de baja',
          intento: 'Eliminar la compañía SURA, que tiene órdenes asociadas',
          esperado: 'Rechazo al eliminar; la baja lógica sí funciona',
          paso: !r.ok && baja.ok,
          detalle: r.motivo || 'Dejó eliminarla: el histórico habría dejado de leerse.'
        });
      })();

      /* ── 17 · 🔴 EL PERMISO LO REVISA EL MOTOR, NO EL BOTÓN ────────────
         Hasta el 13-08-2026 los permisos vivían en una tabla y en el menú, y
         ninguna operación los miraba: entrando como operario se podía crear un
         presupuesto igual. Esta prueba existe para que eso no vuelva a pasar.
         Se corre entrando como el pintor, que no tiene ese permiso. */
      (function () {
        const rolPrevio = Modelo.rolActual().id;
        const operario = Modelo.sesionesPosibles().find((p) => p.rol_id === 'ro-3');
        Modelo.fijar_persona_actual(operario.id);
        const o = Modelo.torre().find((x) => !x.presupuestos.length) || Modelo.torre()[0];
        const r = Modelo.crear_presupuesto(o.id, { id_reparacion: 90001, lineas: [] });
        const conf = Modelo.guardar_catalogo('compania', { nombre: 'Coladura', codigo: 'COL' });
        Modelo.fijar_persona_actual(null);
        Modelo.fijar_rol_actual(rolPrevio);
        push({
          nombre: '🔴 El permiso lo rechaza el motor, no solo el botón',
          intento: 'Entrando con la cuenta ' + operario.nombre + ' (operario), crear un presupuesto y tocar un catálogo',
          esperado: 'Rechazo en las dos, nombrando el permiso que falta',
          paso: !r.ok && !conf.ok && /permiso/i.test(r.motivo || ''),
          detalle: r.motivo || 'Lo dejó crear: el permiso es decorativo.'
        });
      })();

      /* ── 18 · El vehículo que se traspasa le llega a su responsable ───── */
      (function () {
        const jefe = Modelo.sesionesPosibles().find((p) => p.rol_id === 'ro-2');
        const libre = Modelo.torre().find((o) => !o.responsableId);
        const antes = Modelo.miTrabajo(jefe.id).aCargo.length;
        const r = libre ? Modelo.asignar_responsable_ot(libre.id, jefe.id) : { ok: false, motivo: 'Sin órdenes libres.' };
        const despues = Modelo.miTrabajo(jefe.id).aCargo.length;
        push({
          nombre: 'El vehículo traspasado aparece en la pantalla de su responsable',
          intento: 'Asignar la OT ' + (libre ? libre.numeroOT : '—') + ' a ' + jefe.nombre,
          esperado: 'La orden le aparece en "Vehículos a mi cargo" sin que nadie le avise',
          paso: r.ok && despues === antes + 1,
          detalle: r.ok ? 'Pasó de ' + antes + ' a ' + despues + ' órdenes a su cargo.'
                        : r.motivo
        });
      })();

      /* ── 19 · 🔴 EL OPERARIO SOLO VE LOS AUTOS QUE TIENE ASIGNADOS ──────
         El permiso dice qué PANTALLAS abre; el alcance dice qué FILAS trae
         cada pantalla. Sin lo segundo, el pintor —que no podía entrar a
         Configuración— igual veía los 102 vehículos del taller con el nombre
         y el RUT de cada cliente, y abría la ficha completa de cualquiera.
         Esta prueba mide las dos cosas: cuántos ve, y que la orden de otro no
         se abra ni por el id. */
      (function () {
        const operario = Modelo.sesionesPosibles().find((p) => p.rol_id === 'ro-3');
        const otro = Modelo.sesionesPosibles().find((p) => p.rol_id === 'ro-3' && p.id !== operario.id);
        Modelo.fijar_persona_actual(null);
        const total = Modelo.torre().length;
        const ajena = otro ? (Modelo.miTrabajo(otro.id).mias[0] || {}) : {};

        Modelo.fijar_persona_actual(operario.id);
        const suyas = Modelo.torre().length;
        const abreAjena = ajena.ot_id ? Modelo.otPorId(ajena.ot_id) : null;
        const historico = Modelo.historico({ todo: true }).length;
        Modelo.fijar_persona_actual(null);

        push({
          nombre: '🔴 El operario ve solo sus vehículos, no el taller entero',
          intento: 'Entrar con ' + operario.nombre + ' y pedir la torre, el histórico y la OT ' +
                   (ajena.numeroOT || '—') + ', que es de otro',
          esperado: 'Ve solo lo asignado, el histórico vacío y la orden ajena no se abre',
          paso: suyas < total && suyas > 0 && historico === 0 && abreAjena === null,
          detalle: 'Ve ' + suyas + ' de ' + total + ' órdenes · histórico ' + historico +
                   ' · la orden ajena ' + (abreAjena === null ? 'no se abre' : 'SE ABRIÓ, no debería')
        });
      })();

      /* ── 20 · Nadie cierra la etapa que tiene otro a su nombre ───────────
         `etapa.finalizar` dice que sabe cerrar etapas. No dice que pueda
         cerrar las de cualquiera. */
      (function () {
        const uno = Modelo.sesionesPosibles().find((p) => p.rol_id === 'ro-3');
        const dos = Modelo.sesionesPosibles().find((p) => p.rol_id === 'ro-3' && p.id !== uno.id);
        Modelo.fijar_persona_actual(null);
        const suya = dos ? (Modelo.miTrabajo(dos.id).mias[0] || {}) : {};

        Modelo.fijar_persona_actual(uno.id);
        const cerrar = suya.ot_id
          ? Modelo.finalizar_etapa(suya.ot_id, suya.etapaCodigo, uno.id)
          : { ok: true, motivo: 'sin etapa de otro para probar' };
        const aNombreDeOtro = suya.ot_id
          ? Modelo.tomar_etapa(suya.ot_id, suya.etapaCodigo, dos.id)
          : { ok: true };
        Modelo.fijar_persona_actual(null);

        push({
          nombre: 'Nadie cierra ni toma la etapa que tiene otro a su nombre',
          intento: uno.nombre + ' intenta cerrar la etapa ' + (suya.etapa || '—') +
                   ' que tiene ' + (dos ? dos.nombre : '—'),
          esperado: 'Rechazo en las dos, diciendo de quién es',
          paso: !cerrar.ok && !aNombreDeOtro.ok,
          detalle: cerrar.motivo || 'La cerró: no debería.'
        });
      })();

      /* ── 21 · Las fotos del vehículo son un permiso aparte ───────────────
         El pintor no sube fotos ni las mira: marca su etapa y sigue. Bodega
         sí necesita los documentos —la guía de despacho llega con la pieza—
         pero tampoco las fotos del daño. Son dos permisos distintos y esta
         prueba comprueba que el motor los distinga, no solo la pantalla. */
      (function () {
        const o = Modelo.torre()[0];
        Modelo.adjuntar_media(null, [o.id], [
          { nombre: 'prueba-dano.jpg', momento: 'ingreso', bytes: 10, bytes_original: 10, ot_id: o.id },
          { nombre: 'prueba-guia.pdf', momento: 'documento', bytes: 10, bytes_original: 10, ot_id: o.id }
        ]);
        const dueno = Modelo.mediaDe(o.id).length;

        const bodega = Modelo.sesionesPosibles().find((p) => p.rol_id === 'ro-4');
        Modelo.fijar_persona_actual(bodega.id);
        const veBodega = Modelo.mediaDe(o.id).map((m) => m.momento);

        const operario = Modelo.sesionesPosibles().find((p) => p.rol_id === 'ro-3');
        Modelo.fijar_persona_actual(operario.id);
        const veOperario = Modelo.mediaDe(o.id).length;
        const sube = Modelo.adjuntar_media(null, [o.id], []);
        Modelo.fijar_persona_actual(null);

        push({
          nombre: 'Las fotos del vehículo y los documentos son permisos distintos',
          intento: 'Pedir los adjuntos de la OT ' + o.numeroOT + ' como bodega y como operario',
          esperado: 'Bodega ve solo el documento; el operario no ve ninguno y no puede subir',
          paso: dueno >= 2 && veBodega.length === 1 && veBodega[0] === 'documento' &&
                veOperario === 0 && !sube.ok,
          detalle: 'El dueño ve ' + dueno + ' · bodega ve [' + veBodega.join(', ') +
                   '] · el operario ve ' + veOperario + ' y al subir: ' + (sube.motivo || 'la dejó subir')
        });
      })();

      /* ── 22 · 🔴 AL ADMINISTRADOR NO SE LE QUITA NADA ────────────────────
         La matriz de permisos es editable, y `configuracion` es una casilla
         más de esa matriz. Sin esta garantía, alguien la desmarca en la fila
         de Administración —por error o por mano ajena— y el taller queda sin
         nadie que pueda volver a marcarla: la única salida sería reiniciar la
         base y perder todo. Son dos puertas y las dos tienen que estar
         trabadas: quitarle el permiso, y desactivar la única cuenta que lo
         tiene. */
      (function () {
        const admin = db.rol.find((r) => r.total);
        const antes = Modelo.permisosDe(admin.id).length;
        const quitar = Modelo.fijar_rol_permiso(admin.id, 'configuracion', false);
        const despues = Modelo.permisosDe(admin.id).length;

        // Y aunque la matriz quedara vacía a mano, el motor lo deja entrar.
        db.rol_permiso = db.rol_permiso.filter((r) => r.rol_id !== admin.id);
        const rolPrevio = Modelo.rolActual().id;
        Modelo.fijar_rol_actual(admin.id);
        const entraIgual = Modelo.puede('configuracion') && Modelo.puede('consolidado.ver');
        Modelo.fijar_rol_actual(rolPrevio);

        // La cuenta con la que se entra: trabajador activo con un rol total.
        // Es la que quedaría huérfano el sistema si se pudiera desactivar.
        const conAcceso = db.persona.filter((p) => p.activo && p.tipo === 'trabajador' &&
          (db.rol.find((r) => r.id === (db.persona_rol.find((y) => y.persona_id === p.id) || {}).rol_id) || {}).total);
        const baja = conAcceso.length === 1
          ? Modelo.dar_de_baja_persona(conAcceso[0].id)
          : { ok: true, motivo: 'NO PROBADO: hay ' + conAcceso.length + ' cuentas con acceso total' };

        push({
          nombre: '🔴 Al administrador no se le puede quitar el acceso',
          intento: 'Desmarcarle «Administrar los catálogos», vaciarle la matriz entera y ' +
                   'desactivar su única cuenta',
          esperado: 'Las tres rebotan, y sigue teniendo los ' + db.permiso.length + ' permisos',
          paso: !quitar.ok && antes === despues && despues === db.permiso.length && entraIgual && !baja.ok,
          detalle: quitar.motivo + ' · Con la matriz vacía a mano ' +
                   (entraIgual ? 'igual entra' : 'QUEDÓ AFUERA') + ' · Al desactivar la cuenta: ' +
                   (baja.ok ? 'la desactivó, no debería' : baja.motivo)
        });
      })();

      /* ── 23 · 🔴 EL AUTO NO SALE SIN PASAR POR CONTROL DE CALIDAD ────────
         Pedido de Marco el 13-08-2026: «el control de calidad se hace antes de
         entregar el auto». Son DOS puertas y las dos tienen que estar
         trabadas, porque el vehículo puede salir por cualquiera de las dos:
         cerrando la etapa Entrega, o registrando la entrega —que es la
         operación que lo manda al histórico—.

         Y una tercera comprobación que importa igual: la orden que NUNCA pasó
         por calidad sí se entrega. Una pérdida total o un rechazo no pueden
         quedar atrapados esperando un control que jamás les aplicó. */
      (function () {
        const idDe = (c) => (db.etapa.find((e) => e.codigo === c) || {}).id;
        const final = db.estado.find((e) => (e.alcanzable_en || []).indexOf('entrega') >= 0) || {};

        // Una orden con Calidad y Entrega asignadas, las dos abiertas.
        const o = Modelo.torre().find((x) => !(x.etapasAsignadas || []).length);
        Modelo.asignar_etapas(o.id, [idDe('calidad'), idDe('entrega')]);

        const puerta1 = Modelo.finalizar_etapa(o.id, 'entrega', null);
        const puerta2 = Modelo.registrar_entrega(o.id, { estado: final.codigo, fecha: HOY });

        Modelo.finalizar_etapa(o.id, 'calidad', null);
        const ahoraSi = Modelo.registrar_entrega(o.id, { estado: final.codigo, fecha: HOY });

        // Y la que nunca pasó por calidad no queda atrapada.
        const libre = Modelo.torre().find((x) => !(x.etapasAsignadas || []).some((a) => a.codigo === 'calidad'));
        const sinCalidad = libre
          ? Modelo.registrar_entrega(libre.id, { estado: final.codigo, fecha: HOY })
          : { ok: true };

        push({
          nombre: '🔴 El auto no sale sin pasar por Control de calidad',
          intento: 'En la OT ' + o.numeroOT + ', con calidad abierta: cerrar la etapa Entrega y ' +
                   'registrar la entrega. Después cerrar calidad y volver a entregar',
          esperado: 'Las dos rebotan mientras calidad esté abierta; con calidad cerrada, entrega',
          paso: !puerta1.ok && !puerta2.ok && ahoraSi.ok && sinCalidad.ok,
          detalle: 'Etapa Entrega: ' + (puerta1.motivo || 'la cerró, no debería') +
                   ' · Entregar: ' + (puerta2.motivo || 'entregó, no debería') +
                   ' · Con calidad cerrada: ' + (ahoraSi.ok ? 'entrega' : 'NO DEJÓ — ' + ahoraSi.motivo) +
                   ' · Sin calidad asignada: ' + (sinCalidad.ok ? 'entrega' : 'QUEDÓ ATRAPADA')
        });
      })();

      /* ── 24 · Toda operación que escribe deja su hecho ───────────────────
         La razón de esta prueba es que el agujero anterior era invisible: 15
         de las 41 operaciones registraban, y no había forma de notar cuáles
         faltaban hasta que el expediente aparecía incompleto — justo cuando
         se necesita para responderle a una compañía.

         Se prueban tres operaciones que ANTES no dejaban ningún rastro, y se
         comprueba además que el hecho queda con el autor correcto y que lo
         rechazado no ensucia el registro. */
      (function () {
        const o = Modelo.torre().find((x) => !x.fueraDeTaller) || Modelo.torre()[0];
        const antes = Modelo.expedienteDe(o.numeroOT).hechos.length;

        /* Con sesión abierta, que es la única forma en que el sistema se usa:
           la pantalla de ingreso no deja entrar sin ella. Sin fijarla, esta
           misma prueba destapó que el autor quedaba disparejo —el evento caía
           al usuario administrador por defecto y la marca del repuesto quedaba
           nula—, que es exactamente lo que no puede pasar en un registro que
           sirve para responderle a una compañía.

           Va con una cuenta de rol total: las dos operaciones piden permisos
           distintos —la fecha es del jefe de taller y el repuesto es de
           bodega— y acá se está probando el registro, no el reparto. */
        const quien = (db.persona.find((p) => p.correo === 'gabriel.diaz@dyp.cl') || {}).id;
        Modelo.fijar_persona_actual(quien);

        const fecha = Modelo.fijar_fecha_compromiso(o.id, new Date(2026, 8, 30));
        const rep = Modelo.cargar_repuesto(o.id, { descripcion: 'Repuesto de prueba', cantidad: 1 });
        // Rechazada por una regla: no cambió nada, así que no puede dejar hecho.
        const mala = Modelo.escribir_bitacora(o.id, { asunto_id: 'no-existe', mensaje: 'x' });

        const ex = Modelo.expedienteDe(o.numeroOT);
        const nuevos = ex.hechos.slice(antes);
        const conAutor = nuevos.filter((h) => h.quien).length;

        push({
          nombre: '🔴 Toda operación que escribe deja su hecho, con autor',
          intento: 'En la OT ' + o.numeroOT + ': fijar la fecha de entrega y cargar un repuesto ' +
                   '—dos operaciones que antes no registraban nada— más una bitácora que la regla rechaza',
          esperado: 'Dos hechos nuevos, los dos con autor. La rechazada no deja ninguno',
          paso: fecha.ok && rep.ok && !mala.ok && nuevos.length === 2 && conAutor === 2,
          detalle: 'Hechos: ' + antes + ' → ' + ex.hechos.length + ' (' + nuevos.length + ' nuevos, ' +
                   conAutor + ' con autor) · ' +
                   nuevos.map((h) => h.titulo + ' por ' + (h.quien || 'SIN AUTOR')).join(' · ') +
                   ' · Rechazada: ' + (mala.ok ? 'PASÓ, no debería' : 'rebotó sin registrar')
        });
      })();

      /* ── 25 · El registro no se edita ────────────────────────────────────
         "Un registro que se puede corregir después no sirve para lo que él lo
         quiere usar." Se comprueba en la superficie del motor: si mañana
         alguien agrega una operación que toque la tabla `evento`, esta prueba
         se cae y hay que discutirlo, que es justamente lo que se busca. */
      (function () {
        const escriben = Object.keys(Modelo).filter((k) =>
          /evento/i.test(k) && /^(editar|eliminar|borrar|actualizar|guardar|fijar|corregir)/.test(k));

        const o = Modelo.torre()[0];
        const ex = Modelo.expedienteDe(o.numeroOT);
        // El expediente entrega copias: tocar lo que devuelve no altera la base.
        const original = ex.hechos.length ? ex.hechos[0].titulo : '';
        if (ex.hechos.length) ex.hechos[0].titulo = 'ADULTERADO';
        const relectura = Modelo.expedienteDe(o.numeroOT);
        const aguanta = !relectura.hechos.length || relectura.hechos[0].titulo === original;

        push({
          nombre: '🔴 El registro de hechos no se puede editar',
          intento: 'Buscar en el motor alguna operación que edite o borre un hecho, y ' +
                   'modificar a mano lo que devuelve el expediente',
          esperado: 'Ninguna operación de escritura sobre el registro, y la base intacta',
          paso: escriben.length === 0 && aguanta,
          detalle: escriben.length
            ? 'APARECIERON operaciones que escriben el registro: ' + escriben.join(', ')
            : 'Ninguna operación edita ni borra hechos · el expediente releído sigue diciendo «' +
              original + '»'
        });
      })();

      /* ── 26 · 🔴 EL ÍTEM QUE NADIE MIRÓ NO ES UN ÍTEM FALTANTE ──────────
         El cambio de modelo del 15-08-2026. Con el booleano `presente`, un
         checklist que nadie tocó se guardaba entero en `false` y se leía como
         "al auto le faltaban los 28 ítems" — que es exactamente el reclamo que
         el taller no puede permitirse tener guardado por escrito.

         Se prueban las dos mitades: lo que no se declara queda `sin_verificar`,
         y lo que sí se declara se guarda tal cual, con `danado` distinto de
         `no_presente`. */
      (function () {
        // Sin persona fijada: se lee una orden recién creada y el alcance del
        // rol decide qué devuelve `otPorId`. Acá se prueba el checklist, no el
        // reparto de permisos.
        restaurarSesion();
        Modelo.fijar_persona_actual(null);

        const items = db.inventario_item;
        const pedido = {};
        pedido[items[0].id] = 'presente';
        pedido[items[1].id] = 'no_presente';
        pedido[items[2].id] = 'danado';

        const r = Modelo.crear_ot_desde_recepcion(
          { patente: 'ZZZZ98', nombre: 'Cliente de Prueba', rut: '11.111.111-2',
            vin: 'PRUEBA00000000098', inventario: pedido, obsInventario: {}, demo: true },
          [{ tipo_ingreso_id: 'ti-2' }], 'prueba-inventario-cuatro');

        const ot = r.ok ? Modelo.otPorId(r.ordenes[0].ot_id) : null;
        const inv = ot ? ot.inventario : [];
        const cuenta = (c) => inv.filter((i) => i.estado === c).length;
        const sinTocar = items.length - 3;

        const ok = !!ot && inv.length === items.length &&
          inv[0].estado === 'presente' && inv[1].estado === 'no_presente' &&
          inv[2].estado === 'danado' && cuenta('sin_verificar') === sinTocar;

        push({
          nombre: '🔴 El ítem del checklist que nadie miró queda «sin verificar», no «no presente»',
          intento: 'Guardar una recepción declarando 3 de los ' + items.length +
                   ' ítems y dejando los otros ' + sinTocar + ' sin tocar',
          esperado: '1 presente · 1 no presente · 1 dañado · ' + sinTocar + ' sin verificar',
          paso: ok,
          detalle: !ot ? ('No se pudo crear la recepción: ' + r.motivo)
            : cuenta('presente') + ' presente · ' + cuenta('no_presente') + ' no presente · ' +
              cuenta('danado') + ' dañado · ' + cuenta('sin_verificar') + ' sin verificar' +
              (ok ? '' : '  ·  NO CUADRA: con un booleano los ' + sinTocar +
                ' sin mirar se guardaban como faltantes.')
        });
      })();

      /* ── 27 · 🔴 LA MISMA PATENTE NO PUEDE ENTRAR DE DOS FORMAS ────────
         Una patente chilena tiene seis caracteres. El guión, el punto y las
         minúsculas que a veces se escriben son decoración, y si se guardan, el
         MISMO vehículo queda como `AABB11` y como `aa-bb-11`: el buscador de
         Entrega encuentra uno y no el otro, y el historial del auto se parte
         en dos. Se normaliza al escribir, no al guardar.

         El corte en seis va en la misma prueba porque es la otra mitad de lo
         mismo: `AABB1199` no es una patente con dos caracteres de más, es un
         error de tipeo que hay que atajar en el mesón. */
      (function () {
        const variantes = ['AABB11', 'aabb11', 'AA-BB-11', ' aa bb 11 ', 'AA.BB.11'];
        const normalizadas = variantes.map(normalizarPatente);
        const todasIguales = normalizadas.every((p) => p === 'AABB11');
        const cortada = normalizarPatente('AABB1199');
        const ok = todasIguales && cortada === 'AABB11' && cortada.length === PATENTE_LARGO;

        push({
          nombre: '🔴 La misma patente escrita de cinco formas se guarda una sola vez',
          intento: 'Normalizar ' + variantes.map((v) => '«' + v + '»').join(', ') +
                   ' y además «AABB1199», que tiene dos caracteres de más',
          esperado: 'Las cinco dan AABB11, y la larga se corta en ' + PATENTE_LARGO,
          paso: ok,
          detalle: normalizadas.map((p) => '«' + p + '»').join(' ') +
            '  ·  AABB1199 → «' + cortada + '»' +
            (ok ? '' : '  ·  NO CUADRA: dos escrituras distintas del mismo vehículo.')
        });
      })();

      /* ── 28 · 🔴 PROGRAMAR LA ENTREGA NO ES HABER ENTREGADO ──────────────
         Pedido del cliente el 15-08-2026: poder poner una fecha de entrega
         futura. El riesgo está a la vista — que "programar" termine cerrando
         la orden y el auto desaparezca de la torre estando todavía en el
         taller, con el cliente esperando que lo llamen el jueves.

         Se prueban las dos mitades del mismo hecho: la fecha queda escrita, y
         la orden sigue viva, en la torre y sin estado final. */
      (function () {
        restaurarSesion();
        const quien = (db.persona.find((p) => p.correo === 'gabriel.diaz@dyp.cl') || {}).id;
        Modelo.fijar_persona_actual(quien);

        const o = Modelo.torre()[0];
        const cuando = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate() + 5, 15, 0);
        const r = o ? Modelo.programar_entrega(o.id, cuando, 'Comprometido con el cliente') : { ok: false };
        const luego = o ? Modelo.otPorId(o.id) : null;
        const enTorre = o ? Modelo.torre().some((x) => x.id === o.id) : false;

        const quedoLaFecha = !!luego && !!luego.fechaCompromiso &&
          luego.fechaCompromiso.getTime() === cuando.getTime();

        push({
          nombre: '🔴 Programar la entrega deja la fecha, no cierra la orden',
          intento: o ? ('Programar la OT ' + o.numeroOT + ' para el ' +
                   cuando.toLocaleDateString('es-CL')) : 'No había ninguna orden viva que programar',
          esperado: 'La fecha comprometida queda escrita · la orden sigue abierta y en la torre',
          paso: r.ok && quedoLaFecha && !!luego && !luego.esFinal && enTorre,
          detalle: !o ? 'La torre vino vacía.' : (!r.ok ? ('Rebotó: ' + r.motivo) :
            'Fecha comprometida: ' + (luego.fechaCompromiso
              ? luego.fechaCompromiso.toLocaleDateString('es-CL') : 'NO QUEDÓ') +
            ' · Estado: ' + luego.estadoNombre + (luego.esFinal ? ' (FINAL, no debería)' : ' (abierta)') +
            ' · En la torre: ' + (enTorre ? 'sí' : 'NO, se la llevó'))
        });
      })();

      /* ── 29 · 🔴 EL TOPE DEL CAMPO NO PUEDE VIVIR EN EL NAVEGADOR ──────
         Reclamo del cliente el 15-08-2026: *"aun deja pasarme de 17
         caracteres"*, con un VIN de 29 en pantalla y el tope ya publicado.

         La causa: `maxlength` es del navegador y solo frena lo que TECLEA una
         persona. El formulario se guarda solo en `localStorage`, así que un
         VIN escrito antes de que existiera el tope quedaba guardado y se
         repintaba entero en cada recarga — el campo se veía sin límite aunque
         el límite estuviera puesto.

         Por eso el corte tiene que estar en el DATO. Esta prueba mide justo
         eso: lo que llega de afuera, no lo que se teclea. */
      (function () {
        const largo = '64646465646846464646468464868';   // 29, el del reclamo
        const cortado = normalizarVin(largo);
        const conBasura = normalizarVin(' 1hgcm8-2633a 004352 ');
        const patSucia = normalizarPatente('AABB1199');

        const ok = cortado.length === VIN_LARGO &&
                   cortado === largo.slice(0, VIN_LARGO) &&
                   conBasura === '1HGCM82633A004352' &&
                   patSucia.length === PATENTE_LARGO;

        push({
          nombre: '🔴 Un VIN largo guardado de antes se corta al volver a abrirlo',
          intento: 'Restaurar un borrador con un VIN de ' + largo.length +
                   ' caracteres, que `maxlength` no toca porque no se tecleó',
          esperado: 'Queda en ' + VIN_LARGO + ', en mayúsculas y sin espacios ni guiones',
          paso: ok,
          detalle: '«' + largo + '» → «' + cortado + '» (' + cortado.length + ')' +
            '  ·  con basura → «' + conBasura + '»' +
            (ok ? '' : '  ·  NO CUADRA: el tope se apoya en el navegador y no en el dato.')
        });
      })();

      restaurarSesion();
      return res;
    });
  }

  /* Comprobaciones de que la semilla sigue cuadrando con lo medido en el
     sistema real. No son reglas de negocio: son control de que no rompimos
     los datos de demostración al tocar el motor. */
  function comprobarCifras() {
    const m = Modelo.metricas();
    const db = Modelo.base();
    const esperado = [
      ['Órdenes vivas en la torre',        m.enTorre,                     Semilla.TOTAL_TORRE],
      ['Con repuesto pendiente',           m.conRepuestoPendiente,        Semilla.CON_REPUESTO_PENDIENTE],
      ['Fuera de taller',                  m.fueraDeTaller,               Semilla.FUERA_DE_TALLER],
      ['Sin ninguna etapa asignada',       m.sinEtapa,                    Semilla.SIN_ETAPA],
      ['Trabajadores del equipo de demostración', db.persona.filter((p) => p.tipo === 'trabajador').length, Semilla.EQUIPO_DEMO],
      ['Entregados (histórico)',           Modelo.historico({ todo: true }).length, Semilla.TOTAL_HISTORICO],
      ['Etapas del taller',                db.etapa.length,               9],
      ['Estados del maestro',              db.estado.length,              9],
      ['Estados finales',                  db.estado.filter((e) => e.es_final).length, 5],
      ['Asuntos de bitácora',              db.asunto_bitacora.length,     6],
      ['Ítems del checklist de recepción', db.inventario_item.length,     28],
      // Cuatro, no dos: el checklist dejó de ser un sí/no el 15-08-2026.
      ['Estados posibles de un ítem',      Modelo.inventarioEstados().length, 4],
      ['Pasos del formulario de ingreso',  RECEPCION_PASOS.length,        5],
      // Los dos largos fijos del paso 2. Están acá para que nadie los "arregle"
      // sin darse cuenta: son norma (ISO 3779) y formato legal, no preferencia.
      ['Caracteres de una patente',        PATENTE_LARGO,                 6],
      ['Caracteres de un VIN',             VIN_LARGO,                     17],
      // El tempario se eliminó el 13-08-2026 y con él su cifra de control.
      // Queda ésta en su lugar: que no haya quedado ni un rastro de la tabla.
      ['Catálogos configurables',          Modelo.CATALOGOS.length,       9]
    ];
    return esperado.map(([nombre, real, ref]) => ({
      nombre, real, referencia: ref, paso: real === ref
    }));
  }

  return { correr, comprobarCifras };
})();
