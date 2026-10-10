---
name: importador-existe
description: Desde el 27/08/2026 la API tiene importador de CSV y Excel para plan, diario e inmovilizado; el frontend no tiene pantalla todavía.
metadata:
  type: reference
---

Desplegado en facturae el 27/08/2026, descrito en el apartado **17 bis** de la
guía. Trae desde CSV o Excel: cuentas del plan, apuntes del diario y bienes de
inmovilizado. Aquí no hay pantalla todavía: es la **fase 12** de `PLAN.md`, colocada después
de la consulta porque quien acaba de importar va al diario a comprobarlo.

Lo que condiciona la pantalla el día que se haga:

- Circuito de cuatro pasos: `subir` → (`previsualizar`) → **`ensayar`** →
  `importar`. `ensayar` no escribe y devuelve el mismo informe que saldría al
  importar. **No es opcional:** es lo que evita meter mil apuntes mal de un
  clic.
- **`/importador/subir` es la única llamada que no es JSON**: es
  `multipart/form-data`, con `mapeo` y `opciones` como JSON dentro de campos de
  texto. Máximo 20 MB. Rompe la regla de «todo es POST con cuerpo JSON».
- Separador y codificación se detectan solos y el usuario puede corregirlos.
  `faltan_obligatorios` es lo que apaga el botón de ensayar.
- **Los asientos entran como borrador** salvo que el archivo traiga una columna
  `contabilizar` con un sí claro. Hay que decirlo en pantalla antes de importar:
  quien sube un histórico lo busca en el diario y está en borradores.
- **El número de asiento del archivo no se conserva.** La correspondencia
  `asiento_origen` → `asiento` viene en la respuesta y en `/detalle`.
- En el informe, las incidencias con `aviso: true` (motivo que empieza por
  `Aviso:`) **no impiden la entrada**: se pintan distinto de los rechazos.
  Los campos `asientos_*` solo vienen con destino diario.
- `/importador/campos` da la lista de campos mapeables con cuál es obligatorio,
  así que la pantalla de mapeo se construye sola.
- Hay plantillas de mapeo, historial y `deshacer` (nivel `cierre`; lo que ya no
  se puede tocar se queda y viene en `pendientes`).
- Niveles: subir, ensayar e importar piden `apuntes`, salvo destino `plan`, que
  pide `cierre`.

**Pendiente con el backend:** cuando se monte la pantalla, decirle si el informe
basta para pintarlo y si falta algún campo mapeable. Ver [[canal-con-backend]].
