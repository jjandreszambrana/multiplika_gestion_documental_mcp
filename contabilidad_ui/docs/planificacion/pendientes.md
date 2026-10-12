# Pendientes

Lo que hace falta y no depende de este repositorio, o está esperando a que se
decida algo. Cuando algo de aquí se resuelve, se borra de la lista y, si
condiciona el código, se anota en `decisiones.md`.

Actualizado: 28/08/2026

## Pedir al backend

### Asientos predefinidos: la definición escrita a mano

**Resuelto en el backend ([5.11], 11/10/2026)**: las respuestas declaran
`PlantillaAsientoDefinicion` y el catálogo `RespuestaCatalogoPlantillas`. Los
tipos ya están regenerados; falta quitar la copia escrita a mano en
`src/api/plantillas.ts` y usar esos. En las peticiones la definición sigue
siendo objeto libre a propósito (así vuelve con sus errores por campo).

### Crear solas en el plan las cuentas que falten, durante el traspaso

Hoy, si un maestro de facturación apunta a una cuenta que no está en el plan, la
factura se aparta. La aplicación lo enseña antes (sección «Enlace con gestión»)
y ofrece darlas de alta, pero es un paso manual que alguien tiene que acordarse
de hacer. Lo natural es que el propio traspaso las cree según las necesita, con
el mismo criterio que `/sincronizacion/crear_cuentas`: de apuntes y con el
título del maestro que las referencia.

Si se hace, la pantalla del enlace deja de ser un requisito y pasa a ser
información.

### Maestros que se quedan sin cuenta propuesta

`/cuentas_maestros/sugerir` compone el número de casi todas las casillas, pero
no de todas, y la pantalla las deja en blanco con el `motivo` debajo. Falta
decidir con el backend si estas tienen criterio o se quedan así:

- **Medios de pago:** hay propuesta para `pagos` y `cobros`, que salen de
  `cuenta_tesoreria`. No la hay para `gastos` ni `efectos_a_cobrar`.
- **Grupos económicos** (`base`, `obra_en_curso`, `devengo`) **y clasificación
  de gastos** (`gasto`): ninguna casilla tiene propuesta. Son campos que el
  traspaso no lee hoy, así que puede ser deliberado.

Resueltos el 26/08/2026: la cuenta del propio cliente o proveedor ya sale
siempre, por la cascada ficha → código → id. Y que la sugerencia no mire
`modo_cuenta_cliente` / `modo_cuenta_proveedor` es a propósito: la cascada es lo
que se ofrece en pantalla, y lo que el motor asigna de verdad va por
`/terceros`. No entra el IVA ni la retención de un proveedor, que vienen sin
propuesta porque los elige el contable.

### Desenlazar un tercero de su subcuenta

`/terceros` tiene `listar`, `obtener`, `sin_enlazar`, `resolver` y `enlazar`, y
nada para deshacer una equivalencia ni para rehacerla: `enlazar` se niega con
400 si ese tercero ya tiene cuenta. Por el otro camino tampoco se puede: vaciar
la casilla de la ficha en «Enlace con gestión» borra la cuenta de la ficha,
pero deja la equivalencia como estaba.

Hace falta cuando alguien enlaza al cliente equivocado, que es justo el error
que hay que poder corregir. No es borrar sin más: la cuenta puede tener
apuntes, y lo que se decida tiene que decir qué pasa con ellos.

### Avisar al backend de dos erratas de la guía

En `docs/contexto/api_para_frontend.md`, apartado 16:

- El párrafo «donde no hay criterio no se inventa uno» sigue diciendo que «un
  cliente sin código no tiene con qué formar el número». Con la cascada ya no es
  cierto: sin código se usa el id.
- La respuesta de ejemplo de `/sugerir` es la de antes de la cascada, y no
  enseña el campo `cuenta` de los emisores.

### Una huella para saber si algo ha cambiado

Para no repetir revisiones ni recargas enteras. Bastaría un endpoint diminuto
que devuelva un sello calculado con un `COUNT(*)` más un `MAX(fecha)` de las
tablas implicadas; si no hay columna de fecha, `COUNT` más `MAX(id)` ya detecta
altas. El cliente guarda el sello y solo vuelve a pedir los datos cuando cambia.

