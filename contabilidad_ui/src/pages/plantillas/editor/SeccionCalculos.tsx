import { Button, Group, Stack, Text, TextInput } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import type { Variable } from '../../../api/plantillas'
import CasillaFormula from './CasillaFormula'
import { mover } from './definicion'
import { AccionesDeFila } from './SeccionDatos'

interface Props {
  variables: Variable[]
  errores: Map<string, string[]>
  alCambiar: (variables: Variable[]) => void
}

/**
 * Cálculos intermedios, en orden: cada uno puede usar los datos y los cálculos
 * de encima, nunca los de debajo.
 */
export default function SeccionCalculos({ variables, errores, alCambiar }: Props) {
  function cambiar(i: number, cambios: Partial<Variable>) {
    alCambiar(variables.map((v, j) => (j === i ? { ...v, ...cambios } : v)))
  }

  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed">
        Cada cálculo puede usar los datos y los cálculos que tiene encima.
      </Text>
      {variables.map((v, i) => {
        const err = (campo: string) => errores.get(`variables[${i}].${campo}`)
        return (
          <Group key={i} align="flex-start" gap="xs" wrap="nowrap">
            <TextInput
              size="xs"
              aria-label="Clave"
              placeholder="cuota"
              value={v.clave}
              onChange={(e) => cambiar(i, { clave: e.currentTarget.value })}
              error={errores.get(`variables[${i}].clave`)?.join(' ')}
              w={200}
              styles={{ input: { fontFamily: 'monospace' } }}
            />
            <Text size="sm" mt={4}>
              =
            </Text>
            <div style={{ flex: 1 }}>
              <CasillaFormula
                ariaLabel="Fórmula"
                placeholder="redondear(valor * pct / 100)"
                valor={v.expr}
                alCambiar={(expr) => cambiar(i, { expr })}
                errores={err('expr')}
              />
            </div>
            <AccionesDeFila
              alSubir={() => alCambiar(mover(variables, i, -1))}
              alBajar={() => alCambiar(mover(variables, i, 1))}
              alQuitar={() => alCambiar(variables.filter((_, j) => j !== i))}
              quitar="Quitar cálculo"
            />
          </Group>
        )
      })}
      <Button
        size="xs"
        variant="default"
        leftSection={<IconPlus size={14} />}
        onClick={() => alCambiar([...variables, { clave: '', expr: '' }])}
        style={{ alignSelf: 'flex-start' }}
      >
        Añadir cálculo
      </Button>
    </Stack>
  )
}
