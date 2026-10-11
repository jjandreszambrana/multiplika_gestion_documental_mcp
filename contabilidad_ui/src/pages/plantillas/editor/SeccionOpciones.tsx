import { Checkbox, Group, Paper, Stack, Text } from '@mantine/core'
import type { Opciones } from '../../../api/plantillas'
import CasillaFormula from './CasillaFormula'

interface Props {
  opciones: Opciones
  errores: Map<string, string[]>
  alCambiar: (opciones: Opciones) => void
}

/** Lo que se añade al final: la línea que cuadra y el asiento que deshace al principal. */
export default function SeccionOpciones({ opciones, errores, alCambiar }: Props) {
  const cuadre = opciones.autocuadre ?? null
  const reversion = opciones.reversion ?? null

  return (
    <Stack gap="md">
      <Paper withBorder p="sm">
        <Stack gap="xs">
          <Checkbox
            label="Añadir una línea que cuadre el asiento"
            description="Lleva la diferencia entre el debe y el haber a la cuenta que se diga. Si ya cuadra, no sale."
            checked={cuadre !== null}
            onChange={(e) =>
              alCambiar({ ...opciones, autocuadre: e.currentTarget.checked ? { cuenta: '', concepto: '' } : null })
            }
          />
          {cuadre && (
            <Group grow align="flex-start">
              <CasillaFormula
                label="Cuenta"
                placeholder="'5720001'"
                valor={cuadre.cuenta}
                alCambiar={(cuenta) => alCambiar({ ...opciones, autocuadre: { ...cuadre, cuenta } })}
                errores={errores.get('opciones.autocuadre.cuenta')}
              />
              <CasillaFormula
                label="Concepto"
                placeholder="El del asiento"
                valor={cuadre.concepto}
                alCambiar={(concepto) => alCambiar({ ...opciones, autocuadre: { ...cuadre, concepto } })}
                errores={errores.get('opciones.autocuadre.concepto')}
              />
            </Group>
          )}
          {errores.get('opciones.autocuadre') && (
            <Text size="xs" c="red">
              {errores.get('opciones.autocuadre')?.join(' ')}
            </Text>
          )}
        </Stack>
      </Paper>

      <Paper withBorder p="sm">
        <Stack gap="xs">
          <Checkbox
            label="Añadir un asiento que deshaga el principal"
            description="Con el debe y el haber cambiados, en la fecha que se diga. Para periodificar: se apunta a fin de mes y se deshace el día 1."
            checked={reversion !== null}
            onChange={(e) =>
              alCambiar({ ...opciones, reversion: e.currentTarget.checked ? { fecha: '', concepto: '' } : null })
            }
          />
          {reversion && (
            <Group grow align="flex-start">
              <CasillaFormula
                label="Fecha"
                placeholder="sumar_dias(fin_de_mes(asiento_fecha), 1)"
                valor={reversion.fecha}
                alCambiar={(fecha) => alCambiar({ ...opciones, reversion: { ...reversion, fecha } })}
                errores={errores.get('opciones.reversion.fecha')}
                extra={['asiento_fecha', 'asiento_concepto']}
              />
              <CasillaFormula
                label="Concepto"
                placeholder="'Reversión: ' + asiento_concepto"
                valor={reversion.concepto}
                alCambiar={(concepto) => alCambiar({ ...opciones, reversion: { ...reversion, concepto } })}
                errores={errores.get('opciones.reversion.concepto')}
                extra={['asiento_fecha', 'asiento_concepto']}
              />
            </Group>
          )}
          {errores.get('opciones.reversion') && (
            <Text size="xs" c="red">
              {errores.get('opciones.reversion')?.join(' ')}
            </Text>
          )}
        </Stack>
      </Paper>
    </Stack>
  )
}
