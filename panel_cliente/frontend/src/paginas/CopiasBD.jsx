import { useEffect, useState } from "react"
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Checkbox,
  Chip,
  Group,
  Modal,
  NumberInput,
  Paper,
  PasswordInput,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core"
import { IconArrowLeft, IconDownload, IconHistory, IconRefresh } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha } from "../formato"

const ORIGENES = { manual: "Manual", programada: "Programada", antes_de_restaurar: "Antes de restaurar" }
const FRECUENCIAS = [
  { value: "diaria", label: "Todos los días" },
  { value: "semanal", label: "Algunos días de la semana" },
  { value: "mensual", label: "Una vez al mes" },
]
const DIAS = ["L", "M", "X", "J", "V", "S", "D"]
const CONFIRMACION = "RESTAURAR"
const SIN_PASSWORD_MANAGER = { autoComplete: "new-password", "data-1p-ignore": true, "data-lpignore": "true" }

function hoy() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function tamano(bytes) {
  if (bytes == null) return "—"
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

// La regla de repetición es la misma que la de los avisos programados
// (database/modelos/_repeticiones.py); aquí solo se ofrecen tres formas.
function periodoDesdeAjustes(p) {
  const regla = p.regla
  return {
    id: p.id,
    frecuencia: regla.tipo === "semanal" ? "semanal" : regla.tipo === "mensual" ? "mensual" : "diaria",
    diasSemana: (regla.dias_semana || []).map(String),
    diaMes: regla.tipo === "mensual" ? Number(regla.fecha.slice(8, 10)) : 1,
    hora: regla.hora,
    conservarModo: p.conservar_modo,
    conservar: p.conservar,
  }
}

// Al añadir uno: el primero diario, el segundo semanal, el tercero mensual.
const PERIODOS_SUGERIDOS = [
  { frecuencia: "diaria", diasSemana: [], diaMes: 1, hora: "03:00", conservarModo: "copias", conservar: 7 },
  { frecuencia: "semanal", diasSemana: ["7"], diaMes: 1, hora: "03:00", conservarModo: "copias", conservar: 10 },
  { frecuencia: "mensual", diasSemana: [], diaMes: 1, hora: "03:00", conservarModo: "copias", conservar: 12 },
]

function formularioDesdeAjustes(a) {
  return {
    programada: a.programada,
    periodos: a.periodos.map(periodoDesdeAjustes),
    cifrar: a.cifrar,
    contrasena: "",
    contrasena2: "",
    sftpCredencial: a.sftp_credencial,
    sftpCarpeta: a.sftp_carpeta,
  }
}

function reglaDesdePeriodo(f) {
  if (f.frecuencia === "semanal") {
    return { tipo: "semanal", fecha: hoy(), hora: f.hora, dias_semana: f.diasSemana.map(Number) }
  }
  if (f.frecuencia === "mensual") {
    return { tipo: "mensual", fecha: `2000-01-${String(f.diaMes).padStart(2, "0")}`, hora: f.hora }
  }
  return { tipo: "cada_dias", fecha: hoy(), hora: f.hora, cada_dias: 1 }
}

const ETIQUETA_FRECUENCIA = { cada_dias: "Diaria", semanal: "Semanal", mensual: "Mensual" }

function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement("a")
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  URL.revokeObjectURL(url)
}

