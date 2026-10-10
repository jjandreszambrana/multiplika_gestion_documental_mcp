import { useEffect, useState } from "react"
import {
  Alert, Badge, Button, Grid, Group, NavLink, NumberInput, Paper, Select, Stack, Text, Textarea, Title,
} from "@mantine/core"
import { api } from "../../api"

// Memoria anual de una empresa, guardada en el SIF (ver
// docs/contabilidad/memoria-anual.md): a la izquierda los apartados del
// modelo con su estado, a la derecha el texto. Los borradores de la IA
// llegan como propuestas; aquí se edita a mano, se guarda y se formula.

const MODELOS = [
  { value: "pymes", label: "PYMES (también microempresas)" },
  { value: "abreviado", label: "Abreviado" },
  { value: "normal", label: "Normal" },
]
const ESTADO_MEMORIA = ["Borrador", "Revisada", "Formulada"]
const COLOR_APARTADO = ["gray", "yellow", "green"]
const FORMULADA = 2

export default function MemoriaAnual({ proyecto, empresa }) {
  const [ejercicio, setEjercicio] = useState(new Date().getFullYear() - 1)
  const [memoria, setMemoria] = useState(undefined)
  const [catalogo, setCatalogo] = useState([])
  const [modelo, setModelo] = useState("pymes")
  const [idApartado, setIdApartado] = useState(null)
  const [texto, setTexto] = useState("")
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  const idObligado = empresa.id_obligado_sif

  const cargar = () => {
    setMemoria(undefined)
    api.obtenerMemoria(proyecto.id, idObligado, ejercicio).then((r) => setMemoria(r.memoria)).catch((err) => { setMemoria(null); setError(err.message) })
  }
  useEffect(cargar, [proyecto.id, idObligado, ejercicio])

  const modeloActual = memoria?.modelo || modelo
  useEffect(() => {
    api.catalogoMemoria(proyecto.id, modeloActual).then((r) => setCatalogo(r.apartados)).catch((err) => setError(err.message))
  }, [proyecto.id, modeloActual])

  const guardados = Object.fromEntries((memoria?.apartados || []).map((a) => [a.codigo_apartado, a]))
  const actual = catalogo.find((a) => a.id === idApartado)
  useEffect(() => setTexto(guardados[String(idApartado)]?.texto || ""), [idApartado, memoria])

  const ejecutar = (accion) => {
    setTrabajando(true)
    accion().then(cargar).catch((err) => setError(err.message)).finally(() => setTrabajando(false))
  }
  const formulada = memoria?.estado === FORMULADA

  return (
    <Stack gap="md">
      <Group align="flex-end" wrap="wrap">
        <NumberInput id="memoria-ejercicio" label="Ejercicio" value={ejercicio} onChange={(v) => v && setEjercicio(Number(v))} min={2000} max={2999} w={120} />
        {memoria && (
          <Text>
            Modelo {modeloActual} · versión {memoria.version} · <Badge variant="light">{ESTADO_MEMORIA[memoria.estado] || memoria.estado_texto}</Badge>
          </Text>
        )}
      </Group>
      {error && <Alert color="red" withCloseButton onClose={() => setError(null)}>{error}</Alert>}

      {memoria === undefined ? (
        <Text>Cargando...</Text>
      ) : memoria === null ? (
        <Group align="flex-end" wrap="wrap">
          <Select id="memoria-modelo" label="Modelo de memoria" data={MODELOS} value={modelo} onChange={(v) => v && setModelo(v)} w={260} />
          <Button loading={trabajando} onClick={() => ejecutar(() => api.crearMemoria(proyecto.id, { id_obligado: idObligado, ejercicio, modelo }))}>
            Crear la memoria de {ejercicio}
          </Button>
          <Text fz="sm" c="dimmed">Si existe la del año anterior, se parte de sus textos.</Text>
        </Group>
      ) : (
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Paper withBorder p="xs">
              {catalogo.map((a) => {
                const guardado = guardados[String(a.id)]
                return (
                  <NavLink
                    key={a.id} active={a.id === idApartado} onClick={() => setIdApartado(a.id)}
                    label={`${a.numero}. ${a.titulo}`}
                    rightSection={<Badge size="xs" variant="light" color={COLOR_APARTADO[guardado?.estado ?? 0]}>{guardado?.estado_texto || "pendiente"}</Badge>}
                  />
                )
              })}
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Paper withBorder p="lg">
              {!actual ? (
                <Text c="dimmed">
                  Elige un apartado. Para que la IA prepare un borrador, pídeselo en el chat (por ejemplo: «redacta el apartado de
                  inmovilizado de la memoria {ejercicio}»): llegará a Propuestas para que lo revises.
                </Text>
              ) : (
                <Stack gap="sm">
                  <Title order={4}>{actual.numero}. {actual.titulo}</Title>
                  {actual.datos?.length > 0 && (
                    <Text fz="sm" c="dimmed">
                      Datos que pide: {actual.datos.map((d) => `${d.descripcion} (${d.tipo === "manual" ? "a mano" : d.tipo === "gd" ? "documentos de la GD" : "contabilidad"})`).join("; ")}.
                    </Text>
                  )}
                  <Textarea id="memoria-apartado-texto" aria-label="Texto del apartado" autosize minRows={10} value={texto} disabled={formulada} onChange={(e) => setTexto(e.currentTarget.value)} />
                  {!formulada && (
                    <Group>
                      <Button loading={trabajando} onClick={() => ejecutar(() => api.guardarApartadoMemoria(proyecto.id, {
                        id_obligado: idObligado, id_memoria: memoria.id, codigo_apartado: String(actual.id), titulo: `${actual.numero}. ${actual.titulo}`, texto,
                      }))}>
                        Guardar en el SIF
                      </Button>
                    </Group>
                  )}
                </Stack>
              )}
            </Paper>
          </Grid.Col>
        </Grid>
      )}

      {memoria && (
        <Group>
          {!formulada ? (
            <Button color="green" variant="light" loading={trabajando} onClick={() => ejecutar(() => api.accionMemoria(proyecto.id, "formular", { id_obligado: idObligado, id_memoria: memoria.id }))}>
              Formular (queda bloqueada)
            </Button>
          ) : (
            <Button variant="light" loading={trabajando} onClick={() => ejecutar(() => api.accionMemoria(proyecto.id, "nueva_version", { id_obligado: idObligado, id_memoria: memoria.id }))}>
              Nueva versión
            </Button>
          )}
        </Group>
      )}
    </Stack>
  )
}
