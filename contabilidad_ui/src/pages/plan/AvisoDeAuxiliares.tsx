import { Alert, List, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { revisarAuxiliares, type RevisionDeAuxiliares } from '../../api/plan'

/**
 * Solo se ve si hay algo que revisar: cuentas marcadas para recibir apuntes sin
 * el ancho de la empresa, o apuntes hechos contra ellas.
 *
 * Con el plan limpio no se enseña nada, que es lo normal desde que el backend
 * cerró por dónde entraban. Si la comprobación falla tampoco: es un aviso, no
 * puede estorbar la pantalla del plan.
 */
export default function AvisoDeAuxiliares() {
  const [revision, setRevision] = useState<RevisionDeAuxiliares | null>(null)

  useEffect(() => {
    revisarAuxiliares()
      .then(setRevision)
      .catch(() => setRevision(null))
  }, [])

  if (revision === null || !revision.hay_algo_que_revisar) return null

  const cuentas = revision.cuentas ?? []
  const apuntes = revision.apuntes_fuera_de_ancho ?? []

  return (
    <Alert color="yellow" title="Cuentas que no deberían recibir apuntes" role="status">
      <Text size="sm">
        {`Estas cuentas están marcadas para recibir apuntes y no tienen los ${revision.anchocuentas} dígitos de una subcuenta. Una cuenta de mayor agrupa, no recibe movimientos.`}
      </Text>
      <List size="sm" mt="xs">
        {cuentas.map((cuenta) => (
          <List.Item key={cuenta.codigo}>
            {`${cuenta.codigo} · ${cuenta.descripcion}`}
            {cuenta.apuntes > 0 && ` — ${cuenta.apuntes} apuntes ya hechos`}
          </List.Item>
        ))}
      </List>
      {apuntes.length > 0 && (
        <Text size="sm" mt="xs">
          {`Hay además ${apuntes.length} apuntes hechos en cuentas que no son subcuentas.`}
        </Text>
      )}
    </Alert>
  )
}
