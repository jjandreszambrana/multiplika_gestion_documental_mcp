import { Alert, Grid, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { useMemo, type ReactNode } from 'react'
import type { Parametro } from '../../api/plantillas'
import CampoDato from './CampoDato'
import { repartirErrores } from './errores'
import TablaDato from './TablaDato'
import type { EstadoPrevisualizacion } from './usePrevisualizacion'
import { textoDeResuelto, type FilaTabla, type ValorSimple } from './valores'
import VistaPrevia from './VistaPrevia'

interface Props {
  parametros: Parametro[]
  estado: EstadoPrevisualizacion
  /** Dígitos de una subcuenta en esta empresa. */
  ancho: number
  /** Para dar de alta subcuentas al vuelo y mirar su mayor. */
  ejercicio: number | null
  /** Lo que va encima de los datos: el selector de plantilla, por ejemplo. */
  cabecera?: ReactNode
}

function nombreDelTercero(valor: unknown): string | undefined {
  if (typeof valor !== 'object' || valor === null) return undefined
  const razon = (valor as Record<string, unknown>).razon
  return typeof razon === 'string' && razon !== '' ? razon : undefined
}

/**
 * Los datos de una plantilla a la izquierda y, a la derecha, el asiento que
 * sale, calculado por el servidor. Lo usan la pantalla de hacer un asiento y
 * la prueba del editor: es la misma cosa.
 */
export default function FormularioPlantilla({ parametros, estado, ancho, ejercicio, cabecera }: Props) {
  const { valores, tocados, previa, errorPrevia, pendiente, cambiar } = estado
  const asientos = useMemo(() => previa?.asientos ?? [], [previa])
  const resueltos = useMemo(
    () => new Map((previa?.parametros ?? []).map((r) => [r.clave, r])),
    [previa],
  )
  const errores = useMemo(
    () => repartirErrores(previa?.errores ?? [], asientos),
    [previa, asientos],
  )

  return (
    <Grid gutter="xl">
      <Grid.Col span={{ base: 12, md: 5 }}>
        <Stack gap="sm">
          {cabecera}
          {errores.generales.length > 0 && (
            <Alert color="red" p="xs">
              <Stack gap={2}>
                {errores.generales.map((e, i) => (
                  <Text key={i} size="sm">
                    {e}
                  </Text>
                ))}
              </Stack>
            </Alert>
          )}

          {parametros.map((p) => {
            const resuelto = resueltos.get(p.clave)
            // Qué se ve lo decide el servidor.
            if (resuelto?.visible === false) return null
            if (p.tipo === 'tabla') {
              const filas = valores[p.clave]
              return (
                <TablaDato
                  key={p.clave}
                  parametro={p}
                  filas={Array.isArray(filas) ? filas : []}
                  resueltas={resuelto?.valor}
                  errores={errores.porDato.get(p.clave)}
                  erroresDeCelda={errores.porCelda}
                  ancho={ancho}
                  ejercicio={ejercicio}
                  alCambiar={(nuevas: FilaTabla[]) => cambiar(p.clave, nuevas)}
                />
              )
            }
            // Lo no tocado enseña lo que ha puesto el servidor.
            const propio = valores[p.clave]
            const valor: ValorSimple =
              tocados.has(p.clave) && !Array.isArray(propio) && propio !== undefined
                ? propio
                : textoDeResuelto(p, resuelto?.valor)
            return (
              <CampoDato
                key={p.clave}
                parametro={p}
                valor={valor}
                errores={errores.porDato.get(p.clave)}
                ancho={ancho}
                ejercicio={ejercicio}
                alCambiar={(v) => cambiar(p.clave, v)}
                nota={p.tipo === 'tercero' ? nombreDelTercero(resuelto?.valor) : undefined}
              />
            )
          })}
        </Stack>
      </Grid.Col>

      <Grid.Col span={{ base: 12, md: 7 }}>
        <Stack gap="sm">
          <Group gap="xs">
            <Title order={5}>Así quedará el asiento</Title>
            {pendiente && <Loader size="xs" />}
          </Group>
          {errorPrevia && (
            <Alert color="red" style={{ whiteSpace: 'pre-line' }}>
              {errorPrevia}
            </Alert>
          )}
          {!errorPrevia && (
            <VistaPrevia
              asientos={asientos}
              porLinea={errores.porLinea}
              porAsiento={errores.porAsiento}
            />
          )}
        </Stack>
      </Grid.Col>
    </Grid>
  )
}
