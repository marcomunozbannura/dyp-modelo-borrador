/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   LOS DATOS DE DEMOSTRACIÓN.

   🔶 TODO LO QUE HAY ACÁ ES INVENTADO. Ninguna persona, patente, RUT,
   teléfono ni domicilio corresponde a nadie real. Los nombres se arman por
   combinación desde listas neutras y los RUT son de la serie 11.111.111-1.

   Lo que NO es inventado son los CATÁLOGOS y los TOTALES: salen del
   levantamiento del sistema actual, medidos pantalla por pantalla el
   12-08-2026, y están citados uno por uno con la sección del documento de
   reglas de donde vienen. Si un número de acá cambia, es que se rompió algo.

   La generación es DETERMINISTA (ver `rnd`): la misma semilla produce
   siempre los mismos datos. Sin eso, las cifras de control cambiarían en
   cada recarga y no se podría comprobar nada.
   ──────────────────────────────────────────────────────────────────────── */

/* Fecha de referencia del modelo borrador. Es la del levantamiento, para que
   los días calculados cuadren con lo que se midió en el sistema real.

   Va como `let` y no como `const` a propósito: los tres relojes solo se
   pueden demostrar de verdad si se puede adelantar el calendario. Procesos →
   Adelantar la fecha del sistema mueve esto, y todo lo demás se recalcula
   solo, porque ningún contador guarda días: todos se derivan de las fechas.
   Es el paso 14 del guion de prueba. */
let HOY = new Date(2026, 7, 12);
const HOY_ORIGINAL = new Date(2026, 7, 12);

