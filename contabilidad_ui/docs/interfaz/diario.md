# El diario

La pantalla que se usa cada día. Vive en el menú bajo `Diario → Entrada
asientos`, y es por donde se entra al módulo.

## Qué se ve

Título `Diario · 2026` —el número del ejercicio elegido detrás—, y a su lado:

- Botón `Filtro…`, que abre el diálogo del filtro.
- Una casilla de fecha suelta, sin etiqueta visible, con marcador `Día`.
- Una línea pequeña que dice qué se está viendo: `Hoy · confirmadas`,
  `01/09/2026 – 30/09/2026 · cuenta 430 · todas`. Sin ella habría que abrir el
  diálogo para saber por qué la lista tiene las filas que tiene.

A la derecha, para quien tiene nivel `apuntes`: `Sin confirmar (3)` cuando hay
borradores, y `Asiento nuevo…`.

Debajo, el número de apuntes, la rejilla y el pie de sumas.

## Por dónde se abre

**Sin filtro guardado, el diario enseña un solo día**, no el ejercicio entero:

- Si el ejercicio elegido es el del año en curso, **hoy**.
- Si no lo es, **su último día**, que sale del campo `cierre` del ejercicio. No
  se compone un 31 de diciembre a mano: hay ejercicios que no son el año
  natural.

Abrir por el ejercicio completo trae miles de apuntes que nadie está mirando, y
el listado no se pagina.

## El filtro

Vive en un diálogo, no en una franja fija de la pantalla: ocupaba alto que se
mira una vez y estorba el resto del rato.

**Se aplica al cerrar, de cualquiera de las maneras** —el botón `Aplicar`, la
equis o Escape—, para que no haya forma de creer que se ha filtrado y no.

Título `Filtro del diario`. Campos:

| Etiqueta | Qué hace |
|---|---|
| `Desde`, `Hasta` | Rango de fechas contables |
| `Cuenta` | Cuenta exacta; admite el comodín del punto |
| `Diario` | Desplegable con los diarios de la empresa |
| `Concepto` | Texto que aparezca en el concepto |
| `Documento` | Igual, sobre la referencia del documento |
| `Asiento desde`, `Asiento hasta` | Rango de número de asiento; los dos iguales, un solo asiento |
| `Importe desde`, `Importe hasta` | Deja fuera los apuntes cuyo importe no esté entre esos dos |
| `Mostrar` | `Todas` / `Borradores` / `Confirmadas` |

Botones: `Quitar el filtro` (vuelve al día de entrada) y `Aplicar`.

Detalles que no son opcionales:

- **Una condición vacía no viaja.** Mandar la clave vacía daría 422.
- Los importes se teclean en español (`1.234,56`) y se mandan como cadena
  decimal (`"1234.56"`). Lo que no se pueda interpretar se queda vacío en vez de
  viajar mal.
- `concepto` y `documento` buscan `%` y `_` **tal cual**: quien teclea `50%`
  busca el descuento. No se escapa nada.
- El desplegable de diarios **no es de búsqueda** y no se puede abrir mientras
  la lista esté vacía: si no, al tabular salta un desplegable en blanco.

**El filtro se guarda por ejercicio.** Si se guardara uno solo, cambiar de
ejercicio arrastraría fechas de otro año y la lista saldría vacía.

## La casilla de día

Elegir una fecha ahí **pisa el rango `Desde`/`Hasta`** del diálogo. Es lo que se
hace veinte veces al día, y por eso está fuera.

Solo enseña fecha cuando el rango es un único día: con un rango de un mes,
ninguna fecha suelta contaría la verdad.

**No pide nada mientras se escribe.** Ver el apartado de fechas en
`transversal.md`.

## La rejilla

Sin paginar: **un asiento no puede quedar partido entre dos páginas**. Como la
API no deja pedir más de 500 de una vez, se piden por tandas y la pantalla va
enseñando lo que llega, diciendo `Cargando 500 de 1.240 apuntes…`.

