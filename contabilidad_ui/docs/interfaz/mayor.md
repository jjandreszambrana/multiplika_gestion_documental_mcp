# Mayor

En `Informes → Mayor`. Nivel `consulta`.

Los movimientos de una cuenta en orden, con el saldo corriente. Se elige la
cuenta con el mismo buscador que el resto del programa —por número o por título,
y el punto se rellena con ceros— y se pulsa `Ver`.

`Informes` es un grupo desde el principio, aunque hoy solo cuelgue el mayor:
detrás vienen sumas y saldos, balance y pérdidas y ganancias.

Junto al título va el botón de ayuda, con la clave **`informes`**: es **una sola
ayuda para todos**, no una por informe. El periodo, los borradores y el Excel son
las mismas dudas en los cuatro, y escribirlas por separado acaba en tres textos
que dicen cosas distintas. Lleva primero lo común y después un apartado por
informe.

## Lo que se ve

Columnas: `Fecha`, `Asiento`, `Concepto`, `Documento`, `Debe`, `Haber`, `Saldo`,
y al final la marca de borrador. El debe y el haber se dejan **en blanco cuando
son cero**, que es como se lee un mayor.

**No pagina.** Se trae entero y se recorre con el scroll, con la cabecera fija.
La API topa a mil apuntes por llamada, así que se piden en tandas hasta juntar
el total; eso vive en `src/api/informes.ts`, no en la pantalla.

Sobre la tabla, dos casillas de fecha para acotar y `Incluir borradores`,
**marcada de entrada**: el diario ya los enseña como uno más, y un mayor que los
dejara fuera diría un saldo distinto del que se está viendo al lado.

## Los borradores

Se marcan con 📝 y `Asiento en borrador`, la misma marca que en el diario y en
asientos eliminados. Las filas van del **mismo naranja**, y lo marcado en azul
por encima: lo que se acaba de señalar tiene que verse aunque sea un borrador.

## Debajo de la tabla

- `Saldo anterior` — lo que la cuenta arrastraba antes del primer apunte. Es lo
  que hace que el saldo de lo que se está viendo signifique algo cuando se ha
  acotado el periodo.
- `Saldo` — el del periodo entero. **Cuenta los borradores** si están pedidos.
- `Saldo firme` — el mismo sin ellos. **Solo aparece si hay alguno**; sin
  borradores sería el mismo número repetido.
- El número de movimientos.

Todos los calcula la API. Aquí no se acumula ninguna columna.

Al marcar filas con su casilla sale además la suma de lo marcado: cuántos
apuntes, `Debe`, `Haber` y `Diferencia`. **Es la única cuenta que echa esta
pantalla**, y solo porque es el total de una columna a la vista. Va con
decimal.js y con tests.

## Corregir un borrador desde aquí

El número de asiento de una fila en borrador es un enlace —`Corregir el
borrador…`— y abre el editor. Nivel `apuntes`.

Al volver, el mayor se rehace **solo si se llegó a escribir algo**: cancelar sin
tocar nada no obliga a bajarlo otra vez. Y mientras llega lo nuevo las filas de
antes se quedan puestas, para que la tabla no se vacíe ni pierda el sitio por el
que se iba.

## Descargar en Excel

Botón con la hoja de cálculo verde, junto a los filtros. Se baja **lo mismo que
se está viendo**: la cuenta, el periodo acotado y con o sin borradores.

El fichero lo arma la API entero —cabecera con la empresa, la cuenta y su
título, columna `Borrador` para poder filtrar, totales al pie y las fechas como
fechas de verdad para que Excel las ordene—. Aquí no se formatea ni un importe:
el porqué está en `../planificacion/decisiones.md`.

## El mayor sin salir de donde estás

Se abre en modal desde otros dos sitios, siempre con el ejercicio entero:

- **Desde el diario**, pinchando la cuenta de cualquier apunte. El clic no marca
  la fila: ver el mayor no cambia lo que se tenía seleccionado.
- **Desde una línea del asiento que se está tecleando**, con el icono de libro
  al lado de la casilla de cuenta. No le quita el foco a la casilla, así que al
  cerrar se sigue tecleando donde se estaba, y abre la cuenta **ya expandida**:
  con `430.1` escrito enseña el mayor de la 430000001.

**Desde el editor de asientos el número no es enlace**, y es a propósito: allí
ya se está tecleando un asiento y abrir otro encima haría perder lo que se
lleva. Además el mayor puede estar enseñando ese mismo borrador, que todavía no
existe como asiento cerrado.

En el diario el mayor se queda abierto **por debajo** del editor, con un z-index
menor. Esconderlo y volver a enseñarlo hacía la animación de apertura entera y
la pantalla daba un salto.
