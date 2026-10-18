import { Button, Checkbox, Group, Modal, Stack } from '@mantine/core'
import { useEffect, useState } from 'react'

/** Las opciones de sumas y saldos del diario B. Todas desmarcadas de fábrica. */
export interface OpcionesSumas {
  soloSinEquivalencia: boolean
  sinRegularizacion: boolean
  ocultarSinSaldo: boolean
}

export const OPCIONES_DE_FABRICA: OpcionesSumas = {
  soloSinEquivalencia: false,
  sinRegularizacion: false,
  ocultarSinSaldo: false,
}

/**
 * Lo guardado, campo a campo: lo que falte o no sea un sí/no se queda como de
 * fábrica. Así unas opciones guardadas por una versión anterior no rompen nada.
 */
export function normalizarOpciones(guardado: unknown): OpcionesSumas {
  const leido = (typeof guardado === 'object' && guardado !== null ? guardado : {}) as Record<
    string,
    unknown
  >
  const opciones = { ...OPCIONES_DE_FABRICA }
  for (const clave of Object.keys(OPCIONES_DE_FABRICA) as (keyof OpcionesSumas)[]) {
    if (typeof leido[clave] === 'boolean') opciones[clave] = leido[clave] as boolean
  }
  return opciones
}

const CASILLAS: [keyof OpcionesSumas, string][] = [
  ['soloSinEquivalencia', 'Solo cuentas sin equivalencia'],
  ['sinRegularizacion', 'Sin regularización ni cierre'],
  ['ocultarSinSaldo', 'No mostrar las cuentas sin saldo'],
]

interface Props {
  abierto: boolean
  opciones: OpcionesSumas
  alAplicar: (opciones: OpcionesSumas) => void
}

/**
 * Como el filtro del diario: se aplica al cerrar, de cualquiera de las maneras
 * (el botón, la equis o Escape), para que no haya forma de creer que se ha
 * cambiado una opción y no.
 */
export default function DialogoOpcionesSumas({ abierto, opciones, alAplicar }: Props) {
  const [borrador, setBorrador] = useState(opciones)

  // Al abrirlo enseña lo que está aplicado.
  useEffect(() => {
    if (abierto) setBorrador(opciones)
  }, [abierto, opciones])

  return (
    <Modal
      opened={abierto}
      onClose={() => alAplicar(borrador)}
      title="Opciones de sumas y saldos"
      size="md"
    >
      <Stack gap="sm">
        {CASILLAS.map(([clave, etiqueta]) => (
          <Checkbox
            key={clave}
            label={etiqueta}
            checked={borrador[clave]}
            onChange={(e) => {
              const marcada = e.currentTarget.checked
              setBorrador((antes) => ({ ...antes, [clave]: marcada }))
            }}
          />
        ))}
        <Group justify="flex-end" mt="sm">
          <Button onClick={() => alAplicar(borrador)}>Aplicar</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
