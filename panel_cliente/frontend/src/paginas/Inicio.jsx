import { useEffect, useState } from "react"
import { Alert, Anchor, Badge, Card, Group, SimpleGrid, Stack, Text, ThemeIcon, Title, UnstyledButton } from "@mantine/core"
import {
  IconActivity, IconAlarm, IconBell, IconCalculator, IconChartFunnel, IconClockExclamation, IconFileText, IconInbox,
  IconNotebook, IconProgressCheck, IconWorld,
} from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha, formatearImporte } from "../formato"

// Pantalla de inicio: una tarjeta por parte del panel con su cifra y sus
// últimos elementos (todo llega en una sola petición, /inicio). Solo salen
// las tarjetas que el servidor manda para este usuario y esta GD. Es
// también adonde vuelven las pantallas con "Inicio".

const hoy = () => new Date().toISOString().slice(0, 10)

// El resumen del embudo viene por etapa; aquí solo interesan las abiertas.
function importeAbierto(resumen) {
  const abiertas = (resumen || []).filter((e) => e.tipo === "abierta")
  const suma = (campo) => abiertas.reduce((total, e) => total + (e[campo] || 0), 0)
  return `${formatearImporte(suma("importe"))} en juego · ${formatearImporte(suma("importe_ponderado"))} previsto`
}

function Tarjeta({ icono: Icono, titulo, total, etiquetaTotal, vacio, onVerTodo, children, aviso }) {
  return (
    <Card withBorder padding="md">
      <Stack gap="sm" h="100%">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <ThemeIcon variant="light" size="md"><Icono size={16} /></ThemeIcon>
            <Text fw={600}>{titulo}</Text>
          </Group>
          <Badge variant={aviso ? "filled" : "light"} color={aviso ? "red" : "gray"} size="lg" style={{ fontVariantNumeric: "tabular-nums" }}>
            {total}
          </Badge>
        </Group>
        {etiquetaTotal && <Text fz="sm" c="dimmed">{etiquetaTotal}</Text>}
        <Stack gap={4} style={{ flex: 1 }}>
          {total === 0 ? <Text fz="sm" c="dimmed">{vacio}</Text> : children}
        </Stack>
        {onVerTodo && (
          <Anchor component="button" type="button" fz="sm" onClick={onVerTodo} style={{ alignSelf: "flex-start" }}>
            Ver todo
          </Anchor>
        )}
      </Stack>
    </Card>
  )
}

function Fila({ texto, detalle, color, onClick }) {
  const contenido = (
    <Group justify="space-between" wrap="nowrap" gap="xs">
      <Text fz="sm" truncate="end" style={{ minWidth: 0 }}>{texto}</Text>
      {detalle && <Text fz="xs" c={color || "dimmed"} style={{ whiteSpace: "nowrap" }}>{detalle}</Text>}
    </Group>
  )
  return onClick ? (
    <UnstyledButton onClick={onClick} style={{ borderRadius: 4 }} className="fila-inicio">{contenido}</UnstyledButton>
  ) : contenido
}