export default function CopiasBD({ proyecto, onVolver }) {
  const [copias, setCopias] = useState([])
  const [ajustes, setAjustes] = useState(null)
  const [formulario, setFormulario] = useState(null)
  const [espacioLibre, setEspacioLibre] = useState(null)
  const [credenciales, setCredenciales] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)

  const [haciendo, setHaciendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [descargando, setDescargando] = useState(null)

  const [aRestaurar, setARestaurar] = useState(null)
  const [contrasenaRestaurar, setContrasenaRestaurar] = useState("")
  const [confirmacion, setConfirmacion] = useState("")
  const [restaurando, setRestaurando] = useState(false)

  async function recargar() {
    setCargando(true)
    setError(null)
    try {
      const datos = await api.listarCopiasBD(proyecto.id)
      setCopias(datos.copias)
      setAjustes(datos.ajustes)
      setFormulario(formularioDesdeAjustes(datos.ajustes))
      setEspacioLibre(datos.espacio_libre)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    recargar()
    api.listarCredenciales(proyecto.id).then(setCredenciales).catch(() => setCredenciales([]))
  }, [proyecto.id])

  const cambiar = (campo) => (valor) => setFormulario((f) => ({ ...f, [campo]: valor }))
  const cambiarPeriodo = (indice, campo) => (valor) =>
    setFormulario((f) => ({ ...f, periodos: f.periodos.map((p, i) => (i === indice ? { ...p, [campo]: valor } : p)) }))
  const anadirPeriodo = () =>
    setFormulario((f) => ({
      ...f,
      periodos: [...f.periodos, { id: null, ...PERIODOS_SUGERIDOS[Math.min(f.periodos.length, PERIODOS_SUGERIDOS.length - 1)] }],
    }))
  const quitarPeriodo = (indice) => setFormulario((f) => ({ ...f, periodos: f.periodos.filter((_, i) => i !== indice) }))

  // Para la columna "Tipo": a qué periodos pertenece cada copia programada.
  const nombrePeriodo = Object.fromEntries((ajustes?.periodos || []).map((p) => [p.id, ETIQUETA_FRECUENCIA[p.regla.tipo]]))
  const tipoDeCopia = (c) =>
    c.origen === "programada" && c.periodos.length
      ? `Programada (${c.periodos.map((id) => nombrePeriodo[id] || "periodo quitado").join(", ")})`
      : ORIGENES[c.origen] || c.origen

  async function hacerCopia() {
    setError(null)
    setAviso(null)
    setHaciendo(true)
    try {
      const copia = await api.crearCopiaBD(proyecto.id)
      setAviso(`Copia hecha y cifrada con la contraseña guardada.${copia.remoto ? ` ${copia.remoto.detalle}.` : ""}`)
      await recargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setHaciendo(false)
    }
  }

  async function guardarAjustes(evento) {
    evento.preventDefault()
    setError(null)
    setAviso(null)
    const f = formulario
    if (f.contrasena && f.contrasena !== f.contrasena2) {
      setError("Las dos contraseñas de las copias programadas no coinciden")
      return
    }
    if (f.programada && f.periodos.some((p) => p.frecuencia === "semanal" && p.diasSemana.length === 0)) {
      setError("En los periodos semanales elige al menos un día de la semana")
      return
    }
    setGuardando(true)
    try {
      const nuevos = await api.actualizarAjustesCopiasBD(proyecto.id, {
        programada: f.programada,
        periodos: f.periodos.map((p) => ({
          id: p.id, regla: reglaDesdePeriodo(p), conservar_modo: p.conservarModo, conservar: Number(p.conservar),
        })),
        cifrar: f.cifrar,
        contrasena: f.contrasena || null,
        sftp_credencial: f.sftpCredencial || null,
        sftp_carpeta: f.sftpCarpeta,
      })
      setAjustes(nuevos)
      setFormulario(formularioDesdeAjustes(nuevos))
      setAviso("Ajustes guardados.")
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function descargar(nombre) {
    setError(null)
    setDescargando(nombre)
    try {
      descargarBlob(await api.descargarCopiaBDBlob(proyecto.id, nombre), nombre)
    } catch (err) {
      setError(err.message)
    } finally {
      setDescargando(null)
    }
  }

  async function borrar(nombre) {
    if (!window.confirm("¿Borrar esta copia para siempre? No se puede deshacer.")) return
    setError(null)
    setAviso(null)
    try {
      await api.borrarCopiaBD(proyecto.id, nombre)
      await recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  function abrirRestaurar(copia) {
    setARestaurar(copia)
    setContrasenaRestaurar("")
    setConfirmacion("")
  }

  async function restaurar() {
    setRestaurando(true)
    setError(null)
    setAviso(null)
    try {
      const r = await api.restaurarCopiaBD(proyecto.id, aRestaurar.nombre, {
        contrasena: aRestaurar.cifrada && contrasenaRestaurar ? contrasenaRestaurar : null,
        confirmacion,
      })
      setARestaurar(null)
      setAviso(
        `Base restaurada a la copia del ${formatearFecha(aRestaurar.fecha)}. ` +
          `Antes se guardó una copia de cómo estaba (${r.copia_previa}), por si hay que deshacerlo.`,
      )
      await recargar()
    } catch (err) {
      setError(err.message)
      setARestaurar(null)
    } finally {
      setRestaurando(false)
    }
  }

  const opcionesCredencial = credenciales.map((c) => ({ value: c.nombre, label: c.nombre }))

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
      <Group justify="space-between" align="flex-start" mb="lg">
        <div>
          <Title order={2} mb="xs">
            Copias de seguridad de {proyecto.nombre}
          </Title>
          <Text c="dimmed">
            Copias de toda la base de datos (documentos, archivos originales, entidades, notas…), guardadas en el
            servidor. Se pueden descargar, programar y, si hace falta, volver a una de ellas.
          </Text>
        </div>
        <Tooltip label="Refrescar">
          <ActionIcon variant="subtle" color="gray" onClick={recargar} loading={cargando}>
            <IconRefresh size={17} stroke={1.8} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {error && (
        <Alert color="red" mb="md" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {aviso && (
        <Alert color="green" mb="md" withCloseButton onClose={() => setAviso(null)}>
          {aviso}
        </Alert>
      )}

      <Group align="flex-start" gap="lg" mb="xl" grow preventGrowOverflow={false} wrap="wrap">
        <Paper withBorder p="md" radius="md" miw={300}>
          <Title order={4} mb="sm">
            Hacer una copia ahora
          </Title>
          <Stack>
            <Text size="sm" c="dimmed">
              Se cifra siempre con la contraseña de las copias, guardada en el almacén de credenciales. Para poder
              hacerla, antes hay que programar las copias y guardar esa contraseña.
            </Text>
            <Button onClick={hacerCopia} loading={haciendo} disabled={!ajustes?.puede_copia_manual}>
              Hacer copia
            </Button>
            {espacioLibre != null && (
              <Text size="xs" c="dimmed">
                Espacio libre en el servidor: {tamano(espacioLibre)}
              </Text>
            )}
          </Stack>
        </Paper>

        {formulario && (
          <Paper withBorder p="md" radius="md" miw={300}>
            <Title order={4} mb="sm">
              Copias programadas
            </Title>
            <Stack component="form" onSubmit={guardarAjustes} autoComplete="off" gap="sm">
              <Switch
                label="Hacer copias automáticamente"
                checked={formulario.programada}
                onChange={(e) => cambiar("programada")(e.currentTarget.checked)}
              />
              {formulario.programada && (
                <>
                  <Text size="sm" c="dimmed">
                    Cada periodo guarda sus propias copias. Por ejemplo: diaria guardando 7, semanal guardando 10 y
                    mensual guardando 12. Si dos coinciden a la misma hora se hace una sola copia que cuenta para los dos.
                  </Text>
                  {formulario.periodos.map((p, i) => {
                    const guardado = ajustes.periodos.find((g) => g.id === p.id)
                    return (
                      <Paper key={p.id ?? `nuevo-${i}`} withBorder p="sm" radius="md">
                        <Stack gap="xs">
                          <Group grow align="flex-end">
                            <Select
                              label="Cuándo" data={FRECUENCIAS} value={p.frecuencia}
                              onChange={(v) => cambiarPeriodo(i, "frecuencia")(v || "diaria")} allowDeselect={false}
                            />
                            <TextInput
                              label="Hora" type="time" value={p.hora}
                              onChange={(e) => cambiarPeriodo(i, "hora")(e.target.value)} required
                            />
                          </Group>
                          {p.frecuencia === "semanal" && (
                            <Chip.Group multiple value={p.diasSemana} onChange={cambiarPeriodo(i, "diasSemana")}>
                              <Group gap="4">
                                {DIAS.map((d, n) => (
                                  <Chip key={d} value={String(n + 1)} size="xs">
                                    {d}
                                  </Chip>
                                ))}
                              </Group>
                            </Chip.Group>
                          )}
                          {p.frecuencia === "mensual" && (
                            <NumberInput
                              label="Día del mes" description="Si el mes es más corto, se hace el último día"
                              min={1} max={31} value={p.diaMes} onChange={cambiarPeriodo(i, "diaMes")} allowDecimal={false}
                            />
                          )}
                          <Group grow align="flex-end">
                            <NumberInput
                              label="Guardar" min={1} max={p.conservarModo === "copias" ? 365 : 3650}
                              value={p.conservar} onChange={cambiarPeriodo(i, "conservar")} allowDecimal={false}
                            />
                            <Select
                              data={[
                                { value: "copias", label: "últimas copias" },
                                { value: "dias", label: "días" },
                              ]}
                              value={p.conservarModo} onChange={(v) => cambiarPeriodo(i, "conservarModo")(v || "copias")}
                              allowDeselect={false}
                            />
                          </Group>
                          <Group justify="space-between">
                            <Text size="xs" c={guardado?.ultimo_resultado && !guardado.ultimo_resultado.ok ? "red" : "dimmed"}>
                              {guardado?.proxima && `Próxima: ${formatearFecha(guardado.proxima)}`}
                              {guardado?.ultimo_resultado &&
                                ` · Última (${formatearFecha(guardado.ultimo_resultado.fecha)}): ${guardado.ultimo_resultado.detalle}`}
                            </Text>
                            <Anchor component="button" type="button" c="red" fz="13px" onClick={() => quitarPeriodo(i)}>
                              Quitar
                            </Anchor>
                          </Group>
                        </Stack>
                      </Paper>
                    )
                  })}
                  {formulario.periodos.length < 10 && (
                    <Button variant="default" size="xs" onClick={anadirPeriodo} style={{ alignSelf: "flex-start" }}>
                      Añadir periodo
                    </Button>
                  )}
                  <Checkbox
                    label="Cifrar también las copias programadas"
                    description="Las copias manuales van siempre cifradas."
                    checked={formulario.cifrar}
                    onChange={(e) => cambiar("cifrar")(e.currentTarget.checked)}
                  />
                </>
              )}
              <PasswordInput
                label="Contraseña de las copias"
                description={
                  "Mínimo 12 caracteres; mejor una frase de varias palabras (mesa-tren-azul-faro). Se guarda cifrada en el " +
                  "almacén de credenciales y no se vuelve a enseñar: apúntala en un sitio seguro, sin ella las copias " +
                  "descargadas no se abren. Si la cambias, las copias anteriores siguen con la de antes."
                }
                placeholder={ajustes.tiene_contrasena ? "Guardada. Escribe otra solo para cambiarla" : "Contraseña nueva"}
                value={formulario.contrasena} onChange={(e) => cambiar("contrasena")(e.target.value)}
                minLength={12} {...SIN_PASSWORD_MANAGER}
              />
              {formulario.contrasena && (
                <PasswordInput
                  placeholder="Repite la contraseña" value={formulario.contrasena2}
                  onChange={(e) => cambiar("contrasena2")(e.target.value)} required {...SIN_PASSWORD_MANAGER}
                />
              )}
              <Select
                label="Guardar también en otro servidor (SFTP)"
                description="Opcional. Una credencial con usuario, contraseña (o campo «clave_privada») y un campo «host». Vale para todas las copias, también las manuales."
                placeholder="No, solo en este servidor" data={opcionesCredencial}
                value={formulario.sftpCredencial} onChange={cambiar("sftpCredencial")} clearable searchable
              />
              {formulario.sftpCredencial && (
                <TextInput
                  label="Carpeta remota" description="Allí se guarda lo mismo que aquí: lo que se borra aquí, se borra allí."
                  value={formulario.sftpCarpeta} onChange={(e) => cambiar("sftpCarpeta")(e.target.value)} required
                />
              )}
              <Button type="submit" loading={guardando} variant="light">
                Guardar ajustes
              </Button>
            </Stack>
          </Paper>
        )}
      </Group>

      {cargando && copias.length === 0 ? (
        <Text>Cargando...</Text>
      ) : (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Fecha</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Cifrada</Table.Th>
              <Table.Th>Tamaño</Table.Th>
              <Table.Th>Otro servidor</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {copias.map((c) => (
              <Table.Tr key={c.nombre}>
                <Table.Td>{formatearFecha(c.fecha)}</Table.Td>
                <Table.Td>{tipoDeCopia(c)}</Table.Td>
                <Table.Td>{c.cifrada ? <Badge size="sm" color="acento">Sí</Badge> : <Text size="sm" c="dimmed">No</Text>}</Table.Td>
                <Table.Td>{tamano(c.tamano)}</Table.Td>
                <Table.Td>
                  {!c.remoto ? (
                    <Text size="sm" c="dimmed">—</Text>
                  ) : (
                    <Tooltip label={c.remoto.detalle} multiline maw={320}>
                      <Badge size="sm" color={c.remoto.ok ? "green" : "red"}>{c.remoto.ok ? "Subida" : "Falló"}</Badge>
                    </Tooltip>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap="4" wrap="nowrap" justify="flex-end">
                    <Tooltip label="Descargar">
                      <ActionIcon variant="subtle" color="gray" onClick={() => descargar(c.nombre)} loading={descargando === c.nombre}>
                        <IconDownload size={16} stroke={1.8} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Volver a esta copia">
                      <ActionIcon variant="subtle" color="orange" onClick={() => abrirRestaurar(c)}>
                        <IconHistory size={16} stroke={1.8} />
                      </ActionIcon>
                    </Tooltip>
                    <Anchor component="button" type="button" c="red" fz="13px" onClick={() => borrar(c.nombre)}>
                      Borrar
                    </Anchor>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {copias.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6}>Todavía no hay ninguna copia.</Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      )}

      <Modal
        opened={!!aRestaurar} onClose={() => !restaurando && setARestaurar(null)}
        title="Volver a una copia de seguridad" size="md"
      >
        {aRestaurar && (
          <Stack>
            <Alert color="orange">
              Todo lo que hay ahora en la base se sustituye por lo que había el {formatearFecha(aRestaurar.fecha)}.
              Lo que se haya hecho después (documentos, cambios, notas…) desaparece. Antes de empezar se guarda una
              copia del estado actual, por si hay que deshacerlo.
            </Alert>
            {aRestaurar.cifrada && (
              <PasswordInput
                label="Contraseña de la copia (opcional)"
                description="Se usa la guardada. Escríbela solo si esta copia se hizo con una contraseña anterior."
                value={contrasenaRestaurar}
                onChange={(e) => setContrasenaRestaurar(e.target.value)} {...SIN_PASSWORD_MANAGER}
              />
            )}
            <TextInput
              label={`Escribe ${CONFIRMACION} para confirmar`} value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)} autoComplete="off"
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setARestaurar(null)} disabled={restaurando}>
                Cancelar
              </Button>
              <Button
                color="red" onClick={restaurar} loading={restaurando}
                disabled={confirmacion.trim() !== CONFIRMACION}
              >
                Restaurar
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  )
}
