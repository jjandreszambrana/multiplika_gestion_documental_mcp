import {
  ActionIcon,
  Alert,
  Button,
  Checkbox,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from '@tabler/icons-react'
import type { OpcionParametro, Parametro, TipoParametro } from '../../../api/plantillas'
import CasillaFormula from './CasillaFormula'
import { useFormulas } from './ContextoFormulas'
import { mover, NOMBRE_DE_ORIGEN, NOMBRE_DE_TIPO, parametroVacio } from './definicion'
import { NOTA } from './notas'

interface Props {
  parametros: Parametro[]
  /** `parametros` o `parametros[2].columnas`: delante de cada ruta de error. */
  ruta: string
  errores: Map<string, string[]>
  alCambiar: (parametros: Parametro[]) => void
  /** Las columnas de una tabla: no se ocultan ni pueden ser otra tabla. */
  enTabla?: boolean
}

const TIPOS = Object.keys(NOMBRE_DE_TIPO) as TipoParametro[]

function texto(errores: string[] | undefined): string | undefined {
  return errores && errores.length > 0 ? errores.join(' ') : undefined
}

/** Los acciones de mover y quitar de un elemento de una lista. */
export function AccionesDeFila({
  alSubir,
  alBajar,
  alQuitar,
  quitar,
}: {
  alSubir: () => void
  alBajar: () => void
  alQuitar: () => void
  quitar: string
}) {
  return (
    <Group gap={2} wrap="nowrap">
      <Tooltip label="Subir">
        <ActionIcon size="sm" variant="subtle" aria-label="Subir" onClick={alSubir}>
          <IconArrowUp size={14} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Bajar">
        <ActionIcon size="sm" variant="subtle" aria-label="Bajar" onClick={alBajar}>
          <IconArrowDown size={14} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={quitar}>
        <ActionIcon size="sm" variant="subtle" color="red" aria-label={quitar} onClick={alQuitar}>
          <IconTrash size={14} />
        </ActionIcon>
      </Tooltip>
    </Group>
  )
}

function OpcionesFijas({
  opciones,
  alCambiar,
}: {
  opciones: OpcionParametro[]
  alCambiar: (opciones: OpcionParametro[]) => void
}) {
  return (
    <Stack gap={4}>
      {opciones.length > 0 && (
        <Text size="xs" c="dimmed">
          {`Valor: ${NOTA.valorOpcion} Lo que se ve: ${NOTA.etiquetaOpcion}`}
        </Text>
      )}
      {opciones.map((o, i) => (
        <Group key={i} gap="xs" wrap="nowrap">
          <TextInput
            size="xs"
            aria-label="Valor"
            placeholder="Valor"
            value={String(o.valor)}
            onChange={(e) =>
              alCambiar(opciones.map((x, j) => (j === i ? { ...x, valor: e.currentTarget.value } : x)))
            }
            w={140}
          />
          <TextInput
            size="xs"
            aria-label="Lo que se ve"
            placeholder="Lo que se ve"
            value={o.etiqueta}
            onChange={(e) =>
              alCambiar(
                opciones.map((x, j) => (j === i ? { ...x, etiqueta: e.currentTarget.value } : x)),
              )
            }
            style={{ flex: 1 }}
          />
          <ActionIcon
            size="sm"
            variant="subtle"
            color="red"
            aria-label="Quitar opción"
            onClick={() => alCambiar(opciones.filter((_, j) => j !== i))}
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      ))}
      <Button
        size="compact-xs"
        variant="subtle"
        leftSection={<IconPlus size={14} />}
        onClick={() => alCambiar([...opciones, { valor: '', etiqueta: '' }])}
        style={{ alignSelf: 'flex-start' }}
      >
        Añadir opción
      </Button>
    </Stack>
  )
}

/**
 * Los datos que pide la plantilla al usarla, uno por tarjeta. Las columnas de
 * una tabla se editan con esto mismo, dentro de su tarjeta.
 */
export default function SeccionDatos({ parametros, ruta, errores, alCambiar, enTabla = false }: Props) {
  const { catalogo } = useFormulas()
  const origenes = catalogo?.origenes ?? Object.keys(NOMBRE_DE_ORIGEN)

  function cambiar(i: number, cambios: Partial<Parametro>) {
    alCambiar(parametros.map((p, j) => (j === i ? { ...p, ...cambios } : p)))
  }

  return (
    <Stack gap="sm">
      {parametros.map((p, i) => {
        const base = `${ruta}[${i}]`
        const err = (campo: string) => errores.get(`${base}.${campo}`)
        const propios = errores.get(base)
        const conOrigen = typeof p.origen === 'string'
        return (
          <Paper key={i} withBorder p="sm">
            <Stack gap="xs">
              {propios && (
                <Alert color="red" p="xs">
                  {propios.join(' ')}
                </Alert>
              )}
              <Group align="flex-start" gap="xs" wrap="nowrap">
                <SimpleGrid cols={{ base: 2, md: 4 }} spacing="xs" style={{ flex: 1 }}>
                  <TextInput
                    size="xs"
                    label="Clave"
                    description={NOTA.clave}
                    placeholder="cuota_mensual"
                    value={p.clave}
                    onChange={(e) => cambiar(i, { clave: e.currentTarget.value })}
                    error={texto(err('clave'))}
                    styles={{ input: { fontFamily: 'monospace' } }}
                  />
                  <Select
                    size="xs"
                    label="Tipo"
                    description={NOTA.tipo}
                    data={TIPOS.filter((t) => !enTabla || t !== 'tabla').map((t) => ({
                      value: t,
                      label: NOMBRE_DE_TIPO[t],
                    }))}
                    value={p.tipo}
                    onChange={(t) => t && cambiar(i, { tipo: t as TipoParametro })}
                    allowDeselect={false}
                    error={texto(err('tipo'))}
                  />
                  <TextInput
                    size="xs"
                    label="Rótulo"
                    description={NOTA.rotulo}
                    placeholder="Importe bruto"
                    value={p.etiqueta ?? ''}
                    onChange={(e) => cambiar(i, { etiqueta: e.currentTarget.value })}
                    error={texto(err('etiqueta'))}
                  />
                  <Checkbox
                    size="xs"
                    label="Obligatorio"
                    description={NOTA.obligatorio}
                    checked={p.obligatorio === true}
                    onChange={(e) => cambiar(i, { obligatorio: e.currentTarget.checked })}
                    mt={26}
                  />
                </SimpleGrid>
                <AccionesDeFila
                  alSubir={() => alCambiar(mover(parametros, i, -1))}
                  alBajar={() => alCambiar(mover(parametros, i, 1))}
                  alQuitar={() => alCambiar(parametros.filter((_, j) => j !== i))}
                  quitar={enTabla ? 'Quitar columna' : 'Quitar dato'}
                />
              </Group>

              <SimpleGrid cols={{ base: 1, md: enTabla ? 3 : 4 }} spacing="xs">
                <CasillaFormula
                  label="Valor por defecto"
                  nota={NOTA.defecto}
                  valor={p.defecto}
                  alCambiar={(v) => cambiar(i, { defecto: v })}
                  errores={err('defecto')}
                />
                {!enTabla && (
                  <CasillaFormula
                    label="Cuándo se ve"
                    nota={NOTA.visibleSi}
                    placeholder="Siempre"
                    valor={p.visible_si}
                    alCambiar={(v) => cambiar(i, { visible_si: v })}
                    errores={err('visible_si')}
                  />
                )}
                <CasillaFormula
                  label="Comprobación"
                  nota={NOTA.validacion}
                  valor={p.validacion}
                  alCambiar={(v) => cambiar(i, { validacion: v })}
                  errores={err('validacion')}
                  extra={enTabla ? ['fila'] : []}
                />
                <TextInput
                  size="xs"
                  label="Mensaje si no se cumple"
                  description={NOTA.mensajeValidacion}
                  value={p.mensaje_validacion ?? ''}
                  onChange={(e) => cambiar(i, { mensaje_validacion: e.currentTarget.value })}
                  error={texto(err('mensaje_validacion'))}
                />
              </SimpleGrid>

              {!enTabla && (
                <TextInput
                  size="xs"
                  label="Ayuda"
                  description={NOTA.ayuda}
                  value={p.ayuda ?? ''}
                  onChange={(e) => cambiar(i, { ayuda: e.currentTarget.value })}
                  error={texto(err('ayuda'))}
                />
              )}

              {p.tipo === 'cuenta' && (
                <TextInput
                  size="xs"
                  label="Empieza por"
                  description="Solo se admiten subcuentas que empiecen así, con * al final: 681*"
                  value={p.filtro ?? ''}
                  onChange={(e) => cambiar(i, { filtro: e.currentTarget.value })}
                  error={texto(err('filtro'))}
                  w={260}
                />
              )}

              {p.tipo === 'texto' && (
                <NumberInput
                  size="xs"
                  label="Largo máximo"
                  description={NOTA.largoMaximo}
                  min={1}
                  max={255}
                  allowDecimal={false}
                  value={p.longitud_maxima ?? ''}
                  onChange={(v) => cambiar(i, { longitud_maxima: typeof v === 'number' ? v : null })}
                  error={texto(err('longitud_maxima'))}
                  w={160}
                />
              )}

              {p.tipo === 'numero' && (
                <NumberInput
                  size="xs"
                  label="Decimales"
                  description={NOTA.decimales}
                  min={0}
                  max={6}
                  allowDecimal={false}
                  value={p.decimales ?? ''}
                  onChange={(v) => cambiar(i, { decimales: typeof v === 'number' ? v : null })}
                  error={texto(err('decimales'))}
                  w={160}
                />
              )}

              {p.tipo === 'seleccion' && (
                <Stack gap={4}>
                  <SegmentedControl
                    size="xs"
                    value={conOrigen ? 'origen' : 'fijas'}
                    onChange={(v) =>
                      cambiar(
                        i,
                        v === 'origen'
                          ? { origen: origenes[0] ?? 'obras', opciones: null }
                          : { origen: null, opciones: [] },
                      )
                    }
                    data={[
                      { value: 'fijas', label: 'Opciones escritas aquí' },
                      { value: 'origen', label: 'Una lista de la empresa' },
                    ]}
                    style={{ alignSelf: 'flex-start' }}
                  />
                  <Text size="xs" c="dimmed">
                    {NOTA.origenOpciones}
                  </Text>
                  {conOrigen ? (
                    <Select
                      size="xs"
                      label="Lista de"
                      data={origenes.map((o) => ({ value: o, label: NOMBRE_DE_ORIGEN[o] ?? o }))}
                      value={p.origen ?? null}
                      onChange={(o) => o && cambiar(i, { origen: o, opciones: null })}
                      allowDeselect={false}
                      error={texto(err('origen'))}
                      w={260}
                    />
                  ) : (
                    <OpcionesFijas
                      opciones={p.opciones ?? []}
                      alCambiar={(opciones) => cambiar(i, { opciones })}
                    />
                  )}
                  {err('opciones') && (
                    <Text size="xs" c="red">
                      {texto(err('opciones'))}
                    </Text>
                  )}
                </Stack>
              )}

              {p.tipo === 'tabla' && !enTabla && (
                <Stack gap="xs" pl="md" style={{ borderLeft: '3px solid var(--mantine-color-default-border)' }}>
                  <Group gap="xs">
                    <NumberInput
                      size="xs"
                      label="Filas mínimas"
                      description={NOTA.filasMinimas}
                      min={0}
                      max={200}
                      allowDecimal={false}
                      value={p.filas_minimas ?? 0}
                      onChange={(v) => cambiar(i, { filas_minimas: typeof v === 'number' ? v : 0 })}
                      error={texto(err('filas_minimas'))}
                      w={130}
                    />
                    <NumberInput
                      size="xs"
                      label="Filas máximas"
                      description={NOTA.filasMaximas}
                      min={1}
                      max={200}
                      allowDecimal={false}
                      value={p.filas_maximas ?? 200}
                      onChange={(v) => cambiar(i, { filas_maximas: typeof v === 'number' ? v : 200 })}
                      error={texto(err('filas_maximas'))}
                      w={130}
                    />
                  </Group>
                  <Text size="sm" fw={500}>
                    Columnas
                  </Text>
                  <Text size="xs" c="dimmed">
                    {NOTA.columnas}
                  </Text>
                  {err('columnas') && (
                    <Text size="xs" c="red">
                      {texto(err('columnas'))}
                    </Text>
                  )}
                  <SeccionDatos
                    parametros={p.columnas ?? []}
                    ruta={`${base}.columnas`}
                    errores={errores}
                    alCambiar={(columnas) => cambiar(i, { columnas })}
                    enTabla
                  />
                </Stack>
              )}
            </Stack>
          </Paper>
        )
      })}
      <Button
        size="xs"
        variant="default"
        leftSection={<IconPlus size={14} />}
        onClick={() => alCambiar([...parametros, parametroVacio()])}
        style={{ alignSelf: 'flex-start' }}
      >
        {enTabla ? 'Añadir columna' : 'Añadir dato'}
      </Button>
    </Stack>
  )
}
