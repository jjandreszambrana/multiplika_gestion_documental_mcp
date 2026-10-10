import { Select } from '@mantine/core'
import { useEffect, useState } from 'react'
import { listarBienes, type Bien } from '../../api/inmovilizado'

interface Props {
  valor: Bien | null
  alElegir: (bien: Bien | null) => void
}

/**
 * De qué bien cuelga una mejora. Solo se ofrecen los bienes en uso y **no las
 * mejoras**: la cadena tiene dos niveles y la API no admite mejoras de mejoras.
 *
 * Si la lista no se puede traer, el desplegable se queda vacío y no se puede
 * elegir: es mejor eso que dejar mandar un bien padre inventado.
 */
export default function SelectorDeBien({ valor, alElegir }: Props) {
  const [bienes, setBienes] = useState<Bien[]>([])

  useEffect(() => {
    const corte = new AbortController()
    listarBienes(true, corte.signal)
      .then(({ bienes: filas }) => setBienes(filas.filter((b) => !b.es_mejora)))
      .catch(() => setBienes([]))
    return () => corte.abort()
  }, [])

  return (
    <Select
      label="De qué bien es mejora"
      data={bienes.map((bien) => ({ value: String(bien.id), label: bien.descripcion }))}
      value={valor === null ? null : String(valor.id)}
      onChange={(id) => alElegir(bienes.find((b) => String(b.id) === id) ?? null)}
      searchable
      required
    />
  )
}
