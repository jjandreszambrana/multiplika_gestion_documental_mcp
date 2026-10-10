import { Stack, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import type { CuentaDeFicha } from '../../api/maestros'

/** Lo que las dos listas comparten: sus cuentas y cuáles echan en falta. */
export interface ConCuentas {
  cuentas?: CuentaDeFicha[]
  cuentas_que_faltan?: string[]
}

export interface ColumnaDeCuenta {
  columna: string
  cabecera: string
}

/**
 * Las columnas de cuentas, en el orden en que las manda el servidor. Se miran
 * todas las facturas y no solo la primera: una venta con dos tipos de IVA trae
 * dos casillas, y la de al lado puede traer otra distinta.
 *
 * Varias casillas caen en la misma columna —`iva_21` e `iva_10` van las dos a
 * `iva`—, y ahí se pintan una debajo de otra dentro de la celda.
 */
export function columnasDeCuentas(facturas: ConCuentas[]): ColumnaDeCuenta[] {
  const columnas = new Map<string, string>()
  for (const factura of facturas) {
    for (const cuenta of factura.cuentas ?? []) {
      if (!columnas.has(cuenta.columna)) columnas.set(cuenta.columna, cuenta.titulo_corto)
    }
  }
  return [...columnas].map(([columna, cabecera]) => ({ columna, cabecera }))
}

/**
 * Lo que va en una celda: la cuenta que se va a usar de verdad, o el aviso de
 * que no hay ninguna. Cuál hace falta lo decide el servidor: una factura sin
 * retención no necesita esa cuenta, y entonces no la echa en falta.
 *
 * Con `alArreglar`, el aviso se puede pulsar y lleva a donde se pone esa
 * cuenta. Sin él, solo se lee.
 */
export function CeldaDeCuentas({
  factura,
  columna,
  alArreglar,
}: {
  factura: ConCuentas
  columna: string
  alArreglar?: (cuenta: CuentaDeFicha) => void
}) {
  const casillas = (factura.cuentas ?? []).filter((cuenta) => cuenta.columna === columna)
  if (casillas.length === 0) return null

  return (
    <Stack gap={2}>
      {casillas.map((casilla) => (
        <Casilla
          key={casilla.campo}
          casilla={casilla}
          falta={(factura.cuentas_que_faltan ?? []).includes(casilla.campo)}
          alArreglar={alArreglar}
        />
      ))}
    </Stack>
  )
}

function Casilla({
  casilla,
  falta,
  alArreglar,
}: {
  casilla: CuentaDeFicha
  falta: boolean
  alArreglar?: (cuenta: CuentaDeFicha) => void
}) {
  if (!falta) {
    return (
      <Text fz="sm" ff="monospace">
        {casilla.efectiva}
      </Text>
    )
  }

  // `de_donde` explica por qué no hay cuenta —«sin ficha de cliente», «la
  // serie B26 no está en el maestro»— y está escrito para enseñarlo tal cual.
  const aviso = casilla.de_donde === '' ? `Falta: ${casilla.titulo}` : casilla.de_donde
  const icono = <IconAlertTriangle size={18} color="var(--mantine-color-orange-6)" />

  return (
    <Tooltip label={aviso} withArrow>
      {alArreglar === undefined ? (
        <span>{icono}</span>
      ) : (
        <UnstyledButton aria-label={aviso} onClick={() => alArreglar(casilla)}>
          {icono}
        </UnstyledButton>
      )}
    </Tooltip>
  )
}
