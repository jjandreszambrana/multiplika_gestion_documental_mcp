import { Alert, Button, Group, Modal, Stack, TextInput } from '@mantine/core'
import { useState } from 'react'
import { textoDeError } from '../../api/errores'
import { duplicarPlantilla, type ResumenPlantilla } from '../../api/plantillas'

interface Props {
  plantilla: ResumenPlantilla
  alCerrar: (hecho: boolean) => void
}

/** Una copia con otro código, que empieza en su versión 1. */
export default function DialogoDuplicar({ plantilla, alCerrar }: Props) {
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState(`${plantilla.nombre} (copia)`)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  function duplicar() {
    setOcupado(true)
    setError(null)
    duplicarPlantilla(plantilla.id, codigo, nombre)
      .then(() => alCerrar(true))
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
      .finally(() => setOcupado(false))
  }

  return (
    <Modal opened onClose={() => alCerrar(false)} title={`Duplicar ${plantilla.codigo}`}>
      <Stack gap="sm">
        <TextInput
          label="Código de la copia"
          value={codigo}
          onChange={(e) => setCodigo(e.currentTarget.value.toUpperCase())}
          maxLength={30}
          required
          data-autofocus
        />
        <TextInput
          label="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.currentTarget.value)}
          maxLength={150}
        />
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={() => alCerrar(false)}>
            Cancelar
          </Button>
          <Button onClick={duplicar} loading={ocupado} disabled={codigo.trim() === ''}>
            Duplicar
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
