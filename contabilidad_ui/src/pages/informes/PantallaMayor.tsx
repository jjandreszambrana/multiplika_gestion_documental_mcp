import { Button, Group, Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import { alcanza } from '../../api/sesion'
import { guardarPreferencia, leerPreferencia } from '../../lib/preferencias'
import CasillaCuenta from '../diario/CasillaCuenta'
import EditorAsiento from '../diario/EditorAsiento'
import VistaMayor from './VistaMayor'

interface Props {
  ejercicio: number | null
  /** Dígitos de una subcuenta en esta empresa, para el comodín del punto. */
  ancho: number
  nivel: string
  /** Para recordarle a cada uno la cuenta y el periodo que estaba mirando. */
  usuario: string
}

const PREFERENCIA = 'mayor.cuenta'

/**
 * El mayor de una cuenta: sus movimientos en orden, con el saldo corriente.
 *
 * Aquí solo se elige la cuenta; lo demás lo pone `VistaMayor`, que es la misma
 * que se abre desde una línea del asiento.
 */
export default function PantallaMayor({ ejercicio, ancho, nivel, usuario }: Props) {
  // Se entra con la última cuenta que se miró, ya consultada: lo normal es
  // volver a la misma, y así no hay que teclearla ni pulsar Ver otra vez.
  const ultima = leerPreferencia<string>(usuario, PREFERENCIA) ?? ''
  const [cuenta, setCuenta] = useState(ultima)
  /** La que se está viendo, que no cambia mientras se teclea otra. */
  const [viendo, setViendo] = useState(ultima)
  /** El borrador que se está corrigiendo desde el propio mayor. */
  const [corrigiendo, setCorrigiendo] = useState<number | null>(null)
  const [refresco, setRefresco] = useState(0)

  return (
    <Stack gap="md">
      {/* La ayuda va dentro de `VistaMayor`, con los filtros, para que salga
          también cuando el mayor se abre en un modal. */}
      <Title order={3}>Mayor</Title>

      <Group align="flex-end" gap="md">
        <CasillaCuenta label="Cuenta" size="sm" valor={cuenta} ancho={ancho} alCambiar={setCuenta} />
        <Button
          onClick={() => {
            const cual = cuenta.trim()
            setViendo(cual)
            guardarPreferencia(usuario, PREFERENCIA, cual)
          }}
          disabled={cuenta.trim() === '' || ejercicio === null}
        >
          Ver
        </Button>
      </Group>

      {viendo === '' ? (
        <Text size="sm" c="dimmed">
          Elige una cuenta para ver su mayor.
        </Text>
      ) : (
        ejercicio !== null && (
          <VistaMayor
            key={viendo}
            ejercicio={ejercicio}
            cuenta={viendo}
            refresco={refresco}
            usuario={usuario}
            alEditarBorrador={alcanza(nivel, 'apuntes') ? setCorrigiendo : undefined}
          />
        )
      )}

      <EditorAsiento
        abierto={corrigiendo !== null}
        ejercicio={ejercicio}
        nivel={nivel}
        ancho={ancho}
        idBorrador={corrigiendo}
        alCerrar={(huboCambios) => {
          setCorrigiendo(null)
          // Solo si se llegó a escribir algo: cancelar sin tocar nada no tiene
          // por qué volver a bajar el mayor entero.
          if (huboCambios) setRefresco((n) => n + 1)
        }}
        alConfirmado={() => {
          setCorrigiendo(null)
          setRefresco((n) => n + 1)
        }}
      />
    </Stack>
  )
}