export default function Inicio({ proyecto, onNavegar, onVerDocumento, onVerNota, onVerProgramacion }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.inicioPanel(proyecto.id).then(setDatos).catch((err) => setError(err.message))
  }, [proyecto.id])

  if (error) return <Alert color="red">{error}</Alert>
  if (!datos) return <Text>Cargando...</Text>
  const d = datos

  return (
    <Stack gap="lg">
      <Title order={2}>{proyecto.nombre}</Title>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        {d.pendientes && (
          <Tarjeta icono={IconInbox} titulo="Pendientes de clasificar" total={d.pendientes.total} aviso={d.pendientes.total > 0}
            vacio="No hay documentos esperando." onVerTodo={() => onNavegar("documentos")}>
            {d.pendientes.ultimos.map((p) => (
              <Fila key={p.id} texto={p.nombre_original || p.archivo} detalle={formatearFecha(p.fecha_alta)} onClick={() => onNavegar("documentos")} />
            ))}
          </Tarjeta>
        )}
        {d.notificaciones && (
          <Tarjeta icono={IconBell} titulo="Notificaciones sin leer" total={d.notificaciones.total} vacio="Estás al día."
            onVerTodo={() => onNavegar("notificaciones")}>
            {d.notificaciones.ultimos.map((n) => (
              <Fila key={n.id} texto={n.titulo || n.texto} detalle={formatearFecha(n.fecha)} onClick={() => onNavegar("notificaciones")} />
            ))}
          </Tarjeta>
        )}
        {d.seguimiento && (
          <Tarjeta icono={IconProgressCheck} titulo="Mi seguimiento" total={d.seguimiento.total} vacio="No tienes nada pendiente ni en curso."
            onVerTodo={() => onNavegar("seguimiento")}>
            {d.seguimiento.ultimos.map((s) => (
              <Fila key={`${s.tipo}-${s.id_objeto}`} texto={s.titulo} detalle={s.nombre_estado || s.estado} onClick={() => onNavegar("seguimiento")} />
            ))}
          </Tarjeta>
        )}
        {d.programaciones && (
          <Tarjeta icono={IconAlarm} titulo="Próximos avisos" total={d.programaciones.total} vacio="No hay avisos programados."
            onVerTodo={() => onNavegar("programaciones")}>
            {d.programaciones.ultimos.map((p) => (
              <Fila key={p.id} texto={p.titulo} detalle={formatearFecha(p.proxima_ejecucion)} onClick={() => onVerProgramacion(p.id)} />
            ))}
          </Tarjeta>
        )}
        {d.caducan && (
          <Tarjeta icono={IconClockExclamation} titulo="Caducan en 30 días" total={d.caducan.total} aviso={d.caducan.ultimos.some((c) => String(c.fecha_caducidad) < hoy())}
            vacio="Ningún documento caduca pronto.">
            {d.caducan.ultimos.map((c) => (
              <Fila
                key={c.id_version} texto={c.nombre} detalle={formatearFecha(c.fecha_caducidad)}
                color={String(c.fecha_caducidad) < hoy() ? "red" : undefined} onClick={() => onVerDocumento(c.id_documento)}
              />
            ))}
          </Tarjeta>
        )}
        {d.crm && (
          <Tarjeta icono={IconChartFunnel} titulo="Oportunidades abiertas" total={d.crm.total} vacio="No hay oportunidades abiertas."
            etiquetaTotal={d.crm.total ? importeAbierto(d.crm.resumen) : null}
            onVerTodo={() => onNavegar("ventas")}>
            {d.crm.ultimos.map((o) => (
              <Fila
                key={o.id} texto={o.titulo}
                detalle={o.fecha_proximo_paso ? `${o.proximo_paso || "Próximo paso"} · ${formatearFecha(o.fecha_proximo_paso)}` : formatearImporte(o.importe)}
                color={o.fecha_proximo_paso && String(o.fecha_proximo_paso) < hoy() ? "red" : undefined}
                onClick={() => onNavegar("ventas")}
              />
            ))}
          </Tarjeta>
        )}
        {d.contabilidad && (
          <Tarjeta icono={IconCalculator} titulo="Propuestas contables" total={d.contabilidad.total} vacio="No hay propuestas por revisar."
            onVerTodo={() => onNavegar("asesor-contable")}>
            {d.contabilidad.ultimos.map((p) => (
              <Fila key={p.id} texto={p.titulo} detalle={formatearFecha(p.fecha_alta)} onClick={() => onNavegar("asesor-contable")} />
            ))}
          </Tarjeta>
        )}
        {d.webs && (
          <Tarjeta icono={IconWorld} titulo="Webs con alertas" total={d.webs.con_alerta} aviso={d.webs.con_alerta > 0}
            etiquetaTotal={`${d.webs.total} webs y redes vigiladas`} vacio="Todo funciona." onVerTodo={() => onNavegar("webs")}>
            {d.webs.ultimos.map((w) => (
              <Fila key={w.id} texto={w.nombre} detalle={w.vigilancia} color="red" onClick={() => onNavegar("webs")} />
            ))}
          </Tarjeta>
        )}
        {d.documentos && (
          <Tarjeta icono={IconFileText} titulo="Últimos documentos" total={d.documentos.total} vacio="Todavía no hay documentos."
            onVerTodo={() => onNavegar("documentos")}>
            {d.documentos.ultimos.map((doc) => (
              <Fila key={doc.id} texto={doc.nombre} detalle={doc.tipo_documento} onClick={() => onVerDocumento(doc.id)} />
            ))}
          </Tarjeta>
        )}
        {d.bloc && (
          <Tarjeta icono={IconNotebook} titulo="Bloc de notas" total={d.bloc.total} vacio="No hay notas." onVerTodo={() => onNavegar("bloc-notas")}>
            {d.bloc.ultimos.map((n) => (
              <Fila key={n.id} texto={n.titulo || n.descripcion} detalle={formatearFecha(n.fecha)} onClick={() => onVerNota(n.id)} />
            ))}
          </Tarjeta>
        )}
        {d.actividad && (
          <Tarjeta icono={IconActivity} titulo="Actividad reciente" total={d.actividad.total} vacio="Sin actividad todavía."
            onVerTodo={() => onNavegar("actividad")}>
            {d.actividad.ultimos.map((a) => (
              <Fila key={a.id} texto={`${a.quien}: ${a.descripcion}`} detalle={formatearFecha(a.fecha)} />
            ))}
          </Tarjeta>
        )}
      </SimpleGrid>
    </Stack>
  )
}
