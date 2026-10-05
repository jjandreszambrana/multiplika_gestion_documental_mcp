import { useEffect, useState } from "react"
import {
  ActionIcon, Alert, Anchor, Badge, Button, Group, PasswordInput, Select, Stack, Switch, Table, Tabs, Text,
  TextInput, Title, Tooltip,
} from "@mantine/core"
import { IconArrowLeft, IconDownload, IconPlugConnected, IconTrash } from "@tabler/icons-react"
import { api } from "../api"
import { useEstadoPersistente } from "../estadoPersistente"
import { formatearFecha } from "../formato"
import Aprendizajes from "../componentes/Aprendizajes"

const ETIQUETA_SENTIDO = {
  central: "Central a la que consultamos",
  enlazada: "Nos consulta a nosotros",
}
const ETIQUETA_TIPO_USO = {
  consulta: "Consultas",
  documento_completo: "Documentos completos",
  resumen: "Resúmenes (IA)",
  anonimizacion: "Anonimizaciones (IA)",
}

function mesActual() {
  return new Date().toISOString().slice(0, 7)
}

function descargarCsv(nombre, filas) {
  const escapar = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`
  const texto = filas.map((f) => f.map(escapar).join(";")).join("\n")
  const enlace = document.createElement("a")
  enlace.href = URL.createObjectURL(new Blob(["﻿" + texto], { type: "text/csv;charset=utf-8" }))
  enlace.download = nombre
  enlace.click()
  URL.revokeObjectURL(enlace.href)
}

function PestanaEnlaces({ proyecto }) {
  const [enlaces, setEnlaces] = useState(null)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [nombre, setNombre] = useState("")
  const [urlMcp, setUrlMcp] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [enlazando, setEnlazando] = useState(false)
  const [ocupado, setOcupado] = useState(null)

  function cargar() {
    return api.listarEnlaces(proyecto.id).then(setEnlaces).catch((err) => setError(err.message))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id])

  async function enlazar(evento) {
    evento.preventDefault()
    setEnlazando(true)
    setError(null)
    setAviso(null)
    try {
      await api.enlazarConCentral(proyecto.id, nombre.trim(), urlMcp.trim(), apiKey.trim())
      setNombre("")
      setUrlMcp("")
      setApiKey("")
      setAviso("Enlace creado en los dos sentidos.")
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setEnlazando(false)
    }
  }

  async function probar(enlace) {
    setOcupado(enlace.id)
    setError(null)
    setAviso(null)
    try {
      const r = await api.probarEnlace(proyecto.id, enlace.id)
      setAviso(`"${enlace.nombre}" responde (${r.herramientas.length} herramientas disponibles).`)
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(null)
    }
  }

  async function cambiarActivo(enlace, activo) {
    setError(null)
    try {
      await api.cambiarActivoEnlace(proyecto.id, enlace.id, activo)
      await cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  async function desenlazar(enlace) {
    if (!window.confirm(`¿Desenlazar "${enlace.nombre}"? Se revocan las claves de los dos lados.`)) return
    setOcupado(enlace.id)
    setError(null)
    try {
      await api.desenlazar(proyecto.id, enlace.id)
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(null)
    }
  }

  return (
    <Stack gap="lg">
      <Stack component="form" onSubmit={enlazar} maw={560} gap="xs">
        <Text fw={600}>Enlazar con una central</Text>
        <Text c="dimmed" fz="13px">
          La central te da una clave de tipo "GD enlazada" desde su pantalla de API keys. Al guardarla aquí,
          el enlace queda hecho en los dos sentidos: tú consultas sus documentos compartidos y ella puede
          leer los tuyos no reservados.
        </Text>
        <TextInput label="Nombre" placeholder="Central de la asesoría" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <TextInput label="Dirección /mcp de la central" placeholder="https://mcp.asesoria.com/mcp" value={urlMcp} onChange={(e) => setUrlMcp(e.target.value)} required />
        <PasswordInput label="Clave que te dio la central" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required />
        <Group>
          <Button type="submit" loading={enlazando} leftSection={<IconPlugConnected size={15} />}>
            Enlazar
          </Button>
        </Group>
      </Stack>

      {aviso && <Alert color="green">{aviso}</Alert>}
      {error && <Alert color="red">{error}</Alert>}

      {enlaces === null ? (
        <Text>Cargando...</Text>
      ) : enlaces.length === 0 ? (
        <Text c="dimmed">Ninguna gestión documental enlazada todavía.</Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nombre</Table.Th>
              <Table.Th>Sentido</Table.Th>
              <Table.Th>Dirección</Table.Th>
              <Table.Th>Activo</Table.Th>
              <Table.Th>Desde</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {enlaces.map((e) => (
              <Table.Tr key={e.id}>
                <Table.Td fw={500}>{e.nombre}</Table.Td>
                <Table.Td>
                  <Badge color={e.sentido === "central" ? "blue" : "teal"} variant="light" tt="none" fw={500}>
                    {ETIQUETA_SENTIDO[e.sentido]}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text fz="12.5px" c="dimmed">{e.url_mcp}</Text>
                </Table.Td>
                <Table.Td>
                  <Switch checked={e.activo} onChange={(ev) => cambiarActivo(e, ev.currentTarget.checked)} aria-label="Activo" />
                </Table.Td>
                <Table.Td>{formatearFecha(e.fecha_alta)}</Table.Td>
                <Table.Td>
                  <Group gap="xs" justify="flex-end" wrap="nowrap">
                    <Button size="compact-sm" variant="default" onClick={() => probar(e)} loading={ocupado === e.id}>
                      Probar
                    </Button>
                    <Tooltip label="Desenlazar">
                      <ActionIcon variant="subtle" color="red" onClick={() => desenlazar(e)} disabled={ocupado === e.id} aria-label="Desenlazar">
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  )
}

function PestanaPreguntas({ proyecto }) {
  const [preguntas, setPreguntas] = useState(null)
  const [estado, setEstado] = useEstadoPersistente(`filtros:${proyecto.id}:preguntas:estado`, "pendiente")
  const [error, setError] = useState(null)

  function cargar(estadoConsulta = estado) {
    return api.listarPreguntasPendientes(proyecto.id, estadoConsulta || null).then(setPreguntas).catch((err) => setError(err.message))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id])

  async function cambiarEstado(pregunta, nuevo) {
    setError(null)
    try {
      await api.cambiarEstadoPreguntaPendiente(proyecto.id, pregunta.id, nuevo)
      await cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Stack gap="md">
      <Text c="dimmed" fz="13px" maw={640}>
        Preguntas que las gestiones documentales enlazadas nos hicieron y no supimos responder, las más
        repetidas primero. Cuando añadas un documento que la cubra, márcala como resuelta.
      </Text>
      <Select
        w={200} value={estado} onChange={(v) => { setEstado(v || ""); cargar(v || "") }}
        data={[{ value: "pendiente", label: "Pendientes" }, { value: "resuelta", label: "Resueltas" }, { value: "", label: "Todas" }]}
        allowDeselect={false}
      />
      {error && <Alert color="red">{error}</Alert>}
      {preguntas === null ? (
        <Text>Cargando...</Text>
      ) : preguntas.length === 0 ? (
        <Text c="dimmed">Nada por aquí.</Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Pregunta</Table.Th>
              <Table.Th>Quién</Table.Th>
              <Table.Th>Motivo</Table.Th>
              <Table.Th>Veces</Table.Th>
              <Table.Th>Última</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {preguntas.map((p) => (
              <Table.Tr key={p.id} style={{ opacity: p.estado === "resuelta" ? 0.6 : 1 }}>
                <Table.Td>
                  <Text fw={500}>{p.pregunta}</Text>
                  {p.detalle && <Text c="dimmed" fz="12.5px">{p.detalle}</Text>}
                </Table.Td>
                <Table.Td>{p.origen}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color={p.motivo === "sin_resultados" ? "gray" : "yellow"} tt="none" fw={500}>
                    {p.motivo === "sin_resultados" ? "Sin resultados" : "No resolvió"}
                  </Badge>
                </Table.Td>
                <Table.Td>{p.veces}</Table.Td>
                <Table.Td>{formatearFecha(p.fecha_ultima)}</Table.Td>
                <Table.Td>
                  <Button
                    size="compact-sm" variant="default"
                    onClick={() => cambiarEstado(p, p.estado === "pendiente" ? "resuelta" : "pendiente")}
                  >
                    {p.estado === "pendiente" ? "Marcar resuelta" : "Reabrir"}
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  )
}

function PestanaUso({ proyecto }) {
  const [mes, setMes] = useState(mesActual())
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (mes.length !== 7) return
    setFilas(null)
    api.resumenUsoEnlaces(proyecto.id, mes).then(setFilas).catch((err) => setError(err.message))
  }, [proyecto.id, mes])

  const totalPorOrigen = {}
  for (const f of filas || []) totalPorOrigen[f.origen] = (totalPorOrigen[f.origen] || 0) + f.coste_estimado

  return (
    <Stack gap="md">
      <Text c="dimmed" fz="13px" maw={640}>
        Lo que cada gestión documental enlazada ha consumido de esta central en el mes: consultas (sin coste
        de IA) y trabajo de IA hecho para ella (resúmenes y anonimizaciones), con su coste estimado en dólares
        según la tarifa vigente en cada momento. La factura se hace fuera, con este informe.
      </Text>
      <Group>
        <TextInput type="month" value={mes} onChange={(e) => setMes(e.target.value)} w={170} aria-label="Mes" />
        <Button
          variant="default" leftSection={<IconDownload size={15} />} disabled={!filas?.length}
          onClick={() => descargarCsv(`uso-enlaces-${mes}.csv`, [
            ["GD enlazada", "Tipo", "Veces", "Tokens entrada", "Tokens salida", "Coste USD"],
            ...filas.map((f) => [f.origen, ETIQUETA_TIPO_USO[f.tipo] || f.tipo, f.veces, f.tokens_entrada, f.tokens_salida, f.coste_estimado.toFixed(4)]),
          ])}
        >
          Descargar CSV
        </Button>
      </Group>
      {error && <Alert color="red">{error}</Alert>}
      {filas === null ? (
        <Text>Cargando...</Text>
      ) : filas.length === 0 ? (
        <Text c="dimmed">Sin uso registrado en ese mes.</Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>GD enlazada</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Veces</Table.Th>
              <Table.Th>Tokens</Table.Th>
              <Table.Th>Coste (USD)</Table.Th>
              <Table.Th>Total GD (USD)</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map((f, i) => (
              <Table.Tr key={`${f.origen}-${f.tipo}`}>
                <Table.Td fw={500}>{f.origen}</Table.Td>
                <Table.Td>{ETIQUETA_TIPO_USO[f.tipo] || f.tipo}</Table.Td>
                <Table.Td>{f.veces}</Table.Td>
                <Table.Td>{f.tokens_entrada + f.tokens_salida > 0 ? `${f.tokens_entrada} / ${f.tokens_salida}` : "—"}</Table.Td>
                <Table.Td>{f.coste_estimado.toFixed(4)}</Table.Td>
                <Table.Td fw={500}>
                  {i === 0 || filas[i - 1].origen !== f.origen ? totalPorOrigen[f.origen].toFixed(4) : ""}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  )
}

export default function Enlaces({ proyecto, onVolver }) {
  return (
    <>
      <Anchor
        component="button" type="button" onClick={onVolver} mb="lg"
        display="flex" style={{ alignItems: "center", gap: 6 }}
        underline="hover" c="dimmed" fz="13.5px" fw={500}
      >
        <IconArrowLeft size={15} stroke={2} />
        Documentos
      </Anchor>
      <Title order={2} mb="6">
        GDs enlazadas
      </Title>
      <Text c="dimmed" maw={640} fz="13.5px" mb="lg">
        Otras gestiones documentales con las que esta comparte conocimiento: una central a la que consultar
        cuando tus documentos no responden, o las que te consultan a ti. Lo que marques como reservado nunca
        sale de aquí.
      </Text>
      <Tabs defaultValue="enlaces" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="enlaces">Enlaces</Tabs.Tab>
          <Tabs.Tab value="preguntas">Preguntas pendientes</Tabs.Tab>
          <Tabs.Tab value="aprendizajes">Aprendizajes</Tabs.Tab>
          <Tabs.Tab value="uso">Uso y coste</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="enlaces"><PestanaEnlaces proyecto={proyecto} /></Tabs.Panel>
        <Tabs.Panel value="preguntas"><PestanaPreguntas proyecto={proyecto} /></Tabs.Panel>
        <Tabs.Panel value="aprendizajes"><Aprendizajes proyecto={proyecto} /></Tabs.Panel>
        <Tabs.Panel value="uso"><PestanaUso proyecto={proyecto} /></Tabs.Panel>
      </Tabs>
    </>
  )
}
