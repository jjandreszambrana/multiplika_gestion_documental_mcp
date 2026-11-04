# Instalación en red privada (VPN)

Plan, 2026-10-07. Solo planificación: nada implementado. Lo marcado **[DECIDIR]** queda pendiente del usuario; lo marcado **[COMPROBAR]** hay que verificarlo antes de vender o montar la opción.

## Qué es

Hoy cada cliente usa un servidor MCP + GD publicado en internet (`https://<servidor>/mcp` y `/panel`), protegido por API key, usuario/contraseña y TLS. La alternativa es montar el mismo producto en un servidor que **no se ve desde internet**: solo se llega a él estando dentro de una red privada virtual (VPN) del cliente.

Dos variantes, con el mismo software:

| Variante | Dónde está la máquina | Para quién |
| --- | --- | --- |
| **A. Servidor local** | En la oficina del cliente | Quiere los datos físicamente en casa |
| **B. Servidor en centro de datos (DC)** | Servidor dedicado o VPS en un DC de la UE, a nombre del cliente o de Multiplika | Quiere aislamiento sin mantener hardware |

En las dos, el servidor solo tiene abierto hacia internet el puerto de la VPN. Panel, MCP, SSH y base de datos solo responden por dentro del túnel.

## El punto clave: quién llega al servidor

| Quién | Hoy (público) | En red privada |
| --- | --- | --- |
| Panel web (navegador del usuario) | Internet | Por la VPN. Funciona igual |
| Claude Desktop / Claude Code en el PC del usuario | Internet | Por la VPN, si el MCP se configura como conexión **local** del equipo (ver abajo). Funciona |
| claude.ai web, app de móvil y conectores personalizados de Claude Desktop | Llegan desde los servidores de Anthropic, no desde el PC del usuario | Llegan **a través de la portería** (en el mismo servidor o aparte, ver "Variante con portería"). Sin portería no llegan |
| ChatGPT (cualquier versión) | Llega desde los servidores de OpenAI | Igual que la fila anterior, añadiendo sus IPs al filtro de la portería **[COMPROBAR]** |
| Multiplika (despliegues, soporte) | SSH por internet | Por la VPN, con un usuario de VPN propio que el cliente puede cortar |

Es decir: sin portería, la IA se usa solo desde el ordenador del usuario (Claude Desktop o Claude Code). Con portería, también desde la web, el móvil y ChatGPT. Hay que dejarlo claro en la venta.

**Cómo se conecta Claude Desktop sin pasar por la nube de Anthropic.** En `claude_desktop_config.json` se declara un servidor local que hace de puente con la URL interna, por ejemplo con `mcp-remote`:

```json
{
  "mcpServers": {
    "gd-empresa": {
      "command": "npx",
      "args": ["mcp-remote", "https://gd.interno.empresa.es/mcp", "--header", "x-api-key:${GD_API_KEY}"],
      "env": {"GD_API_KEY": "..."}
    }
  }
}
```

Claude Code lo admite directamente: `claude mcp add --transport http gd-empresa https://gd.interno.empresa.es/mcp --header "x-api-key: ..."`. **[COMPROBAR]** el puente en Windows y macOS con la versión de Claude Desktop vigente al montarlo; preparar un instalador o guía de una página para el cliente.

**Variante con portería (para claude.ai web, móvil y conectores).** Si el cliente necesita la IA desde la web o el móvil, se añade un canal solo para `/mcp` sin abrir ningún puerto en el servidor de la GD:

```
 Anthropic (claude.ai, móvil, conectores)
        │  https://gd-empresa.multiplika.net/mcp
        ▼
 Portería pública (Multiplika o Cloudflare Tunnel)
   · solo deja pasar /mcp
   · solo desde las IPs de salida publicadas por Anthropic
   · límite de peticiones por minuto
        ▲
        │  túnel abierto DESDE la GD hacia fuera (WireGuard o cloudflared)
        │
 Servidor GD (sin puertos de entrada; panel, SSH y BD solo por la VPN)
```

**Dónde va la portería: lo elige el cliente según el caso.**

| | En el mismo servidor de la GD | En un servidor aparte |
| --- | --- | --- |
| Cómo | El Apache de la GD publica solo `/mcp` en el 443, filtrado por IPs de Anthropic; panel, SSH y BD siguen solo por la VPN | VPS propio o Cloudflare Tunnel; la GD abre el túnel hacia fuera (ver abajo) |
| Coste | Sin coste extra | VPS pequeño o cuenta de Cloudflare |
| Puertos abiertos en el servidor con los datos | Uno (443) | Ninguno |
| Si aparece un fallo de seguridad en Apache o en el filtro | El atacante tiene delante el servidor con los datos | Como mucho cae la portería; la GD sigue sin puertos de entrada |
| Recomendado para | Clientes que quieren la VPN sobre todo para cerrar el panel | Clientes con datos sensibles o exigencias de auditoría |

