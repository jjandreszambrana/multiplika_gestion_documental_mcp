import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { esAbortada } from '../../api/cliente'
import { apuntesSinFicha, type ApuntePideFicha } from '../../api/inmovilizado'
import DialogoBien from './DialogoBien'
import DialogoDescartar from './DialogoDescartar'

interface Props {
  /** Nulo mientras no se acabe de confirmar un asiento. */
  asiento: number | null
  ejercicio: number | null
  ancho: number
  /** Sin nivel `apuntes` no se pregunta: no habría nada que hacer. */
  activo: boolean
  alCerrar: () => void
}

/**
 * Avisa de que el asiento recién confirmado ha metido algo en una cuenta de
 * inmovilizado sin ficha de bien.
 *
 * **Sale después de confirmar, nunca mientras se teclea**: interrumpir a quien
 * está metiendo líneas con el teclado es la forma más rápida de que acabe
 * ignorando el aviso.
 *
 * Si no hay nada que avisar no se enseña nada, y si la consulta falla tampoco:
 * es un aviso de cortesía y no puede estorbar el trabajo del diario.
 */
export default function AvisoTrasConfirmar({
  asiento,
  ejercicio,
  ancho,
  activo,
  alCerrar,
}: Props) {
  const [apuntes, setApuntes] = useState<ApuntePideFicha[]>([])
  const [creando, setCreando] = useState<ApuntePideFicha | null>(null)
  const [descartando, setDescartando] = useState<ApuntePideFicha | null>(null)

  useEffect(() => {
    if (!activo || asiento === null) {
      setApuntes([])
      return
    }
    const corte = new AbortController()
    // El ejercicio solo si lo hay: con el selector en «todos» llega nulo, y
    // dejar de preguntar por eso era perder el aviso justo donde hace falta.
    apuntesSinFicha({ asiento, ...(ejercicio === null ? {} : { ejercicio }) }, corte.signal)
      .then(({ apuntes: filas }) => setApuntes(filas))
      .catch((fallo: unknown) => {
        setApuntes([])
        // No se enseña: es un aviso de cortesía y no puede estorbar el diario.
        // Pero tampoco se traga en silencio, o no hay forma de saber por qué
        // dejó de salir.
        if (!esAbortada(fallo)) console.error('No se pudo comprobar la ficha del bien:', fallo)
      })
    return () => corte.abort()
  }, [activo, asiento, ejercicio])

  const pendiente = apuntes[0] ?? null

  function siguiente() {
    setCreando(null)
    setDescartando(null)
    const resto = apuntes.slice(1)
    setApuntes(resto)
    if (resto.length === 0) alCerrar()
  }

  return (
    <>
      <Modal
        opened={pendiente !== null && creando === null && descartando === null}
        onClose={alCerrar}
        title="Falta la ficha del bien"
        centered
      >
        <Stack gap="md">
          <Alert color="yellow" role="status">
            Este asiento ha metido algo en una cuenta de inmovilizado y no tiene ficha de bien. Sin
            ficha no se amortiza nunca.
          </Alert>

          {pendiente !== null && (
            <Text size="sm">
              {`${pendiente.cuenta} · ${pendiente.concepto}`}
            </Text>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={alCerrar}>
              Ahora no
            </Button>
            <Button variant="default" onClick={() => setDescartando(pendiente)}>
              No es un bien
            </Button>
            <Button onClick={() => setCreando(pendiente)}>Crear la ficha…</Button>
          </Group>
        </Stack>
      </Modal>

      {creando !== null && (
        <DialogoBien
          key={creando.pase}
          abierto
          bien={null}
          mejoraDe={null}
          ancho={ancho}
          ejercicio={ejercicio}
          desdeApunte={creando}
          alCerrar={() => setCreando(null)}
          alGuardado={siguiente}
        />
      )}

      <DialogoDescartar
        apunte={descartando}
        alCerrar={() => setDescartando(null)}
        alHecho={siguiente}
      />
    </>
  )
}
