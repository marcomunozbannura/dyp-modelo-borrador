/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   EL REPOSITORIO. Guarda las tablas, las persiste, y es el único punto por
   donde las vistas leen y escriben. Ninguna vista toca un arreglo crudo.

   Dos ideas que conviene no perder:

   · Las tablas están NORMALIZADAS como van a estar en PostgreSQL; las vistas
     reciben objetos DESNORMALIZADOS armados al leer. Es la misma separación
     que va a haber entre las tablas y las consultas en producción.

   · Cada mutación se llama como el procedimiento que después va a existir en
     la base (`crear_ot_desde_recepcion`, `asignar_etapas`, `finalizar_etapa`,
     `registrar_salida`, `registrar_reingreso`) y devuelve { ok, motivo }.
     Ninguna valida por su cuenta: todas le preguntan a Reglas.

   Persistencia: solo texto y números, en localStorage. Las fotos NO van acá
   —el límite del navegador son 5 a 10 MB y en el original hay ~47 fotos por
   orden—; van en IndexedDB referenciadas por id. Eso es de la tanda 2.

   🔴 LO QUE ESTE PROTOTIPO NO PUEDE DEMOSTRAR. Tres requisitos de la
   auditoría solo se cumplen de verdad en la base de datos:
     A-1  permisos a nivel de campo — ocultar un campo en el navegador no
          impide leerlo;
     A-2  enmascaramiento de RUT y domicilio por rol — si el dato llegó al
          navegador, ya se entregó;
     A-10 traza de lecturas y exportaciones — un registro que vive en el
          mismo navegador que audita no prueba nada.
   Acá están MODELADOS y se pueden mostrar. Se GARANTIZAN al migrar a
   Postgres con RLS. No decimos "cumple" donde lo correcto es "está modelado,
   falta la base".
   ──────────────────────────────────────────────────────────────────────── */

