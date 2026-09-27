# Sistema de reglas con jerarquía de contexto para la GD

> **Implementado el 2026-09-27** (sin probar todavía de punta a punta). Lo que se hizo, y las seis decisiones que se apartan de este plan, en `docs/gestion-documental.md` → "Reglas de comportamiento: jerarquía de contexto para la IA".

## Problema que resuelve

Hoy las instrucciones a la IA se guardan como documentos normales, mezclados con normativa e informes. La IA tiene que buscarlos, leerlos e interpretarlos cada vez, lo que encarece el uso y no garantiza que los cargue en el momento adecuado. Además no hay separación entre "contenido" (documentos) y "comportamiento" (cómo debe actuar la IA).

---

## Propuesta

Una tabla de reglas independiente por GD, con un mecanismo de carga propio, completamente separada de los documentos.

### Modelo de datos de una regla

```json
{
  "id": "regla_001",
  "texto": "El correo de contacto de esta empresa es contacto@empresa.com",
  "categoria": "datos_empresa",
  "global": true,
  "ambito": "propia",
  "prioridad": 1,
  "activa": true,
  "fecha_creacion": "2026-09-27"
}
```

| Campo | Descripción |
|---|---|
| `texto` | La instrucción en sí, redactada para la IA |
| `categoria` | Agrupa reglas por tipo: `datos_empresa`, `boletines`, `correo`, `estilo`, `facturacion`… |
| `global` | Si `true`, se inyecta siempre en el system prompt al inicio de sesión |
| `ambito` | `propia` = solo esta GD; `heredada` = viene de la GD central |
| `prioridad` | Resuelve conflictos: mayor número gana. Reglas de la GD cliente siempre > central |
| `activa` | Permite desactivar sin borrar |

---

## Carga en tres niveles

### Nivel 1 — Inicio de sesión (automático)

El servidor MCP inyecta en el system prompt todas las reglas con `global: true`:
- Primero las de la GD propia.
- Luego las heredadas de la central (si la GD está enlazada a una central).
- En caso de conflicto entre regla propia y heredada de la misma categoría, prevalece la propia.

**Siempre incluida**: la regla meta (ver más abajo).

### Nivel 2 — Bajo demanda (la IA decide cuándo)

Antes de iniciar una tarea especializada, la IA llama a `obtener_reglas_gd(categoria)` para cargar las reglas de esa categoría. Solo consume tokens cuando es relevante.

### Nivel 3 — Regla meta (inyectada por el servidor en toda GD)

Texto fijo que el servidor añade siempre, independientemente de las reglas del usuario:

> *Las reglas globales de esta GD ya están en tu contexto. Antes de iniciar cualquier tarea especializada, carga las reglas de la categoría correspondiente con `obtener_reglas_gd(categoria)`. En caso de conflicto entre reglas de esta GD y de la GD central, las de esta GD tienen prioridad.*

---

## Jerarquía de precedencia (de mayor a menor)

1. Reglas propias de la GD cliente (`global: true` y cargadas bajo demanda)
2. Reglas heredadas de la GD central
3. Instrucciones del servidor MCP (las actuales, en el system prompt del servidor)

---

## Herramientas MCP nuevas

| Herramienta | Parámetros | Descripción |
|---|---|---|
| `obtener_reglas_gd` | `categoria?` | Devuelve reglas activas (propias + heredadas, conflictos resueltos) |
| `crear_regla_gd` | `texto, categoria, global` | Crea una regla nueva |
| `listar_reglas_gd` | `categoria?` | Lista reglas con su estado y ámbito |
| `actualizar_regla_gd` | `id, cambios` | Edita texto, categoría, global o activa |
| `eliminar_regla_gd` | `id` | Elimina una regla |

---

## Cambios en el servidor

### Al construir el system prompt

1. Consultar todas las reglas `global: true` y `activa: true` de la GD.
2. Si la GD tiene una central enlazada, añadir también sus reglas globales (respetando prioridades).
3. Concatenar las reglas al system prompt en una sección claramente delimitada.
4. Añadir siempre la regla meta al final de esa sección.

### Nuevo endpoint de reglas

Tabla en base de datos: `gd_reglas` con los campos del modelo de datos descrito. La herramienta `obtener_reglas_gd` resuelve en una sola consulta las reglas propias y las heredadas, aplicando prioridades.

---

## Interfaz de usuario (panel web)

- Sección "Reglas de comportamiento" separada de "Documentos".
- Listado con filtro por categoría y por ámbito (propias / heredadas).
- Casilla "Global" por regla, con indicador visual de cuáles se inyectan en cada sesión.
- Indicador del peso aproximado de las reglas globales (número de tokens).

---

## Criterio para marcar una regla como global

Una regla es global si la IA la necesitaría para casi cualquier tarea en esa GD, independientemente de lo que se le pida. Ejemplos:

- Global: "El correo de contacto es X", "Los documentos se redactan en español", "Esta GD pertenece a la empresa Y".
- No global: "Al generar un boletín microbiológico, usa n=5 réplicas", "Los albaranes de compra usan el formato Z".

---

## Impacto estimado en coste de tokens

Las reglas globales se inyectan en cada llamada a la API. Con reglas bien redactadas (concisas, una instrucción por regla) el overhead es bajo: 10-20 reglas globales equivalen a unos 300-500 tokens por sesión, menos de lo que ocupan las instrucciones actuales del servidor.

Las reglas bajo demanda solo consumen tokens cuando son invocadas, por lo que su impacto es nulo en tareas donde no son relevantes.
