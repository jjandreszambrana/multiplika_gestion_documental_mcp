import { Alert, Button, Group, Loader, Modal, Stack, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { textoDeError } from '../../api/errores'
import {
  eliminarCuenta,
  fijarEstado,
  fijarVisibilidad,
  obtenerCuenta,
  type CuentaPlan,
  type CuentaPlanDetalle,
} from '../../api/plan'

export type Accion = 'ocultar' | 'retirar' | 'borrar' | 'mostrar' | 'reactivar'

/** Recuperar una cuenta apartada: `/plan/obtener` da 404 mientras lo esté. */
const RECUPERAN: Accion[] = ['mostrar', 'reactivar']

const TEXTOS: Record<Accion, { titulo: string; aviso: string; boton: string; color: string }> = {
  ocultar: {
    titulo: 'Ocultar la cuenta',
    aviso:
      'Deja de figurar en el plan de esta empresa. No se elimina: es una cuenta del plan normativo que aquí no se utiliza.',
    boton: 'Ocultar',
    color: 'blue',
  },
  retirar: {
    titulo: 'Retirar la cuenta',
    aviso:
      'Deja de ofrecerse al introducir asientos, conservando sus apuntes y su mayor. Es lo que procede con una cuenta con histórico que ya no se utiliza.',
    boton: 'Retirar',
    color: 'orange',
  },
  borrar: {
    titulo: 'Borrar la cuenta',
    aviso:
      'Se elimina del plan. Solo procede para deshacer un alta errónea: se rechaza si tiene apuntes o subcuentas.',
    boton: 'Borrar',
    color: 'red',
  },
  mostrar: {
    titulo: 'Volver a mostrar la cuenta',
    aviso: 'Vuelve a figurar en el plan de esta empresa y se podrá usar.',
    boton: 'Volver a mostrar',
    color: 'blue',
  },
  reactivar: {
    titulo: 'Reactivar la cuenta',
    aviso: 'Vuelve a ofrecerse al introducir asientos. Sus apuntes y su mayor están intactos.',
    boton: 'Reactivar',
    color: 'blue',
  },
}

interface Props {
  cuenta: CuentaPlan | null
  accion: Accion
  ejercicio: number | null
  alCerrar: () => void
  alHecha: () => void
}

/** Confirmación de apartar una cuenta y de recuperarla. Todas son nivel `cierre`. */
export default function DialogoAccionCuenta({
  cuenta,
  accion,
  ejercicio,
  alCerrar,
  alHecha,
}: Props) {
  const [detalle, setDetalle] = useState<CuentaPlanDetalle | null>(null)
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  // Apuntes e hijas son lo que explica por qué la API va a decir que no. Se
  // enseñan antes de pulsar; quien decide si se puede sigue siendo la API.
  const recupera = RECUPERAN.includes(accion)

  useEffect(() => {
    if (cuenta === null || recupera) return
    let vigente = true
    setDetalle(null)
    setErrorDetalle(null)
    setError(null)
    obtenerCuenta(cuenta.codigo, ejercicio)
      .then((leido) => vigente && setDetalle(leido))
      .catch((fallo: unknown) => vigente && setErrorDetalle(textoDeError(fallo)))
    return () => {
      vigente = false
    }
  }, [cuenta, ejercicio, recupera])

  async function confirmar() {
    if (cuenta === null) return
    setError(null)
    setTrabajando(true)
    try {
      if (accion === 'ocultar') await fijarVisibilidad(cuenta.codigo, true, ejercicio)
      else if (accion === 'mostrar') await fijarVisibilidad(cuenta.codigo, false, ejercicio)
      else if (accion === 'retirar') await fijarEstado(cuenta.codigo, false, ejercicio)
      else if (accion === 'reactivar') await fijarEstado(cuenta.codigo, true, ejercicio)
      else await eliminarCuenta(cuenta.codigo, ejercicio)
      alHecha()
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setTrabajando(false)
    }
  }

  const texto = TEXTOS[accion]

  return (
    <Modal opened={cuenta !== null} onClose={alCerrar} title={texto.titulo} centered>
      {cuenta !== null && (
        <Stack gap="md">
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}

          <Text>
            <Text span ff="monospace">
              {cuenta.codigo}
            </Text>{' '}
            {cuenta.descripcion}
          </Text>

          <Text size="sm">{texto.aviso}</Text>

          {recupera ? null : errorDetalle ? (
            <Alert color="yellow">No se pudo leer el detalle de la cuenta: {errorDetalle}</Alert>
          ) : detalle === null ? (
            <Group gap="xs">
              <Loader size="xs" />
              <Text size="sm" c="dimmed">
                Consultando la cuenta…
              </Text>
            </Group>
          ) : (
            <Text size="sm" c="dimmed">
              Tiene {detalle.apuntes} apuntes y {detalle.hijas} subcuentas dependientes.
            </Text>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={alCerrar}>
              Cancelar
            </Button>
            <Button color={texto.color} loading={trabajando} onClick={confirmar}>
              {texto.boton}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
