import { lazy, Suspense } from 'react'
import { Center, Loader } from '@mantine/core'
import { sesionPanel } from '../api.js'

// Carga diferida: las pantallas de contabilidad solo se descargan al abrir
// este apartado; quien no lo usa no nota que el panel pese más.
const Embebido = lazy(() => import('@contabilidad/Embebido.tsx'))

/**
 * Contabilidad del SIF dentro del panel.
 * `empresa` = { id_obligado, nombre, nif, nivel } (el nivel es opcional: si
 * falta, lo pregunta la propia contabilidad).
 */
export default function ContabilidadSIF({ proyecto, empresa }) {
  return (
    <Suspense fallback={<Center py="xl"><Loader /></Center>}>
      <Embebido
        sesion={sesionPanel}
        idProyecto={proyecto.id}
        idObligado={empresa.id_obligado}
        nombreEmpresa={empresa.nombre}
        nif={empresa.nif}
        nivel={empresa.nivel || undefined}
      />
    </Suspense>
  )
}
