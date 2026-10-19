import { useCallback, useEffect, useMemo, useState } from "react"
import { ActionIcon, Alert, Button, Group, Modal, NumberInput, Select, Stack, Switch, Text, TextInput, Title, Tooltip } from "@mantine/core"
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react"
import { MantineReactTable, useMantineReactTable } from "mantine-react-table"
import { CELDA_QUE_CRECE, opcionesDeTabla } from "@contabilidad/components/tabla.ts"
import { api } from "../../api"

// Un maestro del SIF (ver maestros.js): listado, alta, cambio y baja. Lo que
// cada usuario puede hacer lo decide el SIF con su acceso; aquí solo se
// enseña su respuesta si dice que no.
export default function MaestroSif({ proyecto, empresa, maestro }) {
  const pedir = useCallback(
    (accion, cuerpo) => api.erpSif(proyecto.id, empresa.id_empresa, `${maestro.ruta}/${accion}`, cuerpo),
    [proyecto.id, empresa.id_empresa, maestro.ruta],
  )
  const [filas, setFilas] = useState(null)
  const [tipos, setTipos] = useState([])
  const [error, setError] = useState(null)
  const [editando, setEditando] = useState(null) // {} = alta
  const [borrando, setBorrando] = useState(null)

  const cargar = useCallback(() => {
    setError(null)
    pedir("listar", { limit: 10000 })
      .then((r) => setFilas(r.registros))
      .catch((err) => {
        setFilas([])
        setError(err.message)
      })
  }, [pedir])
  useEffect(cargar, [cargar])
  useEffect(() => {
    if (!maestro.tipos) return
    api.erpSif(proyecto.id, empresa.id_empresa, maestro.tipos.ruta)
      .then((r) => setTipos(r.registros.map((t) => ({ value: String(t.id), label: t[maestro.tipos.etiqueta] }))))
      .catch(() => setTipos([]))
  }, [proyecto.id, empresa.id_empresa, maestro.tipos])

  const columnas = useMemo(() => [
    ...maestro.columnas.map((c) => ({
      accessorKey: c.campo, header: c.titulo,
      ...(c.crece ? { grow: true, mantineTableBodyCellProps: CELDA_QUE_CRECE } : { size: c.ancho, grow: false }),
      ...(c.ver ? { Cell: ({ cell }) => c.ver(cell.getValue()) } : {}),
    })),
    {
      id: "acciones", header: "", size: 80, grow: false,
      Cell: ({ row }) => (
        <Group gap={4} wrap="nowrap">
          <Tooltip label="Cambiar">
            <ActionIcon size="sm" variant="subtle" aria-label="Cambiar" onClick={() => setEditando(row.original)}><IconPencil size={14} /></ActionIcon>
          </Tooltip>
          <Tooltip label="Borrar">
            <ActionIcon size="sm" variant="subtle" color="red" aria-label="Borrar" onClick={() => setBorrando(row.original)}><IconTrash size={14} /></ActionIcon>
          </Tooltip>
        </Group>
      ),
    },
  ], [maestro])

  const nuevo = maestro.femenino ? "Nueva" : "Nuevo"
  const tabla = useMantineReactTable({
    ...opcionesDeTabla(),
    columns: columnas,
    data: filas || [],
    enablePagination: false,
    enableBottomToolbar: false,
    state: { isLoading: filas === null },
    localization: { noRecordsToDisplay: `Esta empresa no tiene ${maestro.femenino ? "ninguna" : "ningún"} ${maestro.singular}.` },
  })

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>{maestro.titulo}</Title>
        <Button leftSection={<IconPlus size={15} />} onClick={() => setEditando({})}>{nuevo} {maestro.singular}</Button>
      </Group>
      {error && <Alert color="red">{error}</Alert>}
      <MantineReactTable table={tabla} />
      {editando && (
        <Ficha
          maestro={maestro} fila={editando} tipos={tipos} pedir={pedir}
          alCerrar={() => setEditando(null)} alGuardar={() => { setEditando(null); cargar() }}
        />
      )}
      <Borrar
        maestro={maestro} fila={borrando} pedir={pedir}
        alCerrar={() => setBorrando(null)} alBorrar={() => { setBorrando(null); cargar() }}
      />
    </Stack>
  )
}

