import { useEffect, useState } from "react"
import { ActionIcon, Alert, Anchor, Group, Pagination, Select, Text, TextInput, Title, Tooltip } from "@mantine/core"
import { IconArrowLeft, IconRefresh, IconSearch } from "@tabler/icons-react"
import { api } from "../api"
import TablaActividad from "../componentes/TablaActividad"

const POR_PAGINA = 50
const FILTROS_VACIOS = { quien: "", origen: "", desde: "", hasta: "", q: "" }

export default function Actividad({ proyecto, onVolver, onVerDocumento }) {
  const [datos, setDatos] = useState(null)
  const [quienes, setQuienes] = useState([])
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [pagina, setPagina] = useState(1)
  const [error, setError] = useState(null)
  const [refrescando, setRefrescando] = useState(false)

  function cargar(nuevosFiltros = filtros, nuevaPagina = pagina) {
    setRefrescando(true)
    setError(null)
    return api
      .listarActividad(proyecto.id, { ...nuevosFiltros, pagina: nuevaPagina, por_pagina: POR_PAGINA })
      .then(setDatos)
      .catch((err) => setError(err.message))
      .finally(() => setRefrescando(false))
  }

  useEffect(() => {
    cargar(FILTROS_VACIOS, 1)
    api.listarQuienesActividad(proyecto.id).then(setQuienes).catch(() => setQuienes([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id])

  function cambiarFiltro(clave, valor) {
    const nuevos = { ...filtros, [clave]: valor || "" }
    setFiltros(nuevos)
    setPagina(1)
    if (clave !== "q") cargar(nuevos, 1)
  }

  function buscar(evento) {
    evento.preventDefault()
    setPagina(1)
    cargar(filtros, 1)
  }

  function cambiarPagina(nueva) {
    setPagina(nueva)
    cargar(filtros, nueva)
  }

  const paginas = datos ? Math.ceil(datos.total / POR_PAGINA) : 0

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
        Actividad
      </Title>
      <Text c="dimmed" maw={620} fz="13.5px" mb="lg">
        Quién ha cambiado qué y cuándo: desde la IA, desde el chat o desde este panel. Las consultas no se apuntan. Se
        guarda un año; lo más antiguo se borra solo.
      </Text>

      <Group component="form" onSubmit={buscar} mb="md">
        <TextInput
          placeholder="Buscar en la actividad" leftSection={<IconSearch size={15} stroke={2} />}
          value={filtros.q} onChange={(e) => cambiarFiltro("q", e.target.value)}
          style={{ flex: 1, minWidth: 200, maxWidth: 300 }}
        />
        <Select
          placeholder="Quién: todos" data={quienes} value={filtros.quien || null}
          onChange={(v) => cambiarFiltro("quien", v)} searchable clearable w={200}
        />
        <Select
          placeholder="Desde dónde: todo" value={filtros.origen || null} onChange={(v) => cambiarFiltro("origen", v)}
          data={[
            { value: "ia", label: "IA" },
            { value: "chat", label: "Chat del panel" },
            { value: "panel", label: "Panel" },
          ]}
          clearable w={170}
        />
        <TextInput
          placeholder="Desde" type="date" value={filtros.desde}
          onChange={(e) => cambiarFiltro("desde", e.target.value)} w={150}
        />
        <TextInput
          placeholder="Hasta" type="date" value={filtros.hasta}
          onChange={(e) => cambiarFiltro("hasta", e.target.value)} w={150}
        />
        <Tooltip label="Refrescar">
          <ActionIcon variant="subtle" color="gray" onClick={() => cargar()} loading={refrescando}>
            <IconRefresh size={17} stroke={1.8} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      {!datos ? (
        <Text>Cargando...</Text>
      ) : datos.filas.length === 0 ? (
        <Text c="dimmed">No hay actividad que coincida.</Text>
      ) : (
        <>
          <TablaActividad filas={datos.filas} onVerDocumento={onVerDocumento} />
          <Group justify="space-between" mt="md">
            <Text size="13px" c="dimmed">
              {datos.total} apunte(s)
            </Text>
            {paginas > 1 && <Pagination total={paginas} value={pagina} onChange={cambiarPagina} size="sm" />}
          </Group>
        </>
      )}
    </>
  )
}
