# Cierre de ejercicio

Sección `Cierre de ejercicio`, suelta en el menú. Nivel `cierre`.

Regularizar el ejercicio, cerrarlo y abrir el siguiente. Es lo más
irreversible que hace el programa, así que la pantalla está montada para que
nada ocurra sin haberlo visto antes.

El título lleva el año: `Cierre del ejercicio 2025`, el que esté elegido en la
cabecera. Sin ejercicio elegido no se enseña nada más que el aviso
`Elige un ejercicio en la cabecera para cerrarlo.`

## Los dos asientos nacen como borradores

Es la decisión que sostiene toda la pantalla. La regularización y el cierre **se
preparan en borrador**: se pueden mirar enteros en el diario, y deshacerse sin
dejar rastro. Solo al confirmar entran en el libro.

Por eso deshacer **no es ninguna excepción** a la regla de que un asiento
confirmado no se toca: ninguno de los dos llegó a entrar.

La API tiene también `/cierre/cerrar` y `/cierre/abrir`, que hacen todo de una
vez y sin vuelta atrás. **Aquí no se usan.**

## El orden en que se ve

Lo primero es **qué falta por hacer**; solo después, qué va a pasar. Al revés
—enseñar el resultado y luego decir que no se puede— se lee como una promesa que
después se retira.

### 1. Antes de cerrar

La lista de impedimentos, **redactada por la API** y enseñada tal cual. Cada uno
lleva una marca que dice si frena o solo avisa: `Impide cerrar` en rojo, `Aviso`
en amarillo. Lo único que decide la interfaz es de qué color va, y eso lo dice
el propio dato.

Si no hay nada, en verde: `No hay nada pendiente: el ejercicio se puede cerrar.`

Encima va la casilla `Contar los asientos en borrador`, **desmarcada de
entrada**: lo normal es cerrar con el ejercicio ya resuelto, y esto sirve para
mirar cómo quedaría antes. Marcándola, los asientos a medias dejan de frenar y
pasan a ser un aviso, pero **siguen en la lista**, porque sigue habiendo algo que
hacer. Con el cierre ya preparado la casilla se bloquea: lo preparado se hizo
con un criterio y cambiarlo por debajo confundiría.

### 2. Qué va a pasar

Se ve **desde el primer momento**, aunque todavía no se pueda cerrar: el ensayo
no se frena por lo que falte. Eso es lo que hace que la pantalla sirva para
preparar el cierre y no solo para rematarlo.

Dos recuadros, en el orden en que ocurren, con la fecha de los asientos arriba:

- **Regularización** — `Cuentas que se saldan`, `Gastos`, `Ingresos`,
  `Resultado` y `Va a la cuenta`.
- **Cierre** — `Cuentas con saldo` e `Importe`.

**El detalle cuenta a cuenta no está aquí**, a propósito: está en el borrador,
que se abre en el diario y se ve entero. Repetirlo sería una lista más que
mantener y que puede quedarse vieja.

Cuando lo que se está viendo es provisional —porque cuentan los borradores— sale
en amarillo la nota que escribe la API, que dice por qué no se puede cerrar así.

### 3. Preparar, y luego confirmar

Un estado arriba, junto al título: `Sin empezar`, `Preparado, pendiente de
confirmar` o `Cerrado`.

Sin preparar hay un botón, `Preparar el cierre…`, apagado mientras haya algo que
lo impida o mientras lo que se ve sea provisional.

Ya preparado, dos: `Deshacer…` y `Confirmar el cierre…`, este último en rojo. Y
dos avisos que no se pueden saltar:

> Preparar no cierra el ejercicio: sigue admitiendo apuntes. Si se apunta algo
> después de preparar, hay que deshacer y volver a preparar.

> Al confirmar, los dos asientos entran en el libro y el ejercicio queda
> cerrado. Esto ya no se puede deshacer.

Con el ejercicio cerrado no se ofrece ninguna acción: ni impedimentos, ni
casilla, ni botones.

## La apertura del ejercicio siguiente

Un recuadro al final, `Apertura del ejercicio siguiente`, con los mismos pasos:
se prepara en borrador, se mira y se confirma. El ejercicio nuevo es el
siguiente al cerrado.

Mientras el cierre no esté confirmado, solo se lee:

> La apertura solo se puede preparar con el cierre del ejercicio anterior ya
> confirmado.

No es un capricho de la pantalla: la API se niega, porque la apertura arrastra
los saldos del cierre y en borrador todavía pueden cambiar.

Con el cierre confirmado sale `Preparar la apertura…`, y una vez preparada, una
frase con lo que se arrastra —cuántas cuentas, por cuánto, a qué ejercicio y con
qué fecha— y los botones `Deshacer…` y `Confirmar la apertura…`.

## Lo que no está

Ni el cierre ni la apertura se pueden deshacer una vez confirmados. Está en
`../planificacion/pendientes.md`.
