# Lo transversal

Lo que vale en todas las pantallas. Portar esto primero: el resto se apoya aquí.

## Dinero

Todo importe se maneja con una biblioteca decimal, nunca con el número en coma
flotante del lenguaje. En este cliente es decimal.js; en otro, la que haga ese
papel. Alcanza a variables, estado, propiedades y pasos intermedios.

- **Al enviar, los importes van como cadena**: `"121.23"`, con punto decimal.
  Vale para `debe`, `haber`, `importe_desde`, `valor_adquisicion` y cualquier
  otro. El formato español es solo para mostrar.
- **Al recibir, la API puede devolver un importe como número o como cadena.**
  La capa de cliente lo normaliza a decimal en un único punto. Ningún componente
  recibe jamás un importe sin normalizar.
- **Se redondea solo al mostrar**, nunca en un paso intermedio. Dos decimales,
  redondeo al alza en el medio (`ROUND_HALF_UP`).

## Formato español

- Decimales con coma y miles con punto: `1.234,56`.
- Fechas `dd/mm/aaaa` al mostrar, `aaaa-mm-dd` al enviar.
- El formateo vive en un módulo único, no suelto por las pantallas.

## Fechas que se teclean

Una casilla de fecha **no puede interpretar lo tecleado a la americana**: un
`03/09/2026` es 3 de septiembre. Este cliente tuvo ese fallo y lo corrigió con
un componente propio que se usa en toda la aplicación; en otra plataforma, la
regla es la misma.

Lo que acepta el parseo, con pruebas: `dd/mm/aaaa`, con barras, guiones o
puntos, sin ceros a la izquierda (`3/9/26`) y escrito del tirón (`030926`,
`03092026`). Un año de dos cifras es 20xx. Mientras la fecha esté a medias o no
exista en el calendario (31/02) **no vale y la casilla deja seguir escribiendo**.

Dos comportamientos que costaron caro y hay que repetir:

- **El calendario no se abre al recibir el foco**, solo a propósito: pinchando
  en la casilla o con la flecha abajo. Si se abre al tabular, salta un panel
  encima del formulario que tapa los campos de debajo.
- **Nada de pedir datos mientras se escribe una fecha.** Media fecha ya es una
  fecha válida, así que aplicar letra a letra lanza una petición por tecla. Se
  aplica al salir del campo, con Enter o al elegir en el calendario.

Los meses y los días salen en español.

## El punto en un código de cuenta es un comodín

Escribiendo `431.10` el contable quiere decir `431000010`: el punto se rellena
con ceros hasta completar el ancho de cuenta de la empresa. Vale en **cualquier
sitio donde se teclee una cuenta**: buscador del plan, alta de subcuenta y
entrada de asientos.

- El ancho **no se fija en el código**: sale de la configuración de la empresa
  (`anchocuentas`), y cada empresa puede tener el suyo.
- Se expande **al salir del campo**, para que el usuario vea el resultado antes
  de que se use.
- Si el resultado no cabe en el ancho, se deja lo tecleado y decide la API.
  Aquí no se valida si una cuenta existe.

## Permisos: cuatro niveles acumulativos

`consulta` < `apuntes` < `cierre` < `admin`. El nivel llega al conmutar de
empresa y en cada elemento de la lista de empresas; no se pide aparte.

| Nivel | Qué se ve |
|---|---|
| `consulta` | Diario, asientos, informes, fiscal, inmovilizado, pendientes y anulaciones. **Todo en solo lectura** |
| `apuntes` | Lo anterior + crear/corregir/borrar asientos, contabilizar periodo, reintentar pendientes, revertir anulaciones, alta/baja/dotación de inmovilizado |
| `cierre` | Lo anterior + abrir ejercicio, cerrar ejercicio, asiento de apertura |
| `admin` | Lo anterior + pantalla de accesos |

**Esconder, no deshabilitar y dejar que falle.** Un 403 en pantalla significa
que la interfaz mostró algo que no debía.

## Errores

Ningún error se silencia y ninguna pantalla enseña una tabla vacía como si no
hubiera datos: **«no hay resultados» y «no se pudo cargar» son cosas distintas**
y se dicen distinto.

La API tiene dos formas de error: los endpoints devuelven `{"detail": "..."}` y
el middleware de sesión devuelve
`{"success": false, "status_code": 401, "message": "..."}`. La capa de cliente
acepta las dos y deja el texto en un único sitio.

| Código | Qué hacer |
|---|---|
| 400 | **Mostrar el texto tal cual.** Está escrito para el contable |
| 401 | A login, sin reintentos |
| 403 | La acción no debía estar visible; el texto dice qué nivel hace falta |
| 404 | No existe |
| 409 | Falta elegir empresa: al selector. Sin reintentos |
| 422 | Fallo de la interfaz: un campo sobra o falta |

Ejemplos reales de 400, que se enseñan sin envolver ni traducir:

    El asiento no cuadra: debe 121.23 y haber 100.00
    El ejercicio 2025 esta cerrado.
    El periodo 03/2026 ya esta presentado y no admite apuntes.
    Lo que se traspasa no cuadra: debe 121.00 y haber 0.00, diferencia de 121.00

