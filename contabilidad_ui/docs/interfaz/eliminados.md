# Asientos eliminados

En el menú, bajo `Diario → Asientos eliminados`. Nivel `consulta`, el mismo que
el diario: **no se esconde**. Quien puede ver el libro puede ver lo que se quitó
de él; esconderlo solo serviría para que un asiento desapareciera sin
explicación.

## Qué es

Los asientos que salieron del libro. **Solo se consultan**: un asiento eliminado
no se recupera, ni por aquí ni por la API, igual que un asiento confirmado no se
edita ni se borra.

Un borrador que se tira **no aparece**: nunca estuvo en el libro. Lo que se
quita de un borrador se sigue por otro camino, el histórico de borradores.

Título `Asientos eliminados`, y debajo:

> Aquí quedan los asientos que salieron del libro. Solo se consultan: un asiento
> eliminado no se recupera.

Esa frase no es adorno: hoy la tabla está casi siempre vacía —desde que se
retiró el borrado de asientos, lo único que borra es deshacer una importación—,
y sin ella la pantalla parece rota.

## Datos

`POST /contabilidad/asientos/eliminados/listar`, con `ejercicio`, `desde`,
`hasta`, `offset` y `limit`, todos opcionales. Respuesta
`{"total", "apuntes"}`, como el diario.

`desde` y `hasta` son la **fecha contable del apunte**, no el día en que se
borró: quien busca lo que se quitó de marzo pregunta por los asientos de marzo.

Orden: **lo último que se borró primero**, y dentro de un mismo borrado, el
asiento en su orden natural. Se borra el asiento entero, nunca líneas sueltas.

Se carga por tandas, como el diario, y se distingue «no hay resultados» de «no
se pudo cargar». Cuando no hay ninguno:
`No hay asientos eliminados con esas fechas.`

## Columnas

Las mismas del libro —Fecha, Cuenta, Concepto, Documento, Diario, Debe, Haber—
para que un asiento se lea igual esté dentro o fuera, más:

| Columna | Qué es |
|---|---|
| `Asiento al borrarse` | El número que tenía cuando se quitó |
| `Borrado el` | Cuándo se quitó |
| `Quién` | Quién lo quitó |
| `Motivo` | Lo que se anotó al quitarlo, si se anotó |

**El número no es el actual y por eso se rotula así.** Al renumerar, los asientos
del libro cambian de número y los borrados conservan el suyo, así que después de
una renumeración ese número puede corresponder ya a otro asiento. No se renumera
el archivo: falsearía lo que pasó.

La clave de fila viene como `x:<pase>`, distinta de la de un apunte vivo para
que no se confundan.
