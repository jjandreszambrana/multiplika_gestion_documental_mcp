# Proyecto: UI de contabilidad (Multiplika SIF)

> **Copia para la gestión documental (2026-10-10).** Esta carpeta es una copia
> completa de `/home/jjandres/desarrollos/python3/multiplika_conta_ui` (commit
> 9ea0920), hecha por decisión del usuario para trabajarla **solo para la GD**.
> A partir de aquí evoluciona por separado: lo que se cambie aquí no llega a la
> app de contabilidad independiente, ni al revés.
>
> - Plan de integración: `../docs/contabilidad/planificacion.md`, fase 5.
> - Notas de desarrollo de la app original (vocabulario del contable, textos
>   aprobados, reglas de pantallas...): `docs/notas_desarrollo/`. Siguen
>   valiendo aquí.
> - Se ha quitado `scripts/desplegar.sh`: esta copia no se despliega en
>   `contabilidad-dev`; se compila dentro del panel de la GD. Lo que dice más
>   abajo sobre despliegue es de la app original.
> - Las peticiones al backend del SIF siguen por el canal compartido
>   (`multiplika_compartida/contabilidad/prompts/`), diciendo que vienen de la GD.

## Contexto

Cliente web del módulo de contabilidad de Multiplika SIF. Toda la lógica de
negocio (cálculos, validaciones contables, cuadres, generación de asientos) ya
está implementada en la **Multiplika SIF API** (FastAPI + Pydantic), que además
de contabilidad cubre facturación VeriFactu, cobros, pedidos y lotes.

Este repositorio es **únicamente la interfaz**. Stack: React + TypeScript + Vite.

### Dónde está la documentación de la API

- **`docs/contexto/api_para_frontend.md`** — guía detallada del módulo contable
  escrita desde el código del backend: endpoints, cuerpos exactos, forma de las
  respuestas, permisos, errores y lo que todavía no existe. **Es la primera
  fuente a consultar.**
- **`docs/interfaz/`** — qué hace cada pantalla y por qué, escrito para poder
  rehacer la interfaz en otra plataforma. Se actualiza al terminar una pantalla
  o al cambiar un comportamiento acordado.
- **`docs/planificacion/PLAN.md`** — alcance, fases y estado actual. Se lee al
  planificar o al retomar, y se actualiza al terminar una fase.
- **`docs/planificacion/decisiones.md`** — por qué se hizo así y qué se
  descartó. Se añade un bloque cuando una decisión condiciona código futuro.
- Especificación viva: `https://facturae.multiplika.net/apisif/openapi.json`
  (OpenAPI 3.1). Interfaz de exploración en `/apisif/swagger`.
- Si el documento y el OpenAPI discrepan, manda el OpenAPI y hay que avisarlo.

**El código del backend no está en este espacio de trabajo.** Es un proyecto
Python aparte. Si detectas que hace falta un cambio en la API, **dímelo y
detente**: no se parchea aquí. Ver también la regla 1.

### Forma de la API

- Prefijo de rutas: `/apisif/v1/...`
- **Todo es POST con cuerpo JSON, incluidas las lecturas.** Los endpoints sin
  parámetros exigen igualmente cuerpo `{}`. Única excepción:
  `GET /apisif/v1/usuarios/me`.
- Los filtros y los identificadores viajan en el cuerpo, nunca en la URL ni en
  query params. Tenlo en cuenta al montar la capa de datos y la caché.
- Los cuerpos llevan `extra="forbid"`: un campo de más devuelve **422**, no se
  descarta en silencio. Un 422 es siempre un error de programación del frontend.

### Autenticación: cookie, no cabecera

- El servidor usa una cookie `access_token` con JWT (HttpOnly, SameSite=strict,
  Secure en https, path `/`). **No hay cabecera `Authorization`.**
- Login: `POST /apisif/v1/usuarios/login`, con `username` + `password`, o bien
  `username` + `api_key` + `api_secret`. El token **no viene en el cuerpo**.
- Logout: `POST /apisif/v1/usuarios/logout`, que borra la cookie.
- Rutas abiertas: login, swagger, redoc y openapi.json. El resto exige cookie.
- Estado de sesión: `GET /apisif/v1/usuarios/me`, que devuelve
  `{"user": {…payload del JWT…, "modulos": {…}}}` o un 401. Es la primera
  llamada al arrancar la aplicación.

