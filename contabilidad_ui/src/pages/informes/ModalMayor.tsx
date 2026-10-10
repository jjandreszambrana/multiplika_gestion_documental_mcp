import { Modal } from '@mantine/core'
import { usePlanEnMemoria } from '../../components/PlanEnMemoria'
import VistaMayor from './VistaMayor'

interface Props {
  /** Vacía con el modal cerrado. */
  cuenta: string
  /**
   * Por debajo de qué se tiene que quedar. En el diario va por debajo del
   * editor de asientos, que se abre desde él: cerrarlo y reabrirlo para dejar
   * paso hacía la animación entera y la pantalla daba un salto.
   */
  zIndex?: number
  ejercicio: number | null
  alCerrar: () => void
  /**
   * Abre el borrador del que viene un apunte. **No se pasa desde el editor de
   * asientos**: allí ya se está tecleando uno, y el mayor puede estar enseñando
   * ese mismo, que todavía no existe como asiento cerrado.
   */
  alEditarBorrador?: (idBorrador: number) => void
  /** Cambia para volver a pedir el mayor tras corregir uno de sus borradores. */
  refresco?: number
}

/**
 * El mayor de una cuenta sin salir del asiento que se está tecleando: es lo que
 * se mira para saber si esa cuenta lleva lo que uno cree antes de apuntar.
 */
export default function ModalMayor({
  cuenta,
  zIndex,
  ejercicio,
  alCerrar,
  alEditarBorrador,
  refresco,
}: Props) {
  const plan = usePlanEnMemoria()
  const titulo = plan.porCodigo.get(cuenta)?.descripcion ?? ''

  return (
    <Modal
      opened={cuenta !== '' && ejercicio !== null}
      zIndex={zIndex}
      onClose={alCerrar}
      title={titulo === '' ? `Mayor de ${cuenta}` : `Mayor de ${cuenta} · ${titulo}`}
      size="90%"
      centered
    >
      {cuenta !== '' && ejercicio !== null && (
        <VistaMayor
          key={cuenta}
          ejercicio={ejercicio}
          cuenta={cuenta}
          alEditarBorrador={alEditarBorrador}
          refresco={refresco}
        />
      )}
    </Modal>
  )
}
