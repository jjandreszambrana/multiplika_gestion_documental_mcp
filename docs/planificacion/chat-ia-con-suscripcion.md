# Chat de IA con la suscripción de cada usuario

Estado: EN BACKLOG (2026-10-10), sin código. Retomar más adelante.

## Problema

El asesor contable consume muchos tokens del pago por uso (API) del
desarrollador. Se buscaba que cada usuario use su propia suscripción de
Claude o ChatGPT.

## Descartado

- **Meter la suscripción del usuario dentro del panel de la GD** (login con su
  cuenta de Claude desde nuestra web o con el Agent SDK): Anthropic no lo
  permite a apps de terceros salvo aprobación expresa. Riesgo de bloqueo de la
  cuenta del cliente.
- **Incrustar la app oficial de Claude/ChatGPT en una ventana de la GD**: no se
  puede incrustar ni controlar desde fuera.
- **GD de escritorio con dos ventanas lado a lado** + enlace con la pregunta
  ya escrita (`claude.ai/new?q=...`, `chatgpt.com/?q=...`): posible, pero
  queda superado por MCP Apps.

## Opción elegida para cuando se retome: MCP Apps en Claude

El conector MCP de la GD, además de datos, devuelve trozos de pantalla de la
GD que Claude pinta dentro del chat (p. ej. tabla de facturas pendientes con
botones "Contabilizar" / "Ver PDF"). Al pulsar un botón, la mini pantalla manda
un mensaje a la conversación (`ui/message`, rol user) y Claude responde. Todo
dentro de la app oficial y con la cuota del usuario: 0 tokens para el
desarrollador.

Comprobado el 2026-10-10:

- **Claude**: MCP Apps desde 2026-01-26, todos los planes, web y escritorio,
  con conectores propios (plan Free: solo 1 conector propio). Móvil: añadir
  conectores en beta; sin confirmar que se vean las mini pantallas.
  `ui/message` lo puede limitar o rechazar el host.
- **ChatGPT**: conectores propios con escritura solo en Business /
  Enterprise / Edu (los pone el admin, solo web). Pro: solo lectura en modo
  desarrollador. Plus y Free: no. Alternativa: publicar en el catálogo oficial
  de apps (revisión de OpenAI) para que lo instale cualquier usuario de pago.

Límite que no se puede evitar: la GD no puede escribir sola en el chat. Se
suple pasando los avisos pendientes en el contexto inicial al abrir una
conversación nueva.

## Fuentes

- https://alpic.ai/blog/mcp-apps-goes-official-claude-chatgpt-support
- https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities
- https://sunpeak.ai/docs/mcp-apps/app/requests/send-message
- https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt
