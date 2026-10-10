---
name: documentacion-dentro-del-proyecto
description: Toda la documentación va en docs/ del repositorio; nada de artefactos publicados fuera.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a43f9bfd-e067-41e6-ab88-2637e50453ae
  modified: 2026-09-02T04:26:12.578Z
---

Nada de publicar artefactos ni documentos fuera del repositorio. Todo lo que se
escriba —planes, resúmenes de datos, vistas previas, decisiones— va a `docs/`
del propio proyecto, en Markdown, y entra en git con el resto.

**Por qué:** dicho el 02/09/2026. Un documento publicado fuera se le queda
descontrolado: no está versionado, no se encuentra al retomar el proyecto y no
lo ve quien mire el repositorio.

**Cómo aplicarlo:**

- `docs/interfaz/` para lo que hace cada pantalla, `docs/planificacion/` para lo
  que todavía se está decidiendo.
- Si hace falta enseñar algo visual, se describe en el Markdown; no se monta una
  página aparte.
- Ver [[pendientes-en-fichero]] y [[canal-con-backend]], que siguen el mismo
  criterio: lo que importa queda por escrito y en su sitio.
