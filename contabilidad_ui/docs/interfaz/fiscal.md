# IVA y retenciones

`Fiscal → IVA y retenciones`. Hecha el 02/09/2026. Nivel `consulta`: todo es de
solo lectura y no hay nada que se pueda tocar.

## Qué resuelve

Las tres preguntas que se hacen al cerrar un trimestre: cuánto IVA se ha
repercutido y soportado, a quién se le ha retenido, y si lo que dice
facturación coincide con lo que dicen los libros.

## Cómo funciona

Un solo filtro arriba —el periodo; el ejercicio ya está elegido en la
aplicación— y un botón `Ver`. Las tres consultas salen a la vez, no al cambiar
de pestaña: cambiar de pestaña no puede quedarse esperando a una llamada que no
se lanzó.

**Cada pestaña guarda su error por separado.** Si falla el cuadre, el IVA y las
retenciones se siguen viendo, y el recuadro rojo dice cuál es la que no llegó.

El periodo se recuerda por usuario, como el filtro del diario y el de sumas y
saldos. Se hace así porque **en ningún sitio consta si una empresa declara por
meses o por trimestres**: el desplegable lleva los cuatro trimestres primero,
que es como declara casi todo el mundo, y detrás los doce meses, todos con el
nombre al lado para no tener que acordarse de qué abarca «3T».

## Las tres pestañas

**IVA del periodo.** Bases y cuotas por tipo, repercutido y soportado, y el
resultado con «a ingresar» o «a compensar o devolver» al lado según el signo.
Debajo, los días que abarca el periodo, que los calcula la API.

**Retenciones.** Un renglón por proveedor y porcentaje, con el NIF, el nombre,
cuántas facturas y lo retenido. El aviso de que **no se separa el modelo 111 del
115** viene redactado de la API y se enseña tal cual.

**Cuadre con facturación.** El IVA repercutido y el soportado según las facturas
y según los libros, con su diferencia. `Cuadra` o `No cuadra` lo decide la API
con su propia tolerancia; aquí no se compara ningún importe. El texto que dice
qué casos no mira ese cuadre va junto al resultado, no escondido.

## Lo que no se calcula aquí

El resultado del periodo, las dos cuotas totales y el veredicto del cuadre los
da la API. Lo único que suma esta pantalla son **la base y el recargo** de las
tablas de IVA, que son columnas a la vista que la API no totaliza: va con
decimal.js y está en `sumasIva.ts`, con tests.

## Lo que falta

**El modelo 303 no está aquí y no está en ninguna parte todavía.** Existe en la
API desde el 01/09/2026 (`/contabilidad/declaraciones`), pero no se puede pintar
mientras las casillas lleguen sin rótulo y las facturas de los avisos vengan
identificadas solo por un id interno. El detalle está en
`docs/planificacion/fiscal_303.md`.

Cuando llegue, va como **entrada aparte del mismo grupo**, no como una cuarta
pestaña: es un documento guardado, con su fecha y su estado, y sus cifras no se
recalculan. Ponerlo bajo el mismo filtro que tres consultas vivas invitaría a
compararlos como si tuvieran que coincidir.

Tampoco hay descargas: ni Excel ni PDF de ninguna de las tres.
