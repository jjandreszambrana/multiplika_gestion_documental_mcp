import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActionIcon, Alert, Button, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Switch, Text, Textarea, TextInput, Title, Tooltip,
} from "@mantine/core"
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react"
import { MantineReactTable, useMantineReactTable } from "mantine-react-table"
import { CELDA_QUE_CRECE, opcionesDeTabla } from "@contabilidad/components/tabla.ts"
import { api } from "../../api"
import { LISTAS } from "./maestros"

// Todo lo que haya, por tandas del tamaño que admite el SIF
async function todo(pedir, ruta, cuerpo = {}, limite = 10000) {
  const filas = []
  for (;;) {
    const r = await pedir(ruta, { ...cuerpo, offset: filas.length, limit: limite })
    filas.push(...r.registros)
    if (r.registros.length < limite) return filas
  }
}

// Un maestro del SIF (ver maestros.js): listado, alta, cambio y baja. Lo que
// cada usuario puede hacer lo decide el SIF con su acceso; aquí solo se
// enseña su respuesta si dice que no.
export default function MaestroSif({ proyecto, empresa, maestro }) {
  const pedirRuta = useCallback(
    (ruta, cuerpo) => api.erpSif(proyecto.id, empresa.id_empresa, ruta, cuerpo),
    [proyecto.id, empresa.id_empresa],
  )
  const pedir = useCallback((accion, cuerpo) => pedirRuta(`${maestro.ruta}/${accion}`, cuerpo), [pedirRuta, maestro.ruta])
  const { padre } = maestro
  const [padres, setPadres] = useState(null)
  const [idPadre, setIdPadre] = useState(null)
  const [filas, setFilas] = useState(null)
  const [opciones, setOpciones] = useState({})
  const [error, setError] = useState(null)
  const [editando, setEditando] = useState(null) // {} = alta
  const [borrando, setBorrando] = useState(null)

  useEffect(() => {
    if (!padre) return
    todo(pedirRuta, padre.ruta)
      .then((r) => {
        setPadres(r.map((f) => ({ value: String(f.id), label: f[padre.etiqueta] })))
        setIdPadre(r[0] ? String(r[0].id) : null)
      })
      .catch((err) => setError(err.message))
  }, [pedirRuta, padre])

  const cargar = useCallback(() => {
    if (padre && !idPadre) {
      setFilas(padres ? [] : null)
      return
    }
    setError(null)
    setFilas(null)
    todo(pedirRuta, `${maestro.ruta}/listar`, padre ? { [padre.campo]: Number(idPadre) } : {}, maestro.limite)
      .then(setFilas)
      .catch((err) => {
        setFilas([])
        setError(err.message)
      })
  }, [pedirRuta, maestro, padre, idPadre, padres])
  useEffect(cargar, [cargar])

  // Las listas de la ficha que vienen del SIF (países, formas de pago...)
  useEffect(() => {
    const nombres = [...new Set(maestro.campos.map((c) => c.opciones).filter((o) => typeof o === "string"))]
    nombres.forEach((nombre) => {
      const lista = LISTAS[nombre]
      todo(pedirRuta, lista.ruta)
        .then((r) => {
          const datos = r.map((f) => ({ value: String(f[lista.valor]), label: f[lista.etiqueta] }))
          setOpciones((o) => ({ ...o, [nombre]: lista.vacio ? [lista.vacio, ...datos.filter((d) => d.value !== lista.vacio.value)] : datos }))
        })
        .catch(() => {})
    })
  }, [pedirRuta, maestro])

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
    enableTopToolbar: true,
    enableGlobalFilter: true,
    positionGlobalFilter: "left",
    initialState: { density: "xs", showGlobalFilter: true },
    mantineSearchTextInputProps: { placeholder: "Buscar" },
    state: { isLoading: filas === null },
    localization: {
      noRecordsToDisplay: padre && !idPadre
        ? `Elige un ${padre.titulo.toLowerCase()}.`
        : `${maestro.femenino ? "No hay ninguna" : "No hay ningún"} ${maestro.singular}.`,
    },
  })

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap="md">
          <Title order={3}>{maestro.titulo}</Title>
          {padre && (
            <Select
              aria-label={padre.titulo} placeholder={padre.titulo} w={360} searchable allowDeselect={false}
              data={padres || []} value={idPadre} onChange={setIdPadre}
            />
          )}
        </Group>
        <Button leftSection={<IconPlus size={15} />} disabled={padre && !idPadre} onClick={() => setEditando({})}>
          {nuevo} {maestro.singular}
        </Button>
      </Group>
      {error && <Alert color="red">{error}</Alert>}
      <MantineReactTable table={tabla} />
      {editando && (
        <Ficha
          maestro={maestro} fila={editando} opciones={opciones} pedir={pedir}
          extraAlta={padre ? { [padre.campo]: Number(idPadre) } : {}}
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

const vacio = (c) => (c.tipo === "texto" || c.tipo === "nota" ? "" : null)

function Ficha({ maestro, fila, opciones, pedir, extraAlta, alCerrar, alGuardar }) {
  const alta = fila.id === undefined
  const [valores, setValores] = useState(() =>
    Object.fromEntries(maestro.campos.map((c) => [c.campo, fila[c.campo] ?? (alta ? c.defecto : undefined) ?? vacio(c)])),
  )
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const poner = (campo, valor) => setValores((v) => ({ ...v, [campo]: valor }))

  const valorParaSif = (c, v) => (v === "" || v === undefined ? null : c.numerico && v !== null ? Number(v) : v)

  const guardar = (e) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    // En un cambio solo va lo tocado: el SIF deja el resto como está (y
    // rechaza algunos campos si llegan vacíos aunque ya lo estuvieran)
    const campos = maestro.campos.filter((c) =>
      alta || (!c.soloAlta && String(valores[c.campo] ?? "") !== String(fila[c.campo] ?? "")),
    )
    const cuerpo = Object.fromEntries(campos.map((c) => [c.campo, valorParaSif(c, valores[c.campo])]))
    if (!alta && !campos.length) {
      alCerrar()
      return
    }
    pedir(alta ? "crear" : "modificar", alta ? { ...cuerpo, ...extraAlta } : { ...cuerpo, id: fila.id })
      .then(alGuardar)
      .catch((err) => setError(err.message))
      .finally(() => setGuardando(false))
  }

  const control = (c) => {
    const comun = { key: c.campo, label: c.titulo, description: c.ayuda, required: c.obligatorio, disabled: !alta && c.soloAlta }
    const v = valores[c.campo]
    if (c.tipo === "si_no") {
      return <Switch {...comun} mt="lg" checked={!!Number(v)} onChange={(e) => poner(c.campo, e.currentTarget.checked ? 1 : 0)} />
    }
    if (c.tipo === "numero") {
      return <NumberInput {...comun} value={v ?? ""} decimalScale={c.decimales || 0} decimalSeparator="," min={0} onChange={(n) => poner(c.campo, n === "" ? null : n)} />
    }
    if (c.tipo === "lista") {
      const datos = typeof c.opciones === "string" ? opciones[c.opciones] || [] : c.opciones
      return (
        <Select
          {...comun} data={datos} searchable clearable={!c.obligatorio && c.defecto === undefined}
          value={v === null || v === undefined || v === "" ? null : String(v)} onChange={(n) => poner(c.campo, n)}
        />
      )
    }
    if (c.tipo === "nota") {
      return <Textarea {...comun} autosize minRows={2} style={{ gridColumn: "1 / -1" }} value={v ?? ""} onChange={(e) => poner(c.campo, e.currentTarget.value)} />
    }
    return <TextInput {...comun} value={v ?? ""} onChange={(e) => poner(c.campo, e.currentTarget.value)} />
  }

  const titulo = alta ? `${maestro.femenino ? "Nueva" : "Nuevo"} ${maestro.singular}` : `Cambiar ${maestro.singular}`
  return (
    <Modal opened onClose={alCerrar} title={titulo} size={maestro.campos.length > 10 ? "xl" : "lg"}>
      <form onSubmit={guardar}>
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, sm: maestro.campos.length > 10 ? 2 : 1 }} spacing="sm" verticalSpacing="xs">
            {maestro.campos.map(control)}
          </SimpleGrid>
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
  const nombre = fila && (maestro.nombre ? maestro.nombre(fila) : fila.descripcion)
  return (
    <Modal opened={!!fila} onClose={alCerrar} title={`Borrar ${maestro.singular}`}>
      <Stack gap="sm">
        <Text>Se borra «{nombre}» del SIF. No se puede deshacer.</Text>
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>Cancelar</Button>
          <Button color="red" loading={borrando} onClick={borrar}>Borrar</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
