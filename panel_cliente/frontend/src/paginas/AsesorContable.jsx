import { useEffect, useState } from "react"
import {
  Alert, Anchor, Badge, Grid, Group, Modal, NavLink, Paper, Stack, Switch, Text, TextInput, Title,
} from "@mantine/core"
import { IconSearch } from "@tabler/icons-react"
import { api } from "../api"
import Markdown from "../componentes/Markdown"

// Biblioteca del asesor contable (ver docs/contabilidad/planificacion.md,
// fase 1): árbol que se va cargando al abrir cada nivel, buscador y tema.
// El admin activa o desactiva aquí el apartado para esta GD.

function Rama({ nodo, hijos, cargarHijos, idTema, onElegirTema }) {
  const [abierto, setAbierto] = useState(false)
  if (nodo.tipo === "tema") {
    return (
      <NavLink
        label={`${nodo.posicion} ${nodo.titulo}`}
        active={nodo.id === idTema}
        onClick={() => onElegirTema(nodo.id)}
      />
    )
  }
  return (
    <NavLink
      label={`${nodo.posicion} ${nodo.titulo}`}
      description={nodo.resumen}
      opened={abierto}
      onChange={(valor) => {
        setAbierto(valor)
        if (valor && !hijos[nodo.id]) cargarHijos(nodo.id)
      }}
      childrenOffset={14}
    >
      {(hijos[nodo.id] || []).map((h) => (
        <Rama
          key={h.id} nodo={h} hijos={hijos} cargarHijos={cargarHijos}
          idTema={idTema} onElegirTema={onElegirTema}
        />
      ))}
    </NavLink>
  )
}

function Activacion({ proyecto, onCambiarModulo, onError }) {
  const [guardando, setGuardando] = useState(false)
  if (!proyecto.es_admin) return null
  return (
    <Switch
      label="Activado en esta gestión documental"
      checked={!!proyecto.modulo_contable}
      disabled={guardando}
      onChange={(e) => {
        const activo = e.currentTarget.checked
        setGuardando(true)
        api
          .actualizarModuloContable(proyecto.id, activo)
          .then(() => onCambiarModulo(activo))
          .catch((err) => onError(err.message))
          .finally(() => setGuardando(false))
      }}
    />
  )
}

