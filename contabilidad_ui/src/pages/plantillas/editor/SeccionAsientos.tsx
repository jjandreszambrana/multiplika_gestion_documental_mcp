import { ActionIcon, Alert, Button, Group, Paper, Select, Stack, Table, Text, Tooltip } from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import type { AsientoPlantilla, Linea, Parametro } from '../../../api/plantillas'
import type { DiarioContable } from '../../../api/diarios'
import CasillaFormula from './CasillaFormula'
import { lineaVacia, mover } from './definicion'
import { NOTA } from './notas'
import { AccionesDeFila } from './SeccionDatos'
import TituloConNota from './TituloConNota'

interface Props {
  asientos: AsientoPlantilla[]
  parametros: Parametro[]
  diarios: DiarioContable[]
  errores: Map<string, string[]>
  alCambiar: (asientos: AsientoPlantilla[]) => void
}

/** Las columnas de la hoja de líneas, en el orden en que se rellenan. */
const COLUMNAS: { campo: keyof Linea; titulo: string; ancho: number; nota: string }[] = [
  { campo: 'cuenta', titulo: 'Cuenta', ancho: 170, nota: NOTA.cuenta },
  { campo: 'debe', titulo: 'Debe', ancho: 160, nota: NOTA.importe },
  { campo: 'haber', titulo: 'Haber', ancho: 160, nota: NOTA.importe },
  { campo: 'concepto', titulo: 'Concepto', ancho: 200, nota: NOTA.conceptoLinea },
  { campo: 'documento', titulo: 'Documento', ancho: 130, nota: NOTA.documento },
  { campo: 'id_obra', titulo: 'Obra', ancho: 120, nota: NOTA.obra },
  { campo: 'id_tipo_iva', titulo: 'Tipo de IVA', ancho: 120, nota: NOTA.tipoIva },
  { campo: 'si', titulo: 'Solo si', ancho: 140, nota: NOTA.soloSi },
]

/**
 * Los asientos que salen y sus líneas, en forma de hoja: una fila por línea.
 * Todo lo que va en una celda es una fórmula; una subcuenta fija se escribe
 * entre comillas, '6810001'.
 */