Opciones para la portería en servidor aparte:

- **Portería propia**: un VPS pequeño de Multiplika (vale uno para todos los clientes con esta variante) con Apache/Caddy filtrando por IP y ruta, y un WireGuard al que se conecta cada GD. Control total, un servidor más que mantener.
- **Cloudflare Tunnel**: `cloudflared` en la GD abre el túnel hacia Cloudflare; una regla WAF limita `/mcp` a las IPs de Anthropic y una regla de ruta bloquea todo lo demás. Sin servidor extra; el tráfico pasa descifrado por Cloudflare (es el proxy TLS). **[DECIDIR]** cuál de las dos.
- La autenticación sigue siendo la API key de siempre (`x-api-key`), con rol y dueño.

Límite a explicar: las IPs de Anthropic las comparten todos los usuarios de Claude del mundo. El filtro deja fuera a cualquier atacante normal, pero otra cuenta de Claude que apunte a la URL llega hasta la GD y solo la para la clave. Medidas que acompañan: claves largas, retirada inmediata (ya existe), renovación periódica **[DECIDIR]** (p. ej. aviso a los 6 meses) y vigilar en `gd_actividad`/logs los intentos con clave errónea.

**[COMPROBAR]** la lista de IPs de salida vigente de Anthropic para conectores MCP y cómo se avisa de cambios (si cambia sin aviso, el canal se corta hasta actualizar la regla); y que el conector de claude.ai sigue funcionando a través del túnel (sesiones largas, streaming).

## Qué sigue saliendo a internet (y por qué no es un problema)

La VPN corta lo que **entra**; lo que el servidor pide hacia fuera sigue funcionando a través del cortafuegos:

| Salida | Para qué |
| --- | --- |
| API de Anthropic | Chat del panel, estructurar documentos con IA |
| Mistral u OpenAI | Búsqueda por significado (embeddings) |
| IMAP / SMTP / Microsoft 365 | Correo |
| Google, redes sociales, Cloudflare, Ayrshare | Webs y redes |
| SIF (`sif2.multiplika.net`) | CRM |
| SFTP de copias | Copia en otro servidor |

Se puede cerrar la salida a todo excepto esta lista (cortafuegos de salida por destino). **[DECIDIR]** si se ofrece por defecto o solo a quien lo pida.

Ser honestos en la venta: la VPN decide **quién puede entrar**, pero el texto que procesa la IA sigue viajando cifrado a Anthropic y al proveedor de embeddings, igual que hoy. Si el cliente exige que nada salga de su red, haría falta IA local (fuera de este plan; ver "Fuera de alcance").

## Funciones afectadas

| Función | Qué pasa | Solución propuesta |
| --- | --- | --- |
| Compartir por enlace | El destinatario externo no está en la VPN y no puede abrir el enlace | **[DECIDIR]**: (a) desactivarla y enviar el PDF por correo con `gd_envios`; (b) un "buzón de salida" público mínimo en un servidor Multiplika al que la GD **sube** el PDF congelado (sale, no entra) y que sirve solo esos enlaces |
| Conexión con cuentas Google / Microsoft 365 (OAuth) | La vuelta del login la hace el navegador del usuario, que está en la VPN | Funciona. **[COMPROBAR]** que Google y Microsoft aceptan una URL de vuelta con dominio interno (deberían; no la visitan ellos) |
| GDs enlazadas (central de conocimiento) | La central o el cliente pueden estar en redes distintas | Túnel VPN entre los dos servidores (sitio a sitio), solo hacia el puerto MCP de la central |
| Avisos por correo, resumen de las 8:00, programaciones | Salen hacia fuera | Funcionan |
| Formularios web que crean clientes (CRM, previsto) | La web tendría que llamar a la GD | Usar la vía por correo (la GD lee el buzón) o el buzón de salida de arriba en sentido inverso |

## Arquitectura

```
 PC del usuario ──(WireGuard)──┐
 Portátil fuera ──(WireGuard)──┼──► Servidor GD  ── 10.20.0.1
 Multiplika soporte ─(WG)──────┘     · Apache 443 (panel + /mcp), solo en la interfaz VPN
                                     · MariaDB/Postgres solo en 127.0.0.1
                                     · SSH solo en la interfaz VPN
                                     · Internet: solo UDP 51820 abierto
```

**VPN: WireGuard [DECIDIR].** Es simple, rápida, viene en el núcleo de Linux y tiene clientes oficiales para Windows, macOS, iOS y Android. Una clave por persona/equipo; dar de baja a alguien es borrar su línea. Alternativa si el cliente ya tiene VPN corporativa (Fortinet, Sophos, OpenVPN...): meter el servidor detrás de la suya y no montar otra.

