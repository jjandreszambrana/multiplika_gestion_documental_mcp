# Ejercicios

En `Utilidades → Ejercicios`. Nivel `cierre`.

Título `Ejercicios`, botón `Abrir ejercicio…` y la lista de los que hay, con su
estado y sus acciones: `Bloquear…` y `Desbloquear…`.

## Los cuatro estados, que no son lo mismo

| Marca | Qué significa |
|---|---|
| `cerrado` | Definitivo. No admite ningún cambio |
| `bloqueado` | Bloqueado para revisión. **Reversible** |
| `cerrando` | Proceso de cierre en curso. Bloqueo transitorio, lo pone y lo quita el proceso |
| `deshabilitado` | De un periodo ya presentado, **no del ejercicio** |

La interfaz **apaga los botones antes**, en vez de dejar teclear un asiento
entero y perderlo al guardar.

Cada ejercicio trae también `apertura` y `cierre` —primer y último día—, que usa
el diario para saber por dónde abrirse, y `primero_apertura`, que dice si aún no
se ha generado su asiento de apertura.

## Periodos

Panel con los periodos del ejercicio: `Periodo`, `Desde`, `Hasta`, `Estado`. Un
periodo presentado no admite apuntes, y ese es el `deshabilitado` de arriba.

## Al cambiar algo

La cabecera y la pantalla leen la misma lista de ejercicios, así que tras abrir,
bloquear o desbloquear se rehace **una sola vez y en un único sitio**. Si el
ejercicio elegido deja de estar, se cae al más reciente.