Interesa por separado para: los maestros de gestión (revisión del enlace), el
plan contable (la copia que el frontend tiene en memoria) y los terceros.

### Tipar la respuesta de `/obligados/listar`

Llega como `registros: object[]`, así que la pantalla de activar contabilidad la
lee con comprobaciones de tipo en vez de un tipo declarado. Cuando se tipe, se
regeneran los tipos y se borra esa lectura defensiva.

### Los estados contables en PDF

El balance y pérdidas y ganancias se bajan en Excel, no en PDF. El Excel es para
trabajar el fichero; el PDF es lo que se firma, se archiva y se manda, y un
balance a fecha de corte se guarda tal cual quedó ese día.

**Depende del backend**, por la decisión del 30/08/2026 que dejó los informes en
su lado: hacerlo aquí obliga a meter una librería de PDF y a duplicar el
formateo español, que hoy vive en un solo sitio.

Pedido en `[5.1]` del intercambio, **solo para los estados contables**. El
mayor, el libro diario y sumas y saldos van a querer lo mismo; se decidió el
01/09/2026 empezar por estos dos y ver el resultado antes de pedir el resto.

## Decisiones que no están tomadas

### Exportar informes a PDF y a Excel

**Decidido el 30/08/2026: se pide al backend**, no se genera en el navegador. El
porqué está en `decisiones.md`. Pedido el Excel del mayor en
`prompts/4_intercambio.md` [4.1]; detrás van sumas y saldos, balance y pérdidas
y ganancias. Lo de PDF sigue sin plantearse.



### «Asientos eliminados» no enseña lo que de verdad se elimina

Un asiento confirmado no se puede borrar, así que del libro solo sale algo al
deshacer una importación. El borrado que ocurre a diario es el de apuntes de
borradores, y ese no aparece en la pantalla.

Pedido en `prompts/historico/2_intercambio.md` [2.8] el 28/08/2026: que el backend
registre al guardar qué líneas desaparecieron y las exponga, preferiblemente
como un parámetro de `/asientos/eliminados/listar` para que siga habiendo una
sola pantalla. Dos preguntas abiertas: si tirar un borrador entero cuenta como
eliminar sus apuntes, y qué pasa con los traspasados a otro borrador, que no se
eliminan sino que se mueven.

### El alta de la ficha del bien desde la factura

Hoy la ficha de un bien se teclea a mano en la pantalla de inmovilizado, y solo
si alguien se acuerda. Lo normal es que se olvide: el bien queda en la cuenta
del activo y no se amortiza nunca.

Pedido en `prompts/historico/3_intercambio.md` [3.8] el 29/08/2026: que sea la entrada al
debe de una cuenta de inmovilizado la que dispare la propuesta, por los dos
caminos —el traspaso de facturas recibidas, que es el bueno, y el asiento
manual, **avisando después de confirmar y nunca mientras se teclea**—.

Quién decide si una cuenta es de inmovilizado es el backend: aquí no se mira si
el código empieza por 21.

La propuesta admite tres respuestas: es un bien nuevo, es una mejora de este
otro, o no es un bien. **La tercera hay que recordarla**, o cada vez que se abra
la factura vuelve a preguntar y el aviso se convierte en ruido.

**No se monta hasta que el backend conteste**: es camino nuevo y no se adivina.

### ~~Corregir un valor mal tecleado de un bien~~ — resuelto

**Resuelto el 29/08/2026**, aviso [3.12]: `/inmovilizado/corregir_valor`, aparte
de `/editar`, que sigue sin dejar tocar el valor con dotaciones hechas. Cambia la
ficha y hace **un asiento** por la diferencia entre lo dotado y lo que tocaba. No
toca el cuadro de amortización ni la cuenta del activo. Está montado.

Estuvo sin poderse en un bien que ya tenía meses dotados. No es lo mismo que una
mejora —ahí lo ya dotado está **mal**, no bien— y no puede ser el mismo camino.
El backend está de acuerdo y quiere hablarlo con el usuario antes de tocar nada:
arreglarlo bien significa un asiento de corrección, no cambiar el dato.

### La pieza sustituida por una mejora

Cuando una mejora sustituye una pieza, lo sustituido debería salir de los
libros. El backend propone **dejarlo fuera y decirlo en la ayuda**, y el
argumento convence: no se sabe qué parte del valor del bien era esa pieza salvo
que estuviera en ficha propia, y si lo estaba ya hay camino —se le da de baja
como mejora—. Queda pendiente escribir esa ayuda.