export default function SeccionAsientos({ asientos, parametros, diarios, errores, alCambiar }: Props) {
  const tablas = parametros.filter((p) => p.tipo === 'tabla' && p.clave !== '')

  function cambiarAsiento(i: number, cambios: Partial<AsientoPlantilla>) {
    alCambiar(asientos.map((a, j) => (j === i ? { ...a, ...cambios } : a)))
  }

  return (
    <Stack gap="md">
      {asientos.map((a, i) => {
        const base = `asientos[${i}]`
        const cambiarLineas = (lineas: Linea[]) => cambiarAsiento(i, { lineas })
        const propios = errores.get(base)
        return (
          <Paper key={i} withBorder p="sm">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text fw={600} size="sm">{`Asiento ${i + 1}`}</Text>
                {asientos.length > 1 && (
                  <Tooltip label="Quitar asiento">
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="red"
                      aria-label="Quitar asiento"
                      onClick={() => alCambiar(asientos.filter((_, j) => j !== i))}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
              {propios && (
                <Alert color="red" p="xs">
                  {propios.join(' ')}
                </Alert>
              )}
              <Group align="flex-start" gap="xs" grow>
                <CasillaFormula
                  label="Fecha"
                  nota={NOTA.fechaAsiento}
                  placeholder="fecha"
                  valor={a.fecha}
                  alCambiar={(fecha) => cambiarAsiento(i, { fecha })}
                  errores={errores.get(`${base}.fecha`)}
                />
                <CasillaFormula
                  label="Concepto"
                  nota={NOTA.conceptoAsiento}
                  placeholder="'Nómina ' + formato(fecha, 'MM/AAAA')"
                  valor={a.concepto}
                  alCambiar={(concepto) => cambiarAsiento(i, { concepto })}
                  errores={errores.get(`${base}.concepto`)}
                />
                <Select
                  size="xs"
                  label="Diario"
                  description={NOTA.diarioAsiento}
                  placeholder="El de la plantilla"
                  data={diarios.map((d) => ({ value: d.codigo, label: `${d.codigo} · ${d.descripcion ?? ''}` }))}
                  value={a.diario || null}
                  onChange={(diario) => cambiarAsiento(i, { diario })}
                  clearable
                  error={errores.get(`${base}.diario`)?.join(' ')}
                />
              </Group>

              <Table.ScrollContainer minWidth={1500}>
                <Table withTableBorder verticalSpacing={2} horizontalSpacing={4} fz="sm">
                  <Table.Thead>
                    <Table.Tr>
                      {COLUMNAS.map((c) => (
                        <Table.Th key={c.campo} w={c.ancho}>
                          <TituloConNota titulo={c.titulo} nota={c.nota} />
                        </Table.Th>
                      ))}
                      <Table.Th w={150}>
                        <TituloConNota titulo="Una por cada fila de" nota={NOTA.repetirPor} />
                      </Table.Th>
                      <Table.Th w={80} />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {a.lineas.map((l, j) => {
                      const rl = `${base}.lineas[${j}]`
                      // En una línea repetida se puede usar la fila y su número.
                      const extra = l.repetir_por ? ['fila', 'indice'] : []
                      const deLaLinea = errores.get(rl)
                      return (
                        <Table.Tr key={j}>
                          {COLUMNAS.map((c) => (
                            <Table.Td key={c.campo} style={{ verticalAlign: 'top' }}>
                              <CasillaFormula
                                ariaLabel={c.titulo}
                                valor={l[c.campo]}
                                alCambiar={(v) =>
                                  cambiarLineas(a.lineas.map((x, k) => (k === j ? { ...x, [c.campo]: v } : x)))
                                }
                                errores={errores.get(`${rl}.${c.campo}`)}
                                extra={extra}
                              />
                            </Table.Td>
                          ))}
                          <Table.Td style={{ verticalAlign: 'top' }}>
                            <Select
                              size="xs"
                              aria-label="Una por cada fila de"
                              placeholder="Una sola"
                              data={tablas.map((t) => ({ value: t.clave, label: t.etiqueta || t.clave }))}
                              value={l.repetir_por || null}
                              onChange={(v) =>
                                cambiarLineas(a.lineas.map((x, k) => (k === j ? { ...x, repetir_por: v } : x)))
                              }
                              clearable
                              error={[...(errores.get(`${rl}.repetir_por`) ?? []), ...(deLaLinea ?? [])].join(' ') || undefined}
                            />
                          </Table.Td>
                          <Table.Td style={{ verticalAlign: 'top' }}>
                            <AccionesDeFila
                              alSubir={() => cambiarLineas(mover(a.lineas, j, -1))}
                              alBajar={() => cambiarLineas(mover(a.lineas, j, 1))}
                              alQuitar={() => cambiarLineas(a.lineas.filter((_, k) => k !== j))}
                              quitar="Quitar línea"
                            />
                          </Table.Td>
                        </Table.Tr>
                      )
                    })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
              {errores.get(`${base}.lineas`) && (
                <Text size="xs" c="red">
                  {errores.get(`${base}.lineas`)?.join(' ')}
                </Text>
              )}
              <Button
                size="compact-xs"
                variant="subtle"
                leftSection={<IconPlus size={14} />}
                onClick={() => cambiarLineas([...a.lineas, lineaVacia()])}
                style={{ alignSelf: 'flex-start' }}
              >
                Añadir línea
              </Button>
            </Stack>
          </Paper>
        )
      })}
      <Button
        size="xs"
        variant="default"
        leftSection={<IconPlus size={14} />}
        onClick={() => alCambiar([...asientos, { fecha: '', concepto: '', lineas: [lineaVacia(), lineaVacia()] }])}
        style={{ alignSelf: 'flex-start' }}
      >
        Añadir asiento
      </Button>
    </Stack>
  )
}