const Modelo = (function () {

  /* La llave lleva versión, y la versión SUBE cada vez que cambia la forma de
     los datos. Sin eso, una base guardada de antes sobrevive y el sistema
     arranca mezclado: pasó con las cuentas —quedaron a la vista los 89
     trabajadores de la semilla vieja, cada uno con su cuenta— porque el
     navegador guarda por origen y `localhost:8101` tenía lo suyo mientras
     `localhost:8102` estaba recién sembrado.

     v3 · cuentas por rol, con usuario y clave.
     v4 · alcance por rol y seis permisos nuevos (histórico, fotos, documentos,
          ficha completa, editar personal).
     v5 · sin tempario: se fue la tabla, su catálogo y el `tempario_id` de las
          líneas del presupuesto. */
  const CLAVE = 'dyp-modelo-v5';

  // Y se barre lo que dejaron las versiones anteriores: ocupa espacio y no
  // sirve para nada.
  try {
    ['dyp-modelo', 'dyp-modelo-v2', 'dyp-modelo-v3', 'dyp-modelo-v4']
      .forEach((k) => localStorage.removeItem(k));
  } catch (e) { /* sin almacenamiento */ }

  /* El nombre que se muestra de una cuenta. Las cuentas de rol no tienen
     apellido —"Pintura" no se apellida—, así que concatenar a secas dejaba un
     espacio colgando en cada pantalla. */
  const nombreDe = (p) => (p ? String((p.nombres || '') + ' ' + (p.apellidos || '')).trim() : '');

  let db = null;
  let modificado = false;
  let version = 0;          // sube en cada mutación: invalida los memos
  const memo = {};

  /* ── Persistencia ─────────────────────────────────────────────────────── */

  // OJO con esta: JSON.stringify llama a Date.prototype.toJSON ANTES que al
  // reemplazador, así que `valor` ya llega convertido a texto y `instanceof
  // Date` siempre da falso. Hay que mirar el valor original del contenedor,
  // que es lo que `this[clave]` devuelve. Sin esto las fechas se guardan como
  // texto plano y al recargar el sistema revienta al formatearlas.
  function aJSON(clave, valor) {
    const original = this[clave];
    return original instanceof Date ? { __fecha: original.toISOString() } : valor;
  }
  function deJSON(_clave, valor) {
    return valor && typeof valor === 'object' && valor.__fecha ? new Date(valor.__fecha) : valor;
  }

  function guardar() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ modificado, db }, aJSON));
      return true;
    } catch (e) {
      // Cuota llena o file:// sin almacenamiento: el borrador sigue andando
      // en memoria, solo que no recuerda al cerrar.
      console.warn('No se pudo guardar el estado:', e && e.message);
      return false;
    }
  }

  function cargar() {
    try {
      const crudo = localStorage.getItem(CLAVE);
      if (!crudo) return null;
      const dato = JSON.parse(crudo, deJSON);
      return dato && dato.db ? dato : null;
    } catch (e) {
      console.warn('Estado guardado ilegible, se vuelve a la semilla:', e && e.message);
      return null;
    }
  }

  function sembrar() { db = Semilla.generar(); modificado = false; version++; limpiarMemo(); alinearSeqEvento(); guardar(); }

  /* ¿La base guardada quedó vieja para este código? Se compara su catálogo de
     permisos con el que trae la semilla. Si falta alguno, ese navegador tiene
     una base de una versión anterior y arrancar con ella deja el sistema a
     medias: los módulos que piden un permiso inexistente desaparecen del menú
     —incluso los del administrador— y parece que "no están hechos los
     cambios".

     Pasó de verdad, dos veces, y siempre por lo mismo: el navegador guarda por
     ORIGEN, así que `localhost:8101` conserva la suya mientras se prueba en
     otro puerto. Subir la versión de la llave lo arregla una vez; esto lo
     arregla siempre. */
  function baseVieja(g) {
    try {
      const guardados = (g.db.permiso || []).map((p) => p.codigo);
      const faltan = Semilla.CATALOGO_PERMISOS
        .map(([c]) => c).filter((c) => guardados.indexOf(c) < 0);
      return faltan.length ? faltan : null;
    } catch (e) { return ['(base ilegible)']; }
  }

  function iniciar() {
    const g = cargar();
    if (!g) return sembrar();
    const faltan = baseVieja(g);
    if (faltan) {
      console.warn('La base guardada en este navegador es de una versión anterior ' +
        '(le faltan: ' + faltan.join(', ') + '). Se vuelve a sembrar.');
      return sembrar();
    }
    db = g.db; modificado = !!g.modificado; version++; limpiarMemo(); alinearSeqEvento();
  }

  /* Vuelve a leer lo que hay guardado, descartando la copia en memoria.

     Existe por un problema que solo aparece con varias pestañas abiertas, que
     es como se usa esto de verdad: la orden se abre en su pestaña con doble
     clic, después se le carga el presupuesto desde la pestaña principal, y al
     volver a la de la orden seguía mostrando lo de antes. No era que no
     guardara — era que esa pestaña tenía su propia copia cargada al abrirse y
     nadie le avisaba. Ahora el navegador avisa y esta función releé. */
  function recargarDeDisco() {
    const g = cargar();
    if (!g) return false;
    db = g.db; modificado = !!g.modificado;
    version++; limpiarMemo(); alinearSeqEvento();
    pila.length = 0;   // la pila de deshacer es de esta pestaña y ya no aplica
    return true;
  }

  function reiniciar() {
    try { localStorage.removeItem(CLAVE); } catch (e) { /* sin almacenamiento */ }
    // Y los binarios de IndexedDB: si no, las fotos quedan huérfanas para
    // siempre, ocupando disco sin que nada las referencie.
    try { if (window.Media) Media.vaciar(); } catch (e) { /* sin IndexedDB */ }
    try { localStorage.removeItem('dyp-recepcion-borrador'); } catch (e) { /* nada */ }
    sembrar();
    return { ok: true, motivo: '' };
  }

  function limpiarMemo() { Object.keys(memo).forEach((k) => delete memo[k]); }
  function tocado() { modificado = true; version++; limpiarMemo(); guardar(); }

  const estaModificado = () => modificado;
  const base = () => db;

  /* Corre `fn` contra una base recién sembrada y descarta todo al terminar.
     Lo usan las pruebas negativas: ejecutan los procedimientos DE VERDAD, no
     una imitación, pero no ensucian los datos del usuario. */
  function sandbox(fn) {
    const real = { db, modificado, version };
    const guardarReal = guardar;
    try {
      db = Semilla.generar(); modificado = false; version++; limpiarMemo();
      guardar = function () { return true; };
      return fn();
    } finally {
      guardar = guardarReal;
      db = real.db; modificado = real.modificado; version = real.version + 1;
      limpiarMemo();
    }
  }

  let secuencia = 0;
  const nuevoId = (p) => p + '-' + Date.now().toString(36) + '-' + (++secuencia);

  /* ── Índices ──────────────────────────────────────────────────────────── */

  function indices() {
    if (memo.idx && memo.idxV === version) return memo.idx;
    const agrupar = (tabla, clave) => {
      const m = new Map();
      (db[tabla] || []).forEach((f) => {
        if (!m.has(f[clave])) m.set(f[clave], []);
        m.get(f[clave]).push(f);
      });
      return m;
    };
    const porId = (tabla) => new Map((db[tabla] || []).map((f) => [f.id, f]));
    memo.idx = {
      vehiculo: porId('vehiculo'), persona: porId('persona'), compania: porId('compania'),
      etapa: porId('etapa'), estado: new Map(db.estado.map((e) => [e.codigo, e])),
      marca: porId('marca'), modelo: porId('modelo'), color: porId('color_vehiculo'),
      tipo_ingreso: porId('tipo_ingreso'), prioridad: porId('prioridad'),
      inventario_item: porId('inventario_item'), asunto: porId('asunto_bitacora'),
      respPago: porId('responsable_pago'), tipoDano: porId('tipo_dano'), zonaDano: porId('zona_dano'),
      etapasDeOT: agrupar('ot_etapa', 'ot_id'), repuestosDeOT: agrupar('repuesto', 'ot_id'),
      presupuestosDeOT: agrupar('presupuesto', 'ot_id'),
      lineasDePresupuesto: agrupar('presupuesto_linea', 'presupuesto_id'),
      danosDeRec: agrupar('dano', 'recepcion_id'), estadiasDeOT: agrupar('ot_estadia', 'ot_id'),
      bitacoraDeOT: agrupar('bitacora', 'ot_id'), eventosDeOT: agrupar('evento', 'ot_id'),
      inventarioDeRec: agrupar('recepcion_inventario', 'recepcion_id'),
      recepcion: porId('recepcion')
    };
    memo.idxV = version;
    return memo.idx;
  }

  /* ── Vista desnormalizada de una orden ────────────────────────────────── */

  function vistaOT(o) {
    const ix = indices();
    const veh = ix.vehiculo.get(o.vehiculo_id) || {};
    const cli = ix.persona.get(o.cliente_id) || {};
    const comp = ix.compania.get(o.compania_id);
    const est = ix.estado.get(o.estado) || {};
    const rel = Reglas.calcularRelojes(db, o.id, HOY);

    const etapas = (ix.etapasDeOT.get(o.id) || [])
      .map((x) => Object.assign({}, x, { etapa: ix.etapa.get(x.etapa_id) }))
      .filter((x) => x.etapa)
      .sort((a, b) => a.etapa.orden - b.etapa.orden);
    // Etapa actual = la asignada más avanzada sin cerrar. Si todas están
    // cerradas, la última que se cerró. Nunca se guarda como campo suelto.
    const actual = etapas.find((x) => !x.salio_at) || etapas[etapas.length - 1];

    return {
      id: o.id, numeroOT: o.numero_ot,
      patente: veh.patente,
      marca: (ix.marca.get(veh.marca_id) || {}).nombre,
      modelo: (ix.modelo.get(veh.modelo_id) || {}).nombre,
      anio: veh.anio,
      color: (ix.color.get(veh.color_id) || {}).nombre,
      vin: veh.vin,
      cliente: [cli.nombres, cli.apellidos].filter(Boolean).join(' '),
      rut: cli.rut, telefono: cli.telefono, direccion: cli.direccion,
      compania: comp ? comp.codigo : '—', companiaId: o.compania_id,
      origenIngreso: (ix.tipo_ingreso.get(o.tipo_ingreso_id) || {}).codigo,
      origenIngresoNombre: (ix.tipo_ingreso.get(o.tipo_ingreso_id) || {}).nombre,
      siniestro: o.siniestro, deducible: o.deducible, liquidador: o.liquidador,
      prioridad: (ix.prioridad.get(o.prioridad_id) || {}).codigo,
      fechaIngreso: o.fecha_ingreso, fechaCompromiso: o.fecha_compromiso,
      fechaEntrega: o.fecha_entrega_real,
      // 🔴 `Fecha de salida` existe en la ficha del sistema actual y está
      // VACÍA incluso en órdenes ya entregadas. Acá sale de `ot_estadia`, que
      // es un hecho con fecha, y por eso siempre está.
      fechaSalida: (() => {
        const cerradas = db.ot_estadia.filter((e) => e.ot_id === o.id && e.salio_at)
          .sort((a, b) => b.salio_at - a.salio_at);
        return cerradas.length ? cerradas[0].salio_at : null;
      })(),

      // Quién responde por esta orden de punta a punta, distinto de quien hace
      // cada etapa. Se asigna al recibir el vehículo.
      responsableId: o.responsable_id || null,
      responsableNombre: (() => {
        const p = o.responsable_id ? ix.persona.get(o.responsable_id) : null;
        return p ? nombreDe(p) : null;
      })(),

      // ── estado, con sus dos booleanos separados ──
      estado: o.estado, estadoNombre: est.nombre || o.estado, estadoClase: est.clase || 'gris',
      esFinal: !!est.es_final, cierraOrden: !!est.cierra_orden,
      enTaller: !!Reglas.estadiaAbierta(db, o.id) && !est.es_final,
      fueraDeTaller: !Reglas.estadiaAbierta(db, o.id) && !est.es_final,

      // ── los TRES relojes ──
      diasTotales: rel.dias_totales,
      diasReparacion: rel.dias_reparacion,          // se reanuda
      diasEstadiaActual: rel.dias_estadia_actual,   // vuelve a cero
      diasFuera: rel.dias_fuera,
      diasKpi: rel.dias_kpi, sobreMeta: rel.sobre_meta,

      etapa: actual && actual.etapa ? actual.etapa.codigo : null,
      etapaNombre: actual && actual.etapa ? actual.etapa.nombre : 'Pendiente',
      etapasAsignadas: etapas.map((x) => ({
        codigo: x.etapa.codigo, nombre: x.etapa.nombre, orden: x.etapa.orden, color: x.etapa.color,
        finalizada: !!x.salio_at, asignadaAt: x.asignada_at, finalizadaAt: x.salio_at,
        responsable: (ix.persona.get(x.persona_id) || {}).nombres || null
      })),
      asignado: (() => {
        const p = actual && ix.persona.get(actual.persona_id);
        return p ? nombreDe(p) : null;
      })(),

      alertas: Reglas.alertasDe(db, o.id),

      repuestos: (ix.repuestosDeOT.get(o.id) || []).map((r) => ({
        id: r.id, descripcion: r.descripcion, cantidad: r.cantidad,
        responsablePago: (ix.respPago.get(r.responsable_pago_id) || {}).nombre,
        pagaTaller: !!(ix.respPago.get(r.responsable_pago_id) || {}).es_taller,
        fechaSolicitud: r.fecha_solicitud, fechaBodega: r.fecha_bodega,
        fechaEntregaArea: r.fecha_entrega_area, observacion: r.observacion,
        solicitadoPor: r.solicitado_por || null, recibidoPor: r.recibido_por || null,
        entregadoPor: r.entregado_por || null,
        // Compatibilidad con las vistas de las tandas anteriores.
        estado: r.fecha_bodega ? 'recibido' : 'por_pedir',
        fechaPedido: r.fecha_solicitud, fechaEstimada: null, proveedor: null,
        // Lo que los booleanos del original NO permitían calcular:
        diasEnLlegar: r.fecha_bodega ? Reglas.dias(r.fecha_solicitud, r.fecha_bodega) : null
      })),

      // Del vehículo, no de la orden: dos siniestros comparten la silueta.
      danos: (ix.danosDeRec.get(o.recepcion_id) || []).map((d) => ({
        zona: (ix.zonaDano.get(d.zona_id) || {}).codigo,
        zonaNombre: (ix.zonaDano.get(d.zona_id) || {}).nombre,
        tipo: (ix.tipoDano.get(d.tipo_id) || {}).codigo,
        tipoNombre: (ix.tipoDano.get(d.tipo_id) || {}).nombre,
        color: (ix.tipoDano.get(d.tipo_id) || {}).color,
        severidad: d.severidad, x: d.x, y: d.y, vista: d.vista
      })),

      inventario: (ix.inventarioDeRec.get(o.recepcion_id) || []).map((i) => ({
        item: (ix.inventario_item.get(i.item_id) || {}).nombre, presente: i.presente
      })),

      presupuestos: (ix.presupuestosDeOT.get(o.id) || [])
        .sort((a, b) => a.version - b.version)
        .map((p) => {
          const lineas = (ix.lineasDePresupuesto.get(p.id) || []).sort((a, b) => a.orden - b.orden);
          return {
            id: p.id, version: p.version, numeroOR: p.numero_or, idReparacion: p.id_reparacion,
            correlativo: p.correlativo, estado: p.estado,
            neto: p.neto, iva: p.iva, total: p.total,
            enviadoAt: p.enviado_at || null, resueltoAt: p.resuelto_at || null,
            lineas
          };
        }),

      recepcion: ix.recepcion.get(o.recepcion_id) || null,
      demo: !!o.demo
    };
  }

  /* ── Consultas ────────────────────────────────────────────────────────── */

  /* La torre entera, sin filtrar por quién mira. Es de uso interno: la usan
     `miTrabajo` —que justamente necesita ver lo que TODAVÍA no es de nadie
     para poder ofrecerlo— y las cifras de control. Lo que sale por la API es
     `torre()`, que va recortada al alcance de la sesión. */
  function torreCompleta() {
    if (memo.torre && memo.torreV === version) return memo.torre;
    memo.torre = db.orden_trabajo
      .filter((o) => Reglas.estaAbierta(db, o.estado))
      .map(vistaOT)
      .sort((a, b) => b.fechaIngreso - a.fechaIngreso);
    memo.torreV = version;
    return memo.torre;
  }

  const torre = () => torreCompleta().filter(enAlcance);

  /* El Histórico es un BUSCADOR, no un listado: sin filtro no devuelve nada.
     Así es el original (§C.9) y así hay que dejarlo, porque con 2.100 órdenes
     al año un listado paginado es inusable. `todo:true` es solo para las
     cifras de control. */
  function historico(filtro) {
    const f = filtro || {};
    const hayFiltro = f.todo || ['patente', 'cliente', 'compania_id', 'estado', 'desde', 'hasta']
      .some((k) => f[k]);
    if (!hayFiltro) return [];
    return db.orden_trabajo
      .filter((o) => Reglas.esFinal(db, o.estado))
      .map(vistaOT)
      .filter(enAlcance)
      .filter((o) => {
        if (f.patente && String(o.patente || '').toUpperCase().indexOf(String(f.patente).toUpperCase()) < 0) return false;
        if (f.cliente && String(o.cliente || '').toLowerCase().indexOf(String(f.cliente).toLowerCase()) < 0) return false;
        if (f.compania_id && o.companiaId !== f.compania_id) return false;
        if (f.estado && o.estado !== f.estado) return false;
        if (f.desde && o.fechaEntrega < f.desde) return false;
        if (f.hasta && o.fechaEntrega > f.hasta) return false;
        return true;
      })
      .sort((a, b) => b.fechaEntrega - a.fechaEntrega);
  }

  /* Abrir una orden por id o por número pasa por el mismo filtro que la torre.
     Si no está en el alcance de quien mira, la respuesta es `null` — la misma
     que si no existiera. Distinguir "no existe" de "existe pero no es tuya" se
     hace aparte, con `otFueraDeAlcance`, para poder escribir un mensaje que no
     mienta sin regalar de paso qué patentes hay en el taller. */
  const otPorId = (id) => {
    const o = db.orden_trabajo.find((x) => x.id === id);
    if (!o) return null;
    const v = vistaOT(o);
    return enAlcance(v) ? v : null;
  };
  const otPorNumero = (n) => {
    const o = db.orden_trabajo.find((x) => String(x.numero_ot) === String(n));
    if (!o) return null;
    const v = vistaOT(o);
    return enAlcance(v) ? v : null;
  };
  const otFueraDeAlcance = (n) => {
    const o = db.orden_trabajo.find((x) => String(x.numero_ot) === String(n) || x.id === n);
    return !!o && !enAlcance(vistaOT(o));
  };

  const totalOT = (o) => o.presupuestos.reduce((s, p) => s + p.total, 0);
  const tieneRepuestoPendiente = (o) => o.repuestos.some((r) => !r.fechaBodega);

  function metricas() {
    if (memo.met && memo.metV === version) return memo.met;
    const t = torre();
    const dentro = t.filter((o) => o.enTaller);
    const fuera = t.filter((o) => o.fueraDeTaller);
    const conRep = t.filter(tieneRepuestoPendiente);
    memo.met = {
      enTorre: t.length,
      enTaller: dentro.length,
      fueraDeTaller: fuera.length,
      conRepuestoPendiente: conRep.length,
      sinEtapa: t.filter((o) => !o.etapasAsignadas.length).length,
      repuestosPendientes: t.reduce((s, o) => s + o.repuestos.filter((r) => !r.fechaBodega).length, 0),
      sobreMeta: dentro.filter((o) => o.sobreMeta).length,
      metaDias: Reglas.metaDias(db),
      kpi: Reglas.kpiReparacion(db),
      diasPromedioReparacion: dentro.length ? Math.round(dentro.reduce((s, o) => s + o.diasKpi, 0) / dentro.length) : 0,
      diasPromedioFuera: fuera.length ? Math.round(fuera.reduce((s, o) => s + o.diasFuera, 0) / fuera.length) : 0,
      valorEsperandoRepuesto: conRep.reduce((s, o) => s + totalOT(o), 0),
      // El agendamiento automático NO existe en el sistema actual: ver
      // DECISIONES-REPLICA. Quedan en cero para no inventar un indicador.
      agendaPendiente: 0, agendaConProblema: 0
    };
    memo.metV = version;
    return memo.met;
  }

  function corteEspera() {
    const t = torre();
    return [
      { grupo: 'Fuera de taller esperando repuesto', filtro: 'fuera',
        detalle: 'El vehículo está con el cliente. No ocupa box y su reloj de reparación está detenido.',
        ots: t.filter((o) => o.fueraDeTaller) },
      { grupo: 'En taller con repuesto pendiente', filtro: 'repuesto',
        detalle: 'Ocupa espacio y la pieza todavía no llega. Son cosas distintas: hoy son ' +
                 t.filter((o) => o.enTaller && tieneRepuestoPendiente(o)).length + ' contra ' +
                 t.filter((o) => o.fueraDeTaller).length + '.',
        ots: t.filter((o) => o.enTaller && tieneRepuestoPendiente(o)) },
      { grupo: 'En taller sobre la meta de ' + Reglas.metaDias(db) + ' días', filtro: 'sobremeta',
        detalle: 'Lleva más días de reparación que el objetivo del taller.',
        ots: t.filter((o) => o.enTaller && !tieneRepuestoPendiente(o) && o.sobreMeta) }
    ].map((g) => ({
      grupo: g.grupo, detalle: g.detalle, filtro: g.filtro, vehiculos: g.ots.length,
      diasAcumulados: g.ots.reduce((s, o) => s + (o.fueraDeTaller ? o.diasFuera : o.diasKpi), 0),
      valor: g.ots.reduce((s, o) => s + totalOT(o), 0),
      lista: g.ots
    })).sort((a, b) => b.diasAcumulados - a.diasAcumulados);
  }

  function historialDe(ot_id) {
    const ix = indices();
    return (ix.eventosDeOT.get(ot_id) || [])
      .slice().sort((a, b) => b.fecha - a.fecha)
      .map((e) => ({
        fecha: e.fecha, tipo: e.tipo, detalle: e.detalle,
        etapa: (ix.etapa.get(e.etapa_id) || {}).nombre || '—',
        usuario: (() => { const p = ix.persona.get(e.persona_id); return p ? nombreDe(p) : '—'; })()
      }));
  }

  /* ── El expediente ────────────────────────────────────────────────────
     Todo lo que le pasó a un vehículo, en una sola línea de tiempo. Es lo que
     el cliente declaró como lo más importante del sistema, y para qué lo
     quiere: "tener el registro histórico le permite tener transparencia de
     cara a las compañías de seguro, pero también a los que van con el auto
     particular". No es un reporte: es con lo que le responde a una aseguradora.

     Junta seis fuentes que hasta ahora había que mirar en seis pantallas
     distintas —el registro de hechos, la recepción con sus daños, los
     presupuestos con sus versiones, los repuestos con sus marcas, la bitácora
     y los archivos— y las ordena por cuándo pasaron.

     No hay ninguna operación que edite o borre un hecho, y eso es a propósito:
     "un registro que se puede corregir después no sirve para lo que él lo
     quiere usar". Se agregan hechos, no se cambian. */
  function expedienteDe(clave) {
    const o = otPorNumero(clave) || otPorId(clave);
    if (!o) return null;
    const ix = indices();
    const hechos = [];

    const sumar = (fecha, seq, grupo, titulo, detalle, quien) => {
      if (!fecha) return;
      hechos.push({ fecha, seq: seq || 0, grupo, titulo, detalle: detalle || '', quien: quien || null });
    };
    const nombre = (persona_id) => {
      const p = ix.persona.get(persona_id);
      return p ? nombreDe(p) : null;
    };

    // 1 · La recepción abre el expediente.
    // Correlativos NEGATIVOS a propósito: la recepción y lo que se levantó
    // en ella abren el expediente. Los eventos que vienen de la semilla no
    // traen correlativo —valen 0— y sin esto los daños del vehículo salían
    // DESPUÉS de la primera etapa cerrada, que es imposible.
    sumar(o.fechaIngreso, -3, 'recepcion', 'Ingreso del vehículo',
      [o.marca, o.modelo, o.color].filter(Boolean).join(' · ') +
      (o.compania && o.compania !== '—' ? ' — ' + o.compania : ''), null);

    if (o.danos.length) {
      sumar(o.fechaIngreso, -2, 'recepcion', 'Daños registrados en la recepción',
        o.danos.map((d) => d.zonaNombre + ': ' + d.tipoNombre +
          (d.severidad ? ' (' + d.severidad + ')' : '')).join(' · '), null);
    }
    const faltantes = o.inventario.filter((i) => !i.presente);
    if (o.inventario.length) {
      sumar(o.fechaIngreso, -1, 'recepcion', 'Inventario de recepción',
        faltantes.length
          ? o.inventario.length + ' ítems revisados, falta: ' + faltantes.map((i) => i.item).join(', ')
          : 'Los ' + o.inventario.length + ' ítems presentes', null);
    }

    // 2 · El registro de hechos: etapas, estados, salidas, reingresos.
    (ix.eventosDeOT.get(o.id) || []).forEach((e) => {
      sumar(e.fecha, e.seq, e.tipo, rotuloEvento(e.tipo),
        e.detalle + ((ix.etapa.get(e.etapa_id) || {}).nombre
          ? ' — ' + ix.etapa.get(e.etapa_id).nombre : ''),
        nombre(e.persona_id));
    });

    // 3 · Presupuestos: cada versión es un hecho, y el envío y la respuesta
    //     también. Es la discusión con la compañía, y es lo que la hace
    //     auditable.
    o.presupuestos.forEach((p) => {
      sumar(o.fechaIngreso, 3, 'presupuesto', 'Presupuesto ' + p.numeroOR + ' · versión ' + p.version,
        p.lineas.length + (p.lineas.length === 1 ? ' línea' : ' líneas') +
        ' · ' + fPlata(p.neto) + ' neto · ' + fPlata(p.total) + ' total', null);
      if (p.enviadoAt) sumar(p.enviadoAt, 4, 'presupuesto', 'Presupuesto ' + p.numeroOR + ' enviado', '', null);
      if (p.resueltoAt) sumar(p.resueltoAt, 5, 'presupuesto',
        'Presupuesto ' + p.numeroOR + ': ' + p.estado, '', null);
    });

    // 4 · Repuestos, con sus marcas separadas: pedido, llegada a bodega y
    //     entrega al área son tres hechos distintos y con fechas distintas.
    o.repuestos.forEach((r) => {
      sumar(r.fechaSolicitud, 6, 'repuesto', 'Repuesto pedido',
        r.descripcion + (r.cantidad > 1 ? ' (' + r.cantidad + ')' : '') +
        (r.responsablePago ? ' — paga ' + r.responsablePago : ''), nombre(r.solicitadoPor));
      if (r.fechaBodega) sumar(r.fechaBodega, 7, 'repuesto', 'Repuesto recibido en bodega',
        r.descripcion + (r.diasEnLlegar != null ? ' — tardó ' + r.diasEnLlegar + ' días' : ''),
        nombre(r.recibidoPor));
      if (r.fechaEntregaArea) sumar(r.fechaEntregaArea, 8, 'repuesto', 'Repuesto entregado al área',
        r.descripcion, nombre(r.entregadoPor));
    });

    // 5 · Bitácora: las comunicaciones al cliente y a la compañía.
    bitacoraDe(o.id).forEach((b) => {
      sumar(b.fecha, 9, 'bitacora', 'Bitácora · ' + (b.asunto || 'mensaje'),
        b.mensaje, b.usuario);
    });

    // 6 · Archivos. Van con quién los subió: una foto sin autor ni fecha no
    //     sirve para respaldar nada frente a una compañía.
    mediaDe(o.id).forEach((m) => {
      sumar(m.subido_at || o.fechaIngreso, 10,
        m.momento === 'documento' ? 'documento' : 'foto',
        m.momento === 'documento' ? 'Documento adjunto' : 'Foto adjunta',
        (m.nombre || m.id) + (m.momento ? ' — ' + m.momento : ''),
        nombre(m.subido_por));
    });

    hechos.sort((a, b) => (+a.fecha - +b.fecha) || (a.seq - b.seq));

    return {
      orden: o,
      hechos,
      resumen: {
        hechos: hechos.length,
        presupuestos: o.presupuestos.length,
        repuestos: o.repuestos.length,
        archivos: mediaDe(o.id).length,
        etapasCerradas: o.etapasAsignadas.filter((e) => e.finalizada).length,
        etapas: o.etapasAsignadas.length,
        desde: hechos.length ? hechos[0].fecha : o.fechaIngreso,
        hasta: hechos.length ? hechos[hechos.length - 1].fecha : o.fechaIngreso
      }
    };
  }

  const ROTULO_EVENTO = {
    estado: 'Cambio de estado', etapa: 'Etapa', salida: 'Salida del taller',
    reingreso: 'Reingreso al taller', modificacion: 'Modificación',
    documento: 'Archivos', entrega: 'Entrega'
  };
  const rotuloEvento = (t) => ROTULO_EVENTO[t] || 'Movimiento';

  // El formato de plata vive en las vistas; acá se necesita para el detalle de
  // un hecho, que es texto y no se vuelve a formatear después.
  const fPlata = (n) => '$' + (Number(n) || 0).toLocaleString('es-CL');

  function bitacoraDe(ot_id) {
    const ix = indices();
    return (ix.bitacoraDeOT.get(ot_id) || [])
      .slice().sort((a, b) => b.fecha - a.fecha)
      .map((b) => ({
        id: b.id, fecha: b.fecha, mensaje: b.mensaje,
        asunto: (ix.asunto.get(b.asunto_id) || {}).nombre,
        destinatario: (() => { const p = ix.persona.get(b.destinatario_id); return p ? nombreDe(p) : '—'; })(),
        apagada: !!b.alerta_apagada
      }));
  }

  /* ── Catálogos, tal como los consumen las vistas ──────────────────────── */

  const vigentes = (t) => (db[t] || []).filter((f) => f.vigente !== false);

  const etapas = () => vigentes('etapa').slice().sort((a, b) => a.orden - b.orden).map((e) => ({
    id: e.id, codigo: e.codigo, nombre: e.nombre, orden: e.orden, color: e.color,
    reqRepuestos: e.requiere_repuestos_completos, exigePrecedencia: e.exige_precedencia,
    opcional: !e.aplica_siempre
  }));
  const estadosOT = () => vigentes('estado').slice().sort((a, b) => a.orden - b.orden);
  const companias = () => vigentes('compania').map((c) => ({ id: c.id, codigo: c.codigo, nombre: c.nombre }));
  const tiposDano = () => vigentes('tipo_dano');
  const zonasDano = () => vigentes('zona_dano');
  const inventarioItems = () => vigentes('inventario_item').sort((a, b) => a.orden - b.orden).map((i) => i.nombre);
  const roles = () => vigentes('rol');
  const motivosDetencion = () => vigentes('motivo_detencion');
  const prerrequisitos = () => db.etapa_prerrequisito.map((p) => ({
    etapa: (db.etapa.find((e) => e.id === p.etapa_id) || {}).codigo,
    requiere: (db.etapa.find((e) => e.id === p.requiere_etapa_id) || {}).codigo
  }));

  /* ═══════════════════════════════════════════════════════════════════════
     MUTACIONES · nombre de procedimiento, resultado { ok, motivo }
     ═══════════════════════════════════════════════════════════════════════ */

  /* Idempotencia (regla 15). El doble clic no crea dos: la segunda llamada
     con la misma llave devuelve lo mismo que la primera, sin escribir. */
  function conLlave(llave, fn) {
    if (!llave) return fn();
    const previo = db.operacion.find((o) => o.llave === llave);
    if (previo) return Object.assign({ ok: true, motivo: '', repetida: true }, previo.resultado);
    const r = fn();
    if (r.ok) { db.operacion.push({ llave, resultado: r, at: HOY }); guardar(); }
    return r;
  }

  /* ── El registro de hechos ────────────────────────────────────────────
     Es la base del expediente del vehículo, que el cliente declaró el
     15-08-2026 como lo más importante del sistema: "todo movimiento, todo lo
     que se le haga al vehículo... absolutamente todo lo que tuvo detrás el
     proceso operacional del vehículo debiese quedar en el registro histórico".
     Lo usa para responderle a una aseguradora, así que tiene que ser completo
     y no tiene que poder editarse.

     Dos cosas que estaban mal y se arreglaron para poder armarlo:

     · `fecha: HOY` es la fecha de demostración, sin hora, e igual para todo lo
       que pase el mismo día. Ordenar el expediente por fecha dejaba los hechos
       del día en cualquier orden. Por eso cada evento lleva además un
       correlativo que sólo sube: la fecha dice el día y el correlativo dice
       qué pasó primero.

     · `persona_id || 'pe-u-admin'` le atribuía a administración lo que hacía
       cualquiera. En un registro que sirve para responderle a la compañía, eso
       no es un detalle: por defecto queda quien tiene la sesión abierta. */
  let seqEvento = 0;

  function registrarEvento(ot_id, tipo, detalle, etapa_id, persona_id) {
    if (!ot_id) return;
    db.evento.push({
      id: nuevoId('ev'), ot_id, fecha: HOY, seq: ++seqEvento, tipo, detalle,
      etapa_id: etapa_id || null,
      persona_id: persona_id || persona_actual || 'pe-u-admin'
    });
  }

  /* El correlativo arranca por encima de lo que ya haya en la base, para que un
     evento nuevo nunca quede antes de uno viejo al recargar de localStorage. */
  function alinearSeqEvento() {
    seqEvento = (db.evento || []).reduce((m, e) => Math.max(m, Number(e.seq) || 0), 0);
  }

  /* Una recepción puede generar VARIAS órdenes (A-8). Por eso recibe un
     arreglo de bloques: cada uno con su siniestro, compañía y deducible. */
  function crear_ot_desde_recepcion(ficha, bloques, llave) {
    return conLlave(llave, function () {
      if (!ficha || !ficha.patente) return { ok: false, motivo: 'La patente es obligatoria.' };
      if (!bloques || !bloques.length)
        return { ok: false, motivo: 'Hay que declarar al menos una orden. Una recepción puede generar varias.' };

      const pat = String(ficha.patente).toUpperCase().replace(/[^A-Z0-9]/g, '');
      let veh = db.vehiculo.find((v) => v.patente === pat);
      if (!veh) {
        veh = { id: nuevoId('veh'), patente: pat, marca_id: ficha.marca_id || null,
          modelo_id: ficha.modelo_id || null, anio: ficha.anio || null,
          color_id: ficha.color_id || null, vin: ficha.vin || null };
        db.vehiculo.push(veh);
      }

      const permiso = Reglas.puedeCrearOT(db, { vehiculo_id: veh.id });
      if (!permiso.ok) return permiso;

      let cli = ficha.cliente_id && db.persona.find((p) => p.id === ficha.cliente_id);
      if (!cli) {
        cli = { id: nuevoId('pe-c'), tipo: 'cliente', ficha: null, rut: ficha.rut || null,
          nombres: ficha.nombres || 'Cliente', apellidos: ficha.apellidos || '',
          correo: ficha.correo || null, telefono: ficha.telefono || null,
          direccion: ficha.direccion || null, comuna: ficha.comuna || null,
          activo: true, demo: !!ficha.demo };
        db.persona.push(cli);
      }

      const rec_id = nuevoId('rec');
      db.recepcion.push({
        id: rec_id, vehiculo_id: veh.id, cliente_id: cli.id, fecha: HOY,
        km: ficha.km || null, combustible: ficha.combustible != null ? ficha.combustible : null,
        observaciones: ficha.observaciones || '', firma_media_id: ficha.firma_media_id || null,
        recibido_por: 'pe-u-recepcion'
      });
      db.inventario_item.forEach((it, i) => db.recepcion_inventario.push({
        recepcion_id: rec_id, item_id: it.id,
        presente: !!(ficha.inventario && ficha.inventario[i]), observacion: ''
      }));
      // Los daños de la silueta cuelgan de la RECEPCIÓN, no de la orden: son
      // el estado físico del vehículo al entrar, y es uno solo aunque el auto
      // traiga dos siniestros. Lo que sí es por orden es la "Descripción de
      // daños" en texto, que va en cada bloque.
      (ficha.danos || []).forEach((d, i) => db.dano.push({
        id: nuevoId('da') + '-' + i, recepcion_id: rec_id, vista: d.vista || 'superior',
        zona_id: d.zona_id, tipo_id: d.tipo_id, severidad: d.severidad || 2,
        x: d.x, y: d.y, descripcion: d.descripcion || ''
      }));

      const creadas = [];
      bloques.forEach((b) => {
        const numero_ot = Number(Reglas.parametro(db, 'correlativo_ot', 23489));
        const p = db.parametro.find((x) => x.clave === 'correlativo_ot');
        if (p) p.valor = numero_ot + 1;

        const ot_id = 'ot-' + numero_ot;
        db.orden_trabajo.push({
          id: ot_id, numero_ot, recepcion_id: rec_id, vehiculo_id: veh.id, cliente_id: cli.id,
          tipo_ingreso_id: b.tipo_ingreso_id || 'ti-1', compania_id: b.compania_id || null,
          siniestro: b.siniestro || null, deducible: b.deducible || 0,
          liquidador: b.liquidador || null, prioridad_id: b.prioridad_id || 'pri-1',
          fecha_ingreso: HOY, fecha_compromiso: b.fecha_compromiso || null,
          fecha_entrega_real: null, estado: b.estado || 'recibido',
          // El traspaso empieza acá: si la recepción eligió responsable, esa
          // orden le aparece en su pantalla apenas se guarda.
          responsable_id: b.responsable_id || null,
          observaciones_ingreso: b.observaciones || '', demo: !!ficha.demo
        });
        // La estadía se abre acá. A partir de este momento los relojes se
        // calculan de esta tabla y de ninguna otra.
        db.ot_estadia.push({ id: nuevoId('est'), ot_id, entro_at: HOY, salio_at: null, motivo_salida: null });
        registrarEvento(ot_id, 'estado', 'Ingreso del vehículo. Estado: ' + Reglas.nombreEstado(db, b.estado || 'recibido'), null, 'pe-u-recepcion');
        creadas.push({ ot_id, numero_ot });
      });

      tocado();
      return { ok: true, motivo: '', recepcion_id: rec_id, ordenes: creadas };
    });
  }

  /* Asignar es un paso aparte de finalizar, igual que en el original. Y a
     diferencia del original, la pantalla de asignar SÍ refleja lo ya
     asignado — allá muestra las nueve desmarcadas siempre. */
  function asignar_etapas(ot_id, etapa_ids) {
    const fallas = [];
    let n = 0;
    (etapa_ids || []).forEach((eid) => {
      const r = Reglas.puedeAsignarEtapa(db, { ot_id, etapa_id: eid });
      if (!r.ok) { fallas.push(r.motivo); return; }
      db.ot_etapa.push({ id: nuevoId('oe'), ot_id, etapa_id: eid,
        asignada_at: HOY, salio_at: null, persona_id: null, observacion: '' });
      registrarEvento(ot_id, 'etapa', 'Asignada', eid);
      n++;
    });
    if (!n) return { ok: false, motivo: fallas[0] || 'No se asignó ninguna etapa.' };
    tocado();
    return { ok: true, motivo: '', asignadas: n, avisos: fallas };
  }

  /* ── Quién hace qué ───────────────────────────────────────────────────
     Una etapa se asigna a la orden, y después alguien la toma. Hasta que la
     toman está abierta y sin dueño: cualquiera que tenga esa habilidad la
     puede agarrar. Es como funciona el piso de un taller — el auto entra a
     pintura y lo pinta el que esté libre—, y es lo que permite que cada
     persona abra el sistema y vea lo suyo sin que nadie se lo reparta a mano. */

  /* El dueño de la orden completa. Es distinto de quien hace cada etapa: uno
     pinta, otro desabolla, pero alguien tiene que responder por el vehículo de
     punta a punta — presupuestarlo, seguirlo y entregarlo.

     Se asigna al recibir, y desde ahí esa orden le aparece a esa persona en
     "Mi trabajo" aunque todavía no haya ninguna etapa abierta a su nombre. Es
     lo que convierte la recepción en un traspaso y no en un aviso. */
  function asignar_responsable_ot(ot_id, persona_id) {
    const o = db.orden_trabajo.find((x) => x.id === ot_id);
    if (!o) return { ok: false, motivo: 'La orden no existe.' };
    if (Reglas.esTerminal(db, o.estado))
      return { ok: false, motivo: 'La orden ' + o.numero_ot + ' está cerrada.' };
    if (!persona_id) {
      o.responsable_id = null;
      registrarEvento(ot_id, 'modificacion', 'Orden sin responsable asignado');
      tocado();
      return { ok: true, motivo: '' };
    }
    const p = db.persona.find((x) => x.id === persona_id);
    if (!p) return { ok: false, motivo: 'Esa persona no existe.' };
    if (!p.activo) return { ok: false, motivo: p.nombres + ' está desactivado.' };
    o.responsable_id = persona_id;
    registrarEvento(ot_id, 'modificacion', 'Responsable de la orden: ' + nombreDe(p));
    tocado();
    return { ok: true, motivo: '' };
  }

  function tomar_etapa(ot_id, etapa_codigo, persona_id) {
    const etapa = Reglas.etapaPorCodigo(db, etapa_codigo);
    if (!etapa) return { ok: false, motivo: 'La etapa "' + etapa_codigo + '" no existe.' };
    const oe = db.ot_etapa.find((x) => x.ot_id === ot_id && x.etapa_id === etapa.id && !x.salio_at);
    if (!oe) return { ok: false, motivo: 'Esa etapa no está abierta en esta orden.' };
    const p = db.persona.find((x) => x.id === persona_id);
    if (!p) return { ok: false, motivo: 'La persona no existe.' };
    // Con alcance `asignado` uno toma para sí, no a nombre de otro.
    if (alcanceActual() === 'asignado' && persona_id !== persona_actual)
      return { ok: false, motivo: 'Solo puedes tomar etapas para ti. Repartir el trabajo es del jefe de taller.' };
    if (!db.persona_etapa.some((h) => h.persona_id === persona_id && h.etapa_id === etapa.id))
      return { ok: false, motivo: p.nombres + ' no tiene ' + etapa.nombre + ' entre sus etapas. ' +
        'Se habilita en su ficha de personal.' };
    if (oe.persona_id && oe.persona_id !== persona_id) {
      const otro = db.persona.find((x) => x.id === oe.persona_id) || {};
      return { ok: false, motivo: 'Esa etapa ya la tomó ' + (otro.nombres || 'otra persona') + '.' };
    }
    oe.persona_id = persona_id;
    registrarEvento(ot_id, 'etapa', 'Tomada por ' + nombreDe(p), etapa.id);
    tocado();
    return { ok: true, motivo: '' };
  }

  function soltar_etapa(ot_id, etapa_codigo) {
    const etapa = Reglas.etapaPorCodigo(db, etapa_codigo);
    const oe = etapa && db.ot_etapa.find((x) => x.ot_id === ot_id && x.etapa_id === etapa.id && !x.salio_at);
    if (!oe) return { ok: false, motivo: 'Esa etapa no está abierta en esta orden.' };
    if (!oe.persona_id) return { ok: false, motivo: 'Esa etapa no la tiene nadie tomada.' };
    const ajena = etapaAjena(oe);
    if (ajena) return ajena;
    oe.persona_id = null;
    registrarEvento(ot_id, 'etapa', 'Devuelta a la lista', etapa.id);
    tocado();
    return { ok: true, motivo: '' };
  }

  /* Lo que una persona tiene entre manos, en el orden en que hay que hacerlo:
     primero lo suyo, después lo que puede tomar. La antigüedad manda, porque
     el auto que lleva más días parado es el que más cuesta. */
  function miTrabajo(persona_id) {
    const habilidades = db.persona_etapa.filter((h) => h.persona_id === persona_id).map((h) => h.etapa_id);
    const mias = [], disponibles = [], aCargo = [];

    /* Acá va la torre COMPLETA a propósito: para ofrecerle a alguien una etapa
       que puede tomar hay que mirar órdenes que todavía no son suyas. Lo que
       sale de acá está recortado a mano —el bloque `disponibles` lleva patente,
       vehículo y etapa, y ni el cliente ni la compañía— porque para decidir si
       tomo un trabajo no necesito saber de quién es el auto. */
    torreCompleta().forEach((o) => {
      // Las órdenes de las que soy responsable, tenga o no una etapa abierta.
      // Es lo que le llega a alguien cuando se le traspasa un vehículo en la
      // recepción: todavía no hay nada que hacer con las manos, pero ya es
      // suyo — hay que presupuestarlo y hacerlo avanzar.
      if (o.responsableId === persona_id) {
        aCargo.push({
          ot_id: o.id, numeroOT: o.numeroOT, patente: o.patente, cliente: o.cliente,
          marca: o.marca, modelo: o.modelo, compania: o.compania,
          estado: o.estadoNombre, estadoClase: o.estadoClase, etapa: o.etapaNombre,
          dias: o.diasKpi, sobreMeta: o.sobreMeta, enTaller: o.enTaller,
          conPresupuesto: !!o.presupuestos.length,
          repuestosPendientes: o.repuestos.filter((r) => !r.fechaBodega).length
        });
      }
      (o.etapasAsignadas || []).filter((a) => !a.finalizada).forEach((a) => {
        const etapa = db.etapa.find((e) => e.codigo === a.codigo);
        if (!etapa) return;
        const oe = db.ot_etapa.find((x) => x.ot_id === o.id && x.etapa_id === etapa.id && !x.salio_at);
        const fila = {
          ot_id: o.id, numeroOT: o.numeroOT, patente: o.patente,
          marca: o.marca, modelo: o.modelo,
          etapa: etapa.nombre, etapaCodigo: etapa.codigo, color: etapa.color,
          dias: o.diasKpi, sobreMeta: o.sobreMeta, enTaller: o.enTaller,
          repuestosPendientes: o.repuestos.filter((r) => !r.fechaBodega).length,
          desde: a.asignadaAt || null
        };
        if (oe && oe.persona_id === persona_id) mias.push(fila);
        else if (!oe || !oe.persona_id) {
          if (habilidades.indexOf(etapa.id) >= 0) disponibles.push(fila);
        }
      });
    });

    const porAntiguedad = (a, b) => b.dias - a.dias;
    return {
      aCargo: aCargo.sort(porAntiguedad),
      mias: mias.sort(porAntiguedad),
      disponibles: disponibles.sort(porAntiguedad)
    };
  }

  /* Con alcance `asignado` nadie cierra ni suelta lo que tiene otro a su
     nombre. El permiso `etapa.finalizar` dice que sabe cerrar etapas; no dice
     que pueda cerrar las de cualquiera. Quien reparte —el jefe de taller—
     tiene alcance `todo` y por eso sí puede destrabar lo ajeno. */
  function etapaAjena(oe) {
    if (alcanceActual() !== 'asignado') return null;
    if (!oe || !oe.persona_id || oe.persona_id === persona_actual) return null;
    const otro = db.persona.find((x) => x.id === oe.persona_id) || {};
    return { ok: false, motivo: 'Esa etapa la tiene tomada ' + (nombreDe(otro) || 'otra persona') +
      '. Solo la puede cerrar quien la tomó, o el jefe de taller.' };
  }

  /* Varias etapas se finalizan en un mismo guardado. Verificado: Preparación
     y Pintura se cerraron en el mismo segundo. */
  function finalizar_etapa(ot_id, etapa_codigo, persona_id) {
    const etapa = Reglas.etapaPorCodigo(db, etapa_codigo);
    if (!etapa) return { ok: false, motivo: 'La etapa "' + etapa_codigo + '" no existe.' };
    const ajena = etapaAjena(db.ot_etapa.find((x) => x.ot_id === ot_id && x.etapa_id === etapa.id && !x.salio_at));
    if (ajena) return ajena;
    const permiso = Reglas.puedeFinalizarEtapa(db, { ot_id, etapa_id: etapa.id });
    if (!permiso.ok) return permiso;
    const fila = Reglas.etapaAsignada(db, ot_id, etapa.id);
    fila.salio_at = HOY;
    if (persona_id) fila.persona_id = persona_id;
    registrarEvento(ot_id, 'etapa', 'Completado', etapa.id, persona_id);
    tocado();
    return { ok: true, motivo: '' };
  }

  /* Varias etapas se cierran en un mismo guardado, cada una con SU responsable.
     Verificado en el sistema real: Preparación y Pintura quedaron cerradas en
     el mismo segundo. `asignaciones` = [{ codigo, persona_id }]. */
  function finalizar_etapas(ot_id, asignaciones) {
    const res = (asignaciones || []).map((a) =>
      ({ a, r: finalizar_etapa(ot_id, a.codigo, a.persona_id) }));
    const malas = res.filter((x) => !x.r.ok);
    if (!res.length) return { ok: false, motivo: 'No se marcó ninguna etapa para finalizar.' };
    if (malas.length === res.length) return { ok: false, motivo: malas[0].r.motivo };
    return { ok: true, motivo: '', cerradas: res.length - malas.length, avisos: malas.map((x) => x.r.motivo) };
  }

  /* Se puede quitar una etapa asignada mientras no esté cerrada. El original
     no lo permite porque su pantalla de asignar ni siquiera muestra lo ya
     asignado: las nueve casillas salen siempre en blanco. */
  function quitar_etapa(ot_id, etapa_codigo) {
    const etapa = Reglas.etapaPorCodigo(db, etapa_codigo);
    if (!etapa) return { ok: false, motivo: 'La etapa no existe.' };
    const fila = Reglas.etapaAsignada(db, ot_id, etapa.id);
    if (!fila) return { ok: false, motivo: 'Esa etapa no está asignada a la orden.' };
    if (fila.salio_at)
      return { ok: false, motivo: 'La etapa ' + etapa.nombre + ' ya está finalizada y no se puede quitar. ' +
        'El historial no se edita.' };
    db.ot_etapa = db.ot_etapa.filter((x) => x !== fila);
    registrarEvento(ot_id, 'etapa', 'Desasignada', etapa.id);
    tocado();
    return { ok: true, motivo: '' };
  }

  /* El desplegable de responsable de cada etapa ofrece SOLO a los trabajadores
     que tienen esa etapa marcada en su ficha. Es el único modelo de permisos
     que el sistema actual tiene de verdad, y se conserva tal cual. */
  function personasParaEtapa(etapa_id) {
    const ids = db.persona_etapa.filter((p) => p.etapa_id === etapa_id).map((p) => p.persona_id);
    return db.persona
      .filter((p) => p.activo && ids.indexOf(p.id) >= 0)
      .map((p) => ({ id: p.id, nombre: nombreDe(p), ficha: p.ficha }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  const destinatarios = () => db.persona
    .filter((p) => p.activo && p.tipo !== 'cliente')
    .map((p) => ({ id: p.id, nombre: nombreDe(p) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  /* La fecha probable de entrega se fija en la pantalla de finalizar etapas,
     igual que en el original, y queda como evento de Modificación. */
  function fijar_fecha_compromiso(ot_id, fecha) {
    const o = db.orden_trabajo.find((x) => x.id === ot_id);
    if (!o) return { ok: false, motivo: 'La orden de trabajo no existe.' };
    if (Reglas.esTerminal(db, o.estado))
      return { ok: false, motivo: 'La orden ' + o.numero_ot + ' está cerrada y no admite cambios.' };
    if (!fecha) return { ok: false, motivo: 'Hay que indicar una fecha.' };
    o.fecha_compromiso = fecha;
    registrarEvento(ot_id, 'modificacion', 'Fecha Probable De Entrega ' +
      fecha.toLocaleDateString('es-CL'));
    tocado();
    return { ok: true, motivo: '' };
  }

  /* ── Salida y reingreso: hechos con fecha ─────────────────────────────── */

  function registrar_salida(ot_id, motivo_salida) {
    const permiso = Reglas.puedeRegistrarSalida(db, { ot_id });
    if (!permiso.ok) return permiso;
    Reglas.estadiaAbierta(db, ot_id).salio_at = HOY;
    const o = db.orden_trabajo.find((x) => x.id === ot_id);
    o.estado = 'fuera_taller';
    registrarEvento(ot_id, 'salida', 'Salida del taller. Motivo: ' + (motivo_salida || 'espera de repuesto'));
    tocado();
    return { ok: true, motivo: '' };
  }

  /* 🔴 EL PASO MÁS IMPORTANTE. Se abre una estadía nueva; las anteriores
     quedan intactas. El reloj de reparación acumulada SE REANUDA —suma los
     tramos— y el de la estadía actual vuelve a cero. Los dos existen, y cuál
     manda es el parámetro `kpi_reparacion`. Nada de esto lee el estado, así
     que regrabarlo no mueve ningún contador. */
  function registrar_reingreso(ot_id) {
    const permiso = Reglas.puedeRegistrarReingreso(db, { ot_id });
    if (!permiso.ok) return permiso;
    db.ot_estadia.push({ id: nuevoId('est'), ot_id, entro_at: HOY, salio_at: null, motivo_salida: null });
    const o = db.orden_trabajo.find((x) => x.id === ot_id);
    o.estado = 'recibido';
    registrarEvento(ot_id, 'reingreso', 'Reingreso al taller. El reloj de reparación se reanuda.');
    tocado();
    return { ok: true, motivo: '' };
  }

  function cambiar_estado_ot(ot_id, nuevo_estado, observacion) {
    const permiso = Reglas.puedeCambiarEstado(db, { ot_id, nuevo_estado });
    if (!permiso.ok) return permiso;
    const o = db.orden_trabajo.find((x) => x.id === ot_id);
    const antes = Reglas.nombreEstado(db, o.estado);
    o.estado = nuevo_estado;
    if (Reglas.esFinal(db, nuevo_estado)) {
      // La fecha de salida se llena SIEMPRE al cerrar. En el original ese
      // campo existe y está vacío incluso en órdenes ya entregadas.
      o.fecha_entrega_real = HOY;
      const est = Reglas.estadiaAbierta(db, ot_id);
      if (est) est.salio_at = HOY;
    }
    registrarEvento(ot_id, 'estado', "Cambio de estado: '" + antes + "' a '" +
      Reglas.nombreEstado(db, nuevo_estado) + "'" + (observacion ? '. Obs: ' + observacion : ''));
    tocado();
    return { ok: true, motivo: '' };
  }

  function registrar_entrega(ot_id, { estado, fecha, observacion }) {
    const e = Reglas.estadoPorCodigo(db, estado);
    if (!e) return { ok: false, motivo: 'El estado de entrega no existe en el catálogo.' };
    if (!e.es_final) return { ok: false, motivo: '"' + e.nombre + '" no cierra la orden: la entrega exige un estado final.' };
    if (!fecha) return { ok: false, motivo: 'La fecha de entrega es obligatoria.' };

    /* 🔶 CONTROL DE CALIDAD ANTES DE ENTREGAR (13-08-2026, pedido de Marco).
       La precedencia del catálogo gobierna el cierre de la ETAPA Entrega, pero
       el auto no sale del taller por ahí: sale por esta operación, que es la
       que lo manda al histórico. Sin esto se podía entregar un vehículo con el
       control de calidad todavía abierto, que es justo lo que no puede pasar.

       Pesa solo si la etapa está ASIGNADA a la orden, igual que la regla de
       precedencias: hay órdenes que no pasan por taller —pérdida total, un
       rechazo— y a ésas no se les puede exigir un control que nunca aplicó. */
    const calidad = Reglas.etapaPorCodigo(db, 'calidad');
    const suya = calidad && Reglas.etapaAsignada(db, ot_id, calidad.id);
    if (suya && !suya.salio_at)
      return { ok: false, motivo: 'No se puede entregar: el ' + calidad.nombre +
        ' todavía está abierto. El auto no sale del taller sin pasar por calidad.' };
    const r = cambiar_estado_ot(ot_id, estado, observacion);
    if (!r.ok) return r;
    const o = db.orden_trabajo.find((x) => x.id === ot_id);
    o.fecha_entrega_real = fecha;
    const est = db.ot_estadia.filter((x) => x.ot_id === ot_id).sort((a, b) => b.entro_at - a.entro_at)[0];
    if (est) est.salio_at = fecha;
    tocado();
    return { ok: true, motivo: '' };
  }

  /* ── Bodega ───────────────────────────────────────────────────────────── */

  function cargar_repuesto(ot_id, { descripcion, cantidad, responsable_pago_id }) {
    const permiso = Reglas.puedeCargarRepuesto(db, { ot_id });
    if (!permiso.ok) return permiso;
    if (!descripcion || !String(descripcion).trim())
      return { ok: false, motivo: 'El repuesto necesita descripción: se identifica por el texto del presupuesto, no por código.' };
    if (responsable_pago_id && !db.responsable_pago.some((r) => r.id === responsable_pago_id))
      return { ok: false, motivo: 'El responsable de pago no está en el catálogo. Acá no hay texto libre: es plata del taller.' };
    const id = nuevoId('rep');
    db.repuesto.push({
      id, ot_id, presupuesto_linea_id: null, descripcion: String(descripcion).trim(),
      cantidad: cantidad || 1, responsable_pago_id: responsable_pago_id || 'rp-1',
      fecha_solicitud: HOY, fecha_bodega: null, fecha_entrega_area: null,
      observacion: '',
      // Las tres marcas del repuesto guardan QUIÉN, no sólo cuándo: el
      // expediente las muestra y un hecho sin autor no respalda nada.
      solicitado_por: persona_actual || null, recibido_por: null, entregado_por: null
    });
    tocado();
    return { ok: true, motivo: '', id };
  }

  /* Los dos hitos son FECHAS, no booleanos. Con booleanos no se puede medir
     cuánto demora un repuesto, que es la mitad de la conversación con la
     compañía. */
  function recibir_repuesto(repuesto_id, fecha) {
    const r = db.repuesto.find((x) => x.id === repuesto_id);
    if (!r) return { ok: false, motivo: 'El repuesto no existe.' };
    if (r.fecha_bodega) return { ok: false, motivo: 'Ese repuesto ya figura recibido en bodega.' };
    const permiso = Reglas.puedeCargarRepuesto(db, { ot_id: r.ot_id });
    if (!permiso.ok) return permiso;
    r.fecha_bodega = fecha || HOY;
    // Estaba fijo en bodega. En un registro que sirve para responderle a una
    // compañía, atribuirle a un puesto lo que hizo otra persona es un dato falso.
    r.recibido_por = persona_actual || 'pe-u-bodega';
    tocado();
    return { ok: true, motivo: '' };
  }

  function entregar_repuesto_area(repuesto_id, fecha) {
    const r = db.repuesto.find((x) => x.id === repuesto_id);
    if (!r) return { ok: false, motivo: 'El repuesto no existe.' };
    if (!r.fecha_bodega) return { ok: false, motivo: 'No se puede entregar al área un repuesto que todavía no llegó a bodega.' };
    r.fecha_entrega_area = fecha || HOY;
    r.entregado_por = persona_actual || null;
    tocado();
    return { ok: true, motivo: '' };
  }

  /* ── Presupuesto ──────────────────────────────────────────────────────── */

  function crear_presupuesto(ot_id, { id_reparacion, lineas }) {
    const o = db.orden_trabajo.find((x) => x.id === ot_id);
    if (!o) return { ok: false, motivo: 'La orden de trabajo no existe.' };
    if (Reglas.esTerminal(db, o.estado))
      return { ok: false, motivo: 'La orden ' + o.numero_ot + ' está cerrada y no admite presupuestos nuevos.' };

    const rep = id_reparacion || (18000 + (o.numero_ot % 900));
    const corr = Reglas.siguienteCorrelativoOR(db, ot_id, rep);
    const numero_or = Reglas.formatoOR(o.numero_ot, rep, corr);
    const libre = Reglas.numeroORDisponible(db, numero_or);
    if (!libre.ok) return libre;

    const pid = nuevoId('pr');
    const ivaPct = Number(Reglas.parametro(db, 'iva', 19));
    const neto = (lineas || []).reduce((s, l) => s + (l.cantidad || 1) * (l.precio_unitario || 0), 0);
    const previos = db.presupuesto.filter((p) => p.ot_id === ot_id);

    db.presupuesto.push({
      id: pid, ot_id, id_reparacion: rep, correlativo: corr, numero_or,
      version: previos.length + 1, estado: 'borrador',
      neto, iva: Math.round(neto * ivaPct / 100), total: Math.round(neto * (1 + ivaPct / 100)),
      enviado_at: null, resuelto_at: null
    });
    (lineas || []).forEach((l, i) => db.presupuesto_linea.push(Object.assign({
      id: pid + '-l' + (i + 1), presupuesto_id: pid, orden: i + 1, proceso: 'reparar',
      descripcion: '', horas: null, cantidad: 1, precio_unitario: 0
    }, l)));

    tocado();
    return { ok: true, motivo: '', presupuesto_id: pid, numero_or };
  }

  /* ── Presupuesto · líneas, versiones y envío ──────────────────────────
     El presupuesto es VERSIONADO en vez de editable en el sitio: cuando la
     aseguradora rechaza y pide ajustar, se crea la versión 2 y la 1 queda
     intacta. Eso es lo que hace auditable la discusión con la compañía, y es
     imposible con el PDF actual. */

  function recalcularPresupuesto(pid) {
    const p = db.presupuesto.find((x) => x.id === pid);
    if (!p) return;
    const lineas = db.presupuesto_linea.filter((l) => l.presupuesto_id === pid);
    const ivaPct = Number(Reglas.parametro(db, 'iva', 19));
    p.neto = lineas.reduce((s, l) => s + (l.cantidad || 1) * (l.precio_unitario || 0), 0);
    p.iva = Math.round(p.neto * ivaPct / 100);
    p.total = p.neto + p.iva;
  }

  function agregar_linea_presupuesto(pid, linea) {
    const p = db.presupuesto.find((x) => x.id === pid);
    if (!p) return { ok: false, motivo: 'El presupuesto no existe.' };
    if (p.estado !== 'borrador')
      return { ok: false, motivo: 'El presupuesto ' + p.numero_or + ' está ' + p.estado +
        ' y no se edita. Para cambiarlo hay que crear una versión nueva — así queda auditable ' +
        'la discusión con la compañía.' };
    if (!linea.descripcion || !String(linea.descripcion).trim())
      return { ok: false, motivo: 'La línea necesita descripción.' };
    if (!['cambio', 'reparar', 'externo'].includes(linea.proceso))
      return { ok: false, motivo: 'El proceso tiene que ser Cambio, Reparar o Externo.' };
    /* La venta no puede quedar en blanco. Mientras existió el tempario, una
       línea de mano de obra sin precio se calculaba sola —horas por tarifa— y
       nunca quedaba vacía. Sacado el tempario (13-08-2026) eso ya no pasa, y
       sin esta regla la línea entraba en $0 sin decir nada: un presupuesto que
       sale así a la compañía se descubre cuando ya se mandó.

       Un CERO escrito a propósito sí se acepta —un trabajo de cortesía, una
       línea que se muestra sin cobrar—. Lo que se rechaza es el campo vacío,
       que es olvido, no decisión. */
    if (linea.precio_unitario === null || linea.precio_unitario === undefined || linea.precio_unitario === '')
      return { ok: false, motivo: 'Falta la venta de la línea "' + String(linea.descripcion).trim() +
        '". Si de verdad va sin cobro, hay que escribir un 0.' };
    const n = db.presupuesto_linea.filter((l) => l.presupuesto_id === pid).length;
    db.presupuesto_linea.push(Object.assign({
      id: nuevoId('pl'), presupuesto_id: pid, orden: n + 1,
      horas: null, cantidad: 1, precio_unitario: 0
    }, linea));
    recalcularPresupuesto(pid);
    tocado();
    return { ok: true, motivo: '' };
  }

  function quitar_linea_presupuesto(linea_id) {
    const l = db.presupuesto_linea.find((x) => x.id === linea_id);
    if (!l) return { ok: false, motivo: 'La línea no existe.' };
    const p = db.presupuesto.find((x) => x.id === l.presupuesto_id);
    if (p && p.estado !== 'borrador')
      return { ok: false, motivo: 'El presupuesto ya no está en borrador: no se edita.' };
    db.presupuesto_linea = db.presupuesto_linea.filter((x) => x.id !== linea_id);
    recalcularPresupuesto(l.presupuesto_id);
    tocado();
    return { ok: true, motivo: '' };
  }

  /* Eliminar un presupuesto entero. Solo si sigue en borrador: uno ya enviado
     a la compañía no se borra, se anula o se versiona, porque la discusión con
     la aseguradora tiene que quedar completa. Esto existe para el caso simple
     y frecuente —se apretó "Agregar OR" sin querer— y hoy no había vuelta
     atrás. */
  function eliminar_presupuesto(pid) {
    const p = db.presupuesto.find((x) => x.id === pid);
    if (!p) return { ok: false, motivo: 'El presupuesto no existe.' };
    if (p.estado !== 'borrador')
      return { ok: false, motivo: 'La OR ' + p.numero_or + ' está ' + p.estado +
        '. Un presupuesto que ya salió del taller no se borra: se anula o se versiona.' };
    const conRepuestos = db.repuesto.some((r) => r.presupuesto_id === pid);
    if (conRepuestos)
      return { ok: false, motivo: 'La OR ' + p.numero_or + ' ya tiene repuestos pedidos a bodega. ' +
        'Hay que quitarlos primero.' };
    db.presupuesto_linea = db.presupuesto_linea.filter((l) => l.presupuesto_id !== pid);
    db.presupuesto = db.presupuesto.filter((x) => x.id !== pid);
    registrarEvento(p.ot_id, 'modificacion', 'Presupuesto ' + p.numero_or + ' eliminado');
    tocado();
    return { ok: true, motivo: '' };
  }

  const ESTADOS_PRESU = ['borrador', 'enviado', 'aprobado', 'rechazado', 'anulado'];

  function cambiar_estado_presupuesto(pid, estado) {
    const p = db.presupuesto.find((x) => x.id === pid);
    if (!p) return { ok: false, motivo: 'El presupuesto no existe.' };
    if (!ESTADOS_PRESU.includes(estado)) return { ok: false, motivo: 'Ese estado no existe.' };
    if (p.estado === estado)
      return { ok: false, motivo: 'El presupuesto ' + p.numero_or + ' ya está ' + estado + '.' };
    if (['aprobado', 'rechazado'].includes(p.estado))
      return { ok: false, motivo: 'El presupuesto ' + p.numero_or + ' ya está ' + p.estado +
        '. Para cambiarlo se crea una versión nueva.' };
    if (estado === 'enviado' && !db.presupuesto_linea.some((l) => l.presupuesto_id === pid))
      return { ok: false, motivo: 'No se envía un presupuesto sin líneas.' };
    p.estado = estado;
    if (estado === 'enviado') p.enviado_at = HOY;
    if (['aprobado', 'rechazado'].includes(estado)) p.resuelto_at = HOY;
    registrarEvento(p.ot_id, 'modificacion', 'Presupuesto ' + p.numero_or + ': ' + estado);
    tocado();
    return { ok: true, motivo: '' };
  }

  /* La versión nueva copia las líneas y deja la anterior intacta. */
  function nueva_version_presupuesto(pid) {
    const p = db.presupuesto.find((x) => x.id === pid);
    if (!p) return { ok: false, motivo: 'El presupuesto no existe.' };
    const o = db.orden_trabajo.find((x) => x.id === p.ot_id);
    if (Reglas.esTerminal(db, o.estado))
      return { ok: false, motivo: 'La orden ' + o.numero_ot + ' está cerrada.' };
    const corr = Reglas.siguienteCorrelativoOR(db, p.ot_id, p.id_reparacion);
    const numero_or = Reglas.formatoOR(o.numero_ot, p.id_reparacion, corr);
    const nid = nuevoId('pr');
    const previos = db.presupuesto.filter((x) => x.ot_id === p.ot_id);
    db.presupuesto.push({
      id: nid, ot_id: p.ot_id, id_reparacion: p.id_reparacion, correlativo: corr, numero_or,
      version: previos.length + 1, estado: 'borrador', neto: 0, iva: 0, total: 0,
      enviado_at: null, resuelto_at: null
    });
    db.presupuesto_linea.filter((l) => l.presupuesto_id === pid).forEach((l, i) =>
      db.presupuesto_linea.push(Object.assign({}, l, { id: nid + '-l' + (i + 1), presupuesto_id: nid })));
    recalcularPresupuesto(nid);
    tocado();
    return { ok: true, motivo: '', presupuesto_id: nid, numero_or };
  }

  /* Las líneas de proceso `cambio` son las que se piden a bodega: la
     descripción se copia TAL CUAL, sin código de repuesto. Fue decisión
     deliberada del taller, y tiene sentido. */
  function generar_repuestos_desde_presupuesto(pid) {
    const p = db.presupuesto.find((x) => x.id === pid);
    if (!p) return { ok: false, motivo: 'El presupuesto no existe.' };
    const permiso = Reglas.puedeCargarRepuesto(db, { ot_id: p.ot_id });
    if (!permiso.ok) return permiso;
    const lineas = db.presupuesto_linea.filter((l) => l.presupuesto_id === pid && l.proceso === 'cambio');
    if (!lineas.length)
      return { ok: false, motivo: 'Este presupuesto no tiene líneas de proceso Cambio: no hay repuestos que pedir.' };
    let n = 0;
    lineas.forEach((l) => {
      if (db.repuesto.some((r) => r.presupuesto_linea_id === l.id)) return;   // idempotente
      db.repuesto.push({
        id: nuevoId('rep'), ot_id: p.ot_id, presupuesto_linea_id: l.id,
        descripcion: l.descripcion, cantidad: l.cantidad,
        responsable_pago_id: 'rp-1', fecha_solicitud: HOY, fecha_bodega: null,
        fecha_entrega_area: null, observacion: '', recibido_por: null
      });
      n++;
    });
    if (!n) return { ok: false, motivo: 'Los repuestos de este presupuesto ya estaban pedidos.' };
    tocado();
    return { ok: true, motivo: '', creados: n };
  }

  function fijar_responsable_pago(repuesto_id, responsable_pago_id) {
    const r = db.repuesto.find((x) => x.id === repuesto_id);
    if (!r) return { ok: false, motivo: 'El repuesto no existe.' };
    if (!db.responsable_pago.some((x) => x.id === responsable_pago_id))
      return { ok: false, motivo: 'Ese responsable no está en el catálogo. Acá no hay texto libre: es plata del taller.' };
    r.responsable_pago_id = responsable_pago_id;
    tocado();
    return { ok: true, motivo: '' };
  }

  /* ── Costos adicionales de reparación ─────────────────────────────────
     La pantalla existe en el original (`bodegacostos`, 98 filas) y lista las
     órdenes; lo que se carga en ella no se pudo ver sin escribir. Acá se
     modela como lo que el rótulo dice: costos que aparecen después del
     presupuesto y que alguien tiene que pagar. */

  function agregar_costo_adicional(ot_id, { descripcion, monto, responsable_pago_id }) {
    const o = db.orden_trabajo.find((x) => x.id === ot_id);
    if (!o) return { ok: false, motivo: 'La orden no existe.' };
    if (!Reglas.estaAbierta(db, o.estado))
      return { ok: false, motivo: 'La orden ' + o.numero_ot + ' ya está cerrada: no admite costos nuevos.' };
    if (!descripcion || !String(descripcion).trim())
      return { ok: false, motivo: 'El costo necesita una descripción.' };
    if (!(Number(monto) > 0)) return { ok: false, motivo: 'El monto tiene que ser mayor que cero.' };
    db.costo_adicional.push({
      id: nuevoId('ca'), ot_id, descripcion: String(descripcion).trim(),
      monto: Number(monto), responsable_pago_id: responsable_pago_id || 'rp-2', fecha: HOY
    });
    tocado();
    return { ok: true, motivo: '' };
  }

  const costosDe = (ot_id) => db.costo_adicional.filter((c) => c.ot_id === ot_id).map((c) => Object.assign({}, c, {
    responsable: (db.responsable_pago.find((r) => r.id === c.responsable_pago_id) || {}).nombre,
    pagaTaller: !!(db.responsable_pago.find((r) => r.id === c.responsable_pago_id) || {}).es_taller
  }));

  /* ── Nómina y carga de trabajo: no se construyen ─────────────────────
     En el original, la pantalla "Ver nómina de pagos" MUESTRA LA TORRE DE
     CONTROL: mismo encabezado, mismas 102 órdenes, mismas 17 columnas. Ni un
     dato de pagos. Nunca se construyó.

     Tampoco se construye acá. La nómina en plata se descartó porque el valor
     hora no se ocupa, y la vista de carga de trabajo que la reemplazaba se
     sacó el 13-08-2026: no existe en el sistema actual, y esto es una
     réplica. Lo que no está, no se regala. */

  /* ── Personal ─────────────────────────────────────────────────────────
     "No se elimina gente, se desactiva, porque si vuelve hay que recargar
      todo y se pierde el registro." RUT y número de ficha son inmutables. */

  function personal() {
    return db.persona.filter((p) => p.tipo === 'trabajador').map((p) => {
      const etapas = db.persona_etapa.filter((e) => e.persona_id === p.id)
        .map((e) => (db.etapa.find((x) => x.id === e.etapa_id) || {}))
        .filter((e) => e.id).sort((a, b) => a.orden - b.orden);
      return {
        id: p.id, ficha: p.ficha, rut: p.rut, nombres: p.nombres, apellidos: p.apellidos,
        cargo: p.cargo || null, correo: p.correo, telefono: p.telefono,
        direccion: p.direccion, comuna: p.comuna,
        // El usuario sí sale; la clave NUNCA. Ni siquiera para dibujarla en la
        // ficha de uno mismo: no hace falta y es la manera de que no se filtre
        // por descuido a una pantalla que después alguien exporta.
        usuario: p.usuario || null, claveInicial: !!p.clave_inicial,
        activo: p.activo, etapas
      };
    }).sort((a, b) => (a.ficha || 0) - (b.ficha || 0));
  }

  function guardar_persona(datos) {
    if (!datos.nombres || !String(datos.nombres).trim())
      return { ok: false, motivo: 'El nombre es obligatorio.' };
    if (datos.id) {
      const p = db.persona.find((x) => x.id === datos.id);
      if (!p) return { ok: false, motivo: 'La persona no existe.' };
      // RUT y ficha son inmutables: así se pidió, y es correcto.
      ['nombres', 'apellidos', 'correo', 'telefono', 'direccion', 'comuna'].forEach((k) => {
        if (datos[k] !== undefined) p[k] = datos[k];
      });
      tocado();
      return { ok: true, motivo: '', id: p.id };
    }
    if (!datos.rut || !String(datos.rut).trim())
      return { ok: false, motivo: 'El RUT es obligatorio, y después no se puede cambiar.' };
    if (db.persona.some((x) => x.rut === datos.rut))
      return { ok: false, motivo: 'Ya hay una persona con el RUT ' + datos.rut + '.' };
    const id = nuevoId('pe-t');
    db.persona.push(Object.assign({
      id, tipo: 'trabajador', activo: true, demo: true,
      ficha: db.persona.reduce((m, p) => Math.max(m, p.ficha || 0), 1000) + 1
    }, datos));
    tocado();
    return { ok: true, motivo: '', id };
  }

  function dar_de_baja_persona(persona_id) {
    const p = db.persona.find((x) => x.id === persona_id);
    if (!p) return { ok: false, motivo: 'La persona no existe.' };
    if (!p.activo) return { ok: false, motivo: p.nombres + ' ya está desactivado.' };
    const abiertas = db.ot_etapa.filter((x) => x.persona_id === persona_id && !x.salio_at).length;
    if (abiertas)
      return { ok: false, motivo: p.nombres + ' tiene ' + abiertas + ' etapa' + (abiertas > 1 ? 's' : '') +
        ' abierta' + (abiertas > 1 ? 's' : '') + '. Hay que reasignarlas antes de desactivarlo.' };

    /* La segunda puerta que se cierra por dentro. La primera era quitarle un
       permiso al administrador; ésta es desactivar la única cuenta que lo
       tiene. El resultado es el mismo: el taller queda sin nadie que entre a
       Configuración, y la única salida es reiniciar la base. */
    const suRol = (db.persona_rol.find((x) => x.persona_id === persona_id) || {}).rol_id;
    if (esRolTotal(suRol)) {
      const otros = db.persona.filter((x) => x.id !== persona_id && x.activo && x.tipo === 'trabajador' &&
        esRolTotal((db.persona_rol.find((y) => y.persona_id === x.id) || {}).rol_id)).length;
      if (!otros)
        return { ok: false, motivo: nombreDe(p) + ' es la última cuenta con acceso total al sistema. ' +
          'Desactivarla dejaría el taller sin nadie que pueda entrar a Configuración. ' +
          'Primero hay que crear otra cuenta de administración.' };
    }

    p.activo = false;
    tocado();
    return { ok: true, motivo: '' };
  }

  function reactivar_persona(persona_id) {
    const p = db.persona.find((x) => x.id === persona_id);
    if (!p) return { ok: false, motivo: 'La persona no existe.' };
    p.activo = true;
    tocado();
    return { ok: true, motivo: '' };
  }

  function fijar_habilidad(persona_id, etapa_id, activa) {
    const existe = db.persona_etapa.some((x) => x.persona_id === persona_id && x.etapa_id === etapa_id);
    if (activa && !existe) db.persona_etapa.push({ persona_id, etapa_id });
    if (!activa && existe) {
      const abiertas = db.ot_etapa.filter((x) => x.persona_id === persona_id &&
        x.etapa_id === etapa_id && !x.salio_at).length;
      if (abiertas)
        return { ok: false, motivo: 'Tiene ' + abiertas + ' orden' + (abiertas > 1 ? 'es' : '') +
          ' abierta' + (abiertas > 1 ? 's' : '') + ' en esa etapa.' };
      db.persona_etapa = db.persona_etapa.filter((x) =>
        !(x.persona_id === persona_id && x.etapa_id === etapa_id));
    }
    tocado();
    return { ok: true, motivo: '' };
  }

  /* ── Fotos, firmas y documentos ───────────────────────────────────────
     Acá va SOLO la ficha: id, orden, etapa, momento, tamaño y medidas. Los
     bytes viven en IndexedDB (ver media.js). En producción es la misma
     separación entre la fila en Postgres y el objeto en el bucket. */

  function adjuntar_media(recepcion_id, ot_ids, fichas) {
    if (!fichas || !fichas.length) return { ok: true, motivo: '', adjuntadas: 0 };
    // Una recepción puede haber generado varias órdenes: las fotos de ingreso
    // y la firma son del vehículo, así que quedan colgando de la recepción y
    // se ven desde todas sus órdenes.
    //
    // `subido_por` y `subido_at` son del 15-08-2026: el cliente pidió que los
    // documentos y las fotos sean parte del expediente y no un adjunto suelto.
    // Una foto sin autor ni fecha no sirve para responderle a una compañía.
    fichas.forEach((f) => db.media.push(Object.assign({}, f, {
      recepcion_id: recepcion_id || f.recepcion_id || null,
      ot_id: f.ot_id || ((ot_ids && ot_ids.length === 1) ? ot_ids[0] : null),
      subido_por: f.subido_por || persona_actual || null,
      subido_at: f.subido_at || HOY
    })));

    // Registra en todas las órdenes alcanzadas, no en una: por eso lo hace por
    // su cuenta y no lo deja en manos del decorador, que resuelve una sola.
    const alcanzadas = {};
    fichas.forEach((f) => { if (f.ot_id) alcanzadas[f.ot_id] = true; });
    (ot_ids || []).forEach((id) => { alcanzadas[id] = true; });
    const cuantas = fichas.length;
    const docs = fichas.filter((f) => f.momento === 'documento').length;
    const que = docs === cuantas ? (cuantas === 1 ? 'documento' : 'documentos')
              : docs === 0 ? (cuantas === 1 ? 'foto' : 'fotos')
              : 'archivos';
    Object.keys(alcanzadas).forEach((ot_id) =>
      registrarEvento(ot_id, 'documento', 'Se adjuntaron ' + cuantas + ' ' + que));

    tocado();
    return { ok: true, motivo: '', adjuntadas: fichas.length };
  }

  function eliminar_media(media_id) {
    const f = db.media.find((x) => x.id === media_id);
    if (!f) return { ok: false, motivo: 'La imagen no existe.' };
    db.media = db.media.filter((x) => x.id !== media_id);
    tocado();
    return { ok: true, motivo: '' };
  }

  /* Todo lo adjunto a una orden: lo suyo propio más lo de su recepción.
     Filtrado por dos cosas, en este orden:

       1 · el ALCANCE — si la orden no es de quien mira, no hay nada que ver;
       2 · el PERMISO — las fotos del vehículo piden `foto.ver` y los
           documentos piden `documento.ver`, que son cosas distintas: bodega
           necesita la guía de despacho y no las fotos del daño; el pintor no
           necesita ninguna de las dos. */
  function mediaDe(ot_id, momento) {
    const o = db.orden_trabajo.find((x) => x.id === ot_id);
    if (!o || !enAlcance(vistaOT(o))) return [];
    const verFotos = puede('foto.ver');
    const verDocs = puede('documento.ver');
    return db.media.filter((m) =>
      (m.ot_id === ot_id || (m.recepcion_id && m.recepcion_id === o.recepcion_id)) &&
      (!momento || m.momento === momento) &&
      (m.momento === 'documento' ? verDocs : verFotos));
  }

  /* ── Bitácora y alertas ───────────────────────────────────────────────── */

  function escribir_bitacora(ot_id, { asunto_id, mensaje, destinatario_id }) {
    const permiso = Reglas.puedeEscribirBitacora(db, { ot_id, asunto_id, mensaje });
    if (!permiso.ok) return permiso;
    db.bitacora.push({
      id: nuevoId('bit'), ot_id, asunto_id, mensaje: String(mensaje).trim(),
      destinatario_id: destinatario_id || 'pe-u-admin', autor_id: 'pe-u-admin',
      fecha: HOY, alerta_apagada: false
    });
    tocado();
    return { ok: true, motivo: '' };
  }

  /* ⚠️ Cómo se apagan las alertas en el original no se pudo observar ("se
     van muriendo"). Acá se apagan a mano y queda registrado quién lo hizo.
     Es la pregunta 6, todavía sin confirmar. */
  function apagar_alerta(bitacora_id) {
    const b = db.bitacora.find((x) => x.id === bitacora_id);
    if (!b) return { ok: false, motivo: 'El mensaje no existe.' };
    if (b.alerta_apagada) return { ok: false, motivo: 'Esa alerta ya está apagada.' };
    b.alerta_apagada = true;
    tocado();
    return { ok: true, motivo: '' };
  }

  /* ── Detenciones (modeladas, sin pantalla propia) ─────────────────────── */

  function abrir_detencion(ot_id, motivo_codigo, detalle) {
    const m = db.motivo_detencion.find((x) => x.codigo === motivo_codigo);
    if (!m) return { ok: false, motivo: 'El motivo "' + motivo_codigo + '" no existe.' };
    const permiso = Reglas.puedeAbrirDetencion(db, { ot_id, motivo_id: m.id });
    if (!permiso.ok) return permiso;
    db.ot_detencion.push({ id: nuevoId('od'), ot_id, motivo_id: m.id, inicio: HOY, fin: null, detalle: detalle || '' });
    tocado();
    return { ok: true, motivo: '' };
  }

  function cerrar_detencion(ot_id) {
    const permiso = Reglas.puedeCerrarDetencion(db, { ot_id });
    if (!permiso.ok) return permiso;
    Reglas.detencionAbierta(db, ot_id).fin = HOY;
    tocado();
    return { ok: true, motivo: '' };
  }

  const detencionDe = (ot_id) => {
    const d = Reglas.detencionAbierta(db, ot_id);
    if (!d) return null;
    const m = db.motivo_detencion.find((x) => x.id === d.motivo_id) || {};
    return { motivo: m.nombre, codigo: m.codigo, imputable: m.imputable_a, inicio: d.inicio, detalle: d.detalle };
  };

  /* ═══════════════════════════════════════════════════════════════════════
     CATÁLOGOS · el alta, la edición y la baja
     Esto es "escalable" hecho carne: agregar una etapa o una compañía sin
     llamar a un programador. En el sistema actual las etapas son casillas de
     `name` fijo en el HTML y tres de las siete tarjetas de Configuración
     apuntan a sí mismas.
     ═══════════════════════════════════════════════════════════════════════ */

  const CATALOGOS = [
    { tabla: 'etapa',            nombre: 'Etapas del taller',      llave: true,  campos: ['nombre', 'codigo', 'orden', 'color'] },
    { tabla: 'estado',           nombre: 'Estados de la orden',    llave: true,  campos: ['nombre', 'codigo', 'orden'] },
    { tabla: 'compania',         nombre: 'Compañías',              llave: true,  campos: ['nombre', 'codigo'] },
    { tabla: 'tipo_ingreso',     nombre: 'Tipos de ingreso',       llave: true,  campos: ['nombre', 'codigo'] },
    { tabla: 'prioridad',        nombre: 'Prioridades',            llave: true,  campos: ['nombre', 'codigo', 'color'] },
    { tabla: 'color_vehiculo',   nombre: 'Colores de vehículo',    llave: true,  campos: ['nombre', 'codigo', 'orden'] },
    { tabla: 'asunto_bitacora',  nombre: 'Asuntos de bitácora',    llave: true,  campos: ['nombre', 'codigo', 'orden'] },
    { tabla: 'responsable_pago', nombre: 'Responsable de pago',    llave: true,  campos: ['nombre', 'codigo'] },
    { tabla: 'motivo_detencion', nombre: 'Motivos de detención',   llave: true,  campos: ['nombre', 'codigo'] }
  ];

  const catalogo = (tabla) => (db[tabla] || []).slice()
    .sort((a, b) => (a.orden || 0) - (b.orden || 0) || String(a.nombre).localeCompare(String(b.nombre), 'es'));

  function guardar_catalogo(tabla, fila) {
    const esNuevo = !fila.id;
    const permiso = Reglas.puedeGuardarCatalogo(db, tabla, fila, { esNuevo });
    if (!permiso.ok) return permiso;
    if (esNuevo) {
      const nueva = Object.assign({
        id: nuevoId(tabla.slice(0, 3)), vigente: true,
        orden: (db[tabla] || []).reduce((m, f) => Math.max(m, f.orden || 0), 0) + 1
      }, fila);
      // Valores por omisión propios de cada catálogo.
      if (tabla === 'etapa') Object.assign(nueva, {
        aplica_siempre: fila.aplica_siempre !== false,
        exige_precedencia: !!fila.exige_precedencia,
        requiere_repuestos_completos: !!fila.requiere_repuestos_completos,
        color: fila.color || '#64748b'
      });
      if (tabla === 'estado') Object.assign(nueva, {
        es_final: !!fila.es_final, cierra_orden: !!fila.cierra_orden,
        clase: fila.clase || 'gris', alcanzable_en: fila.alcanzable_en || []
      });
      if (tabla === 'asunto_bitacora') nueva.genera_alerta = fila.genera_alerta !== false;
      db[tabla].push(nueva);
      tocado();
      return { ok: true, motivo: '', id: nueva.id };
    }
    const actual = db[tabla].find((f) => f.id === fila.id);
    if (!actual) return { ok: false, motivo: 'El registro no existe.' };
    Object.assign(actual, fila);
    tocado();
    return { ok: true, motivo: '', id: actual.id };
  }

  function eliminar_catalogo(tabla, id) {
    const permiso = Reglas.puedeEliminarCatalogo(db, tabla, id);
    if (!permiso.ok) return permiso;
    db[tabla] = db[tabla].filter((f) => f.id !== id);
    if (tabla === 'etapa')
      db.etapa_prerrequisito = db.etapa_prerrequisito.filter(
        (p) => p.etapa_id !== id && p.requiere_etapa_id !== id);
    tocado();
    return { ok: true, motivo: '' };
  }

  /* "No se elimina gente, se desactiva" — fue explícito en la reunión, y vale
     igual para los catálogos: si se borra, el histórico deja de leerse. */
  function dar_de_baja_catalogo(tabla, id) {
    const permiso = Reglas.puedeDarDeBajaCatalogo(db, tabla, id);
    if (!permiso.ok) return permiso;
    db[tabla].find((f) => f.id === id).vigente = false;
    tocado();
    return { ok: true, motivo: '' };
  }

  function reactivar_catalogo(tabla, id) {
    const f = (db[tabla] || []).find((x) => x.id === id);
    if (!f) return { ok: false, motivo: 'El registro no existe.' };
    f.vigente = true;
    tocado();
    return { ok: true, motivo: '' };
  }

  function agregar_prerrequisito(etapa_id, requiere_etapa_id) {
    const permiso = Reglas.puedeAgregarPrerrequisito(db, { etapa_id, requiere_etapa_id });
    if (!permiso.ok) return permiso;
    db.etapa_prerrequisito.push({ etapa_id, requiere_etapa_id });
    tocado();
    return { ok: true, motivo: '' };
  }

  function quitar_prerrequisito(etapa_id, requiere_etapa_id) {
    const antes = db.etapa_prerrequisito.length;
    db.etapa_prerrequisito = db.etapa_prerrequisito.filter(
      (p) => !(p.etapa_id === etapa_id && p.requiere_etapa_id === requiere_etapa_id));
    if (db.etapa_prerrequisito.length === antes) return { ok: false, motivo: 'Ese prerrequisito no existe.' };
    tocado();
    return { ok: true, motivo: '' };
  }

  function guardar_parametro(clave, valor) {
    const p = db.parametro.find((x) => x.clave === clave);
    if (!p) return { ok: false, motivo: 'El parámetro "' + clave + '" no existe.' };
    if (p.tipo === 'numero' && (isNaN(Number(valor)) || Number(valor) < 0))
      return { ok: false, motivo: '"' + p.nombre + '" tiene que ser un número positivo.' };
    if (p.tipo === 'opcion' && !p.opciones.some((o) => o.valor === valor))
      return { ok: false, motivo: 'Ese valor no está entre las opciones de "' + p.nombre + '".' };
    p.valor = p.tipo === 'numero' ? Number(valor) : valor;
    tocado();
    return { ok: true, motivo: '' };
  }

  /* ── Los roles de acceso total ──────────────────────────────────────────
     Administración y Dueño tienen TODO el sistema, siempre, y su fila de la
     matriz no se toca. No es una decisión de configuración: es la condición
     para que el sistema siga siendo administrable.

     Sin esto había una puerta que se cierra por dentro. La matriz de permisos
     es editable —esa es la gracia—, y `configuracion` es una casilla más:
     alguien la desmarca en la fila de Administración, con buena o mala
     intención, y ya no queda nadie que pueda volver a marcarla. La única
     salida sería reiniciar la base y perder todo. */
  const esRolTotal = (rol_id) => !!(db.rol.find((r) => r.id === rol_id) || {}).total;

  function fijar_rol_permiso(rol_id, permiso_codigo, activo) {
    if (esRolTotal(rol_id)) {
      const r = db.rol.find((x) => x.id === rol_id) || {};
      return { ok: false, motivo: 'El rol ' + (r.nombre || '—') + ' tiene acceso a todo el sistema y ' +
        'no se le puede quitar. Si se pudiera, bastaría con desmarcarle «Administrar los catálogos» ' +
        'para que nadie pudiera volver a entrar a Configuración.' };
    }
    const existe = db.rol_permiso.some((r) => r.rol_id === rol_id && r.permiso_codigo === permiso_codigo);
    if (activo && !existe) db.rol_permiso.push({ rol_id, permiso_codigo });
    if (!activo && existe) db.rol_permiso = db.rol_permiso.filter(
      (r) => !(r.rol_id === rol_id && r.permiso_codigo === permiso_codigo));
    tocado();
    return { ok: true, motivo: '' };
  }

  /* Un rol total devuelve el catálogo completo, se haya sembrado como se haya
     sembrado. Así la garantía no depende de que las filas de `rol_permiso`
     estén bien: depende de la marca. */
  const permisosDe = (rol_id) => (esRolTotal(rol_id)
    ? db.permiso.map((p) => p.codigo)
    : db.rol_permiso.filter((r) => r.rol_id === rol_id).map((r) => r.permiso_codigo));
  const parametros = () => db.parametro.slice();

  /* ── El rol con el que se está mirando ────────────────────────────────
     Sirve para DEMOSTRAR el enmascaramiento: se cambia de rol y se ve qué
     desaparece. Es el paso 26 del guion de prueba.

     🔴 Y hay que decirlo con todas sus letras: esto está MODELADO, no
     garantizado. En el navegador el dato igual llegó; ocultarlo es una
     cortesía visual. La garantía es RLS en PostgreSQL, donde la fila ni
     siquiera sale de la base. No decimos "cumple" donde corresponde decir
     "está modelado, falta la base". */

  let rol_actual = 'ro-6';   // dueño: ve todo

  /* Quién está sentado frente a la pantalla. Antes solo había un rol suelto,
     y con eso no se puede responder "¿qué me toca a mí?": el rol dice qué
     puede hacer una persona, no cuál es. Ahora la sesión es una persona, y su
     rol sale de ella. `null` es el dueño mirando el sistema completo. */
  let persona_actual = null;

  const rolActual = () => db.rol.find((r) => r.id === rol_actual) || {};

  /* El rol total pasa siempre, sin consultar la matriz. Es la misma garantía
     que en `permisosDe`, puesta en el único lugar por donde pasan las 37
     operaciones y las 14 pantallas: aunque a la base le faltaran las filas de
     `rol_permiso`, el administrador entra igual. */
  const puede = (codigo) => rolActual().total === true ||
    permisosDe(rol_actual).indexOf(codigo) >= 0;

  const personaActual = () => (persona_actual ? db.persona.find((p) => p.id === persona_actual) : null) || null;

  function fijar_rol_actual(rol_id) {
    if (!db.rol.some((r) => r.id === rol_id)) return { ok: false, motivo: 'Ese rol no existe.' };
    rol_actual = rol_id;
    persona_actual = null;
    version++; limpiarMemo();
    return { ok: true, motivo: '' };
  }

  /* ── ALCANCE · sobre qué órdenes ───────────────────────────────────────
     El permiso dice qué PANTALLA se abre. El alcance dice qué FILAS trae esa
     pantalla. Hasta el 13-08-2026 solo existía lo primero, y por eso el
     pintor —que no podía entrar a Configuración— igual veía los 102 vehículos
     del taller, con el nombre y el RUT de cada cliente, y podía abrir la
     ficha completa de cualquiera de ellos.

     Tres alcances, declarados en el rol y editables en Configuración:

       todo      · todas las órdenes                    recepción, jefe, bodega, admin
       asignado  · las que tiene tomadas o a su cargo   operario
       compania  · las de su compañía de seguros        aseguradora (modelado, sin cuenta)

     "Asignado" son dos cosas: las órdenes donde la persona figura como
     responsable —se las traspasaron en la recepción— y aquellas donde tiene
     una etapa ABIERTA a su nombre.

     Que la etapa cerrada no cuente es deliberado y se midió: contándolas, el
     pintor pasaba de ver 102 vehículos a ver 29, que sigue siendo medio taller.
     Con la etapa abierta como único criterio ve los cinco que efectivamente
     tiene entre manos. La regla queda en una frase: **ves el auto mientras la
     etapa esté abierta a tu nombre**. Si el vehículo vuelve rechazado, el jefe
     de taller le abre la etapa de nuevo y reaparece.

     ⚠️ Sigue valiendo lo de siempre: esto corre en el navegador y por lo tanto
        es una barrera del programa. La fila igual viajó. La garantía es RLS en
        PostgreSQL, donde la fila no sale de la base. Acá se demuestra el
        comportamiento; allá se cumple. */
  // El rol total ve todas las órdenes, aunque a su fila le hayan escrito otro
  // alcance: acceso a todo el sistema incluye todas las filas.
  const alcanceActual = () => (rolActual().total === true ? 'todo' : (rolActual().alcance || 'todo'));

  function misOrdenes() {
    if (memo.mias && memo.miasV === version) return memo.mias;
    const s = {};
    if (persona_actual) {
      db.orden_trabajo.forEach((o) => { if (o.responsable_id === persona_actual) s[o.id] = true; });
      db.ot_etapa.forEach((x) => { if (x.persona_id === persona_actual && !x.salio_at) s[x.ot_id] = true; });
    }
    memo.mias = s; memo.miasV = version;
    return s;
  }

  function enAlcance(o) {
    const a = alcanceActual();
    if (a === 'todo') return true;
    if (!o) return false;
    if (a === 'asignado') return persona_actual ? !!misOrdenes()[o.id] : false;
    if (a === 'compania') {
      const p = personaActual();
      return !!(p && p.compania_id && o.companiaId === p.compania_id);
    }
    return false;
  }

  /* ── El ingreso ────────────────────────────────────────────────────────
     Cada persona entra con su usuario y su clave. El usuario es el correo o
     el número de ficha: los dos sirven, porque en el taller a la gente se la
     identifica por ficha y en la oficina por correo.

     ⚠️ Esto es un ingreso MODELADO. La clave vive en el mismo navegador que
        la revisa, así que cualquiera que abra las herramientas del
        desarrollador la lee. No es autenticación: es la puerta dibujada para
        poder demostrar que cada persona ve lo suyo. La de verdad vive en el
        servidor, con la clave cifrada y sin viajar nunca hasta acá.

     Lo que SÍ es real y se conserva al migrar: que el ingreso sea por persona
     y no por un usuario compartido, que la sesión traiga el rol, que se pueda
     cerrar, y que una cuenta desactivada no entre. */
  const CLAVE_SESION = 'dyp-sesion';

  function iniciar_sesion(usuario, clave) {
    const u = String(usuario || '').trim().toLowerCase();
    if (!u) return { ok: false, motivo: 'Falta el usuario.' };
    if (!clave) return { ok: false, motivo: 'Falta la clave.' };

    const p = db.persona.find((x) => x.usuario &&
      (String(x.usuario).toLowerCase() === u || String(x.ficha) === u));

    // El mismo mensaje para usuario inexistente y clave equivocada: decir
    // "ese usuario no existe" le regala a cualquiera la lista de quién trabaja
    // acá. Es la única parte de esto que ya está bien hecha.
    if (!p || p.clave !== clave)
      return { ok: false, motivo: 'Usuario o clave incorrectos.' };
    if (!p.activo)
      return { ok: false, motivo: 'La cuenta de ' + p.nombres + ' está desactivada. ' +
        'Hay que reactivarla desde Personal.' };

    const r = fijar_persona_actual(p.id);
    if (!r.ok) return r;
    try { localStorage.setItem(CLAVE_SESION, p.id); } catch (e) { /* sin almacenamiento */ }
    return { ok: true, motivo: '', persona: p.id, claveInicial: !!p.clave_inicial };
  }

  function cerrar_sesion() {
    persona_actual = null;
    rol_actual = 'ro-6';
    version++; limpiarMemo();
    try { localStorage.removeItem(CLAVE_SESION); } catch (e) { /* nada */ }
    return { ok: true, motivo: '' };
  }

  /* Al abrir el sistema se retoma la sesión de antes. Un F5 no puede echar a
     nadie: la recepcionista tiene el formulario a medio llenar. */
  function retomar_sesion() {
    let id = null;
    try { id = localStorage.getItem(CLAVE_SESION); } catch (e) { return false; }
    if (!id) return false;
    const p = db.persona.find((x) => x.id === id);
    if (!p || !p.activo) { cerrar_sesion(); return false; }
    return fijar_persona_actual(id).ok;
  }

  const haySesion = () => !!persona_actual;

  /* Quién está en la sesión GUARDADA, que puede no ser quien tiene esta
     pestaña en memoria. La sesión es una sola para todo el navegador —así
     funciona un sistema web—, pero cada pestaña se queda con la que tenía al
     abrirse. Si en una se cierra sesión y entra otra persona, las demás siguen
     mostrando y dejando operar como la anterior hasta que alguien las recarga.

     En un modelo borrador eso se ve como "la información no viaja": se mira la
     misma orden desde dos pestañas con dos cuentas distintas y una no la ve,
     porque cada rol alcanza órdenes distintas. Con esto la aplicación puede
     comparar y realinearse. */
  const sesionGuardada = () => {
    try { return localStorage.getItem(CLAVE_SESION); } catch (e) { return null; }
  };
  const sesionAlDia = () => sesionGuardada() === persona_actual;

  /* Cambiar la clave. Se pide la actual: si alguien deja la sesión abierta,
     que no le puedan cambiar la clave y dejarlo afuera de su propia cuenta. */
  function cambiar_clave(persona_id, actual, nueva) {
    const p = db.persona.find((x) => x.id === persona_id);
    if (!p) return { ok: false, motivo: 'Esa persona no existe.' };
    if (p.clave !== actual) return { ok: false, motivo: 'La clave actual no coincide.' };
    const n = String(nueva || '');
    if (n.length < 6) return { ok: false, motivo: 'La clave nueva tiene que tener al menos 6 caracteres.' };
    if (n === actual) return { ok: false, motivo: 'La clave nueva es igual a la anterior.' };
    p.clave = n;
    p.clave_inicial = false;
    tocado();
    return { ok: true, motivo: '' };
  }

  /* Entrar como una persona: toma su rol y con eso sus permisos. Es lo que
     hace demostrable el flujo completo — el pintor entra, ve lo suyo, cierra
     su etapa, y el dueño lo ve aparecer en la torre sin que nadie le avise. */
  function fijar_persona_actual(persona_id) {
    if (!persona_id) { persona_actual = null; return fijar_rol_actual('ro-6'); }
    const p = db.persona.find((x) => x.id === persona_id);
    if (!p) return { ok: false, motivo: 'Esa persona no existe.' };
    if (!p.activo) return { ok: false, motivo: p.nombres + ' está desactivado: no puede entrar al sistema.' };
    const pr = db.persona_rol.find((x) => x.persona_id === persona_id);
    rol_actual = pr ? pr.rol_id : 'ro-3';
    persona_actual = persona_id;
    version++; limpiarMemo();
    return { ok: true, motivo: '' };
  }

  /* Con quién se puede entrar: el equipo activo más el dueño, que no es un
     trabajador del taller sino quien mira todo. */
  function sesionesPosibles() {
    return db.persona.filter((p) => p.tipo === 'trabajador' && p.activo).map((p) => {
      const pr = db.persona_rol.find((x) => x.persona_id === p.id);
      const rol = db.rol.find((r) => r.id === (pr || {}).rol_id) || {};
      return {
        id: p.id, nombre: nombreDe(p), cargo: p.cargo || rol.nombre,
        rol: rol.nombre, rol_id: rol.id,
        usuario: p.usuario || null, ficha: p.ficha || null,
        claveDemo: p.clave_inicial ? p.clave : null,
        etapas: db.persona_etapa.filter((h) => h.persona_id === p.id)
          .map((h) => (db.etapa.find((e) => e.id === h.etapa_id) || {}).nombre).filter(Boolean)
      };
    });
  }

  /* Enmascara según el permiso. Un RUT sin permiso sale `••.•••.•78-9`. */
  function velar(valor, permiso, patron) {
    if (valor == null || valor === '') return '—';
    if (puede(permiso)) return String(valor);
    const s = String(valor);
    return patron === 'monto' ? '•••••'
      : patron === 'todo' ? s.replace(/\S/g, '•')
      : s.replace(/[\dA-Za-z](?=.{4})/g, '•');
  }

  /* ── El agendamiento automático NO forma parte de la réplica ───────────
     No existe en ninguna de las 39 pantallas del sistema actual. Está
     documentado en DECISIONES-REPLICA y se cotiza aparte. Las funciones
     quedan para que nada reviente, rechazando con el motivo. */
  const agenda = () => [];
  const crear_ot_desde_agendamiento = () => ({
    ok: false,
    motivo: 'El agendamiento automático no forma parte de la réplica: no existe en el sistema actual. ' +
            'Está modelado y se cotiza aparte (ver DECISIONES-REPLICA).'
  });

  /* ── Deshacer ───────────────────────────────────────────────────────────
     Una pila de fotos de la base. Antes de cada operación que escribe se
     guarda cómo estaba TODO, y `deshacer()` vuelve a la última foto.

     Es bruto —copia la base entera— y es a propósito: revertir campo por campo
     es imposible de hacer bien. Dar de baja una compañía puede arrastrar
     órdenes, eventos y repuestos; la única marcha atrás siempre correcta es
     volver al estado anterior completo.

     Se guardan las últimas doce. Nadie deshace doce pasos hacia atrás, y más
     que eso es memoria regalada. */
  const PILA_MAX = 12;
  const pila = [];

  const fotoDeLaBase = () => JSON.stringify(db, aJSON);

  function apilar(rotulo) {
    pila.push({ rotulo, foto: fotoDeLaBase() });
    if (pila.length > PILA_MAX) pila.shift();
  }

  function deshacer() {
    if (!pila.length) return { ok: false, motivo: 'No hay nada que deshacer.' };
    const paso = pila.pop();
    const previo = JSON.parse(paso.foto, deJSON);
    Object.keys(db).forEach((k) => delete db[k]);
    Object.keys(previo).forEach((k) => { db[k] = previo[k]; });
    modificado = true; version++; limpiarMemo(); guardar();
    return { ok: true, motivo: '', rotulo: paso.rotulo };
  }

  const puedeDeshacer = () => pila.length;
  const proximoDeshacer = () => (pila.length ? pila[pila.length - 1].rotulo : null);

  /* Qué operación corresponde a cada rótulo. Solo las que escriben: envolver
     una consulta sería llenar la pila de ruido. El rótulo es lo que después se
     le muestra al usuario —"Deshacer: dar de baja una compañía"—, porque un
     botón que dice solo "Deshacer" obliga a adivinar qué va a pasar. */
  const ESCRIBEN = {
    guardar_catalogo: 'el cambio en un catálogo',
    dar_de_baja_catalogo: 'dar de baja una fila del catálogo',
    reactivar_catalogo: 'reactivar una fila del catálogo',
    eliminar_catalogo: 'eliminar una fila del catálogo',
    guardar_parametro: 'el cambio de un parámetro',
    fijar_rol_permiso: 'el cambio de un permiso',
    agregar_prerrequisito: 'agregar una precedencia',
    quitar_prerrequisito: 'quitar una precedencia',
    crear_ot_desde_recepcion: 'la recepción',
    asignar_etapas: 'asignar etapas',
    finalizar_etapa: 'cerrar una etapa',
    finalizar_etapas: 'cerrar etapas',
    quitar_etapa: 'quitar una etapa',
    tomar_etapa: 'tomar la etapa',
    cambiar_clave: 'el cambio de clave',
    asignar_responsable_ot: 'el responsable de la orden',
    soltar_etapa: 'soltar la etapa',
    fijar_fecha_compromiso: 'la fecha de entrega',
    registrar_salida: 'la salida del taller',
    registrar_reingreso: 'el reingreso',
    cambiar_estado_ot: 'el cambio de estado',
    registrar_entrega: 'la entrega',
    cargar_repuesto: 'cargar un repuesto',
    recibir_repuesto: 'recibir un repuesto',
    entregar_repuesto_area: 'entregar un repuesto al área',
    fijar_responsable_pago: 'el responsable de pago',
    crear_presupuesto: 'crear el presupuesto',
    agregar_linea_presupuesto: 'agregar una línea',
    quitar_linea_presupuesto: 'quitar una línea',
    eliminar_presupuesto: 'eliminar el presupuesto',
    cambiar_estado_presupuesto: 'el cambio de estado del presupuesto',
    nueva_version_presupuesto: 'la versión nueva del presupuesto',
    agregar_costo_adicional: 'el costo adicional',
    guardar_persona: 'el cambio en una persona',
    dar_de_baja_persona: 'dar de baja a una persona',
    reactivar_persona: 'reactivar a una persona',
    fijar_habilidad: 'el cambio de habilidades',
    escribir_bitacora: 'el mensaje de bitácora',
    apagar_alerta: 'apagar la alerta',
    eliminar_media: 'eliminar una foto',
    /* Estas cuatro escriben y no estaban declaradas: no se podían deshacer y,
       desde el 15-08-2026, tampoco habrían dejado registro. Es exactamente el
       agujero que `conRegistro` viene a cerrar — una operación que escribe sin
       estar en esta lista es invisible para el expediente. */
    adjuntar_media: 'adjuntar archivos',
    generar_repuestos_desde_presupuesto: 'generar los repuestos del presupuesto',
    abrir_detencion: 'abrir la detención',
    cerrar_detencion: 'cerrar la detención'
  };

  /* Envuelve las operaciones que escriben para que apilen su foto antes de
     correr. Si la operación es rechazada por una regla no cambió nada, así que
     la foto se descarta: deshacer no puede gastarse en algo que no pasó. */
  /* ── El permiso se revisa acá, no en el botón ──────────────────────────
     Hasta el 13-08-2026 los permisos existían en una tabla y en el menú, pero
     ninguna operación los miraba: entrando como recepción se podía crear un
     presupuesto igual, aunque ese rol no lo tuviera. Un permiso que solo
     esconde el botón no es un permiso — es una sugerencia.

     Ahora cada operación que escribe declara qué permiso pide y se rechaza
     antes de tocar nada, con el motivo escrito. Las consultas no se guardan
     acá: lo que se OCULTA al leer se resuelve con `velar()` y con lo que cada
     pantalla decide dibujar.

     ⚠️ Y sigue valiendo lo de siempre: esto corre en el navegador, así que es
        una barrera del programa, no de los datos. La garantía llega cuando
        viva en la base con permisos por fila. Acá se demuestra el
        comportamiento; allá se cumple. */
  const PERMISO_DE = {
    crear_ot_desde_recepcion: 'ot.crear',
    asignar_etapas: 'etapa.asignar',
    quitar_etapa: 'etapa.asignar',
    finalizar_etapa: 'etapa.finalizar',
    finalizar_etapas: 'etapa.finalizar',
    tomar_etapa: 'etapa.finalizar',
    soltar_etapa: 'etapa.finalizar',
    fijar_fecha_compromiso: 'etapa.asignar',
    cambiar_estado_ot: 'ot.editar',
    asignar_responsable_ot: 'ot.editar',
    registrar_salida: 'salida.registrar',
    registrar_reingreso: 'salida.registrar',
    registrar_entrega: 'entrega.registrar',
    cargar_repuesto: 'repuesto.cargar',
    recibir_repuesto: 'repuesto.cargar',
    entregar_repuesto_area: 'repuesto.cargar',
    fijar_responsable_pago: 'repuesto.cargar',
    agregar_costo_adicional: 'repuesto.cargar',
    crear_presupuesto: 'presupuesto.crear',
    agregar_linea_presupuesto: 'presupuesto.crear',
    quitar_linea_presupuesto: 'presupuesto.crear',
    eliminar_presupuesto: 'presupuesto.crear',
    cambiar_estado_presupuesto: 'presupuesto.crear',
    nueva_version_presupuesto: 'presupuesto.crear',
    generar_repuestos_desde_presupuesto: 'presupuesto.crear',
    // Fotos y documentos son permisos distintos, y VER es distinto de CARGAR.
    // El pintor no tiene ninguno de los cuatro: su trabajo es cerrar la etapa.
    adjuntar_media: 'foto.cargar',
    eliminar_media: 'foto.cargar',
    // La bitácora es parte de la ficha completa: escribir ahí enciende una
    // bandera en la torre, y eso lo maneja quien responde por la orden.
    escribir_bitacora: 'ficha.completa',
    apagar_alerta: 'ficha.completa',
    // Ver la ficha del personal y EDITARLA se separaron: el jefe de taller
    // necesita saber quién está y qué sabe hacer para repartir el trabajo,
    // pero los datos de un trabajador los toca administración.
    guardar_persona: 'personal.editar',
    dar_de_baja_persona: 'personal.editar',
    reactivar_persona: 'personal.editar',
    fijar_habilidad: 'personal.editar',
    guardar_catalogo: 'configuracion',
    eliminar_catalogo: 'configuracion',
    dar_de_baja_catalogo: 'configuracion',
    reactivar_catalogo: 'configuracion',
    agregar_prerrequisito: 'configuracion',
    quitar_prerrequisito: 'configuracion',
    guardar_parametro: 'configuracion',
    fijar_rol_permiso: 'configuracion'
  };

  function conPermiso(api) {
    Object.keys(PERMISO_DE).forEach((nombre) => {
      const fn = api[nombre];
      if (typeof fn !== 'function') return;
      const codigo = PERMISO_DE[nombre];
      api[nombre] = function () {
        if (!puede(codigo)) {
          const p = db.permiso.find((x) => x.codigo === codigo) || {};
          return { ok: false, motivo: 'El rol ' + (rolActual().nombre || '—') + ' no puede hacer esto. ' +
            'Falta el permiso «' + (p.descripcion || codigo) + '», que se administra en Configuración → Roles y permisos.' };
        }
        return fn.apply(null, arguments);
      };
    });
    return api;
  }

  function conDeshacer(api) {
    Object.keys(ESCRIBEN).forEach((nombre) => {
      const fn = api[nombre];
      if (typeof fn !== 'function') return;
      api[nombre] = function () {
        apilar(ESCRIBEN[nombre]);
        const r = fn.apply(null, arguments);
        if (!r || r.ok === false) pila.pop();
        return r;
      };
    });
    return api;
  }

  /* ── conRegistro ──────────────────────────────────────────────────────
     "Toda operación que cambie algo deja su evento, con quién, cuándo y qué.
     Sin excepciones."

     Escribir la llamada a mano en cada operación era lo que había: 15 de las
     41 que escriben lo hacían, y no había forma de notar las que faltaban. Una
     operación nueva nacía sin registro y nadie se daba cuenta hasta que el
     expediente aparecía incompleto — justo cuando se necesita.

     Por eso el registro es un decorador y no una llamada: se envuelve el mismo
     conjunto `ESCRIBEN` que ya usa `conDeshacer`, así que una operación nueva
     entra al registro por el mismo acto de declararla. Va POR DENTRO de
     `conPermiso`, para que lo rechazado por permiso no deje rastro de algo que
     no pasó, y por dentro de `conDeshacer`, para que deshacer se lleve el
     evento junto con el cambio.

     Si la operación ya dejó su propio evento —hay quince que lo hacen y dicen
     bastante más que un rótulo genérico— no se agrega otro. */

  // De dónde sale la orden afectada, según qué recibe cada operación. Las que
  // no tocan una orden —catálogos, parámetros, personas— no aparecen acá: son
  // del sistema, no del vehículo, y no tienen por qué ensuciar su expediente.
  const OT_DEL_PRIMER_ARGUMENTO = [
    'asignar_etapas', 'asignar_responsable_ot', 'tomar_etapa', 'soltar_etapa',
    'finalizar_etapa', 'finalizar_etapas', 'quitar_etapa', 'fijar_fecha_compromiso',
    'registrar_salida', 'registrar_reingreso', 'cambiar_estado_ot', 'registrar_entrega',
    'cargar_repuesto', 'crear_presupuesto', 'agregar_costo_adicional', 'escribir_bitacora',
    'abrir_detencion', 'cerrar_detencion'
  ];
  // Reciben el id de otra cosa y hay que subir hasta la orden.
  const OT_POR_TABLA = {
    recibir_repuesto: 'repuesto', entregar_repuesto_area: 'repuesto',
    fijar_responsable_pago: 'repuesto',
    eliminar_presupuesto: 'presupuesto', cambiar_estado_presupuesto: 'presupuesto',
    nueva_version_presupuesto: 'presupuesto', generar_repuestos_desde_presupuesto: 'presupuesto',
    agregar_linea_presupuesto: 'presupuesto',
    apagar_alerta: 'bitacora', eliminar_media: 'media'
  };

  function otAfectada(nombre, args) {
    if (OT_DEL_PRIMER_ARGUMENTO.indexOf(nombre) >= 0) return args[0] || null;

    const tabla = OT_POR_TABLA[nombre];
    if (tabla) {
      const f = (db[tabla] || []).find((x) => x.id === args[0]);
      return f ? f.ot_id || null : null;
    }
    // La línea no conoce la orden: conoce su presupuesto, que sí la conoce.
    if (nombre === 'quitar_linea_presupuesto') {
      const l = (db.presupuesto_linea || []).find((x) => x.id === args[0]);
      if (!l) return null;
      const p = db.presupuesto.find((x) => x.id === l.presupuesto_id);
      return p ? p.ot_id : null;
    }
    return null;
  }

  const SIN_EVENTO_GENERICO = ['cargar_repuesto', 'recibir_repuesto', 'entregar_repuesto_area'];

  function conRegistro(api) {
    Object.keys(ESCRIBEN).forEach((nombre) => {
      const fn = api[nombre];
      if (typeof fn !== 'function') return;
      api[nombre] = function () {
        // `eliminar_media` y compañía borran la fila: hay que mirar a quién
        // pertenecía ANTES de que desaparezca.
        const ot_id = otAfectada(nombre, arguments);
        const antes = db.evento.length;
        const r = fn.apply(null, arguments);
        if (!r || r.ok === false) return r;
        if (db.evento.length > antes) return r;   // ya dejó el suyo, mejor que el genérico
        // Las marcas del repuesto no pasan por acá: el expediente las arma desde
        // la propia tabla —pedido, llegada y entrega son tres hechos con fecha y
        // autor propios— y un evento genérico encima sería la misma línea dos veces.
        if (SIN_EVENTO_GENERICO.indexOf(nombre) >= 0) return r;
        if (ot_id) registrarEvento(ot_id, 'modificacion', mayuscula(ESCRIBEN[nombre]));
        return r;
      };
    });
    return api;
  }

  const mayuscula = (t) => String(t || '').charAt(0).toUpperCase() + String(t || '').slice(1);

  /* El orden importa: permiso por fuera —lo rechazado ahí no pasó y no se
     registra—, deshacer en medio, y el registro pegado a la operación. */
  return conPermiso(conDeshacer(conRegistro({
    iniciar, reiniciar, sembrar, estaModificado, base, sandbox, version: () => version,
    recargarDeDisco, CLAVE,
    deshacer, puedeDeshacer, proximoDeshacer,
    // consultas
    torre, historico, otPorId, otPorNumero, otFueraDeAlcance, vistaOT, metricas, corteEspera,
    alcanceActual, enAlcance,
    historialDe, bitacoraDe, expedienteDe, totalOT, tieneRepuestoPendiente,
    // catálogos de lectura
    etapas, estadosOT, companias, tiposDano, zonasDano, inventarioItems, roles,
    motivosDetencion, prerrequisitos, catalogo, CATALOGOS, parametros, permisosDe,
    rolActual, puede, fijar_rol_actual, velar,
    personaActual, fijar_persona_actual, sesionesPosibles,
    iniciar_sesion, cerrar_sesion, retomar_sesion, haySesion, cambiar_clave,
    sesionGuardada, sesionAlDia, CLAVE_SESION,
    // operación
    crear_ot_desde_recepcion, asignar_etapas, finalizar_etapa, finalizar_etapas, quitar_etapa,
    tomar_etapa, soltar_etapa, miTrabajo, asignar_responsable_ot,
    personasParaEtapa, destinatarios, fijar_fecha_compromiso,
    registrar_salida, registrar_reingreso, cambiar_estado_ot, registrar_entrega,
    cargar_repuesto, recibir_repuesto, entregar_repuesto_area, fijar_responsable_pago,
    crear_presupuesto, agregar_linea_presupuesto, quitar_linea_presupuesto,
    eliminar_presupuesto,
    cambiar_estado_presupuesto, nueva_version_presupuesto, generar_repuestos_desde_presupuesto,
    agregar_costo_adicional, costosDe,
    personal, guardar_persona, dar_de_baja_persona, reactivar_persona,
    fijar_habilidad,
    escribir_bitacora, apagar_alerta,
    adjuntar_media, eliminar_media, mediaDe,
    abrir_detencion, cerrar_detencion, detencionDe,
    // configuración
    guardar_catalogo, eliminar_catalogo, dar_de_baja_catalogo, reactivar_catalogo,
    agregar_prerrequisito, quitar_prerrequisito, guardar_parametro, fijar_rol_permiso,
    // fuera de alcance, declarado
    agenda, crear_ot_desde_agendamiento
  })));
})();

/* Alias de transición: las vistas de las tandas anteriores hablan con
   `Estado`. Se van migrando a `Modelo` a medida que se reescriben. */
const Estado = Modelo;
