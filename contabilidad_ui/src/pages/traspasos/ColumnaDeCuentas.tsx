import { Autocomplete, Stack, Text } from '@mantine/core'
import { useMemo } from 'react'
import type { CuentaPlan } from '../../api/plan'
import type { CuentaDeFicha } from '../../api/maestros'
import { usePlanEnMemoria } from '../../components/PlanEnMemoria'
import { expandirCuenta } from '../../lib/cuenta'

/** Tope de sugerencias: más de esto no se lee, se teclea otra letra. */
const MAXIMO = 12

const SEPARADOR = ' · '

function etiqueta(cuenta: CuentaPlan): string {
  return `${cuenta.codigo}${SEPARADOR}${cuenta.descripcion ?? ''}`
}

/**
 * Las opciones se enseñan como «600000001 · Título», pero lo que se guarda es
 * el número. Se recorta aquí y no solo al elegir de la lista porque Mantine
 * avisa del cambio después, con la etiqueta entera, y esa era la que acababa
 * llegando al servidor.
 */
function soloCodigo(texto: string): string {
  const corte = texto.indexOf(SEPARADOR)
  return corte === -1 ? texto : texto.slice(0, corte)
}

interface Props {
  titulo: string
  /** Las casillas, con su título y lo que heredan. Las manda el servidor. */
  cuentas: CuentaDeFicha[]
  valores: Record<string, string>
  alCambiar: (valores: Record<string, string>) => void
  ancho: number
  /** Enfoca la primera casilla al abrir. Solo la mitad izquierda. */
  enfocar: boolean
}

/**
 * Una de las dos mitades del formulario: un juego de cuentas con su rótulo.
 *
 * Los títulos de las casillas vienen del servidor, no se escriben aquí: cada
 * maestro dice cómo se llaman las suyas.
 */
export default function ColumnaDeCuentas({
  titulo,
  cuentas,
  valores,
  alCambiar,
  ancho,
  enfocar,
}: Props) {
  return (
    <Stack gap="sm">
      <Text fw={500}>{titulo}</Text>

      {cuentas.map((cuenta, posicion) => (
        <Casilla
          key={cuenta.campo}
          cuenta={cuenta}
          valor={valores[cuenta.campo] ?? ''}
          alEscribir={(tecleado) => alCambiar({ ...valores, [cuenta.campo]: tecleado })}
          ancho={ancho}
          enfocar={enfocar && posicion === 0}
        />
      ))}
    </Stack>
  )
}

/**
 * Una casilla, con las coincidencias del plan que ya está en memoria: se busca
 * por número y por título sin esperar a ninguna llamada, igual que en la
 * entrada de asientos.
 */
function Casilla({
  cuenta,
  valor,
  alEscribir,
  ancho,
  enfocar,
}: {
  cuenta: CuentaDeFicha
  valor: string
  alEscribir: (valor: string) => void
  ancho: number
  enfocar: boolean
}) {
  const plan = usePlanEnMemoria()

  const opciones = useMemo(() => {
    const buscado = valor.trim().toLowerCase()
    if (buscado === '') return []

    const encontradas: string[] = []
    for (const cuentaDelPlan of plan.porCodigo.values()) {
      // Solo las que admiten apuntes: una cuenta de estructura no vale aquí.
      if (!cuentaDelPlan.auxiliar) continue
      const codigo = cuentaDelPlan.codigo.toLowerCase()
      const titulo = (cuentaDelPlan.descripcion ?? '').toLowerCase()
      if (codigo.startsWith(buscado) || titulo.includes(buscado)) {
        encontradas.push(etiqueta(cuentaDelPlan))
        if (encontradas.length >= MAXIMO) break
      }
    }
    return encontradas
  }, [valor, plan])

  // El título de la cuenta que está puesta, para no tener que fiarse del
  // número. Sale del plan que ya está en memoria.
  const titulo = plan.porCodigo.get(soloCodigo(valor).trim())?.descripcion ?? ''

  return (
    <div>
      <Autocomplete
        label={cuenta.titulo}
        description={
          cuenta.heredado === '' ? undefined : `Si se deja vacía, se aplica la ${cuenta.heredado}`
        }
        value={valor}
        data={opciones}
        onChange={(texto) => alEscribir(soloCodigo(texto))}
        onOptionSubmit={(elegido) => alEscribir(soloCodigo(elegido))}
        // El punto es comodín: al salir se rellena con ceros hasta el ancho de
        // cuenta de la empresa.
        onBlur={() => alEscribir(expandirCuenta(soloCodigo(valor), ancho))}
        comboboxProps={{ width: 320, position: 'bottom-start' }}
        styles={{ input: { fontFamily: 'monospace' } }}
        autoFocus={enfocar}
      />

      {titulo !== '' && (
        <Text fz="xs" c="dimmed" mt={4}>
          {titulo}
        </Text>
      )}
    </div>
  )
}
