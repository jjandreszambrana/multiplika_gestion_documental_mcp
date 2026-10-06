import { ActionIcon, AppShell, Avatar, Badge, Group, Menu, NavLink, Text, ThemeIcon, Tooltip, UnstyledButton, useMantineColorScheme } from "@mantine/core"
import {
  IconFileText,
  IconCategory,
  IconFolders,
  IconPalette,
  IconBriefcase,
  IconUsers,
  IconKey,
  IconLock,
  IconCertificate,
  IconBellRinging,
  IconMail,
  IconHelpCircle,
  IconInbox,
  IconMessageCircle,
  IconCode,
  IconWorld,
  IconGavel,
  IconClipboardList,
  IconLink,
  IconLogout,
  IconHeadset,
  IconSun,
  IconMoonStars,
  IconArrowsRightLeft,
  IconCheck,
  IconActivity,
  IconBell,
  IconAlarm,
  IconNotebook,
  IconProgressCheck,
} from "@tabler/icons-react"
import { formatearFecha } from "../formato"

function Item({ icon: Icon, label, active, onClick, badge }) {
  return (
    <NavLink
      label={label}
      leftSection={<Icon size={17} stroke={1.75} />}
      rightSection={
        badge ? (
          <Badge size="sm" circle variant="filled" color="red">
            {badge}
          </Badge>
        ) : null
      }
      active={active}
      onClick={onClick}
      styles={{ root: { borderRadius: "var(--mantine-radius-md)" } }}
    />
  )
}

