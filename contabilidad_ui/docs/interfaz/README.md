# La interfaz de contabilidad, contada para volver a construirla

Este documento describe **qué hace la interfaz y por qué**, no cómo está
escrita en React. Sirve para rehacerla en otra plataforma —escritorio, móvil,
otro framework— sin tener que leer el código ni volver a discutir con el
backend lo que ya está decidido.

Regla al leerlo: **lo que aquí se cuenta como comportamiento está acordado**.
Los textos que aparecen entrecomillados están aprobados por el usuario y se
copian tal cual; cambiar uno es una decisión suya, no del que porta la interfaz.

## Índice

- `arranque.md` — entrar, elegir empresa y ejercicio, y qué se pide al empezar.
- `transversal.md` — dinero, fechas, errores, permisos, rejillas y teclado.
  Es lo primero que hay que portar: lo demás se apoya en ello.
- `diario.md` — el libro diario, el filtro, el editor de asientos y el traspaso.
- `eliminados.md` — los asientos que salieron del libro.
- `plan.md` — el plan contable y el enlace con facturación.
- `mayor.md` — los movimientos de una cuenta, con su saldo.
- `balances.md` — sumas y saldos y los estados contables (balance y pérdidas y
  ganancias, en una pantalla de dos pestañas).
- `traspasos.md` — pasar a asientos las facturas de facturación.
- `ejercicios.md` — abrir y bloquear ejercicios; periodos.
- `cierre.md` — regularizar, cerrar el ejercicio y abrir el siguiente.
- `configuracion.md` — cuentas por defecto y datos fijos de la empresa.
- `inmovilizado.md` — los bienes que se amortizan y su cuadro de amortización.
- `importador.md` — importar asientos de CSV y Excel.
- `conexiones.md` — la conexión con Codiplika.
- `fiscal.md` — el IVA del periodo, las retenciones y el cuadre con
  facturación. El modelo 303 todavía no está.

## Lo que hay que entender antes de nada

**Toda la lógica de negocio vive en la API.** La interfaz no calcula importes,
no valida reglas contables, no decide si un asiento cuadra ni si una cuenta
existe. Cuando algo hace falta y la API no lo da, se le pide al backend; no se
resuelve en el cliente. La única cuenta que se echa aquí es el total de una
columna que se está viendo en pantalla.

Esto no es purismo: es lo que hace que dos interfaces distintas —esta y la que
se porte— se comporten igual. En cuanto una de las dos empiece a decidir por su
cuenta, dejarán de coincidir en los casos raros, que en contabilidad son los
que importan.

**La API es toda POST con cuerpo JSON**, incluidas las lecturas, y los
identificadores viajan en el cuerpo, nunca en la URL. Un cuerpo con un campo de
más devuelve 422: los modelos son estrictos. Un 422 siempre es un fallo de la
interfaz.

**La sesión es una cookie HttpOnly.** No hay cabecera de autorización, no se lee
ni se guarda el token, y no hay lógica de refresco: el servidor lo renueva en
cada petición. La empresa activa viaja dentro del token, no en el cuerpo.

## Estado de este documento

Escrito el 28/08/2026 sobre lo que hay implementado ese día, **puesto al día
el 01/09/2026** con las pantallas que faltaban por documentar —los balances, el
traspaso de facturas y el cierre de ejercicio— y el 02/09/2026 con IVA y
retenciones.

Lo que todavía no existe está en `../planificacion/pendientes.md`, y el porqué de
las decisiones que condicionan el código, en `../planificacion/decisiones.md`.
