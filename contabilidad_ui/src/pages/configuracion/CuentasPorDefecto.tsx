import { Box, Paper, SimpleGrid, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import type { CampoDeCuenta } from '../../api/configuracion'
import { usePlanEnMemoria } from '../../components/PlanEnMemoria'
import DialogoCuentaAlVuelo from '../diario/DialogoCuentaAlVuelo'
import DialogoNuevaMayor from '../plan/DialogoNuevaMayor'
import CasillaDeCuenta from '../../components/CasillaDeCuenta'

interface Props {
  campos: CampoDeCuenta[]
  /** Lo tecleado, que empieza siendo lo que hay guardado. */
  valores: Record<string, string>
  /** Dígitos de una cuenta de apuntes en esta empresa. */
  ancho: number
  /** El que está elegido, para dar de alta la cuenta donde toca. */
  ejercicio: number | null
  alCambiar: (campo: string, valor: string) => void
}

/** La casilla desde la que se está dando de alta una cuenta que no existía. */
interface Alta {
  campo: string
  codigo: string
  esMayor: boolean
}

/**
 * Las cuentas por defecto de la contabilización automática, repartidas en dos
 * marcos: a la izquierda las cuentas de las que cuelgan otras y a la derecha
 * las que llevan los apuntes. Dentro de cada marco, una rejilla de rótulo y
 * casilla, para poder recorrer la columna de rótulos de un vistazo.
 *
 * Los rótulos, el orden y el reparto entre los dos marcos los manda la API;
 * aquí no se decide ninguno.
 */
export default function CuentasPorDefecto({
  campos,
  valores,
  ancho,
  ejercicio,
  alCambiar,
}: Props) {
  const plan = usePlanEnMemoria()
  const [alta, setAlta] = useState<Alta | null>(null)

  const mayores = campos.filter((campo) => campo.tipo === 'mayor')
  const subcuentas = campos.filter((campo) => campo.tipo !== 'mayor')

  /** La cuenta recién creada se queda puesta en la casilla desde la que se pidió. */
  function creada(codigo: string) {
    if (alta !== null) alCambiar(alta.campo, codigo)
    setAlta(null)
    plan.refrescar()
  }

  function fila(campo: CampoDeCuenta) {
    return (
      <Fila
        key={campo.campo}
        campo={campo}
        valores={valores}
        ancho={ancho}
        alCambiar={alCambiar}
        alCrear={(codigo) =>
          setAlta({ campo: campo.campo, codigo, esMayor: campo.tipo === 'mayor' })
        }
      />
    )
  }

  return (
    <>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Marco titulo="Cuentas de mayor">{mayores.map(fila)}</Marco>
        <Marco titulo="Subcuentas">{subcuentas.map(fila)}</Marco>
      </SimpleGrid>

      {/* Los dos altas del plan, ya escritas: la de estructura para el marco de
          la izquierda y la de subcuenta para el de la derecha. */}
      <DialogoNuevaMayor
        abierto={alta !== null && alta.esMayor}
        ejercicio={ejercicio}
        codigoInicial={alta?.codigo ?? ''}
        alCerrar={() => setAlta(null)}
        alCreada={(cuenta) => creada(cuenta.codigo)}
      />
      <DialogoCuentaAlVuelo
        codigo={alta !== null && !alta.esMayor ? alta.codigo : null}
        ejercicio={ejercicio}
        alCerrar={() => setAlta(null)}
        alCreada={(cuenta) => creada(cuenta.codigo)}
      />
    </>
  )
}

function Marco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Paper withBorder p="md">
      <Stack gap="sm">
        <Text fw={600} fz="sm">
          {titulo}
        </Text>
        {/* El rótulo se lleva el ancho que sobra: la casilla solo tiene que
            dar de sí para un código de cuenta, que son nueve dígitos. */}
        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 7rem',
            columnGap: 'var(--mantine-spacing-sm)',
            rowGap: 'var(--mantine-spacing-xs)',
            alignItems: 'center',
          }}
        >
          {children}
        </Box>
      </Stack>
    </Paper>
  )
}

function Fila({
  campo,
  valores,
  ancho,
  alCambiar,
  alCrear,
}: { campo: CampoDeCuenta; alCrear: (codigo: string) => void } & Omit<
  Props,
  'campos' | 'ejercicio'
>) {
  return (
    <>
      <Text component="label" htmlFor={campo.campo} fz="sm">
        {campo.titulo}
        {campo.obligatoria && <span aria-hidden> *</span>}
      </Text>
      <CasillaDeCuenta
        id={campo.campo}
        obligatoria={campo.obligatoria}
        valor={valores[campo.campo] ?? ''}
        ancho={ancho}
        alCambiar={(nuevo) => alCambiar(campo.campo, nuevo)}
        alCrear={alCrear}
      />
    </>
  )
}