**Al cambiar el filtro, la carga anterior se aborta de verdad**, no solo se
ignora: si no, cada cambio deja una descarga completa ocupando la conexión y la
siguiente espera detrás.

La búsqueda global de la rejilla está apagada a propósito: mientras entran las
tandas filtraría sobre lo que lleve cargado, y eso engaña sobre lo que hay.

Columnas: Fecha, Asiento, Pase, Estado, Cuenta, Concepto, Documento, Diario,
Obra, Usuario, Fecha de registro. Las cinco primeras y el concepto no se pueden
apagar: sin ellas la pantalla no dice nada. Lo que el usuario encienda y el
orden en que las ponga se guardan en su equipo.

Colores de fila: **lo marcado en azul, los borradores en naranja**, y marcado
manda sobre borrador. El borrador se marca además con 📝 y `Asiento en
borrador`, igual que en el mayor y en asientos eliminados.

**La cuenta de cada apunte es un enlace**: abre el mayor de esa cuenta sin salir
del diario. El clic no marca la fila. Ver `mayor.md`.

En la barra de arriba, el botón de la hoja de cálculo verde baja el diario a
Excel **con los filtros que estén puestos**, no el ejercicio entero: al fichero
le van los mismos que a la consulta que llena la tabla, y la cabecera dice cuáles
se aplicaron. `incluir` viaja con sus tres valores, así que «solo borradores»
también se puede bajar.

Al recargar, las filas que se están viendo **se quedan puestas** hasta que llega
todo lo nuevo, y entonces cambian de una vez. Vaciarlas antes de pedir hacía que
la tabla se repintara entera y saltara la pantalla cada vez que se guardaba un
asiento. Solo se pinta sobre la marcha en la primera carga.

## La selección: por asiento o por apunte

Sobre la rejilla hay un interruptor con dos posiciones,
`Marcar asientos` —de entrada— y `Marcar apuntes`. **Con Ctrl
pulsado, un clic en la casilla hace lo contrario del modo en que se esté**, sin
tener que cambiar el interruptor.

Los apuntes sueltos hacen falta para traspasar solo un trozo de un asiento a
otro borrador; el modo por asiento es el que se usa para mirar.

En el modo por asiento: **marcar una línea marca el asiento entero, y
desmarcarla lo desmarca entero.**
Un asiento es una unidad: media docena de líneas que solo significan algo
juntas, y sumar tres de las seis da una cifra que no corresponde con nada.

Se mira qué líneas ha cambiado la rejilla y ese mismo cambio se aplica a las
demás del asiento, así que funciona igual marcando una fila que marcándolas
todas. Los borradores se agrupan por su borrador, porque todavía no tienen
número de asiento firme.

Al cambiar el filtro se suelta la selección. **Volver del editor no cuenta**:
ahí se sigue mirando el mismo asiento.

## El pie de sumas

Las sumas de la consulta y del ejercicio, que **calcula la API**, no la pantalla.
Van con el mismo filtro que el listado —los mismos once campos— o el pie diría
una cifra distinta de lo que se ve.

Un matiz de la API: el alcance «ejercicio» ignora todo el filtro salvo qué se
incluye, y por eso está rotulado como del ejercicio, no del filtro.

Lo único que se suma en el cliente es **la selección**, que es un total de
columnas visibles en pantalla.

## Botones sobre la rejilla

Aparecen solo cuando lo marcado es un borrador y el usuario tiene `apuntes`:

- `Editar asiento…` — abre ese borrador en el editor.
- `Traspasar a otro borrador…` — ver más abajo.

**Un asiento confirmado no se abre en el editor.** No se edita ni se borra: lo
que ya entró se arregla con un asiento nuevo. Solo el concepto y el documento de
un apunte son corregibles por separado.

## El editor de asientos

Un asiento manual **pasa siempre por borrador**: se teclea, se guarda las veces
que haga falta y solo al confirmarlo entra en el libro y coge número. Hasta
entonces se cambia entero o se tira sin dejar rastro.