**Lo único que tiene que hacer el frontend es enviar las cookies:**
`credentials: "include"` en fetch.

Prohibiciones, que son las que suelen incumplirse:

- **NO leas, guardes ni manipules el token.** Es HttpOnly: JavaScript no puede
  verlo, y no debe intentarlo. Nada de localStorage, sessionStorage ni estado.
- **NO montes temporizadores ni lógica de refresco de token.** El servidor lo
  renueva solo en cada petición. No hay refresh token.
- Ante un **401**: se redirige a login y ya está. Sin reintentos.
- `SameSite=strict` obliga a servir el frontend desde el **mismo dominio** que
  la API. En desarrollo eso se resuelve con el proxy de Vite (ver más abajo);
  no hay alternativa con CORS.

### Empresa activa

La empresa activa **viaja dentro del token** (claim `conta_id_obligado`), no en
el cuerpo de las peticiones. **No añadas un `id_obligado` a las llamadas de
contabilidad** — daría 422. La única excepción es `/contabilidad/empresa/activar`.

- Se selecciona con `POST /apisif/v1/contabilidad/sesion/conmutar`, que reemite
  la cookie y devuelve `{"id_obligado", "nivel"}`.
- **Hasta que no se conmuta, los endpoints de contabilidad responden 409.**
  El 409 significa "falta elegir empresa", nunca un error genérico ni una
  pantalla vacía: se lleva al selector de empresa.

El backend arregló el 25/08/2026 la renovación del token, que antes perdía ese
claim a los cinco minutos. **Ya no hay ningún reintento en este proyecto**, ni
se guarda la empresa en `localStorage`: el token la conserva. Si vuelven los
409 espontáneos, es una regresión del backend, no algo que se parchee aquí.

### Arranque de la aplicación

1. `GET /usuarios/me` → quién es y su `id_rol`. **Es GET**, pese a que el
   apartado 14.1 de la guía diga POST; manda el OpenAPI.
2. `POST /contabilidad/sesion/empresas` (cuerpo `{}`) →
   `{"activa", "puede_conmutar", "empresas": [{id_obligado, NombreRazon, NIF, nivel}]}`.
   - Lista vacía → el usuario no tiene contabilidad: no se pinta el menú del módulo.
   - Una sola y `puede_conmutar: false` → entra directo, sin selector.
   - Varias → selector de empresa.
3. `POST /contabilidad/sesion/conmutar` con el id elegido → guarda el `nivel`.

4. `POST /contabilidad/configuracion/obtener` → ancho de cuenta, plan vigente,
   diarios, cuentas por defecto y lo que falta por configurar.
5. `POST /contabilidad/ejercicios/listar` → selector de ejercicio.

**La configuración se pide una vez, al entrar y al conmutar de empresa, y vive
en el estado de la aplicación.** No la pidas pantalla por pantalla: el ancho de
cuenta y el plan vigente se pasan como propiedad. `/configuracion/fijar_cuentas`
ya devuelve la versión actualizada, así que tampoco hay que volver a pedirla.

`cuentas_sin_poner` y `avisos` no son decorado: la primera lista cuentas
obligatorias que faltan, y sin ellas la contabilización automática falla; la
segunda dice qué deja de funcionar por cada cuenta opcional vacía.
`ejercicios_abiertos: 0` significa que no se puede apuntar en ningún sitio.

**Para quien puede conmutar, el nombre y el NIF de la empresa activa tienen que
estar visibles en todas las pantallas del módulo.** Apuntar en la empresa
equivocada es el error humano más caro de esta aplicación.

### Permisos: cuatro niveles acumulativos

`consulta` < `apuntes` < `cierre` < `admin`. El nivel llega en la conmutación y
en cada elemento de `/sesion/empresas`; no hay que pedirlo aparte.

| Nivel | Qué se ve |
|---|---|
| `consulta` | Diario, asientos, informes, fiscal, inmovilizado, pendientes y anulaciones. **Todo en solo lectura** |
| `apuntes` | Lo anterior + crear/corregir/borrar asientos, contabilizar periodo, reintentar pendientes, revertir anulaciones, alta/baja/dotación de inmovilizado |
| `cierre` | Lo anterior + abrir ejercicio, cerrar ejercicio, asiento de apertura |
| `admin` | Lo anterior + pantalla de accesos |