export default function Sidebar({
  proyecto, esSuperadmin, vista, pendientesCount, noLeidas = 0, onNavigate, onCerrarSesion,
  empresas = [], idTenantActual, onCambiarEmpresa, chatAbierto, onAlternarChat,
}) {
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  // "auto" (el valor de partida, ver main.jsx) sigue el sistema operativo
  // de cada dispositivo — de ahí que el mismo usuario viera el panel
  // claro en un sitio y oscuro en otro. En cuanto elige aquí, Mantine
  // guarda "light"/"dark" en localStorage y ya no vuelve a seguir al
  // sistema en ese navegador.
  const esOscuro = colorScheme === "dark"

  const rolEtiqueta = esSuperadmin
    ? "Modo soporte"
    : proyecto.es_admin
      ? "Administrador"
      : proyecto.puede_editar
        ? "Operador"
        : "Invitado (solo lectura)"

  return (
    <AppShell.Navbar p="md">
      <AppShell.Section>
        <Group gap="10" mb="lg" wrap="nowrap">
          <ThemeIcon size={34} radius="md">
            <IconFileText size={19} stroke={1.9} />
          </ThemeIcon>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Text fw={600} ff="heading" size="15.5px" lh={1.2} truncate>
              Gestión documental
            </Text>
            {empresas.length > 1 ? (
              <Menu shadow="md" width={220} position="bottom-start">
                <Menu.Target>
                  <UnstyledButton style={{ display: "flex", alignItems: "center", gap: 4, width: "100%", minWidth: 0 }}>
                    <Text size="11.5px" c="dimmed" truncate style={{ flex: 1, minWidth: 0 }}>
                      {proyecto.nombre}
                    </Text>
                    <IconArrowsRightLeft size={12} stroke={2} style={{ flexShrink: 0, opacity: 0.6 }} />
                  </UnstyledButton>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Cambiar de empresa</Menu.Label>
                  {empresas.map((empresa) => (
                    <Menu.Item
                      key={empresa.id_tenant}
                      leftSection={empresa.id_tenant === idTenantActual ? <IconCheck size={14} /> : null}
                      disabled={empresa.id_tenant === idTenantActual}
                      onClick={() => onCambiarEmpresa(empresa.id_tenant)}
                    >
                      {empresa.nombre}
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
            ) : (
              <Text size="11.5px" c="dimmed" truncate>
                {proyecto.nombre}
              </Text>
            )}
          </div>
        </Group>
      </AppShell.Section>

      <AppShell.Section grow style={{ overflowY: "auto" }}>
        <Item icon={IconFileText} label="Documentos" active={vista === "documentos"} onClick={() => onNavigate("documentos")} />
        {/* Las notificaciones son de cada usuario: soporte no tiene */}
        {!esSuperadmin && (
          <Item
            icon={IconBell} label="Notificaciones" active={vista === "notificaciones"}
            badge={noLeidas > 0 ? noLeidas : null} onClick={() => onNavigate("notificaciones")}
          />
        )}
        <Item icon={IconNotebook} label="Bloc de notas" active={vista === "bloc-notas"} onClick={() => onNavigate("bloc-notas")} />
        <Item icon={IconProgressCheck} label="Seguimiento" active={vista === "seguimiento"} onClick={() => onNavigate("seguimiento")} />
        <Item icon={IconAlarm} label="Avisos programados" active={vista === "programaciones"} onClick={() => onNavigate("programaciones")} />
        <Item
          icon={IconCategory}
          label="Tipos de documento"
          active={vista === "tipos-documento"}
          onClick={() => onNavigate("tipos-documento")}
        />
        <Item icon={IconPalette} label="Estilos de informe" active={vista === "estilos"} onClick={() => onNavigate("estilos")} />
        <Item icon={IconClipboardList} label="Registros de datos" active={vista === "registros"} onClick={() => onNavigate("registros")} />
        <Item icon={IconGavel} label="Reglas de la IA" active={vista === "reglas"} onClick={() => onNavigate("reglas")} />
        <Item icon={IconFolders} label="Grupos" active={vista === "grupos"} onClick={() => onNavigate("grupos")} />
        <Item icon={IconUsers} label="Entidades" active={vista === "entidades"} onClick={() => onNavigate("entidades")} />
        <Item icon={IconCode} label="Scripts" active={vista === "scripts"} onClick={() => onNavigate("scripts")} />
        {/* Invitado no ve nada de webs y redes, ni para leer */}
        {(proyecto.puede_editar || proyecto.es_admin) && (
          <Item icon={IconWorld} label="Webs y redes" active={vista === "webs" || vista === "publicaciones"} onClick={() => onNavigate("webs")} />
        )}
        {/* Invitado no ve la actividad; soporte sí (llega con es_admin) */}
        {(proyecto.puede_editar || proyecto.es_admin) && (
          <Item icon={IconActivity} label="Actividad" active={vista === "actividad"} onClick={() => onNavigate("actividad")} />
        )}
        {/* El chat solo existe para usuarios de la empresa (el historial
            referencia mcpc_usuarios) — un superadmin en modo soporte no
            puede usarlo, ver usuario_chat_gd_actual en dependencias.py */}
        {!esSuperadmin && (
          <Item icon={IconMessageCircle} label="Chat con la IA" active={chatAbierto} onClick={onAlternarChat} />
        )}

        {proyecto.es_admin && (
          <>
            <Text size="11px" fw={600} c="dimmed" tt="uppercase" mt="lg" mb="4" ml="8" style={{ letterSpacing: ".04em" }}>
              Administración
            </Text>
            <Item icon={IconBriefcase} label="Contexto de negocio" active={vista === "contexto"} onClick={() => onNavigate("contexto")} />
            <Item icon={IconUsers} label="Usuarios" active={vista === "usuarios"} onClick={() => onNavigate("usuarios")} />
            <Item icon={IconKey} label="API keys" active={vista === "api-keys"} onClick={() => onNavigate("api-keys")} />
            <Item icon={IconLink} label="GDs enlazadas" active={vista === "enlaces"} onClick={() => onNavigate("enlaces")} />
            <Item icon={IconLock} label="Credenciales" active={vista === "credenciales"} onClick={() => onNavigate("credenciales")} />
            <Item icon={IconCertificate} label="Certificados" active={vista === "certificados"} onClick={() => onNavigate("certificados")} />
            <Item
              icon={IconBellRinging}
              label="Avisos de caducidad"
              active={vista === "avisos"}
              onClick={() => onNavigate("avisos")}
            />
            <Item icon={IconMail} label="Cuenta de correo" active={vista === "cuenta-email"} onClick={() => onNavigate("cuenta-email")} />
          </>
        )}

        <Text size="11px" fw={600} c="dimmed" tt="uppercase" mt="lg" mb="4" ml="8" style={{ letterSpacing: ".04em" }}>
          Otros
        </Text>
        <Item icon={IconHelpCircle} label="Ayuda" active={vista === "ayuda"} onClick={() => onNavigate("ayuda")} />
        <Item
          icon={IconInbox}
          label="Documentos pendientes"
          badge={pendientesCount > 0 ? pendientesCount : null}
          onClick={() => onNavigate("documentos")}
        />
      </AppShell.Section>

      <AppShell.Section
        pt="sm"
        style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}
      >
        <Group justify="space-between" wrap="nowrap" px="4" py="6">
          <Group gap="8" wrap="nowrap" style={{ minWidth: 0 }}>
            <Avatar radius="xl" size={30} color="acento">
              {esSuperadmin ? <IconHeadset size={16} /> : <IconUsers size={16} />}
            </Avatar>
            <div style={{ minWidth: 0 }}>
              <Text size="13px" fw={500} truncate>
                {rolEtiqueta}
              </Text>
            </div>
          </Group>
          <Group gap="4" wrap="nowrap">
            <Tooltip label={esOscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}>
              <ActionIcon
                variant="subtle" color="gray" size="lg"
                onClick={() => setColorScheme(esOscuro ? "light" : "dark")}
              >
                {esOscuro ? <IconSun size={17} stroke={1.75} /> : <IconMoonStars size={17} stroke={1.75} />}
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Cerrar sesión">
              <ActionIcon variant="subtle" color="gray" size="lg" onClick={onCerrarSesion}>
                <IconLogout size={17} stroke={1.75} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
        <Text size="11px" c="dimmed" ta="center" mt="6">
          v{__APP_VERSION__} · rev. {__APP_REVISION__}
        </Text>
        <Text size="11px" c="dimmed" ta="center">
          {formatearFecha(__BUILD_DATE__)}
        </Text>
      </AppShell.Section>
    </AppShell.Navbar>
  )
}