**Gestión de usuarios de la VPN.** Sin panel nuevo en v1: un script `vpn_usuario.py alta|baja|lista` en el servidor que genera el fichero de configuración y un QR para el móvil. **[DECIDIR]** si más adelante se lleva al panel de administración de la GD.

**Nombre y certificado.** Un nombre interno (`gd.interno.empresa.es` o subdominio de Multiplika) que solo resuelve dentro de la VPN, con certificado real de Let's Encrypt obtenido por validación DNS (no necesita que el servidor sea visible). Así el navegador no muestra avisos y los clientes MCP no rechazan la conexión.

**Software.** El mismo de los 5 servidores actuales: `sync.py` ya despliega en un servidor nuevo dado de alta en `config_servidores.py` (como se hizo con Maderas Cilpe). Diferencias:

- `sync.py` se lanza con la VPN de Multiplika levantada (el host del servidor es su IP interna).
- No hay ISPConfig: el vhost de Apache y el proxy de `/mcp` y `/panel` se dejan en una plantilla versionada en vez de pegarse a mano en el panel. **[DECIDIR]** Apache como hoy, o Caddy (más simple en un servidor dedicado).
- Los repos de proyecto se clonan desde el servidor: necesita salida a `git.multiplika.net` (o se suben con rsync desde el equipo de despliegue).

## Variante A: servidor local

**Máquina orientativa** (para un cliente de 5-15 usuarios y unos miles de documentos): mini servidor o torre con 4 núcleos, 16 GB de RAM y 2 discos SSD de 1 TB en espejo (RAID 1). Precio orientativo 1.000-1.800 € **[COMPROBAR]** al presupuestar. Sistema: Debian o Ubuntu LTS.

Requisitos en la oficina del cliente:

- SAI (batería) para cortes de luz.
- Abrir en el router un único puerto UDP hacia el servidor (o que el router ya sea el servidor VPN).
- IP fija o un nombre dinámico (DDNS) para que los usuarios de fuera encuentren la VPN.
- Copia fuera de la oficina: las copias programadas de la GD ya pueden mandarse por SFTP a otro servidor; aquí pasa a ser **obligatorio**, porque un incendio o robo se lleva servidor y datos a la vez.

Riesgos a explicar: la disponibilidad depende de la luz e internet de la oficina; si se cae la línea, los que trabajan fuera se quedan sin GD.

## Variante B: servidor en centro de datos

- Servidor dedicado o VPS en la UE, 8-16 GB de RAM. Orientativo 25-80 €/mes **[COMPROBAR]** con el proveedor.
- Cortafuegos del proveedor + `nftables` en la máquina: solo UDP 51820 abierto.
- Disco cifrado si el proveedor lo permite **[DECIDIR]** (protege frente a un disco retirado del DC; complica los reinicios, que piden la clave).
- Copia SFTP a un segundo proveedor o a la oficina del cliente.

Es la variante recomendada para la mayoría: mismo aislamiento frente a internet, sin depender de la oficina.

## Mantenimiento y soporte

- Actualizaciones de la GD: igual que hoy con `sync.py`, entrando por la VPN de Multiplika. Mensaje claro de "súbelo = todos los servidores": este servidor entra en la lista, pero si su VPN está caída el despliegue no debe bloquear a los demás **[COMPROBAR]** cómo se comporta `sync.py` hoy ante un servidor inaccesible.
- Actualizaciones del sistema: `unattended-upgrades` solo de seguridad.
- Vigilancia: el servidor envía un latido (petición saliente) a un monitor de Multiplika; si deja de llegar, aviso. No requiere abrir nada.
- El cliente puede cortar el acceso de Multiplika en cualquier momento borrando su clave de VPN; se le explica que entonces no hay actualizaciones ni soporte.

## Fases

1. **Prototipo en DC** (2-3 días): VPS de prueba, WireGuard, Apache solo en la interfaz VPN, certificado por DNS, despliegue con `sync.py` por la VPN. Probar panel, Claude Desktop con el puente y Claude Code.
2. **Ajustes de producto** (2-4 días): decidir y hacer lo de "Compartir por enlace"; script de usuarios VPN; plantilla de Apache; comprobar OAuth de Google/M365; guía de una página para el usuario final.
3. **Primer cliente** (1-2 días + tiempo del cliente): alta, formación, prueba de restauración de copia.
4. **Variante local** cuando la pida un cliente: misma receta más la parte de hardware, router y SAI.

## Fuera de alcance

- **IA local** (modelos ejecutándose en el propio servidor para que ningún texto salga): exige otra máquina (GPU) y otra calidad de respuesta. Se estudia aparte si algún cliente lo pide.
- Alta disponibilidad (dos servidores a la vez).
- Panel para gestionar la VPN.