**Esconder, no deshabilitar y dejar que falle.** Un 403 en pantalla significa que
la interfaz mostró algo que no debía.

### Tipos: generados, nunca escritos a mano

```
npm run api:types
```

que ejecuta:

```
npx openapi-typescript https://facturae.multiplika.net/apisif/openapi.json -o src/api/types.ts
```

- `src/api/types.ts` es **generado**. No lo edites nunca a mano.
- Si necesitas un tipo que no está ahí, dímelo: se arregla en el backend y se
  regenera, no se parchea aquí.
- Tras cualquier cambio en la API, regenerar y arreglar lo que marque el
  compilador.

---

## Reglas innegociables

### 1. Nada de lógica de negocio en el frontend

- No recalcular, no validar reglas contables, no derivar importes que la API
  ya devuelve.
- Si hace falta un cálculo que la API no expone, **pregúntame antes**. La
  respuesta correcta casi siempre es añadir un endpoint, no resolverlo aquí.
- Leer el cálculo en la documentación del backend **no autoriza a replicarlo aquí**.
- Excepción única: totales de una columna visible en pantalla, y aun así
  usando decimal.js.

### 2. Dinero: decimal.js, nunca `number`

- Todo importe se maneja como `Decimal` de decimal.js.
- Prohibido el tipo `number` de JavaScript para dinero, en cualquier punto:
  variables, estado, props, cálculos intermedios.
- **Al enviar, los importes van como CADENA**: `"121.23"`, no `121.23`. Aplica a
  `debe`, `haber`, `valor_adquisicion`, `porcentaje_anual`, `importe_venta`…
  Punto decimal, formato inglés: el formato español es solo para mostrar.
- **Al recibir, la API puede devolver un importe como número o como cadena.**
  La capa de cliente normaliza ambos casos a `Decimal` en un único punto.
  Ningún componente recibe jamás un importe sin normalizar.
- Redondear **solo en el momento de mostrar**. Jamás en un paso intermedio.
- Redondeo a 2 decimales, modo `ROUND_HALF_UP`.

### 3. Tipado estricto

- `any` está prohibido. Si no sabes el tipo, pregúntame.
- Toda respuesta de la API tiene su tipo declarado en `src/api/types.ts`.
- **No inventes nombres de campos.** Si no tienes la especificación del
  endpoint delante, míralo en `docs/contexto/api_para_frontend.md` o en el
  OpenAPI. Si no está en ninguno de los dos, pídemelo.
- `strict: true` en tsconfig. No relajarlo para que algo compile.

### 3b. El punto en un código de cuenta es un comodín

Escribiendo `431.10` el contable quiere decir `431000010`: el punto se rellena
con ceros hasta completar el ancho de cuenta de la empresa. Vale en **cualquier
sitio donde se teclee una cuenta**: buscador del plan, alta de subcuenta y
entrada de asientos.

- Vive en `src/lib/cuenta.ts` (`expandirCuenta`), con tests. No lo repitas.
- El ancho **no se fija en el código**: sale de `anchocuentas`, que devuelve
  `/contabilidad/plan/preferencias`. Cada empresa puede tener el suyo.
- Se expande al salir del campo, para que el usuario vea el código resultante
  antes de que se use.
- Si el resultado no cabe en el ancho, se deja lo tecleado y que la API decida:
  aquí no se valida si una cuenta existe.

### 4. Formato español

- Decimales con coma, miles con punto: `1.234,56`
- Fechas `dd/mm/aaaa` al mostrar; `aaaa-mm-dd` al enviar a la API.
- El formateo vive en un módulo único (`src/lib/format.ts`), y las fechas en
  `src/lib/fecha.ts`. No formatear suelto dentro de los componentes.

### 4b. Los ficheros que se bajan llevan la fecha y la hora en el nombre

Todo fichero que el usuario se descarga termina en `_ddmmaaaahhmmss` antes de
la extensión: `balance_pyg_01092025062401.xlsx`,
`mayor_2026_430000001_01092025062401.xlsx`.

Sin eso, bajar el mismo informe dos veces deja dos ficheros con el mismo nombre
y el segundo pisa al primero, o el navegador le pega un `(1)` que no dice nada.
Un contable baja el mismo balance varias veces en una tarde, y necesita saber
cuál es cuál.