const Semilla = (function () {

  /* ── Cifras de control, medidas sobre el sistema actual ────────────────
     Las comprueba Procesos → Comprobar cifras de la semilla. */

  const TOTAL_TORRE            = 102;  // reglas §C.5  — órdenes vivas
  const CON_REPUESTO_PENDIENTE = 41;   // reglas §C.6  — tarjeta 41/102
  const FUERA_DE_TALLER        = 10;   // reglas §C.6  — y son distintas de las 41
  const SIN_ETAPA              = 53;   // reglas §C.7  — "Pendiente" / "Sin Asignar"
  const TRABAJADORES           = 89;   // medido en el sistema real; la demo siembra 5
  const EQUIPO_DEMO            = 6;    // cinco del taller más el dueño, cada uno con su clave
  const TOTAL_HISTORICO        = 120;  // ~3 entregas diarias (§C.21)
  const ULTIMA_OT              = 23488;// reglas §C.13 — al 12-08-2026
  // TEMPARIO_HORA ($10.000, reglas §C.15) se eliminó el 13-08-2026 junto con
  // el tempario entero. La cifra queda medida en `reglas`, no en el sistema.

  /* ── El catálogo de permisos ───────────────────────────────────────────
     Vive acá arriba, fuera del generador, para que el motor lo pueda comparar
     con lo que hay guardado en el navegador SIN volver a sembrar todo.

     Sirve para un problema que ya pasó dos veces y cuesta caro cuando pasa
     delante del cliente: el navegador guarda la base POR ORIGEN, así que
     `localhost:8101` conserva la suya mientras se prueba en otro puerto. Si
     después se agregan permisos, ese navegador arranca con el código nuevo y
     la base vieja, y módulos enteros desaparecen del menú —incluso los del
     administrador— porque piden un permiso que en esa base no existe.
     Con esta lista afuera, el motor lo detecta al arrancar y vuelve a sembrar
     en vez de dejar el sistema a medias. */
  const CATALOGO_PERMISOS = [
    ['torre.ver',            'Ver la torre de control'],
    ['historico.ver',        'Ver el histórico de órdenes ya cerradas'],
    ['taller.ver',           'Ver el tablero del taller'],
    ['repuesto.ver',         'Ver los repuestos pendientes'],
    ['espera.ver',           'Ver el análisis de esperas y lo detenido'],
    ['ficha.completa',       'Ver la ficha completa: cliente, compañía, siniestro, historial y bitácora'],
    ['documento.ver',        'Ver los documentos de una orden'],
    ['documento.cargar',     'Cargar y quitar documentos de una orden'],
    ['foto.ver',             'Ver las fotografías del vehículo'],
    ['foto.cargar',          'Cargar y quitar fotografías del vehículo'],
    ['ot.crear',             'Crear órdenes de trabajo'],
    ['ot.editar',            'Editar la recepción de una orden'],
    ['etapa.asignar',        'Asignar etapas a un vehículo'],
    ['etapa.finalizar',      'Finalizar etapas'],
    ['presupuesto.ver',      'Ver el presupuesto y sus líneas'],
    ['presupuesto.montos',   'Ver los montos de venta del presupuesto'],
    ['presupuesto.crear',    'Crear y editar presupuestos'],
    ['repuesto.cargar',      'Cargar repuestos en bodega'],
    ['salida.registrar',     'Registrar salidas y reingresos'],
    ['entrega.registrar',    'Entregar el vehículo'],
    ['personal.ver',         'Ver la ficha de los trabajadores'],
    ['personal.editar',      'Crear, editar y dar de baja trabajadores'],
    ['datos.rut_completo',   'Ver el RUT, domicilio y teléfono sin enmascarar'],
    ['exportar',             'Exportar tablas a Excel'],
    ['configuracion',        'Administrar los catálogos del sistema'],
    ['consolidado.ver',      'Ver el consolidado y la rentabilidad']
  ];

  /* ── Generador determinista ────────────────────────────────────────────
     LCG clásico. No sirve para criptografía y no hace falta: sirve para que
     la demostración sea reproducible. */

  let _s = 20260812;
  const rnd = () => { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff; };
  const entre = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const elegir = (arr) => arr[Math.floor(rnd() * arr.length)];
  const dias = (n) => new Date(HOY.getTime() - n * 86400000);

  function generar() {
    _s = 20260812;   // se reinicia en cada siembra: mismo resultado siempre

    /* ═══════════════════════════════════════════════════════════════════
       CATÁLOGOS — copiados del sistema actual, no inventados
       ═══════════════════════════════════════════════════════════════════ */

    /* Las NUEVE etapas, en el orden del formulario `nuevo-personal`.
       reglas §A.1. `Lavado` NO existe: era un supuesto nuestro.
       Una sola redacción por etapa — el original la escribe de tres formas
       distintas según la pantalla ("Control de calidad" / "Control de
       Calidad" / "Calidad").

       exige_precedencia y requiere_repuestos_completos van APAGADAS: no
       sabemos si esas reglas existen en el sistema actual. Preguntas 1 y 3. */
    const etapa = [
      { id: 'et-1', codigo: 'desarme',       nombre: 'Desarme',            orden: 1, color: '#fb923c', aplica_siempre: true,  exige_precedencia: false, requiere_repuestos_completos: false, vigente: true },
      { id: 'et-2', codigo: 'desabolladura', nombre: 'Desabolladura',      orden: 2, color: '#eab308', aplica_siempre: true,  exige_precedencia: false, requiere_repuestos_completos: false, vigente: true },
      { id: 'et-3', codigo: 'preparacion',   nombre: 'Preparación',        orden: 3, color: '#a3e635', aplica_siempre: true,  exige_precedencia: false, requiere_repuestos_completos: false, vigente: true },
      { id: 'et-4', codigo: 'pintura',       nombre: 'Pintura',            orden: 4, color: '#60a5fa', aplica_siempre: true,  exige_precedencia: false, requiere_repuestos_completos: false, vigente: true },
      { id: 'et-5', codigo: 'armado',        nombre: 'Armado',             orden: 5, color: '#34d399', aplica_siempre: true,  exige_precedencia: false, requiere_repuestos_completos: false, vigente: true },
      { id: 'et-6', codigo: 'mecanica',      nombre: 'Mecánica',           orden: 6, color: '#f59e0b', aplica_siempre: false, exige_precedencia: false, requiere_repuestos_completos: false, vigente: true },
      { id: 'et-7', codigo: 'terminacion',   nombre: 'Terminación',        orden: 7, color: '#c084fc', aplica_siempre: true,  exige_precedencia: false, requiere_repuestos_completos: false, vigente: true },
      { id: 'et-8', codigo: 'calidad',       nombre: 'Control de calidad', orden: 8, color: '#4ade80', aplica_siempre: true,  exige_precedencia: false, requiere_repuestos_completos: false, vigente: true },
      /* 🔶 ENTREGA con la precedencia ENCENDIDA (13-08-2026, pedido de Marco):
         «el control de calidad se hace antes de entregar el auto». Es la única
         de las nueve con el interruptor puesto, y no hizo falta tocar código:
         la fila `Entrega ← Calidad` ya estaba en `etapa_prerrequisito`, solo
         estaba apagada porque no se había confirmado con el cliente. Se apaga
         y se enciende desde Configuración → Precedencias. */
      { id: 'et-9', codigo: 'entrega',       nombre: 'Entrega',            orden: 9, color: '#94a3b8', aplica_siempre: true,  exige_precedencia: true,  requiere_repuestos_completos: false, vigente: true }
    ];

    /* Precedencias: el ORDEN sí está observado (reglas §A.3, historial de una
       OT que recorrió el taller). El BLOQUEO no: en pantalla no hay rastro.
       Por eso las filas existen y el interruptor de cada etapa está apagado.
       Si se confirma que la regla existe, se enciende sin tocar código. */
    const etapa_prerrequisito = [
      { etapa_id: 'et-2', requiere_etapa_id: 'et-1' },   // Desabolladura ← Desarme
      { etapa_id: 'et-3', requiere_etapa_id: 'et-2' },   // Preparación   ← Desabolladura
      { etapa_id: 'et-4', requiere_etapa_id: 'et-3' },   // Pintura       ← Preparación
      { etapa_id: 'et-5', requiere_etapa_id: 'et-4' },   // Armado        ← Pintura
      { etapa_id: 'et-6', requiere_etapa_id: 'et-1' },   // Mecánica      ← Desarme
      { etapa_id: 'et-7', requiere_etapa_id: 'et-5' },   // Terminación   ← Armado
      { etapa_id: 'et-8', requiere_etapa_id: 'et-7' },   // Calidad       ← Terminación
      { etapa_id: 'et-9', requiere_etapa_id: 'et-8' }    // Entrega       ← Calidad
    ];

    /* Los NUEVE estados del maestro `administrar-estados`, literales, con sus
       tildes faltantes y su alternancia de mayúsculas. reglas §B.

       es_final     → gobierna Torre vs Histórico. Verificado: el filtro del
                      Histórico ofrece exactamente estos cinco (§C.8).
       cierra_orden → si admite cambios. NO es lo mismo.

       ⚠️ Mirar `Rechazado`: el maestro lo marca Estado Inicial —o sea sigue
       en la Torre— pero en la reunión se dijo que un rechazo cierra la orden para
       siempre. Los dos booleanos dejan la contradicción visible en vez de
       taparla. Pregunta abierta. */
    const estado = [
      { id: 'es-1', codigo: 'recibido',        nombre: 'Recibido',                         es_final: false, cierra_orden: false, clase: 'verde', orden: 1, vigente: true, alcanzable_en: ['ingreso', 'ficha'] },
      { id: 'es-2', codigo: 'rechazado',       nombre: 'Rechazado',                        es_final: false, cierra_orden: true,  clase: 'roja',  orden: 2, vigente: true, alcanzable_en: ['ingreso', 'ficha'] },
      { id: 'es-3', codigo: 'fuera_taller',    nombre: 'Fuera de taller / Espera repuesto',es_final: false, cierra_orden: false, clase: 'ambar', orden: 3, vigente: true, alcanzable_en: ['ingreso', 'ficha'] },
      { id: 'es-4', codigo: 'pt_espera',       nombre: 'Perdida Total / Espera retiro',    es_final: false, cierra_orden: false, clase: 'roja',  orden: 4, vigente: true, alcanzable_en: ['ingreso', 'ficha'] },
      { id: 'es-5', codigo: 'perdida_total',   nombre: 'Perdida total',                    es_final: true,  cierra_orden: true,  clase: 'roja',  orden: 5, vigente: true, alcanzable_en: [] },
      { id: 'es-6', codigo: 'finalizado',      nombre: 'Finalizado',                       es_final: true,  cierra_orden: true,  clase: 'gris',  orden: 6, vigente: true, alcanzable_en: [] },
      { id: 'es-7', codigo: 'despachada_pt',   nombre: 'Despachada por Perdida Total',     es_final: true,  cierra_orden: true,  clase: 'gris',  orden: 7, vigente: true, alcanzable_en: ['entrega'] },
      { id: 'es-8', codigo: 'entrega_cliente', nombre: 'Entrega Cliente',                  es_final: true,  cierra_orden: true,  clase: 'gris',  orden: 8, vigente: true, alcanzable_en: ['entrega'] },
      { id: 'es-9', codigo: 'entrega_sin_rep', nombre: 'Entrega sin reparar',              es_final: true,  cierra_orden: true,  clase: 'gris',  orden: 9, vigente: true, alcanzable_en: ['entrega'] }
    ];
    /* ⚠️ `perdida_total` y `finalizado` quedan con alcanzable_en vacío A
       PROPÓSITO: en el sistema actual están en el maestro y en el filtro del
       Histórico, pero NINGUNA pantalla los ofrece. Cómo se llega a ellos es
       la pregunta 4. Configuración los muestra rotulados "sin origen
       declarado" en vez de que nosotros inventemos una respuesta. */

    /* Compañías: SIETE reales, consolidadas desde los 19 valores sucios del
       filtro del Histórico. reglas §C.11. Los alias quedan escritos porque
       son el mapa de la migración: hay que poder mostrar qué se
       unificó con qué. */
    const compania = [
      { id: 'co-1', codigo: 'SURA',          nombre: 'SURA',                  vigente: true, alias: [] },
      { id: 'co-2', codigo: 'MAPFRE',        nombre: 'MAPFRE',                vigente: true, alias: ['MAPFE', 'MAPFEE', 'MAPFRW'] },
      { id: 'co-3', codigo: 'CARDIF',        nombre: 'CARDIF',                vigente: true, alias: ['CADIF', 'CARDF', 'CDIF'] },
      { id: 'co-4', codigo: 'HDI',           nombre: 'HDI Seguros',           vigente: true, alias: [] },
      { id: 'co-5', codigo: 'CHILENA',       nombre: 'Chilena Consolidada',   vigente: true, alias: [] },
      { id: 'co-6', codigo: 'MAGALLANES',    nombre: 'Magallanes',            vigente: true, alias: [] },
      { id: 'co-7', codigo: 'PENTA',         nombre: 'Penta Security',        vigente: true, alias: [] }
    ];
    /* Quedaron FUERA a propósito, y hay que preguntarlos: `PRUEBA` (un
       registro de prueba en producción), `HECTOR VASQUEZ` (el nombre de una
       persona guardado como compañía), y `DIVERSEY`, `EUROPCAR` y
       `GRAND LEASING`, que parecen empresas cliente y no aseguradoras. */

    const tipo_ingreso = [
      { id: 'ti-1', codigo: 'compania',   nombre: 'Compañía',   exige_compania: true,  vigente: true },
      { id: 'ti-2', codigo: 'particular', nombre: 'Particular', exige_compania: false, vigente: true },
      { id: 'ti-3', codigo: 'empresa',    nombre: 'Empresa',    exige_compania: false, vigente: true }
    ];

    const prioridad = [
      { id: 'pri-1', codigo: 'normal',  nombre: 'Normal',  color: '#64748b', vigente: true },
      { id: 'pri-2', codigo: 'express', nombre: 'Express', color: '#f43f5e', vigente: true }
    ];

    /* Los SEIS asuntos de la bitácora. reglas §C.16. La columna Alerta de la
       Torre es la INICIAL de estos, y las seis iniciales son distintas entre
       sí, así que no hay colisión.

       ⚠️ En el sistema actual están escritos en el código: la ficha ofrece
       los seis y las pantallas de etapas solo cuatro. Acá son un catálogo y
       se ofrecen los seis en todas partes. */
    const asunto_bitacora = [
      { id: 'as-1', codigo: 'envio',        nombre: 'Envio',        orden: 1, genera_alerta: true, vigente: true },
      { id: 'as-2', codigo: 'autorizado',   nombre: 'Autorizado',   orden: 2, genera_alerta: true, vigente: true },
      { id: 'as-3', codigo: 'otro',         nombre: 'Otro',         orden: 3, genera_alerta: true, vigente: true },
      { id: 'as-4', codigo: 'repuestos',    nombre: 'Repuestos',    orden: 4, genera_alerta: true, vigente: true },
      { id: 'as-5', codigo: 'correcciones', nombre: 'Correcciones', orden: 5, genera_alerta: true, vigente: true },
      { id: 'as-6', codigo: 'presupuesto',  nombre: 'Presupuesto',  orden: 6, genera_alerta: true, vigente: true }
    ];

    /* 🔶 EL TEMPARIO SE ELIMINÓ (13-08-2026). En el sistema actual es un
       desplegable con un solo valor —$10.000 la hora, reglas §C.15— y acá
       servía para proponer la venta de mano de obra multiplicando las horas
       por esa tarifa. Se saca entero: el taller no cobra por hora, cotiza un
       precio por trabajo, y tener la tarifa a la vista invita a que la
       compañía divida el monto por las horas y discuta un valor hora que no
       existe. Con el desplegable fuera del presupuesto, el catálogo de
       Configuración no gobernaba nada: una pantalla que configura aire. */

    /* Responsable de pago de cada repuesto. En el original es texto libre y
       viene sucio (`sura`, `SURA`, `Sura`, `dyp`, `DYP`, `Dyp`, y muchos
       vacíos). Acá es catálogo cerrado: ES PLATA DEL TALLER. reglas §C.14. */
    const responsable_pago = [
      { id: 'rp-1', codigo: 'compania', nombre: 'Compañía', es_taller: false, vigente: true },
      { id: 'rp-2', codigo: 'dyp',      nombre: 'DyP',      es_taller: true,  vigente: true }
    ];

    /* ⚠️ NO existe en el sistema actual. Ninguna de las 39 pantallas tiene
       motivos de detención ni imputabilidad. Queda modelado, sin pantalla
       propia: es desarrollo nuevo y se cotiza aparte. */
    const motivo_detencion = [
      { id: 'mo-1', codigo: 'espera_repuesto',   nombre: 'Espera de repuesto',            imputable_a: 'proveedor',   vigente: true },
      { id: 'mo-2', codigo: 'espera_aprobacion', nombre: 'Espera aprobación aseguradora', imputable_a: 'aseguradora', vigente: true },
      { id: 'mo-3', codigo: 'espera_liquidador', nombre: 'Espera visita del liquidador',  imputable_a: 'aseguradora', vigente: true },
      { id: 'mo-4', codigo: 'espera_cliente',    nombre: 'Espera respuesta del cliente',  imputable_a: 'cliente',     vigente: true }
    ];

    /* El original tiene 169 colores y 73 marcas. Acá va una muestra: lo que
       importa demostrar es que son un CATÁLOGO editable, no una lista quemada
       — en el sistema actual "Administrar Colores Vehículos" apunta a sí
       misma y no lleva a ninguna parte. */
    const color_vehiculo = ['Blanco', 'Negro', 'Gris', 'Plata', 'Rojo', 'Azul', 'Azul marino',
      'Verde', 'Beige', 'Café', 'Amarillo', 'Naranjo', 'Burdeo', 'Perla', 'Grafito', 'Champagne']
      .map((n, i) => ({ id: 'col-' + (i + 1), codigo: n.toLowerCase().replace(/\s/g, '_'), nombre: n, orden: i + 1, vigente: true }));

    const MARCAS = ['CHEVROLET', 'HYUNDAI', 'KIA', 'NISSAN', 'SUZUKI', 'TOYOTA', 'MAZDA',
      'FORD', 'PEUGEOT', 'RENAULT', 'MITSUBISHI', 'VOLKSWAGEN', 'HONDA', 'SUBARU',
      'CHERY', 'MG', 'GREAT WALL', 'JAC', 'CITROEN', 'FIAT'];
    const marca = MARCAS.map((n, i) => ({ id: 'ma-' + (i + 1), codigo: String(i), nombre: n, vigente: true }));

    const MODELOS = {
      CHEVROLET: ['Sail', 'Onix', 'Spark', 'Tracker'], HYUNDAI: ['Accent', 'Tucson', 'Creta', 'Grand i10'],
      KIA: ['Rio', 'Morning', 'Sportage', 'Seltos'], NISSAN: ['Versa', 'Kicks', 'Qashqai', 'March'],
      SUZUKI: ['Swift', 'Baleno', 'Vitara', 'Celerio'], TOYOTA: ['Yaris', 'Corolla', 'Rav4', 'Hilux'],
      MAZDA: ['Mazda 3', 'CX-5', 'Mazda 2', 'BT-50'], FORD: ['Ranger', 'Ecosport', 'Escape', 'Fiesta'],
      PEUGEOT: ['208', '2008', '308', 'Partner'], RENAULT: ['Kwid', 'Duster', 'Sandero', 'Logan'],
      MITSUBISHI: ['L200', 'ASX', 'Outlander', 'Mirage'], VOLKSWAGEN: ['Gol', 'Polo', 'T-Cross', 'Amarok'],
      HONDA: ['Fit', 'HR-V', 'City', 'Civic'], SUBARU: ['XV', 'Forester', 'Impreza', 'Outback'],
      CHERY: ['Tiggo 2', 'Tiggo 4', 'Arrizo 5', 'Tiggo 7'], MG: ['MG3', 'ZS', 'MG5', 'RX5'],
      'GREAT WALL': ['Wingle', 'Poer', 'Haval H6', 'Jolion'], JAC: ['S2', 'T6', 'S3', 'J4'],
      CITROEN: ['C3', 'C4 Cactus', 'Berlingo', 'C-Elysee'], FIAT: ['Mobi', 'Argo', 'Cronos', 'Strada']
    };
    const modelo = [];
    marca.forEach((m) => (MODELOS[m.nombre] || []).forEach((n, j) =>
      modelo.push({ id: m.id + '-mo-' + (j + 1), marca_id: m.id, nombre: n, vigente: true })));

    /* Los 28 ítems del checklist de recepción, con el nombre literal que
       tienen en el código del sistema actual. inventario §Nuevo Ingreso.
       Se cree que "el checklist se cayó": está entero. Pregunta 10. */
    const inventario_item = [
      'radio', 'ceniceros', 'encendedor', 'espejo_interior', 'luz_interior', 'pisos_goma', 'tag',
      'cinturon', 'antena_radio', 'botiquin', 'parabrisas', 'emblemas_delanteros',
      'placa_patente_delantera', 'espejos_laterales', 'senalizadores_laterales', 'llave_rueda',
      'rueda_repuesto', 'tapas_ruedas', 'placa_patente_trasera', 'tapa_bencina', 'bateria',
      'bocina', 'documentos', 'llaves_vehiculo', 'sistema_alarma', 'extintor', 'triangulos', 'gata'
    ].map((c, i) => ({
      id: 'inv-' + (i + 1), codigo: c, orden: i + 1, vigente: true,
      nombre: c.replace(/_/g, ' ').replace(/^./, (s) => s.toUpperCase())
    }));

    const tipo_dano = [
      { id: 'td-1', codigo: 'rayon',      nombre: 'Rayón',      color: '#f59e0b', vigente: true },
      { id: 'td-2', codigo: 'abolladura', nombre: 'Abolladura', color: '#ef4444', vigente: true },
      { id: 'td-3', codigo: 'quiebre',    nombre: 'Quiebre',    color: '#a78bfa', vigente: true },
      { id: 'td-4', codigo: 'faltante',   nombre: 'Faltante',   color: '#22d3ee', vigente: true },
      { id: 'td-5', codigo: 'oxido',      nombre: 'Óxido',      color: '#84cc16', vigente: true }
    ];

    const zona_dano = [
      ['capo', 'Capó'], ['techo', 'Techo'], ['maletero', 'Maletero'],
      ['puerta_del_izq', 'Puerta del. izq.'], ['puerta_tra_izq', 'Puerta tras. izq.'],
      ['puerta_del_der', 'Puerta del. der.'], ['puerta_tra_der', 'Puerta tras. der.'],
      ['paragolpes_del', 'Paragolpes del.'], ['paragolpes_tra', 'Paragolpes tras.'],
      ['tapabarro_izq', 'Tapabarro izq.'], ['tapabarro_der', 'Tapabarro der.']
    ].map(([c, n], i) => ({ id: 'zd-' + (i + 1), codigo: c, nombre: n, vigente: true }));

    /* ═══════════════════════════════════════════════════════════════════
       ROLES Y PERMISOS — se CONSTRUYEN, no se copian
       El sistema actual no tiene ninguna administración de roles: el alta de
       usuario tiene cinco campos y ninguno es un rol. reglas §A.4.
       Esto es literalmente lo que se pidió al decir "escalable".
       ═══════════════════════════════════════════════════════════════════ */

    const permiso = CATALOGO_PERMISOS.map(([codigo, descripcion]) => ({ codigo, descripcion }));

    /* ── ALCANCE: sobre QUÉ ÓRDENES ─────────────────────────────────────────
       El permiso dice qué PANTALLAS abre alguien. El alcance dice sobre qué
       FILAS. Son dos cosas distintas y hasta el 13-08-2026 solo existía la
       primera: al pintor no le aparecía Configuración en el menú, pero veía
       los 102 vehículos del taller con el nombre y el RUT de cada cliente.

         todo      · todas las órdenes
         asignado  · solo las que tiene tomadas o a su cargo
         compania  · solo las de su compañía de seguros

       El operario es el único con `asignado`, y es el punto: entra, ve los
       cuatro autos que le tocan, cierra su etapa y no hay una fila más. */
    const rol = [
      { id: 'ro-1', codigo: 'recepcion',    nombre: 'Recepción',      alcance: 'todo',     vigente: true },
      { id: 'ro-2', codigo: 'jefe_taller',  nombre: 'Jefe de taller', alcance: 'todo',     vigente: true },
      { id: 'ro-3', codigo: 'operario',     nombre: 'Operario',       alcance: 'asignado', vigente: true },
      { id: 'ro-4', codigo: 'bodega',       nombre: 'Bodega',         alcance: 'todo',     vigente: true },
      /* `total: true` no es una fila más de la matriz: es una GARANTÍA. Un rol
         total tiene acceso a todo el sistema siempre, y no se le puede quitar.
         Sin esto, bastaba con que alguien desmarcara `configuracion` en la
         fila de Administración —por error o por mano ajena— para que el taller
         quedara sin nadie que pudiera volver a marcarla. Un sistema del que te
         puedes dejar afuera sin marcha atrás no es administrable. */
      { id: 'ro-5', codigo: 'admin',        nombre: 'Administración', alcance: 'todo',     total: true, vigente: true },
      { id: 'ro-6', codigo: 'dueno',        nombre: 'Dueño',          alcance: 'todo',     total: true, vigente: true },
      { id: 'ro-7', codigo: 'aseguradora',  nombre: 'Aseguradora',    alcance: 'compania', vigente: true, externo: true }
    ];

    /* La matriz. Lo importante para la demostración es el contraste entre el
       operario —que ve el presupuesto pero NO los montos— y quien sí los ve.
       "Tiene el presupuesto y no puede ver los valores."

       🔶 CAMBIO PEDIDO POR MARCO (13-08-2026): el nivel de COSTO y UTILIDAD se
       eliminó. El taller no lleva costos por orden, así que el presupuesto es
       la VENTA y nada más. Quedan dos niveles: ve las líneas / ve los montos. */
    /* Quién presupuesta: el JEFE DE TALLER y administración. Nadie más.
       Pasó por dos revisiones. Primero lo tenía solo el dueño y el flujo no
       cerraba —el auto se recibe, se le asigna un responsable y esa persona
       tiene que poder valorizar el daño—, así que se le dio también a
       recepción con el argumento de que es quien habla con la compañía. Al
       revisar los accesos de verdad quedó claro que el argumento no aguanta:
       hablar con la compañía es MANDAR el presupuesto, no ARMARLO. Quien sabe
       cuánto cuesta reparar un tapabarro es el que está en el taller.
       Recepción quedó leyéndolo y pudiendo mandarlo; un operario ve las
       líneas, no los valores, y no crea. */
    /* El reparto, puesto por puesto. Sale de recorrer el día de cada uno y
       preguntar qué necesita TOCAR, no qué le vendría bien mirar.

       RECEPCIÓN — recibe el auto, fotografía el daño, anota al cliente y a la
       compañía, hace el seguimiento y al final entrega. Es la única que
       necesita el RUT sin enmascarar, porque es la que emite. No ve el
       histórico ni el tablero de esperas: eso es análisis de gestión, no
       atención de público.

       🔶 CAMBIO PEDIDO POR MARCO (13-08-2026): recepción pierde dos permisos
       que antes tenía —eran los dos más discutibles de los dieciséis—:

         · `presupuesto.crear` · valorizar el daño lo hace quien sabe cuánto
           cuesta reparar un tapabarro, y ése es el jefe de taller. Recepción
           conserva `presupuesto.ver` y `presupuesto.montos`: sigue leyendo la
           OR y sigue pudiendo abrir el PDF para mandárselo a la compañía y
           para responderle al cliente cuánto es. Lo que ya no hace es armarla.
         · `salida.registrar` · sacar el vehículo del taller DETIENE el reloj
           de reparación, que es el número del que cuelga toda la meta de días.
           Esa decisión es del taller, no del mostrador.

       Si en la práctica resulta que es recepción la que recibe el auto de
       vuelta cuando llega de un tercero, es una casilla en Configuración.

       JEFE DE TALLER — reparte el trabajo y responde por los plazos. Ve casi
       todo lo operativo: torre, tablero, esperas, repuestos, presupuestos con
       monto. No ve el HISTÓRICO —el archivo de lo ya cerrado es del
       administrador— ni el consolidado, ni la configuración, ni el RUT.
       Puede mirar la ficha del personal para saber quién está, pero no
       editarla: los datos de un trabajador los toca administración.

       OPERARIO (desabolladura, pintura) — hace el trabajo con las manos. Ve
       SU lista, el tablero del piso y si llegó su repuesto. Del vehículo ve
       lo que necesita para trabajarlo: patente, marca, modelo, color, daños,
       su etapa y las líneas del presupuesto SIN los montos —para saber qué
       fue autorizado—. No ve al cliente, ni la compañía, ni el siniestro, ni
       fotos, ni documentos, ni el historial. Y solo sobre los autos que tiene
       asignados: el alcance `asignado` hace el resto.

       BODEGA — pide, recibe y entrega piezas. Necesita la torre entera porque
       compra para todo el taller, y los documentos porque la guía de despacho
       llega con la pieza. No ve montos de venta ni el RUT del cliente.

       ADMINISTRACIÓN (Gabriel Díaz) — ve y hace todo, incluido el histórico,
       el consolidado y la configuración. Hoy queda igual que el rol Dueño
       porque así se pidió: un administrador que vea todo. Son dos filas
       distintas para que el día que el dueño quiera guardarse el margen,
       se le quite `consolidado.ver` a Administración en Configuración y
       listo — sin tocar una línea de código. */
    const M = {
      recepcion:   ['torre.ver', 'taller.ver', 'repuesto.ver', 'ficha.completa',
                    'documento.ver', 'documento.cargar', 'foto.ver', 'foto.cargar',
                    'ot.crear', 'ot.editar', 'presupuesto.ver', 'presupuesto.montos',
                    'entrega.registrar', 'datos.rut_completo'],
      jefe_taller: ['torre.ver', 'taller.ver', 'repuesto.ver', 'espera.ver', 'ficha.completa',
                    'documento.ver', 'foto.ver', 'foto.cargar',
                    'etapa.asignar', 'etapa.finalizar', 'presupuesto.ver', 'presupuesto.montos',
                    'presupuesto.crear', 'personal.ver', 'salida.registrar'],
      operario:    ['taller.ver', 'repuesto.ver', 'etapa.finalizar', 'presupuesto.ver'],
      bodega:      ['torre.ver', 'taller.ver', 'repuesto.ver', 'ficha.completa',
                    'documento.ver', 'documento.cargar', 'repuesto.cargar', 'presupuesto.ver'],
      admin:       permiso.map((p) => p.codigo),
      dueno:       permiso.map((p) => p.codigo),
      aseguradora: ['torre.ver', 'ficha.completa', 'presupuesto.ver', 'presupuesto.montos',
                    'documento.ver', 'foto.ver']
    };
    const rol_permiso = [];
    rol.forEach((r) => (M[r.codigo] || []).forEach((p) =>
      rol_permiso.push({ rol_id: r.id, permiso_codigo: p })));

    /* ═══════════════════════════════════════════════════════════════════
       PERSONAS — todas inventadas
       ═══════════════════════════════════════════════════════════════════ */

    const NOM = ['Andrés', 'Bernardita', 'Camilo', 'Daniela', 'Esteban', 'Fernanda', 'Gonzalo',
      'Hilda', 'Ignacio', 'Javiera', 'Kevin', 'Lorena', 'Matías', 'Natalia', 'Óscar', 'Paulina',
      'Rodrigo', 'Sofía', 'Tomás', 'Valentina', 'Wilson', 'Ximena', 'Yerko', 'Zoila'];
    const APE = ['Aguilera', 'Bravo', 'Cárdenas', 'Donoso', 'Espinoza', 'Fuentes', 'Gallardo',
      'Herrera', 'Ibáñez', 'Jara', 'Klein', 'Lagos', 'Molina', 'Núñez', 'Orellana', 'Peña',
      'Quezada', 'Riquelme', 'Sepúlveda', 'Tapia', 'Urrutia', 'Vergara', 'Yáñez', 'Zúñiga'];

    // RUT ficticio de la serie 11.111.111-K. No corresponde a nadie.
    const rutFalso = (n) => '11.' + String(100 + (n % 900)).padStart(3, '0') + '.' +
      String(100 + ((n * 7) % 900)).padStart(3, '0') + '-' + (n % 10);

    const persona = [];
    const persona_etapa = [];
    const persona_rol = [];

    /* 🔶 EL VALOR HORA SE ELIMINÓ (decisión del 13-08-2026). No se ocupa. Y hay algo que conviene señalar: el requisito A-3 de la
       auditoría pedía protegerlo con su propia política de acceso porque hoy
       cualquier cuenta ve el sueldo de los 89 trabajadores.
       **Al no recoger el dato, el requisito deja de aplicar.** El dato que no
       se guarda no se puede filtrar: es la mejor respuesta posible a A-3. */

    /* CINCO personas, no 89 (decisión del 13-08-2026).
       El sistema real tiene 89 trabajadores y ese número sigue anotado más
       arriba como lo que se midió. Pero una lista de 89 no se puede usar para
       demostrar nada: no se distingue quién hace qué. Acá va un equipo chico
       con especialidades claras, que es lo que permite mostrar el flujo —a
       quién le llega el auto después de la recepción, quién lo pinta, quién lo
       entrega— y que cada perfil vea en su panel solo lo suyo.

       Nombres inventados. Ningún dato de ninguna persona real. */
    /* Cada persona entra al sistema con SU usuario y SU clave. El usuario es
       el correo o el número de ficha —los dos sirven, porque en el taller a la
       gente se la identifica por ficha y en la oficina por correo—.

       ⚠️ Las claves iniciales son de DEMOSTRACIÓN y están a la vista en la
          pantalla de ingreso, a propósito: esto corre en el navegador y una
          clave guardada acá la puede leer cualquiera que abra las herramientas
          del desarrollador. **Es un ingreso modelado, no una autenticación.**
          La de verdad vive en el servidor, con la clave cifrada y sin viajar
          nunca al navegador. No decimos "cumple" donde corresponde decir
          "está modelado, falta el servidor". */
    /* Las cuentas son POR ROL, no por persona (decisión del 13-08-2026). En un
       taller chico el sistema no lo abre "Marcelo": lo abre el que está en
       desabolladura ese día. Y en una demostración los nombres inventados
       distraen — la primera pregunta pasa a ser "¿quién es Marcelo?" en vez de
       "¿qué ve el que desabolla?".

       La única cuenta con nombre propio es la del administrador, porque es una
       sola persona y responde por todo.

       Cuando el sistema se ponga en marcha, cada cuenta de rol puede
       desdoblarse en una por persona sin cambiar nada: el motor ya trabaja con
       cuentas individuales, y las etapas y las órdenes cuelgan de la cuenta,
       no del rol. */
    const EQUIPO = [
      { nombre: 'Recepción',      rol: 'ro-1', etapas: [],
        cargo: 'Recepción y entrega' },
      { nombre: 'Jefe de taller', rol: 'ro-2', etapas: ['et-1', 'et-5', 'et-8', 'et-9'],
        cargo: 'Jefatura de taller', usuario: 'jefe' },
      { nombre: 'Desabolladura',  rol: 'ro-3', etapas: ['et-1', 'et-2', 'et-5'],
        cargo: 'Operario · Desabolladura' },
      { nombre: 'Pintura',        rol: 'ro-3', etapas: ['et-3', 'et-4', 'et-7'],
        cargo: 'Operario · Preparación y pintura' },
      { nombre: 'Bodega',         rol: 'ro-4', etapas: ['et-6', 'et-8'],
        cargo: 'Bodega y mecánica' },
      // El administrador también entra con usuario y clave: no hay una puerta
      // trasera sin credenciales, que es como se cuela el "entro yo nomás".
      { nombre: 'Gabriel', apellidos: 'Díaz', rol: 'ro-5', etapas: [],
        cargo: 'Administrador', usuario: 'gabriel.diaz' }
    ];

    const sinTildes = (t) => String(t).toLowerCase()
      .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
      .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/[^a-z]/g, '');

    EQUIPO.forEach((x, i) => {
      const id = 'pe-t-' + (i + 1);
      const corto = x.usuario || sinTildes(x.nombre);
      persona.push({
        id, tipo: 'trabajador', ficha: 1001 + i, rut: rutFalso(i + 1),
        usuario: corto + '@dyp.cl',
        // Clave inicial, declarada. Se cambia desde la ficha de la cuenta.
        clave: corto + '2026',
        clave_inicial: true,
        nombres: x.nombre, apellidos: x.apellidos || '', cargo: x.cargo,
        correo: corto + '@dyp.cl',
        telefono: '+56 9 0000 ' + String(1001 + i).slice(-4),
        direccion: 'Domicilio de ejemplo ' + (100 + i), comuna: 'Comuna de ejemplo',
        activo: true, demo: true
      });
      x.etapas.forEach((e) => persona_etapa.push({ persona_id: id, etapa_id: e }));
      persona_rol.push({ persona_id: id, rol_id: x.rol });
    });

    // Un usuario por rol, para poder demostrar el enmascaramiento.
    rol.forEach((r, i) => {
      const id = 'pe-u-' + r.codigo;
      persona.push({
        id, tipo: 'usuario', ficha: null, rut: rutFalso(500 + i),
        nombres: 'Usuario', apellidos: r.nombre, correo: r.codigo + '@ejemplo.cl',
        telefono: null, direccion: null, comuna: null, activo: true, demo: true
      });
      persona_rol.push({ persona_id: id, rol_id: r.id });
    });

    /* ═══════════════════════════════════════════════════════════════════
       PARÁMETROS DE NEGOCIO — no constantes en el código
       ═══════════════════════════════════════════════════════════════════ */

    const parametro = [
      { clave: 'meta_dias_reparacion', nombre: 'Meta de días de reparación', valor: 15, tipo: 'numero',
        ayuda: 'El objetivo declarado por el taller. Hoy el promedio de las órdenes abiertas es 18.' },
      { clave: 'kpi_reparacion', nombre: 'Qué reloj se mide contra la meta', valor: 'acumulado', tipo: 'opcion',
        opciones: [
          { valor: 'acumulado',      nombre: 'Reparación acumulada (el reloj se reanuda al reingresar)' },
          { valor: 'estadia_actual', nombre: 'Estadía actual (el reloj vuelve a cero al reingresar)' }
        ],
        ayuda: 'En la reunión se pidió que vuelva a cero. Los dos números se calculan siempre; esto elige cuál es el KPI.' },
      { clave: 'correlativo_ot', nombre: 'Próximo número de OT', valor: ULTIMA_OT + 1, tipo: 'numero',
        ayuda: 'Correlativo de cinco dígitos, sin año ni local. Al 12-08-2026 el sistema real iba por ' + ULTIMA_OT + '.' },
      { clave: 'iva', nombre: 'IVA', valor: 19, tipo: 'numero', ayuda: 'Porcentaje aplicado al neto del presupuesto.' },
      { clave: 'retencion_fotos_meses', nombre: 'Retención de fotografías (meses)', valor: 12, tipo: 'numero',
        ayuda: 'Hoy las fotos se borran al año POR FALTA DE DISCO, no por política. Acá es una decisión de negocio.' },
      /* Nadie en el taller sabe comprimir una foto, y no tiene por qué: lo hace
         el sistema al subirla. Pero queda como interruptor, porque si alguna
         vez hace falta el original íntegro —un peritaje, un juicio— hay que
         poder apagarlo sabiendo lo que cuesta en disco. */
      { clave: 'comprimir_fotos', nombre: 'Comprimir las fotos al subirlas', valor: 'si', tipo: 'opcion',
        opciones: [
          { valor: 'si', nombre: 'Sí — el sistema las achica solo (recomendado)' },
          { valor: 'no', nombre: 'No — guardar el archivo tal como viene' }
        ],
        ayuda: 'Con compresión, ~34 GB al año. Sin compresión, ~296 GB. Cálculo nuestro sobre supuestos.' },
      { clave: 'foto_lado_max', nombre: 'Lado largo de la foto (píxeles)', valor: 1600, tipo: 'numero',
        ayuda: 'A 1600 px una foto de taller se sigue viendo bien impresa y en pantalla.' },
      { clave: 'foto_objetivo_kb', nombre: 'Peso objetivo por foto (KB)', valor: 350, tipo: 'numero',
        ayuda: 'El sistema baja la calidad por pasos hasta llegar acá. Si no llega, guarda igual y lo dice.' }
    ];

    /* ═══════════════════════════════════════════════════════════════════
       OPERACIÓN — datos inventados, totales reales
       ═══════════════════════════════════════════════════════════════════ */

    const vehiculo = [], recepcion = [], orden_trabajo = [], ot_etapa = [], ot_estadia = [];
    const repuesto = [], presupuesto = [], presupuesto_linea = [], bitacora = [], media = [];
    const evento = [], dano = [], recepcion_inventario = [], ot_detencion = [], costo_adicional = [];

    const PATENTES = [];
    const L = 'BCDFGHJKLPRSTVWXYZ';
    for (let i = 0; i < 400; i++) {
      PATENTES.push(L[i % 18] + L[(i * 3) % 18] + L[(i * 7) % 18] + L[(i * 5) % 18] +
        String(10 + (i % 90)));
    }

    let nOT = ULTIMA_OT - (TOTAL_TORRE + TOTAL_HISTORICO) + 1;
    let seqRep = 0, seqPre = 0, seqEv = 0, seqBit = 0;

    // Quién puede hacer cada etapa. Se calcula una vez: son 89 trabajadores
    // por 9 etapas y crearOrden se llama 222 veces.
    const habilitados = {};
    etapa.forEach((e) => {
      habilitados[e.id] = persona_etapa.filter((p) => p.etapa_id === e.id).map((p) => p.persona_id);
    });

    /* Cómo se reparten las 102 vivas. Medido en reglas §C.7: son 53 sin
       ninguna etapa asignada ("Pendiente" / "Sin Asignar"). Las otras 49 se
       reparten en cinco etapas; Desarme, Pintura, Mecánica y Entrega no
       tienen ningún vehículo en este momento, y eso también se copia. */
    const REPARTO = [
      { etapa: null,    n: SIN_ETAPA },
      { etapa: 'et-2',  n: 12 },   // Desabolladura
      { etapa: 'et-5',  n: 11 },   // Armado
      { etapa: 'et-3',  n: 11 },   // Preparación
      { etapa: 'et-8',  n: 8 },    // Control de Calidad
      { etapa: 'et-7',  n: 7 }     // Terminación
    ];
    const plan = [];
    REPARTO.forEach((r) => { for (let i = 0; i < r.n; i++) plan.push(r.etapa); });

    /* Reparto de compañía y tipo de ingreso, medido en reglas §C.25:
       78 por compañía (74 SURA + 4 MAPFRE), 23 empresa, 1 particular.
       Las 24 sin compañía son exactamente las de empresa y particular. */
    const planTipo = [];
    for (let i = 0; i < 74; i++) planTipo.push({ tipo: 'ti-1', comp: 'co-1' });
    for (let i = 0; i < 4; i++)  planTipo.push({ tipo: 'ti-1', comp: 'co-2' });
    for (let i = 0; i < 23; i++) planTipo.push({ tipo: 'ti-3', comp: null });
    planTipo.push({ tipo: 'ti-2', comp: null });

    function nuevoCliente(i) {
      const id = 'pe-c-' + i;
      persona.push({
        id, tipo: 'cliente', ficha: null, rut: rutFalso(2000 + i),
        nombres: NOM[(i * 3) % NOM.length], apellidos: APE[(i * 7) % APE.length],
        correo: 'cliente' + i + '@ejemplo.cl', telefono: '+56 9 1111 ' + String(1000 + i).slice(-4),
        direccion: 'Domicilio de ejemplo ' + (200 + i), comuna: 'Comuna de ejemplo',
        activo: true, demo: true
      });
      return id;
    }

    /* Crea una orden completa: vehículo, recepción, OT, estadías, etapas,
       presupuesto, repuestos, bitácora y eventos. */
    function crearOrden(idx, { viva, etapaActual, tipo, comp, fuera, conRepPend }) {
      const numero_ot = nOT++;
      const ot_id = 'ot-' + numero_ot;
      const pat = PATENTES[idx % PATENTES.length];
      const ma = marca[idx % marca.length];
      const mos = modelo.filter((m) => m.marca_id === ma.id);

      const veh_id = 'veh-' + numero_ot;
      vehiculo.push({
        id: veh_id, patente: pat, marca_id: ma.id,
        modelo_id: mos.length ? mos[idx % mos.length].id : null,
        anio: 2015 + (idx % 11), color_id: color_vehiculo[idx % color_vehiculo.length].id,
        vin: 'VIN-DEMO-' + numero_ot
      });

      const cli_id = nuevoCliente(idx);
      /* Distribución sesgada: la mayoría de las órdenes vivas son recientes y
         hay una cola de casos antiguos. En el sistema real la columna `Días`
         va de 1 a 82 con promedio 18 — pero ese contador está roto y se
         reinicia al regrabar el estado, así que lo que se replica es la FORMA
         de la distribución, no el número. Un reparto plano daba promedios de
         60 días y dejaba 79 de 92 vehículos sobre la meta: irreal. */
      const s = rnd();
      const diasIngreso = viva
        ? (s < 0.62 ? entre(1, 22) : s < 0.86 ? entre(23, 55) : entre(56, 130))
        : entre(20, 210);
      const fecha_ingreso = dias(diasIngreso);

      /* Una recepción puede generar VARIAS órdenes. A-8: en el formulario de
         ingreso los campos son arreglos con botón +. Acá una de cada doce
         trae dos siniestros, para que el caso exista en la demostración. */
      const rec_id = 'rec-' + numero_ot;
      recepcion.push({
        id: rec_id, vehiculo_id: veh_id, cliente_id: cli_id, fecha: fecha_ingreso,
        km: entre(15, 220) * 1000, combustible: entre(0, 8),
        observaciones: '', firma_media_id: null, recibido_por: 'pe-u-recepcion'
      });
      inventario_item.forEach((it) => recepcion_inventario.push({
        recepcion_id: rec_id, item_id: it.id, presente: rnd() > 0.18, observacion: ''
      }));
      // Los daños son del vehículo al ingresar, así que cuelgan de la
      // recepción: si el auto trae dos siniestros, la silueta es una sola.
      const nD = entre(1, 4);
      for (let d = 0; d < nD; d++) dano.push({
        id: 'da-' + numero_ot + '-' + d, recepcion_id: rec_id, vista: 'superior',
        zona_id: zona_dano[entre(0, zona_dano.length - 1)].id,
        tipo_id: tipo_dano[entre(0, tipo_dano.length - 1)].id,
        severidad: entre(1, 3), x: rnd(), y: rnd(), descripcion: ''
      });

      const estadoCod = !viva ? (rnd() > 0.06 ? 'entrega_cliente' : 'entrega_sin_rep')
                              : (fuera ? 'fuera_taller' : 'recibido');
      const fecha_entrega_real = viva ? null : dias(entre(1, diasIngreso - 1));

      orden_trabajo.push({
        id: ot_id, numero_ot, recepcion_id: rec_id, vehiculo_id: veh_id, cliente_id: cli_id,
        tipo_ingreso_id: tipo, compania_id: comp,
        siniestro: comp ? 'SIN-' + numero_ot : null,
        deducible: comp ? entre(0, 8) * 25000 : 0,
        liquidador: comp ? NOM[idx % NOM.length] + ' ' + APE[idx % APE.length] : null,
        prioridad_id: rnd() > 0.88 ? 'pri-2' : 'pri-1',
        fecha_ingreso, fecha_compromiso: dias(diasIngreso - entre(15, 25)),
        fecha_entrega_real, estado: estadoCod,
        /* Quién responde por el vehículo completo: recepción o jefe de taller,
           que son los dos que pueden presupuestarlo y hacerlo avanzar. Antes
           entraba bodega en el reparto y quedaba con 26 autos "a mi cargo",
           que no es lo que hace bodega. Una de cada cuatro queda SIN
           responsable: son las que hay que asignar, y sin ellas la pantalla
           del jefe no tendría nada pendiente que mostrar. */
        responsable_id: idx % 4 === 0 ? null : ['pe-t-1', 'pe-t-2'][idx % 2],
        observaciones_ingreso: '', demo: true
      });

      /* ── Las estadías. Es la tabla que arregla el contador de días ──────
         Una de cada cinco órdenes vivas ya salió y volvió: eso es lo que en
         el sistema actual borraba el reloj y acá queda como dos filas con
         fecha. Con esto los tres relojes dan números distintos y se puede
         mostrar la diferencia en pantalla. */
      const salioYVolvio = viva && !fuera && idx % 5 === 0 && diasIngreso > 30;
      if (salioYVolvio) {
        // Inspección corta, se lo lleva el cliente mientras llegan las piezas,
        // y vuelve. Totales grandes con reparación chica: es EXACTAMENTE el
        // caso que el contador del sistema actual no sabe contar.
        const dentro1 = entre(4, 10);
        const actual = entre(2, 12);
        ot_estadia.push({ id: 'est-' + numero_ot + '-1', ot_id, entro_at: fecha_ingreso,
          salio_at: dias(diasIngreso - dentro1), motivo_salida: 'espera_repuesto' });
        ot_estadia.push({ id: 'est-' + numero_ot + '-2', ot_id,
          entro_at: dias(actual), salio_at: null, motivo_salida: null });
      } else if (fuera) {
        const dentro1 = Math.min(entre(3, 10), Math.max(1, diasIngreso - 1));
        ot_estadia.push({ id: 'est-' + numero_ot + '-1', ot_id, entro_at: fecha_ingreso,
          salio_at: dias(diasIngreso - dentro1), motivo_salida: 'espera_repuesto' });
      } else {
        ot_estadia.push({ id: 'est-' + numero_ot + '-1', ot_id, entro_at: fecha_ingreso,
          salio_at: viva ? null : fecha_entrega_real, motivo_salida: null });
      }

      evento.push({ id: 'ev-' + (++seqEv), ot_id, fecha: fecha_ingreso, tipo: 'estado',
        detalle: 'Ingreso del vehículo. Estado: Recibido', etapa_id: null, persona_id: 'pe-u-recepcion' });

      /* Etapas asignadas. 53 órdenes no tienen ninguna: esas van a la
         pantalla de asignar, las demás a la de finalizar.
         El responsable de cada etapa cerrada sale del grupo de trabajadores
         habilitados para ESA etapa — que es el único modelo de permisos que
         el sistema actual tiene de verdad. Sin esto la nómina sale vacía. */
      if (etapaActual) {
        const hasta = etapa.find((e) => e.id === etapaActual).orden;
        etapa.filter((e) => e.orden <= hasta && e.aplica_siempre).forEach((e) => {
          const cerrada = e.orden < hasta;
          const gente = habilitados[e.id] || [];
          const resp = gente.length ? gente[(idx + e.orden) % gente.length] : null;
          const cuando = dias(Math.max(1, diasIngreso - e.orden * 2));
          /* Una etapa CERRADA siempre tiene responsable: alguien la hizo. Una
             abierta, no necesariamente — el auto está en pintura y todavía
             nadie lo agarró. Ese es el estado que la pantalla "Mi trabajo"
             ofrece para tomar, y si la semilla dejara todas asignadas no
             habría nada que mostrar. Dos de cada tres abiertas quedan libres. */
          const suelta = !cerrada && (idx + e.orden) % 3 !== 0;
          ot_etapa.push({
            id: 'oe-' + numero_ot + '-' + e.orden, ot_id, etapa_id: e.id,
            asignada_at: dias(diasIngreso - 1),
            salio_at: cerrada ? cuando : null,
            persona_id: suelta ? null : resp, observacion: ''
          });
          if (cerrada) evento.push({ id: 'ev-' + (++seqEv), ot_id,
            fecha: cuando, tipo: 'etapa',
            detalle: 'Completado', etapa_id: e.id, persona_id: resp });
        });
      }

      /* Costos adicionales: aparecen después del presupuesto y alguien los
         paga. Una de cada seis órdenes trae uno, para que la pantalla tenga
         qué mostrar. */
      if (idx % 6 === 0) costo_adicional.push({
        id: 'ca-' + numero_ot, ot_id,
        descripcion: elegir(['Flete de repuesto', 'Pulido adicional', 'Insumos de pintura',
          'Grúa', 'Traslado a tercero']),
        monto: entre(8, 90) * 1000,
        responsable_pago_id: rnd() > 0.5 ? 'rp-2' : 'rp-1', fecha: dias(Math.max(1, diasIngreso - 3))
      });

      /* Una de cada ocho órdenes vivas todavía no tiene presupuesto: el auto
         entró y nadie lo ha valorizado. Es un caso real y es lo que hace útil
         el indicador de "sin presupuesto" — esas son órdenes que el taller
         **no puede cobrar todavía**.
         Ojo: solo se salta el presupuesto. Los repuestos y la bitácora siguen,
         porque de ellos dependen las cifras de control. */
      const sinPresupuesto = viva && idx % 8 === 3;

      /* Presupuesto con OR compuesta: <OT>-<id_reparacion>-<NNN>. */
      const id_reparacion = 18000 + (numero_ot % 900);
      const pid = 'pr-' + (++seqPre);
      const nL = sinPresupuesto ? 0 : entre(2, 6);
      let neto = 0;
      for (let l = 0; l < nL; l++) {
        const proceso = elegir(['cambio', 'reparar', 'externo']);
        const horas = proceso === 'reparar' ? entre(1, 12) * 0.5 : null;
        const cant = 1;
        // La mano de obra se cotiza por trabajo, no por hora. Las horas quedan
        // como estimación y no multiplican nada — ver la nota del tempario.
        const venta = proceso === 'reparar' ? entre(8, 60) * 5000
                                            : entre(12, 380) * 1000;
        presupuesto_linea.push({
          id: pid + '-l' + (l + 1), presupuesto_id: pid, orden: l + 1, proceso,
          descripcion: elegir(['Paragolpes delantero', 'Tapabarro izquierdo', 'Foco delantero derecho',
            'Puerta trasera izquierda', 'Capó', 'Espejo lateral derecho', 'Parabrisas',
            'Maletero', 'Rejilla frontal', 'Moldura lateral']),
          horas, cantidad: cant, precio_unitario: venta
        });
        neto += venta * cant;
      }
      const ivaPct = 19;
      if (sinPresupuesto) { seqPre--; } else
      presupuesto.push({
        id: pid, ot_id, id_reparacion, correlativo: 1,
        numero_or: Reglas.formatoOR(numero_ot, id_reparacion, 1),
        version: 1, estado: viva ? elegir(['borrador', 'enviado', 'aprobado']) : 'aprobado',
        neto, iva: Math.round(neto * ivaPct / 100), total: Math.round(neto * (1 + ivaPct / 100)),
        enviado_at: null, resuelto_at: null
      });

      /* Repuestos. Los dos hitos van como FECHAS, no como booleanos: es la
         corrección que permite medir cuánto demora un repuesto — con los
         booleanos del original eso no se puede calcular. §C.14. */
      if (conRepPend || rnd() > 0.55) {
        const n = entre(1, 3);
        for (let r = 0; r < n; r++) {
          const llego = conRepPend ? (r > 0 && rnd() > 0.5) : true;
          repuesto.push({
            id: 'rep-' + (++seqRep), ot_id, presupuesto_linea_id: null,
            descripcion: elegir(['Paragolpes delantero', 'Óptico derecho', 'Tapabarro izquierdo',
              'Moldura puerta', 'Rejilla inferior', 'Espejo eléctrico', 'Emblema trasero']),
            cantidad: 1, responsable_pago_id: rnd() > 0.78 ? 'rp-2' : 'rp-1',
            fecha_solicitud: dias(Math.max(1, diasIngreso - 2)),
            fecha_bodega: llego ? dias(Math.max(0, diasIngreso - entre(3, 20))) : null,
            fecha_entrega_area: llego && rnd() > 0.4 ? dias(Math.max(0, diasIngreso - entre(1, 10))) : null,
            observacion: '', recibido_por: llego ? 'pe-u-bodega' : null
          });
        }
      }

      /* Bitácora: es lo que enciende las banderas de la columna Alerta.
         La distribución copia la medida sobre las 102 órdenes: E 91, A 81,
         O 72, R 3, C 1, P 0. §C.16. */
      const asuntos = [];
      if (rnd() < 0.90) asuntos.push('as-1');   // Envio
      if (rnd() < 0.80) asuntos.push('as-2');   // Autorizado
      if (rnd() < 0.71) asuntos.push('as-3');   // Otro
      if (rnd() < 0.03) asuntos.push('as-4');   // Repuestos
      if (rnd() < 0.01) asuntos.push('as-5');   // Correcciones
      asuntos.forEach((a) => bitacora.push({
        id: 'bit-' + (++seqBit), ot_id, asunto_id: a, mensaje: 'Mensaje de demostración.',
        destinatario_id: 'pe-u-admin', autor_id: 'pe-u-recepcion',
        fecha: dias(Math.max(1, diasIngreso - entre(1, 5))), alerta_apagada: false
      }));

      return ot_id;
    }

    // Las 102 vivas.
    const fueraIdx = new Set();
    while (fueraIdx.size < FUERA_DE_TALLER) fueraIdx.add(entre(0, TOTAL_TORRE - 1));
    const repIdx = new Set();
    while (repIdx.size < CON_REPUESTO_PENDIENTE) repIdx.add(entre(0, TOTAL_TORRE - 1));

    for (let i = 0; i < TOTAL_TORRE; i++) {
      crearOrden(i, {
        viva: true, etapaActual: plan[i],
        tipo: planTipo[i].tipo, comp: planTipo[i].comp,
        fuera: fueraIdx.has(i), conRepPend: repIdx.has(i)
      });
    }

    // El histórico.
    for (let i = 0; i < TOTAL_HISTORICO; i++) {
      crearOrden(TOTAL_TORRE + i, {
        viva: false, etapaActual: 'et-9',
        tipo: i % 5 === 0 ? 'ti-3' : 'ti-1', comp: i % 5 === 0 ? null : 'co-1',
        fuera: false, conRepPend: false
      });
    }

    return {
      // catálogos
      etapa, etapa_prerrequisito, estado, compania, tipo_ingreso, prioridad,
      asunto_bitacora, responsable_pago, motivo_detencion,
      color_vehiculo, marca, modelo, inventario_item, tipo_dano, zona_dano,
      // acceso
      rol, permiso, rol_permiso, persona, persona_rol, persona_etapa,
      // parámetros
      parametro,
      // operación
      vehiculo, recepcion, recepcion_inventario, dano, orden_trabajo,
      ot_etapa, ot_estadia, ot_detencion, costo_adicional,
      presupuesto, presupuesto_linea, repuesto, bitacora, media, evento,
      // idempotencia
      operacion: []
    };
  }

  return {
    generar, CATALOGO_PERMISOS,
    TOTAL_TORRE, CON_REPUESTO_PENDIENTE, FUERA_DE_TALLER, SIN_ETAPA,
    TRABAJADORES, EQUIPO_DEMO, TOTAL_HISTORICO, ULTIMA_OT
  };
})();