**Resueltas el 29/08/2026** en la respuesta parcial al [3.8]: la tabla de la LIS
(`/inmovilizado/tabla_amortizacion`, contrastada con el BOE fila a fila) y las
mejoras como ficha encadenada. Las dos están ya en la pantalla.

### ~~Un bien que llega ya amortizado de otra contabilidad~~ — resuelto

**Resuelto el 29/08/2026**, respuesta al [3.10]. El backend añadió
`amortizado_inicial`, en el alta y en el importador, y la casilla está puesta en
el formulario. Confirmó además que **la fecha de inicio puede ser la original**:
el cálculo de la cuota no cuenta meses desde ella. Se deja el apartado por lo que
explica del problema, que estuvo roto hasta ese día.

**Estuvo roto.** El alta no tiene campo de amortización previa y lo amortizado
sale de sumar las dotaciones hechas aquí, así que un bien que entra con 18.000
ya amortizados figura con cero y **se vuelve a amortizar entero**. No lo nota
nadie hasta que el saldo de la cuenta 28 no cuadra con la suma de las fichas.

Le pasa a toda empresa que se dé de alta con historia, y a todos sus bienes a la
vez. El importador de bienes tampoco puede meter ese dato.

Pedido en `prompts/historico/3_intercambio.md` [3.10] el 29/08/2026: un campo de
amortización acumulada de arranque, en el alta y en los campos del importador.
**Declararla no puede hacer ningún asiento**: los saldos del activo y de la
amortización acumulada ya vienen en el asiento de apertura, y si el alta apuntase
por ese importe se duplicaría.

Queda abierto desde cuándo se amortiza aquí un bien que lleva años amortizándose
fuera, que es donde puede salir una cuota rara el primer mes.

### ~~La casilla de «usado» en el alta~~ — resuelta

**Resuelta el 29/08/2026**: cada elemento de la tabla trae ya
`coeficiente_maximo_usado` y hay un bloque `usados` con la regla escrita. La
casilla está puesta.

Del [3.10], y era lo pequeño. Un bien de segunda mano **no arrastra
nada**: entra por lo que se paga y se amortiza desde cero. Lo único particular
es el ritmo, y es fiscal: el artículo 4.3 del Reglamento del Impuesto sobre
Sociedades deja amortizar hasta **el doble del coeficiente de tablas**, o aplicar
el normal sobre el precio de cuando era nuevo si se conoce. Los edificios de
menos de diez años no cuentan como usados.

Se pidió que la tabla traiga el coeficiente de usado ya calculado, para poner una
casilla junto al desplegable. Doblar un número es una cuenta, y las cuentas las
hace el backend.

### ~~Saber qué factura pide ficha de bien~~ — resuelto

**Resuelto el 29/08/2026**: el backend añadió `pide_ficha_de_bien` y
`cuenta_de_inmovilizado` a cada factura de `/cuentas_maestros/facturas`, y el
booleano **viene siempre**, se haya intentado contabilizar o no. El camino desde
la factura está montado. Se deja el apartado por lo que explica.

Bloqueó el camino desde la factura, que por lo demás está hecho en la API
(`/inmovilizado/desde_factura`, respuesta al [3.9]).

`/cuentas_maestros/facturas` solo trae `motivo_frenada`, que es **texto libre**.
Comparar esa cadena con el mensaje del backend haría que el botón desapareciera
en silencio el día que cambien una coma, y es una regla de negocio que aquí no
se replica. Peor aún: ese campo **solo viene si ya se intentó contabilizar**, así
que una factura del mes llega sin él y no se sabe que va a frenar.

Pedido en `prompts/historico/3_intercambio.md` [3.11] el 29/08/2026: un booleano
`pide_ficha_de_bien` por factura, calculado antes de intentar contabilizar, o un
código de motivo estable junto al texto.

Mientras tanto se monta el repaso de apuntes sin ficha, que es autónomo.

### ~~Editar un borrador desde el mayor~~ — resuelto

