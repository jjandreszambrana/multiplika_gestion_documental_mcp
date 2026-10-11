import { Alert, Button, Group, Loader, Modal, Stack, Text } from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
import { textoDeError } from '../../../api/errores'
import { comprobarDefinicion, type Definicion, type ErrorCampo, type Fuente } from '../../../api/plantillas'
import FormularioPlantilla from '../FormularioPlantilla'
import { usePrevisualizacion } from '../usePrevisualizacion'

interface Props {
  /** La que hay en el editor, sin guardar. */
  definicion: Definicion
  ancho: number
  alCerrar: () => void
  /** La plantilla tiene errores: se vuelve al editor con ellos marcados. */
  alDefinicionRota: (errores: ErrorCampo[]) => void
}

/**
 * La plantilla del editor, sin guardar, con datos de prueba: lo mismo que verá
 * el contable al usarla. No graba nada.
 */
export default function DialogoProbar({ definicion, ancho, alCerrar, alDefinicionRota }: Props) {
  const [lista, setLista] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Antes de pedir datos, que la plantilla esté bien: si no, lo que hay que
  // arreglar está en el editor, no aquí.
  useEffect(() => {
    comprobarDefinicion(definicion)
      .then((r) => (r.valida ? setLista(true) : alDefinicionRota(r.errores ?? [])))
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fuente = useMemo<Fuente | null>(() => (lista ? { definicion } : null), [lista, definicion])
  const estado = usePrevisualizacion(fuente, definicion.parametros, lista ? 'prueba' : '')

  return (
    <Modal opened onClose={alCerrar} title="Probar con datos de ejemplo" size="90%">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Así la verá quien la use. No se graba nada.
        </Text>
        {error && <Alert color="red">{error}</Alert>}
        {!lista && !error && <Loader size="sm" />}
        {lista && (
          <FormularioPlantilla parametros={definicion.parametros} estado={estado} ancho={ancho} />
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>
            Cerrar
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
