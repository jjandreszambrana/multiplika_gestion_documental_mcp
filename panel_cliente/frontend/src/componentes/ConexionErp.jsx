import { useEffect, useState } from "react"
import {
  Alert, Badge, Button, Checkbox, FileInput, Group, Modal, Paper, SegmentedControl, Select, Stack, Switch, Table, Tabs, Text, TextInput,
} from "@mantine/core"
import { IconFileSpreadsheet, IconRefresh } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha } from "../formato"

const OBJETOS = [
  { value: "clientes", label: "Clientes" },
  { value: "facturas", label: "Facturas" },
  { value: "cobros", label: "Cobros" },
]
const COLOR_ESTADO = { ok: "green", error: "red", sin_probar: "gray" }

function SIF({ proyecto }) {
  const [conexiones, setConexiones] = useState(null)
  const [credenciales, setCredenciales] = useState([])
  const [credencial, setCredencial] = useState(null)
  const [url, setUrl] = useState("https://sif2.multiplika.net")
  const [ocupado, setOcupado] = useState(null)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)

  function cargar() {
    api.listarConexionesErp(proyecto.id).then(setConexiones).catch((err) => setError(err.message))
  }

  useEffect(() => {
    cargar()
    if (proyecto.es_admin) api.listarCredenciales(proyecto.id).then(setCredenciales).catch(() => setCredenciales([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id])

  async function hacer(clave, accion) {
    setOcupado(clave)
    setError(null)
    setAviso(null)
    try {
      await accion()
      cargar()
    } catch (err) {
      setError(err.message)
      cargar()
    } finally {
      setOcupado(null)
    }
  }

  return (
    <Stack gap="sm">
      <Text size="13px" c="dimmed">
        Con Multiplika SIF, cada noche se traen solos los clientes, las facturas y lo pendiente de cobro. Se entra con el
        usuario y la contraseña de la empresa en SIF, guardados en Credenciales. Solo se lee: no se cambia nada en SIF.
      </Text>
      {error && <Alert color="red">{error}</Alert>}
      {aviso && <Alert color="green">{aviso}</Alert>}
      {conexiones?.map((c) => (
        <Paper key={c.id} withBorder radius="md" p="sm">
          <Group justify="space-between" wrap="nowrap" align="flex-start">
            <div>
              <Group gap={6}>
                <Text fw={600}>{c.nombre}</Text>
                <Badge size="sm" variant="light" color={COLOR_ESTADO[c.estado] || "gray"}>{c.estado === "ok" ? "funciona" : c.estado}</Badge>
              </Group>
              <Text size="12px" c="dimmed">{c.url} · obligado n.º {c.id_obligado ?? "?"}</Text>
              <Text size="13px" mt={4}>
                {c.fecha_ultima_sync ? `Última sincronización: ${formatearFecha(c.fecha_ultima_sync).slice(0, 16)}. ${c.resumen_ultima_sync || ""}` : "Todavía no se ha sincronizado."}
              </Text>
              {c.ultimo_error && <Text size="13px" c="red" mt={4}>{c.ultimo_error}</Text>}
            </div>
            <Stack gap={6} align="flex-end">
              {proyecto.puede_editar && (
                <Button
                  size="xs" leftSection={<IconRefresh size={14} />} loading={ocupado === `s${c.id}`}
                  onClick={() => hacer(`s${c.id}`, async () => setAviso((await api.sincronizarConexionErp(proyecto.id, c.id)).resumen))}
                >
                  Sincronizar ahora
                </Button>
              )}
              {proyecto.es_admin && (
                <>
                  <Switch
                    size="xs" label="Cada noche" checked={c.activa}
                    onChange={(e) => { const activa = e.currentTarget.checked; hacer(`a${c.id}`, () => api.actualizarConexionErp(proyecto.id, c.id, { activa })) }}
                  />
                  <Button
                    size="xs" variant="subtle" color="red"
                    onClick={() => confirm("¿Quitar la conexión? Lo ya traído se queda.") && hacer(`e${c.id}`, () => api.eliminarConexionErp(proyecto.id, c.id))}
                  >
                    Quitar
                  </Button>
                </>
              )}
            </Stack>
          </Group>
        </Paper>
      ))}
      {conexiones?.length === 0 && !proyecto.es_admin && <Text c="dimmed">No hay conexión con SIF. La da de alta un administrador.</Text>}
      {proyecto.es_admin && (
        <Paper withBorder radius="md" p="sm">
          <Text fw={600} size="sm" mb={6}>{conexiones?.length ? "Conectar otra empresa" : "Conectar con Multiplika SIF"}</Text>
          <Group align="flex-end" gap="8">
            <Select
              label="Credencial (usuario y contraseña de SIF)" placeholder="Elige una credencial" w={300}
              data={credenciales.map((c) => ({ value: c.nombre, label: c.usuario ? `${c.nombre} (${c.usuario})` : c.nombre }))}
              value={credencial} onChange={setCredencial} searchable
            />
            <TextInput label="Dirección de SIF" w={260} value={url} onChange={(e) => setUrl(e.currentTarget.value)} />
            <Button
              disabled={!credencial} loading={ocupado === "nueva"}
              onClick={() => hacer("nueva", async () => {
                const c = await api.crearConexionErp(proyecto.id, { nombre_credencial: credencial, url })
                setAviso(`Conectado con ${c.empresa || "SIF"}. Pulsa «Sincronizar ahora» para traer los datos.`)
              })}
            >
              Conectar
            </Button>
          </Group>
          <Text size="12px" c="dimmed" mt={6}>
            Si no está la credencial, créala antes en Credenciales: usuario = usuario de la empresa en SIF; valor = su contraseña.
          </Text>
        </Paper>
      )}
    </Stack>
  )
}

function Importar({ proyecto, onImportado }) {
  const [objeto, setObjeto] = useState("clientes")
  const [archivo, setArchivo] = useState(null)
  const [todos, setTodos] = useState(false)
  const [vista, setVista] = useState(null)
  const [historial, setHistorial] = useState([])
  const [resultado, setResultado] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState(null)

  function cargarHistorial() {
    api.listarImportacionesErp(proyecto.id).then(setHistorial).catch(() => setHistorial([]))
  }
  useEffect(cargarHistorial, [proyecto.id])

  async function hacer(accion) {
    setOcupado(true)
    setError(null)
    try {
      await accion()
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  const subir = () => hacer(async () => {
    setResultado(null)
    setVista(await api.crearImportacionErp(proyecto.id, { archivo, objeto, todosLosClientes: todos }))
  })
  const revisar = (cambios) => hacer(async () => {
    setVista(await api.revisarImportacionErp(proyecto.id, vista.id, { mapeo: vista.mapeo, formato_fecha: vista.formato_fecha, ...cambios }))
  })
  const aplicar = () => hacer(async () => {
    setResultado(await api.aplicarImportacionErp(proyecto.id, vista.id, { mapeo: vista.mapeo, formato_fecha: vista.formato_fecha }))
    setVista(null)
    setArchivo(null)
    cargarHistorial()
    onImportado?.()
  })
  const descartar = () => hacer(async () => {
    await api.descartarImportacionErp(proyecto.id, vista.id)
    setVista(null)
    cargarHistorial()
  })

  const opcionesColumna = (vista?.cabeceras || []).map((c, i) => ({ value: String(i), label: c }))
  const p = vista?.prevision

  return (
    <Stack gap="sm">
      <Text size="13px" c="dimmed">
        Si la empresa usa otro programa de facturación, exporta de él un listado a Excel (.xlsx) o CSV y súbelo aquí. La
        primera vez se propone qué columna es cada dato; se comprueba con la vista previa y se recuerda para la próxima.
        Volver a subir el mismo listado no duplica nada.
      </Text>
      {error && <Alert color="red">{error}</Alert>}
      {resultado && (
        <Alert color="green">
          Importado: {resultado.creados} nuevos y {resultado.actualizados} actualizados
          {resultado.bajas ? `, ${resultado.bajas} marcados como baja` : ""}
          {resultado.con_error ? `; ${resultado.con_error} filas con error no se importaron` : ""}.
        </Alert>
      )}

      {!vista ? (
        <Group align="flex-end" gap="8">
          <SegmentedControl value={objeto} onChange={setObjeto} data={OBJETOS} />
          <FileInput
            w={280} placeholder="Elige el fichero" accept=".xlsx,.csv" value={archivo} onChange={setArchivo}
            leftSection={<IconFileSpreadsheet size={16} />} clearable
          />
          {objeto === "clientes" && (
            <Checkbox label="Son todos mis clientes" checked={todos} onChange={(e) => setTodos(e.currentTarget.checked)} mb={8}
              title="Los que vinieron antes del ERP y no estén en este fichero se marcan como baja (no se borran)" />
          )}
          <Button onClick={subir} disabled={!archivo} loading={ocupado}>Ver vista previa</Button>
        </Group>
      ) : (
        <Paper withBorder radius="md" p="sm">
          <Text fw={600} mb={4}>
            {vista.nombre_fichero} · {OBJETOS.find((o) => o.value === vista.objeto)?.label} · {vista.total_filas} filas
          </Text>
          {vista.mapeo_guardado && <Text size="12px" c="dimmed" mb={6}>Columnas como la última vez que se importó un fichero igual.</Text>}
          <Table verticalSpacing={4} mb="sm">
            <Table.Tbody>
              {vista.campos.map((c) => (
                <Table.Tr key={c.campo}>
                  <Table.Td w={220}><Text size="sm">{c.etiqueta}{c.obligatorio ? " *" : ""}</Text></Table.Td>
                  <Table.Td>
                    <Select
                      size="xs" w={260} placeholder="(ninguna columna)" clearable data={opcionesColumna}
                      value={vista.mapeo[c.campo] != null ? String(vista.mapeo[c.campo]) : null}
                      onChange={(v) => revisar({ mapeo: { ...vista.mapeo, [c.campo]: v == null ? null : Number(v) } })}
                    />
                  </Table.Td>
                  <Table.Td><Text size="12px" c="dimmed" lineClamp={1}>{vista.mapeo[c.campo] != null ? `p.ej. ${vista.muestras[0]?.[vista.mapeo[c.campo]] ?? "—"}` : ""}</Text></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {vista.objeto !== "clientes" && (
            <Select
              size="xs" w={200} label="Las fechas vienen como" mb="sm" allowDeselect={false}
              data={vista.formatos_fecha} value={vista.formato_fecha} onChange={(v) => revisar({ formato_fecha: v })}
            />
          )}
          {vista.faltan.length > 0 ? (
            <Alert color="yellow" mb="sm">Falta decir qué columna es: {vista.faltan.join(", ")}.</Alert>
          ) : p && (
            <Alert color={p.con_error ? "yellow" : "blue"} mb="sm">
              Si se aplica: {p.creados} nuevos, {p.actualizados} actualizados
              {p.bajas ? `, ${p.bajas} marcados como baja` : ""}{p.sin_cliente ? `, ${p.sin_cliente} facturas sin saber de qué cliente son` : ""}
              {p.con_error ? ` y ${p.con_error} filas con error que no se importarán:` : "."}
              {p.errores.slice(0, 8).map((e) => <Text key={e.fila} size="12px">Fila {e.fila}: {e.error}</Text>)}
            </Alert>
          )}
          <Group gap="8">
            <Button onClick={aplicar} loading={ocupado} disabled={vista.faltan.length > 0}>Importar</Button>
            <Button variant="subtle" color="gray" onClick={descartar}>Descartar</Button>
          </Group>
        </Paper>
      )}

      {historial.length > 0 && (
        <>
          <Text fw={600} size="sm" mt="xs">Últimas importaciones</Text>
          <Table striped verticalSpacing={4}>
            <Table.Tbody>
              {historial.slice(0, 8).map((h) => (
                <Table.Tr key={h.id}>
                  <Table.Td><Text size="13px">{formatearFecha(h.fecha).slice(0, 16)}</Text></Table.Td>
                  <Table.Td><Text size="13px">{h.nombre_fichero}</Text></Table.Td>
                  <Table.Td><Badge size="sm" variant="light" color={h.estado === "aplicada" ? "green" : "gray"}>{h.estado}</Badge></Table.Td>
                  <Table.Td><Text size="12px" c="dimmed">{h.resumen ? `${h.resumen.creados} nuevos, ${h.resumen.actualizados} actualizados${h.resumen.con_error ? `, ${h.resumen.con_error} con error` : ""}` : ""} · {h.quien}</Text></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}
    </Stack>
  )
}

// Ventas → "Conexión con el ERP": Multiplika SIF o importar desde Excel.
export default function ConexionErp({ opened, onClose, proyecto, onImportado }) {
  return (
    <Modal opened={opened} onClose={onClose} size="xl" title="Conexión con el programa de facturación">
      <Tabs defaultValue="sif" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="sif">Multiplika SIF</Tabs.Tab>
          {proyecto.puede_editar && <Tabs.Tab value="excel">Importar desde Excel</Tabs.Tab>}
        </Tabs.List>
        <Tabs.Panel value="sif"><SIF proyecto={proyecto} /></Tabs.Panel>
        <Tabs.Panel value="excel"><Importar proyecto={proyecto} onImportado={onImportado} /></Tabs.Panel>
      </Tabs>
    </Modal>
  )
}
