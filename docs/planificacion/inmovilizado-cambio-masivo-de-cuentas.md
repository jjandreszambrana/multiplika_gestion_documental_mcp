# Cambiar las cuentas de varios bienes de golpe

Plan, 2026-10-30. Todavía sin hacer.

## Qué vas a poder hacer

En la lista de inmovilizado marcas varios bienes y pulsas «Cambiar cuentas». Eliges la cuenta nueva y el programa te enseña el asiento que mueve el dinero de la cuenta vieja a la nueva. Al aceptar, el asiento **se crea como borrador**: no entra en los libros hasta que lo revisas y lo confirmas en el diario, como cualquier otro borrador. Los bienes pasan a las cuentas nuevas cuando confirmas ese borrador. Si lo descartas, todo se queda como estaba.

## Un ejemplo

Tienes tres furgonetas apuntadas por error en la cuenta 216 (mobiliario) y deberían estar en la 218 (elementos de transporte).

| Furgoneta | Costó | Lleva amortizado |
| --- | --- | --- |
| A | 20.000 | 6.000 |
| B | 15.000 | 3.000 |
| C | 10.000 | 0 |

Las marcas, eliges la 218 y su cuenta de amortización, y el programa propone este asiento:

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 218 Elementos de transporte | 45.000 | |
| 216 Mobiliario | | 45.000 |
| 281 Amortización mobiliario | 9.000 | |
| 281 Amortización elementos de transporte | | 9.000 |

Tú lo miras y lo aceptas; queda como borrador en el diario. Cuando lo confirmas, las tres furgonetas pasan a la 218.

## Cómo funcionará

- Solo se mueve lo que pertenece a esos bienes. Si la cuenta 216 tiene además otros apuntes que no son de ningún bien, no se tocan.
- Si un bien todavía no tiene dinero apuntado, no hace falta asiento: solo cambia su ficha.
- La cuenta de gasto (la de las dotaciones) no lleva asiento: lo ya dotado se queda donde está y la cuenta nueva vale para las dotaciones que vengan. Mover años pasados falsearía esos años.
- **La fecha del asiento** la eliges tú en el diálogo. Sale puesta con hoy (o con el último día del ejercicio seleccionado, si hoy cae fuera) y tiene que estar en un ejercicio abierto. El importe que se traslada es lo que el bien tiene en esa fecha, no el de hoy. Si ya hay dotaciones apuntadas después de esa fecha, el diálogo te avisa de que esas se quedaron en la cuenta vieja.
- Los bienes dados de baja no se pueden marcar.
- La cuenta nueva tiene que existir; si no, podrás crearla desde el mismo diálogo.
- Todo o nada: el borrador lleva todos los bienes marcados, y al confirmarlo cambian todas las fichas a la vez o ninguna.
- Mientras el borrador esté pendiente, esos bienes quedan avisados («traslado pendiente») y no se pueden marcar para otro cambio.
- Si ya habías corregido el traslado a mano en el diario, habrá una opción «solo cambiar las fichas» que no crea borrador, para no duplicarlo.

## Desde dónde se puede hacer

Solo desde dos sitios, y en los dos con un aviso antes de guardar que explique que se va a crear un asiento en borrador y que la ficha cambiará al confirmarlo:

1. El **cambio masivo** (varios bienes marcados).
2. La **corrección** de un bien suelto, cuando lo que se corrige es una cuenta.

Desde ningún otro sitio cambian las cuentas de un bien con saldo (ni la edición normal de la ficha, ni la IA, ni procesos automáticos).

## Qué hay que construir

1. En el SIF: la operación de cambiar cuentas con su vista previa del asiento, y sus pruebas.
2. En la pantalla: casillas para marcar bienes, el botón «Cambiar cuentas» y el diálogo con el asiento propuesto, que se envía al diario como borrador.
3. Probarlo en el navegador con datos de prueba.
4. Subirlo: primero el SIF y después la web.

## Lo que necesito que decidas

1. **Las mejoras de un bien** (por ejemplo, el motor nuevo de una furgoneta): ¿se mueven siempre con su bien, o prefieres elegirlas tú?
2. **La cuenta de gasto**: ¿basta con que valga para las próximas dotaciones, o quieres también trasladar lo dotado este año?
3. **La cuenta nueva**: ¿la misma para todos los bienes marcados, o una distinta para cada uno?
