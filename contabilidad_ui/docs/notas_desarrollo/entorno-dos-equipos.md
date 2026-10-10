---
name: entorno-dos-equipos
description: El proyecto se trabaja desde dos equipos; Node está instalado a mano en ~/.local y puede no existir en el portátil.
metadata: 
  node_type: memory
  type: project
  originSessionId: c3e62852-a31e-41bf-858a-12a6a54c1dbf
  modified: 2026-08-25T11:31:44.216Z
---

Jorge trabaja este proyecto desde dos equipos: el de sobremesa y un portátil.
En el de sobremesa, Node no venía instalado y el 25/08/2026 se puso a mano en
`~/.local/lib/node24` (v24.19.0), con enlaces en `~/.local/bin`. No hay gestor
de versiones (ni nvm ni fnm) ni Node del sistema.

**Why:** en el portátil probablemente tampoco haya Node, y sin él no arranca
nada: ni `npm install`, ni el servidor de desarrollo, ni los tipos.

**How to apply:** al retomar desde otro equipo, comprobar `node -v` antes de
nada. Si falta, instalarlo igual: descargar el tarball oficial de nodejs.org,
verificar el SHA256 contra `SHASUMS256.txt`, descomprimir en `~/.local/lib` y
enlazar `node`, `npm` y `npx` en `~/.local/bin`, que ya está en el PATH. Después
`npm install` en el proyecto. No hace falta sudo.