- Vive en `src/lib/descarga.ts` (`nombreDeFichero`, `marcaDeTiempo`), con tests.
  **No compongas ningún nombre suelto en una pantalla.**
- La hora es la del ordenador del usuario, no la del servidor: es él quien mira
  la carpeta de descargas.
- **El nombre lo pone siempre la aplicación, nunca el servidor.** La cabecera
  `Content-Disposition` se ignora a propósito: no lleva la marca de tiempo.
- Vale para cualquier formato que se añada, no solo Excel.

### 5. Dependencias

- No añadas ninguna librería sin preguntarme antes.
- Solo licencias MIT o Apache 2.0. Nada de licencia comercial ni dual.
- Descartadas por licencia, no las propongas: Handsontable, PrimeReact
  (desde la v11 pasa a licencia PrimeUI, no abierta), AG Grid Enterprise.

### 5b. Librerías de UI — fijadas, no cambiar

- **Mantine 8.3.x** para componentes generales (`@mantine/core`,
  `@mantine/hooks`, `@mantine/dates`), la misma que el panel de la GD.
- **mantine-react-table 2.0.0-beta.9** para TODAS las rejillas de datos.
- **decimal.js 10.6.0** para importes.
- Arrastradas por MRT v2, no se instalan por gusto: `@tabler/icons-react`,
  `clsx`, `dayjs`.

**Mantine 8 desde el 2026-10-10** (fase 5, para montar las pantallas dentro del
panel de la GD, que usa Mantine 8). mantine-react-table v2 sigue declarando
`@mantine/core: ^7.9` y no hay versión que declare la 8, así que `package.json`
lleva un bloque `overrides` que le hace aceptar la 8 (igual en el panel). Desde
Mantine 8 el `DateInput` devuelve `aaaa-mm-dd` en cadena: `CasillaFecha` lo
convierte a `Date` y el resto de la aplicación no cambia. No actualices Mantine
"porque hay una versión nueva": la rejilla manda.

**Aviso sobre versiones de MRT:** hay dos ramas incompatibles. MRT v1 exige
Mantine 6; MRT v2 exige Mantine 7.9+. Mucha documentación que circula por
internet es de la rama antigua. Usa SIEMPRE la v2 y, si un ejemplo no encaja,
comprueba de qué rama viene antes de adaptarlo. No mezcles ejemplos de v1 y v2.

- **NO instales `@tanstack/react-table` por separado.** Viene como dependencia
  interna de mantine-react-table, con versión exacta fijada. Instalarlo aparte
  provoca conflictos de versiones.
- No introduzcas ninguna otra librería de componentes. Nada de mezclar
  Ant Design, Material UI, shadcn ni Bootstrap con Mantine.

### 5c. Todas las rejillas se ven igual

Las opciones comunes viven en `src/components/tabla.ts` (`opcionesDeTabla`) y
**toda rejilla nueva parte de ahí**, no se configura desde cero:

- Densidad `xs` y 4px de relleno vertical: son listados largos que se recorren
  buscando una fila, y cuantas más quepan de una vez, menos paginación.
- Cabecera fija y scroll solo en las filas (`enableStickyHeader`, contenedor a
  `60vh`): al bajar por un listado no se pierde de vista qué columna es cuál.
- `layoutMode: 'grid'`, que es lo que hace caso a los anchos de columna.
- Sin acciones de columna, sin ordenación y sin barra superior, salvo que la
  pantalla las pida.

Reparto del ancho: **una sola columna crece**. Códigos, marcas, importes y la
columna de acciones llevan ancho corto y `grow: false`; la columna de texto
largo (el título, la razón social) lleva `grow: true` y `CELDA_QUE_CRECE`, que
la deja partir en varias líneas. El resto se queda en una línea a propósito.

La fila va apretada a propósito —densidad `xs` y 4px de relleno vertical—,
que es lo que se espera de un programa contable. Lo que hay dentro de una fila
se pone pequeño para que quepa (`ActionIcon size="sm"`, `Badge size="xs"`): si
un control es más alto que la fila, la celda lo recorta y desaparece.

### 5d. Puntos suspensivos en lo que abre un diálogo

Todo botón o elemento de menú que **abre un formulario o una confirmación**
termina en puntos suspensivos: `Nueva subcuenta…`, `Asignar…`, `Actualizar…`,
`Retirar…`. Los que ejecutan la acción directamente, no: `Guardar`, `Cancelar`,
`Volver a revisar`.

Es la convención de siempre en aplicaciones de escritorio y dice al usuario si
va a pasar algo ya o si todavía le van a preguntar. En un programa contable, esa
diferencia importa antes de tocar un botón.

### 5e. Un texto decidido no se toca

Los mensajes, títulos y descripciones que el usuario ha dado por buenos **no se
reescriben sin pedírselo**, ni al refactorizar, ni al mover el componente a otro
sitio, ni «de paso» porque suene mejor de otra forma. Si hay un motivo para
cambiar uno, se propone y se espera.

Vale también para los textos que vienen del backend: en un 400, el `detail` se
muestra tal cual.

### 5f. Ningún texto de formulario se pone sin aprobarlo antes

**Regla fundamental de este desarrollo.** Todo texto que vaya a leer el usuario
dentro de un formulario o un diálogo —etiqueta de un campo, texto de ayuda
debajo, aviso, texto de un botón, título del diálogo, mensaje de confirmación—
**se propone antes de escribirlo en el código y se espera a que el usuario lo
apruebe.**

Cómo se propone:

- La lista de los textos, tal cual van a salir en pantalla.
- Al lado de cada uno, **en una frase y sin tecnicismos**, qué hace ese control
  y por qué está ahí. Si hace falta nombrar un campo de la API o un endpoint
  para explicarlo, es señal de que la explicación no vale.
- Si un control no se sabe explicar en una frase clara, **el control sobra**.
  No se pone y se pregunta.

Se aprueba antes de escribir el componente, no después. Corregir textos ya
puestos cuesta más tiempo que acordarlos, y es tiempo del usuario.

Vale también al mover, partir o rehacer un componente: lo aprobado se copia tal
cual (ver 5e) y lo nuevo se pregunta.

### 5g. Fechas: siempre `CasillaFecha`, nunca `DateInput`

Toda casilla donde se teclee o se elija una fecha usa
`src/components/CasillaFecha.tsx`. **No pongas un `DateInput` de Mantine suelto
en ninguna pantalla**, ni siquiera «solo por esta vez».

Motivo: el `DateInput` a pelo entiende lo tecleado a la americana y un
`03/09/2026` se convierte en 9 de marzo, sin avisar. `CasillaFecha` ya trae
`valueFormat="DD/MM/YYYY"` y el `dateParser` correcto, y admite todas las
propiedades del `DateInput` (`label`, `clearable`, `minDate`, `w`…).

El parseo vive en `src/lib/fecha.ts` (`parsearFechaEscrita`), con tests: acepta
`dd/mm/aaaa`, con guiones o puntos, sin ceros a la izquierda (`3/9/26`) y del
tirón (`030926`). Mientras la fecha esté a medias o no exista en el calendario
(31/02) devuelve `null` y la casilla deja seguir escribiendo. No lo repitas ni
lo esquives.

Los meses y los días salen **en español** por el `DatesProvider` de
`src/main.tsx` (`locale: 'es'`, semana empezando en lunes), que necesita el
`import 'dayjs/locale/es'` de al lado. Sin ese import el calendario vuelve al
inglés: no lo quites.

### 6. Errores visibles

- Ningún `catch` vacío ni error silenciado.
- Si una llamada a la API falla, la pantalla lo dice. Nunca se muestra una
  tabla vacía como si no hubiera datos.
- Distinguir siempre: "no hay resultados" vs "no se pudo cargar".
- La API tiene **dos formas de error**: los endpoints devuelven
  `{"detail": "..."}` y el middleware de sesión devuelve
  `{"success": false, "status_code": 401, "message": "Token no encontrado", …}`.
  `src/api/cliente.ts` acepta las dos y deja el texto en `ErrorApi.detalle`. En un **400** ese
  texto está escrito para el contable: **muéstralo tal cual**, no lo sustituyas
  por un mensaje genérico. Ejemplos reales:
  `El asiento no cuadra: debe 121.23 y haber 100.00`,
  `El ejercicio 2025 esta cerrado.`,
  `El periodo 03/2026 ya esta presentado y no admite apuntes.`

Manejo por código:

| Código | Qué hacer |
|---|---|
| 400 | Mostrar `detail` tal cual |
| 401 | A login |
| 403 | La acción no debía estar visible; `detail` dice qué nivel hace falta |
| 404 | El asiento no existe |
| 409 | Falta elegir empresa: al selector. Sin reintentos |
| 422 | Bug del frontend: un campo sobra o falta |

### 7. Teclado

Esto se usa a diario y a volumen. La entrada de datos tiene que funcionar sin
tocar el ratón:

- Orden de tabulación correcto en todos los formularios.
- Enter avanza al siguiente campo en las pantallas de entrada de asientos.
- Escape cancela / cierra diálogos.

---

## Cómo quiero que trabajemos

- **Una pantalla por sesión.** No generes la aplicación entera ni te adelantes
  a pantallas que no te he pedido.
- Antes de escribir código, dime en dos líneas qué vas a hacer y espera.
- Si algo del enunciado es ambiguo, pregunta. No elijas por mí y sigas.
- No refactorices código que no te he pedido tocar.
- Cambios pequeños y revisables. Un fichero se parte cuando cuesta leerlo, no
  al llegar a un número de líneas: el límite de 200 se quitó el 01/09/2026
  porque avisaba de ficheros que estaban bien y callaba con otros que no.

## Tests

- Todo lo que calcule o formatee importes lleva test (Vitest).
- Los tests se escriben con valores concretos y legibles: entra `1234.565`,
  sale `"1.234,57"`. Nada de comparar contra la propia función.
- Casos que quiero cubiertos sí o sí: importe negativo, cero, redondeo al
  alza en el .005, y un asiento con varias líneas que debe cuadrar exacto.

---

## Estructura

```
src/
  api/        cliente HTTP, tipos generados y normalización de importes
  lib/        formateo, utilidades de Decimal
  components/ componentes reutilizables
  pages/      una carpeta por pantalla
docs/
  contexto/   documentación de la API (solo lectura)
```

---

## Particularidades del dominio

Leídas del código del backend (ver `docs/contexto/api_para_frontend.md`).
Verifícalas contra el OpenAPI antes de diseñar la pantalla correspondiente.

- **Un asiento confirmado no se toca: ni se edita ni se borra.** Decidido el
  26/08/2026. La API tiene `/asientos/eliminar` y **no se usa ni se ofrece en
  ninguna pantalla**; lo que se corrige antes de entrar al libro se corrige en
  el borrador, y lo que ya entró se arregla con un asiento nuevo. Solo el
  concepto y el documento de un apunte son corregibles por separado
  (`/asientos/editar_texto`). NO hay pantalla de "editar asiento" ni botón de
  borrar asientos.
- **Un asiento manual pasa siempre por borrador.** Se teclea, se guarda las
  veces que haga falta y solo al confirmarlo entra en el libro y coge número.
  Hasta entonces se cambia entero o se tira sin dejar rastro.
- **Un ejercicio cerrado no admite ningún cambio.** `/ejercicios/listar` y
  `/ejercicios/obtener` dan el estado, así que la pantalla puede apagar el
  botón antes en vez de dejar teclear un asiento entero y perderlo. Son cuatro
  marcas distintas: `cerrado` es definitivo, `bloqueado` es reversible,
  `cerrando` lo pone y lo quita el proceso de cierre, y `deshabilitado` es de
  un periodo ya presentado, no del ejercicio.
- **El plan normativo (PGC) no se toca.** Cada empresa crea sus cuentas encima,
  y cuando el código coincide manda la suya. El campo `origen` (`comun` o
  `propia`) es el que decide qué botones se muestran.
- **Los datos del tercero viven en gestión, no en contabilidad.** `razon` y
  `cif` son los del momento del alta y no se refrescan, a propósito: un asiento
  antiguo tiene que imprimirse con el nombre de entonces. No hay
  "sincronizar" y no hay que inventarlo.
- Un usuario de rol 4 (el dueño de la empresa) tampoco entra sin fila de
  autorización. Tener la empresa no da acceso a su contabilidad.
- Algunos campos llegan como **JSON serializado dentro de una cadena** y hay
  que parsearlos. Si te topas con uno, dímelo antes de inventar su forma.

### Lo que la API NO tiene todavía

No planifiques pantallas que dependan de esto sin avisarme antes:

El 25/08/2026 el backend añadió plan contable, terceros y ejercicios, y ya no
son un hueco. Lo que sigue faltando:

- **Diarios.** Se crea el `GEN` al activar; no hay CRUD. La configuración los
  lista, pero no se pueden crear ni borrar.
- **Auditoría y apuntes borrados.** Las tablas se llenan, pero no se consultan
  por API.
- **`anchocuentas` y `tipo_pgc` no se cambian por API.** El ancho necesitaría
  una migración, y el plan se cambia abriendo el ejercicio siguiente con otro.
- **Equivalencias entre planes: existen, pero hoy están vacías.** Solo hay un
  plan cargado en la instalación, así que `/equivalencias/planes` devuelve uno
  y la pantalla se esconde entera. Se cargan en el servidor con un script, no
  desde la API.
- **Auditoría y apuntes borrados.** Las tablas se llenan, pero no se consultan
  por API.
- **Exportar informes a PDF/Excel.** Los informes devuelven datos, no ficheros.

---

## Despliegue

Servidor de desarrollo: **`https://contabilidad-dev.multiplika.net`**.

```
scripts/desplegar.sh
```

Pasa los tests, compila y sincroniza `dist/` con el docroot
`/opt/multiplika/msif_frontend_conta/` de `root@contabilidad-dev.multiplika.net`,
por rsync sobre SSH con `~/.ssh/id_rsa`. Al terminar comprueba que la web, el
JS, el CSS y la API responden.

- **No se toca el vhost de Apache ni ISPConfig**, solo el contenido del
  docroot. Es lo acordado con quien administra el servidor.
- `IdentitiesOnly=yes` es necesario: sin él, ssh prueba las demás claves del
  agente y agota los intentos antes de llegar a la buena.
- `--delete` deja el destino igual que `dist/`. Sin él se quedarían ficheros de
  versiones anteriores y el navegador podría servir uno viejo.
- La máquina responde `facturae.multiplika.net` al preguntarle el nombre: es la
  misma, con varios sitios.
- Para comprobar qué versión hay puesta, **la fecha de compilación al pie del
  menú**. Se congela en el `build` (`define` de Vite, en `vite.config.ts`).

**El salto de `http://` a `https://` lo hace `public/.htaccess`**, puesto el
01/09/2026. Sin él la página se sirve igual por http y ahí la sesión no
funciona, porque la cookie es `Secure` y el navegador no la manda por una
conexión sin cifrar. Es el mismo fichero que el otro frontend de la máquina.

Vive en `public/` **a propósito**: así entra en `dist/` al compilar y el
`rsync --delete` no se lo lleva. Dejado solo en el servidor, el despliegue lo
borraría, que es justo lo que pasó el 30/08/2026.

## Entorno

- Node 24.19.0 y npm 11.17, instalados en `~/.local/lib/node24` y enlazados
  desde `~/.local/bin`. Vite 8, React 19, TypeScript 5.9.
- **TypeScript se queda en la rama 5.** `openapi-typescript` declara
  `typescript: ^5.x`; con TS 6 la instalación falla.
- Proxy de desarrollo en `vite.config.ts`: `/apisif` → `https://facturae.multiplika.net`,
  con `changeOrigin: true` y `secure: true`. Es obligatorio por la cookie
  `SameSite=strict`. Comprobado: `curl localhost:5173/apisif/v1/usuarios/me`
  devuelve el 401 de la API.
- **El proxy retoca la cookie de sesión, y hace falta.** Hacia la API la
  conexión es HTTPS, así que la marca `Secure` y le pone su dominio; el
  navegador la descarta al estar la aplicación en `http://localhost` y el login
  entra y vuelve a salir. El hook `proxyRes` le quita `Secure` y `Domain`. No
  lo borres «porque parece que sobra»: sin eso no hay sesión en desarrollo. En
  producción, mismo dominio y HTTPS, la cookie llega intacta.
- `npm run api:types` pasa por `scripts/api-types.mjs` en vez de llamar
  directamente a `openapi-typescript`. Motivo: el OpenAPI trae una referencia
  `#/$defs/ModeloRespuestaDetelle` (en `/facturas_emitidas/obtener`, ajeno a
  contabilidad) que no es válida en el documento raíz y aborta la generación.
  El script la reescribe a `#/components/schemas/…` y avisa por consola. Es un
  fallo del backend: cuando se arregle, el script sobra.
- `npm test` (Vitest) y `npm run build` (`tsc -b && vite build`) pasan.