function Ficha({ maestro, fila, tipos, pedir, alCerrar, alGuardar }) {
  const alta = fila.id === undefined
  const [valores, setValores] = useState(() =>
    Object.fromEntries(maestro.campos.map((c) => [c.campo, fila[c.campo] ?? c.defecto ?? (c.tipo === "texto" ? "" : null)])),
  )
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const poner = (campo, valor) => setValores((v) => ({ ...v, [campo]: valor }))

  const guardar = (e) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    // En un cambio solo va lo que el SIF deja cambiar
    const cuerpo = Object.fromEntries(
      maestro.campos.filter((c) => alta || !c.soloAlta).map((c) => {
        const v = valores[c.campo]
        return [c.campo, v === "" ? null : c.tipo === "lista" && c.opciones === "tipos" && v !== null ? Number(v) : v]
      }),
    )
    pedir(alta ? "crear" : "modificar", alta ? cuerpo : { ...cuerpo, id: fila.id })
      .then(alGuardar)
      .catch((err) => setError(err.message))
      .finally(() => setGuardando(false))
  }

  return (
    <Modal opened onClose={alCerrar} title={alta ? `${maestro.femenino ? "Nueva" : "Nuevo"} ${maestro.singular}` : `Cambiar ${maestro.singular}`} size="lg">
      <form onSubmit={guardar}>
        <Stack gap="sm">
          {maestro.campos.map((c) => {
            const comun = { key: c.campo, label: c.titulo, description: c.ayuda, required: c.obligatorio, disabled: !alta && c.soloAlta }
            const v = valores[c.campo]
            if (c.tipo === "si_no") {
              return <Switch {...comun} checked={!!v} onChange={(e) => poner(c.campo, e.currentTarget.checked ? 1 : 0)} />
            }
            if (c.tipo === "numero") {
              return <NumberInput {...comun} value={v ?? ""} decimalScale={c.decimales || 0} decimalSeparator="," min={0} onChange={(n) => poner(c.campo, n === "" ? null : n)} />
            }
            if (c.tipo === "lista") {
              const datos = c.opciones === "tipos" ? tipos : c.opciones
              return <Select {...comun} data={datos} value={v === null ? null : String(v)} allowDeselect={false} onChange={(n) => poner(c.campo, n)} />
            }
            return <TextInput {...comun} value={v ?? ""} onChange={(e) => poner(c.campo, e.currentTarget.value)} />
          })}
          {!alta && maestro.campos.some((c) => c.soloAlta) && (
            <Text fz="xs" c="dimmed">Los campos en gris no se pueden cambiar una vez {maestro.femenino ? "creada" : "creado"}.</Text>
          )}
          {error && <Alert color="red">{error}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={alCerrar}>Cancelar</Button>
            <Button type="submit" loading={guardando}>Guardar</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

function Borrar({ maestro, fila, pedir, alCerrar, alBorrar }) {
  const [error, setError] = useState(null)
  const [borrando, setBorrando] = useState(false)
  useEffect(() => setError(null), [fila])
  const borrar = () => {
    setBorrando(true)
    pedir("eliminar", { id: fila.id })
      .then(alBorrar)
      .catch((err) => setError(err.message))
      .finally(() => setBorrando(false))
  }
  return (
    <Modal opened={!!fila} onClose={alCerrar} title={`Borrar ${maestro.singular}`}>
      <Stack gap="sm">
        <Text>Se borra «{fila?.serie ? `${fila.serie} - ` : ""}{fila?.descripcion}» del SIF. No se puede deshacer.</Text>
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>Cancelar</Button>
          <Button color="red" loading={borrando} onClick={borrar}>Borrar</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