export default function AsesorContable({ proyecto, onCambiarModulo }) {
  const [hijos, setHijos] = useState({})
  const [raiz, setRaiz] = useState(null)
  const [texto, setTexto] = useState("")
  const [resultados, setResultados] = useState(null)
  const [idTema, setIdTema] = useState(null)
  const [tema, setTema] = useState(null)
  const [fuente, setFuente] = useState(null)
  const [error, setError] = useState(null)
  const activo = !!proyecto.modulo_contable

  useEffect(() => {
    if (!activo) return
    api.indiceContable(proyecto.id).then((r) => setRaiz(r.hijos)).catch((err) => setError(err.message))
  }, [proyecto.id, activo])

  useEffect(() => {
    if (!idTema) return
    setTema(null)
    api.obtenerTemaContable(proyecto.id, idTema).then(setTema).catch((err) => setError(err.message))
  }, [proyecto.id, idTema])

  const cargarHijos = (idNodo) =>
    api
      .indiceContable(proyecto.id, idNodo)
      .then((r) => setHijos((previos) => ({ ...previos, [idNodo]: r.hijos })))
      .catch((err) => setError(err.message))

  const buscar = (e) => {
    e.preventDefault()
    if (!texto.trim()) return setResultados(null)
    api.buscarTemasContables(proyecto.id, texto).then((r) => setResultados(r.temas)).catch((err) => setError(err.message))
  }

  const abrirFuente = (idFuente) =>
    api.obtenerFuenteContable(proyecto.id, idFuente).then(setFuente).catch((err) => setError(err.message))

  return (
    <>
      <Group justify="space-between" mb="lg" wrap="wrap">
        <Title order={2}>Asesor contable</Title>
        <Activacion proyecto={proyecto} onCambiarModulo={onCambiarModulo} onError={setError} />
      </Group>

      {error && (
        <Alert color="red" mb="md" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!activo ? (
        <Text c="dimmed">
          Con el apartado activado, la IA de esta gestión documental consulta una biblioteca contable y fiscal
          (plan contable, IVA, sociedades, cierre, análisis financiero...) antes de responder, y aquí podéis
          consultarla directamente.
        </Text>
      ) : (
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Paper withBorder p="xs">
              <form onSubmit={buscar}>
                <TextInput
                  id="buscar-tema-contable" aria-label="Buscar en la biblioteca" placeholder="Buscar: leasing, prorrata, 555..."
                  leftSection={<IconSearch size={16} />} value={texto} onChange={(e) => setTexto(e.currentTarget.value)} mb="xs"
                />
              </form>
              {resultados ? (
                <>
                  <Anchor component="button" type="button" fz="sm" mb="xs" onClick={() => setResultados(null)}>
                    Volver al índice
                  </Anchor>
                  {resultados.length === 0 && <Text fz="sm" c="dimmed">No hay temas con esas palabras.</Text>}
                  {resultados.map((t) => (
                    <NavLink
                      key={t.id} label={t.titulo} description={t.ruta.map((r) => r.titulo).join(" › ")}
                      active={t.id === idTema} onClick={() => setIdTema(t.id)}
                    />
                  ))}
                </>
              ) : !raiz ? (
                <Text fz="sm">Cargando...</Text>
              ) : raiz.length === 0 ? (
                <Text fz="sm" c="dimmed">La biblioteca todavía no tiene temas.</Text>
              ) : (
                raiz.map((n) => (
                  <Rama
                    key={n.id} nodo={n} hijos={hijos} cargarHijos={cargarHijos}
                    idTema={idTema} onElegirTema={setIdTema}
                  />
                ))
              )}
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Paper withBorder p="lg">
              {!idTema ? (
                <Text c="dimmed">Elige un tema del índice o búscalo.</Text>
              ) : !tema ? (
                <Text>Cargando...</Text>
              ) : (
                <Stack gap="sm">
                  <Text fz="sm" c="dimmed">{tema.ruta.map((r) => r.titulo).join(" › ")}</Text>
                  <Title order={3}>{tema.titulo}</Title>
                  {tema.avisos.map((a) => (
                    <Alert key={a} color="yellow" p="xs">{a}</Alert>
                  ))}
                  <Markdown>{tema.cuerpo}</Markdown>
                  {tema.fuentes.length > 0 && (
                    <Group gap="xs">
                      <Text fz="sm" fw={500}>Normas citadas:</Text>
                      {tema.fuentes.map((f) =>
                        f.disponible ? (
                          <Badge key={f.id} variant="light" style={{ cursor: "pointer" }} onClick={() => abrirFuente(f.id)}>
                            {f.id}
                          </Badge>
                        ) : (
                          <Badge key={f.id} variant="outline" color="gray">{f.id}</Badge>
                        ),
                      )}
                    </Group>
                  )}
                  {tema.relacionados.length > 0 && (
                    <Group gap="xs">
                      <Text fz="sm" fw={500}>Relacionados:</Text>
                      {tema.relacionados.map((r) => (
                        <Anchor key={r.id} component="button" type="button" fz="sm" onClick={() => setIdTema(r.id)}>
                          {r.titulo}
                        </Anchor>
                      ))}
                    </Group>
                  )}
                </Stack>
              )}
            </Paper>
          </Grid.Col>
        </Grid>
      )}

      <Modal opened={!!fuente} onClose={() => setFuente(null)} size="lg" title={fuente?.articulo || fuente?.id}>
        {fuente && (
          <Stack gap="sm">
            {fuente.titulo_norma && <Text fz="sm" c="dimmed">{fuente.titulo_norma}</Text>}
            <Markdown>{fuente.texto}</Markdown>
            <Text fz="xs" c="dimmed">
              Fuente: Agencia Estatal Boletín Oficial del Estado. Texto consolidado de carácter informativo
              {fuente.vigente_desde ? `, versión vigente desde el ${fuente.vigente_desde}` : ""}.
            </Text>
          </Stack>
        )}
      </Modal>
    </>
  )
}