**Red de seguridad.** Un fallo de programación no puede dejar la pantalla muerta.
Si un componente revienta —y pasó, con un filtro guardado de una versión
anterior—, en lugar de quedarse el diálogo en blanco bloqueando todo, sale un
aviso: «Algo ha fallado en esta pantalla», el mensaje técnico para poder
contarlo, y un botón «Volver a intentarlo». Al cambiar de pantalla se limpia.

## Rejillas

Todas se ven igual, y las opciones comunes salen de un sitio único:

- **Densidad apretada**, con poco relleno vertical: son listados largos que se
  recorren buscando una fila, y cuantas más quepan, menos paginación.
- **Cabecera fija y scroll solo en las filas**: al bajar no se pierde de vista
  qué columna es cuál.
- **Una sola columna crece.** Códigos, marcas, importes y acciones llevan ancho
  corto y fijo; la columna de texto largo —el concepto, la razón social— se
  queda con lo que sobra y puede partir en varias líneas. El resto se queda en
  una línea a propósito.
- Lo que va dentro de una fila se pone pequeño: si un control es más alto que la
  fila, la celda lo recorta y desaparece.
- Sin acciones de columna, sin ordenación y sin barra superior, salvo que la
  pantalla las pida.

## Lo que se guarda en el equipo del usuario

En almacenamiento local, con **una clave por usuario** para que dos personas que
comparten ordenador no se pisen. Si el navegador no deja guardar, se sigue
trabajando sin guardar: la próxima vez sale la disposición de fábrica.

Se guarda: qué columnas tiene encendidas en cada rejilla y en qué orden, el
ejercicio en el que se estaba trabajando **por empresa**, el último apartado del
menú y la última pestaña del diario B **por empresa**, y el último filtro del
diario **por ejercicio**. Si el apartado recordado ya no está disponible (el SIF
no tiene diario B, o no llega el nivel o el rol), se entra en el de siempre.
Los resultados calculados no se guardan: tras recargar se vuelve a pulsar Ver.

## Las pantallas se quedan como se dejaron

Cada apartado del menú se monta la primera vez que se abre y luego se queda
montado y oculto: al volver sigue con sus filtros, su página, la fila marcada y
lo ya calculado, sin volver a pedirlo. Igual las pestañas dentro de una
pantalla (diario B, estados contables, fiscal, plantillas y el editor de
plantillas); las que piden datos al montarse (diario B, historial de
plantillas) no se montan hasta que se abren. Lo común está en
`components/pestanas.ts`.

Al cambiar de ejercicio se rehace la pantalla que se está viendo y se olvidan
las demás, que se rehacen al volver a ellas. Ir desde un traspaso al diario con
los borradores a la vista vuelve a montar el diario, que es lo que abre esa
lista. Ninguna pantalla pide datos con temporizador, así que una oculta no
gasta nada.

Nunca se guarda nada de la sesión ni del token. Y la empresa activa tampoco: va
en el token.

**Lo leído se completa con lo que falte y se descarta lo que no encaje.** Un
filtro guardado por una versión anterior no trae los campos nuevos, y eso
reventó la pantalla una vez. Al leer, cada campo se valida y el que falta se
rellena con el de fábrica.

## Los ficheros que se bajan

Todo fichero que el usuario se descarga lleva **la fecha y la hora en el
nombre**, `_ddmmaaaahhmmss` antes de la extensión:

- `balance_pyg_01092025062401.xlsx`
- `balance_pyg_01092025062401.pdf`
- `sumas_y_saldos_2026_01092025062401.xlsx`
- `mayor_2026_430000001_01092025062401.xlsx`
- `libro_diario_2026_01092025062401.xlsx`

Sin la marca, bajar el mismo informe dos veces deja dos ficheros con el mismo
nombre: el segundo pisa al primero, o el navegador le pega un `(1)` que no dice
nada. Un contable baja el mismo balance varias veces en una tarde —antes y
después de tocar algo— y tiene que poder distinguirlos en la carpeta de
descargas sin abrirlos.

La hora es la del ordenador del usuario, que es quien mira esa carpeta.

**El nombre lo pone la aplicación, no el servidor.** La cabecera
`Content-Disposition` que manda la API se ignora a propósito, porque no lleva la
marca. Al portar la interfaz, esto hay que mantenerlo.

## Qué versión se está usando

Al pie del menú lateral, en gris y pequeño: `Compilado el 01/09/2026 07:33`.

**Se congela al compilar**, no es la hora de ahora. Es la única forma de saber,
mirando la aplicación en un servidor, si lo que se está viendo es la versión que
se subió o una anterior que el navegador guardó. Sin esa línea, la única manera
de comprobarlo es abrir las herramientas del navegador.

Va al pie del menú y no del contenido, para que se vea siempre: el contenido
cambia de alto con cada pantalla y el menú no.

## Puntos suspensivos

Todo botón o elemento de menú que **abre un formulario o una confirmación**
termina en puntos suspensivos: `Nueva subcuenta…`, `Editar asiento…`,
`Traspasar a otro borrador…`. Los que ejecutan la acción directamente, no:
`Guardar`, `Cancelar`, `Aplicar`.

Dice al usuario si va a pasar algo ya o si todavía le van a preguntar.

## Teclado

Se usa a diario y a volumen, así que la entrada de datos tiene que funcionar sin
tocar el ratón: orden de tabulación correcto en todos los formularios, Enter
avanza al siguiente campo en la entrada de asientos, y Escape cierra diálogos.