Cabecera: `Fecha`, `Diario` y `Concepto` del asiento. Debajo, las líneas, con
columnas Cuenta, Concepto, Documento, Debe, Haber y un icono de quitar.

Se teclea seguido: el tabulador va por el orden en que se escribe.

Comportamientos acordados:

- **La casilla de cuenta busca en el plan que ya está en memoria**, por número y
  por título, sin esperar a ninguna llamada. Solo ofrece las que admiten
  apuntes. Si lo tecleado no existe, la última opción da de alta la cuenta sin
  salir del asiento.
- **Debajo de las líneas sale el código y el título de la cuenta de la fila
  donde está el cursor.** La casilla enseña el número; el título es lo que dice
  si es la cuenta que se quería. El alto está reservado siempre, para que la
  tabla no dé saltos.
- **El concepto y el documento se heredan de la línea de encima.** La casilla
  vacía los enseña en gris y al salir de ella se queda con ese valor. Un asiento
  repite el mismo concepto línea tras línea.
- **Al escribir algo en la última línea aparece otra debajo**, para teclear el
  asiento seguido sin parar a pedir sitio. Al abrir un borrador guardado también
  se pone una en blanco al final.
- El descuadre se ve mientras se teclea, como aviso. **Quien decide si un asiento
  cuadra es el servidor al confirmarlo.**

**Al guardar, una línea a medias no deja seguir**, y se nombra la primera que
esté mal: `La línea 3 está a medias: le falta la cuenta.` o
`La línea 3 está a medias: le falta el importe, al debe o al haber.` Una línea
cuenta como escrita si tiene cuenta o algún importe; las del todo en blanco, y
las que solo llevan concepto, se descartan al enviar. Aquí no se comprueba si el
asiento cuadra ni si la cuenta existe.

## Volver del editor

**No se recarga el diario entero.** Se piden solo las líneas de ese asiento y se
cambian en el sitio donde estaban, sin reordenar nada: el orden lo da la API.

- Si se guardó sin confirmar: se piden por `id_borrador`. Ojo, **un `0` no
  filtra**: es lo que llevan todos los apuntes del libro.
- Si se confirmó: se piden por número de asiento.
- Si el asiento no estaba en la lista —era nuevo, o el filtro no lo alcanza—,
  entonces sí se recarga entero.

**Y se marcan las líneas que devuelve el refresco**, no las que había: al
guardar un borrador la API las reescribe con claves nuevas, así que marcar las
viejas deja la selección vacía en cuanto llegan las nuevas. Solo cuando hay que
recargar entero se recuerda el asiento y se marca al llegar los apuntes.

## Traspasar apuntes a otro borrador

Se marcan filas de un borrador y sale `Traspasar a otro borrador…`. Diálogo
`Traspasar apuntes`:

- Arriba: `Se van a mover 3 apuntes del borrador 12.`
- Destino: `A un borrador que ya existe` (campo `Borrador`, la lista de
  borradores sin confirmar) o `A un borrador nuevo` (`Fecha`, `Diario` y
  `Concepto`, con la nota `Lo que dejes en blanco se copia del borrador de
  origen.`).
- Botones `Cancelar` y `Traspasar`.

Lo hace la API en una sola operación, todo o nada. **El cuadre lo decide ella**:
si lo que se traspasa no cuadra, devuelve 400 y su texto se enseña tal cual
(`Lo que se traspasa no cuadra: debe 121.00 y haber 0.00, diferencia de
121.00`). Aquí no se suma nada para dejar o no dejar traspasar.

Reglas del servidor que la pantalla no repite pero conviene conocer: el origen
puede quedar descuadrado, si se queda sin líneas **no se tira**, hace falta nivel
`apuntes`, y mezclar ejercicios se rechaza.

Al terminar se recarga y **queda marcado el borrador de destino**.

## Lo que la API no tiene

Filtrar por tercero, y no se ha pedido: `razon` y `cif` son los del momento del
alta y no se refrescan —a propósito, para que un asiento antiguo se imprima con
el nombre de entonces—, así que daría resultados raros.
