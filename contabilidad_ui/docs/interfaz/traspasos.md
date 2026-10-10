# Contabilizar facturas

Dos secciones del menú, bajo el apartado `Traspasos`: `Facturas emitidas` y
`Facturas recibidas`. Nivel `consulta` para mirarlas; `apuntes` para
contabilizar.

Es el paso que convierte las facturas de facturación en asientos. **Un tipo por
pantalla**, porque lo que hay que arreglar en cada uno no se parece en nada: en
las ventas, la cuenta del cliente y la de la serie; en las compras, la del
proveedor, su IVA y su retención.

Va **después** del enlace con facturación, que está en el plan contable: es lo
que evita lanzar un trimestre entero y encontrarse doscientas facturas
apartadas.

Cada pantalla tiene su propia ayuda —`traspaso_facturas_emitidas` y
`traspaso_facturas_recibidas`—, que explica qué cuenta usa cada línea del
asiento y qué deja una factura en pendientes. La escribe el backend.

## Lo que se ve arriba

- `Mes` — el mes del ejercicio, o el ejercicio entero. Al cambiarlo se borra el
  resultado de lo anterior: mezclar el recuento de un mes con la lista de otro
  induce a error.
- `Contabilizar…` — apagado mientras no haya ninguna factura que vaya a entrar.
- `Reintentar las pendientes…` — vuelve a probar las que quedaron apartadas.

Los dos botones **solo se ven con nivel `apuntes`**. No se enseñan apagados: se
esconden.

Sin ningún ejercicio abierto la pantalla se queda en el título. No hay nada que
listar ni nada que contabilizar, y el armazón ya lo avisa arriba.

## La tabla

Una sola tabla con **todas las facturas que aún no tienen asiento**: las que van
a entrar y las que no. Tenerlas separadas obligaría a mirar en dos sitios para
saber qué pasa con un mes.

Columnas comunes: `Fecha`, `Factura`, el cliente o el proveedor con su NIF
debajo en pequeño, `Estado`, `Traspaso`, una columna por cada cuenta que la
factura va a usar, y `Total`.

- **El NIF va debajo del nombre**, no en columna aparte: se mira para desempatar
  dos fichas parecidas, no de corrido.
- `Estado` es el de facturación, y **el nombre lo escribe el servidor**: el
  vocabulario es de allí y cambia con ella. Llega como
  `Sin aprobar (no traspasa hasta que se apruebe)`; en la celda cabe el nombre y
  el paréntesis se lee al posarse encima.
- `Traspaso` es ✅ o ⛔. Al posarse dice por qué: `Traspasa`, o el motivo que
  escribe el servidor. **Lo decide él**, porque depende del régimen de la
  empresa y no se puede deducir del estado.
- Las columnas de cuentas se arman con las que traigan las facturas del filtro,
  y enseñan **la que se va a aplicar de verdad**: la propia, la heredada de la
  ficha o la de la configuración. Eso lo resuelve el servidor.

La rejilla sigue el criterio del resto del programa: cabecera fija y el scroll
en las filas. Debajo, cuántas facturas hay.

## Arreglar lo que frena, sin salir de aquí

Esa es la razón de ser de la pantalla. Lo que falta se pulsa y se arregla donde
toca.

**En emitidas**, una cuenta no se pone en la factura: se pone en la ficha de
donde sale. Por eso el aviso de la que falta abre **esa ficha**, no un
formulario propio. Hace falta nivel `cierre`, que es el que toca el plan.

Cuando el servidor propone enlaces sobre todo el filtro, sale un aviso azul con
cuántas facturas se pueden enlazar con su cliente y el botón `Enlazar todo…`.
**Se propone; quien enlaza es el usuario.**

**En recibidas**, cada fila lleva `Editar…` para poner sus cuentas, y cuando la
factura es de un bien que hay que amortizar,
`Crear la ficha del bien…`. Lo dice la API con `pide_ficha_de_bien`, calculado
con la misma regla que el traspaso y **antes** de intentar contabilizar: aquí no
se interpreta ningún motivo. Ambos piden nivel `apuntes`.

## Contabilizar

`Contabilizar…` pregunta antes:

> Se van a contabilizar 12 facturas de marzo de 2026. La que no se pueda queda
> anotada con su motivo y no frena a las demás.

Esa última frase es lo importante: **el traspaso no es todo o nada**. Al
terminar, un recuadro `Resultado` con cuatro recuentos —`Contabilizadas`,
`Ya tenían asiento`, `Anuladas`, `Quedan pendientes`—, el desglose por motivo
tal y como lo manda el servidor, y la tabla de qué asiento ha cogido cada
factura, que es lo que el contable apunta o comprueba.

La lista se vuelve a leer, así que las que han entrado desaparecen de ella.

## Reintentar

`Reintentar las pendientes…` vuelve a probar las apartadas de todo el ejercicio,
no las del mes elegido, y lo dice al preguntar. Es lo que se hace después de
arreglar las cuentas que faltaban.

El resultado sale en azul, `Reintento terminado`, con `Reintentadas`,
`Resueltas` y `Siguen pendientes`, más los motivos de las que siguen.

## Ventas anuladas con asiento

Solo en emitidas, y **solo si hay alguna**: un aviso rojo con las facturas
anuladas en facturación que siguen teniendo asiento en los libros.

Va aparte del traspaso del periodo porque no tiene ejercicio ni mes, y porque
merece verse aunque no se esté contabilizando: la contabilidad las está dando
por buenas y ya no existen.

Tabla con `Fecha`, `Factura`, `Motivo` y `Asiento`, y con nivel `apuntes` el
botón `Revertir…`, que pregunta:

> Se genera un asiento inverso por cada anulación. El asiento original no se
> borra.

Que es, otra vez, la regla del programa: un asiento confirmado no se toca, se
corrige con otro.

## Lo que no está

Los casos que hoy no se contabilizan y aparecen como pendientes —rectificativas,
recargo de equivalencia soportado, anticipos, intracomunitarias, inversión del
sujeto pasivo y criterio de caja— son del backend, no de la pantalla. Están en
`../planificacion/PLAN.md`.

`/sincronizacion/comprobar_traspaso` se montó y **se retiró el 28/08/2026**:
anunciaba que nada frenaba el traspaso justo al lado de una lista donde no
entraba ninguna factura. Lo que frena a cada una se ve en su propia fila.