**Resuelto el 30/08/2026**: `id_borrador` llega en cada apunte del mayor, cero
cuando ya está en el libro. El número de asiento es un enlace en la pantalla de
informes y en el modal del diario, y **sigue siendo texto dentro del editor de
asientos**: allí ya se está tecleando uno, y el mayor puede estar enseñando ese
mismo, que todavía no existe como asiento cerrado.

### El Excel del libro diario no respeta los filtros de la pantalla

`/informes/excel` con `libro_diario` solo admite ejercicio, fechas y
borradores. La pantalla del diario filtra además por cuenta, diario, concepto,
documento, rango de asientos y rango de importes.

**Por eso el diario no tiene botón de Excel todavía**: con lo que hay, quien
tuviera el diario filtrado por una cuenta se bajaría el ejercicio entero
creyendo que se lleva lo que ve, y no se enteraría hasta que algo cuadrara mal.

Pedido en `prompts/4_intercambio.md` [4.2] el 30/08/2026, junto con dos detalles:
qué hacer con `incluir` —que en el diario tiene tres valores y no dos— y que la
cabecera del fichero diga qué filtro se aplicó.

### Balance de situación y pérdidas y ganancias: lo que hay que tener en cuenta

Todavía sin pantalla. El backend avisó el 30/08/2026 (`[4.6]` y `[4.7]`) de tres
cosas que condicionan cómo se montan:

- **Se leen en positivo.** El pasivo y la cuenta de resultados vienen ya con el
  signo dado la vuelta: `total_pasivo` positivo, las ventas positivas y los
  gastos negativos. Aquí no se cambia ningún signo.
- **Cuadra con una resta**, no con una suma:
  `total_activo - total_pasivo = resultado_del_ejercicio`.
- **Mientras no se cierre el ejercicio, activo y pasivo no son iguales, y no es
  un error.** El beneficio sigue repartido entre gastos e ingresos, que no
  forman parte del balance, así que la diferencia **es** el resultado. La
  pantalla tiene que explicarlo o lo van a preguntar.

El Excel ya está: `informe: "balance"`, con dos hojas —balance y pérdidas y
ganancias—, porque quien lo manda a la gestoría manda los dos y en una sola hoja
no se leen.

### ~~Sumas y saldos: rangos, título de la cuenta y saldo anterior~~ — resuelto

**Resuelto el 30/08/2026** y la pantalla está hecha. Se deja lo de abajo por lo
que explica.


El informe admite ejercicio, nivel y borradores. Le faltan, para poder montar la
pantalla que pidió el usuario:

- **`cuenta_desde` y `cuenta_hasta`**: el balance se mira por trozos.
- **`desde` y `hasta`**: se saca por trimestres y por meses, no solo a fin de año.
- **`descripcion` en cada línea**: hoy solo llegan números, y el título no se
  puede componer aquí —una línea agrupada por dos dígitos no es ninguna cuenta
  del plan que tenemos en memoria—.
- **El saldo con el que la cuenta llega al periodo**, como el `saldo_anterior`
  del mayor pero por línea. Es el único de los cuatro del que se puede
  prescindir hoy.

Pedido en `prompts/4_intercambio.md` [4.5] el 30/08/2026. Queda por decidir allí
si, acotando por fecha, el debe y el haber son los del periodo o los acumulados.

### Deshacer el cierre del ejercicio

El usuario pidió el 30/08/2026 la pantalla de regularización, cierre y apertura,
**con posibilidad de deshacerlo todo**. Eso hoy no existe y va contra una
decisión del backend: un ejercicio cerrado no admite ningún cambio, tenga quien
sea el nivel.

Pedido en `prompts/4_intercambio.md` [4.8]: deshacer el cierre, deshacer la
apertura, un `simular` para los dos, y saber de antemano todo lo que impide
cerrar para decirlo en pantalla en vez de dejar que el contable se lleve un 400.

Ampliado en el [4.9] con cómo la quiere el usuario: **una vista previa del
proceso entero y, delante, la lista de lo que hay que hacer antes**. Eso obliga a
que los impedimentos lleguen como **lista estructurada** —qué es, cuántos, si
bloquea, y un identificador estable para poder llevar al contable a la pantalla
donde se arregla— y no como un texto suelto.

**La pantalla no se monta hasta que esté**: no se pone un botón irreversible, sin
ensayo y sin vuelta atrás, en la pantalla de un contable.
