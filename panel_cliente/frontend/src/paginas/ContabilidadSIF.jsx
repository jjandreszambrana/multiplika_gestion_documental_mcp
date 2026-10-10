import { lazy, Suspense } from 'react'
import { Center, Loader } from '@mantine/core'
import { sesionPanel } from '../api.js'

// Carga diferida: las pantallas de contabilidad solo se descargan al abrir
// este apartado; quien no lo usa no nota que el panel pese más.
const Embebido = lazy(() => import('@contabilidad/Embebido.tsx'))

/**
 * Contabilidad del SIF dentro del panel.
 * `empresa` = { id_empresa, id_obligado_sif, nombre, nif, nivel }: `id_empresa`
 * es el de la GD (va en la dirección del proxy, que elige el acceso al SIF);
 * `id_obligado_sif`, el de la empresa en su SIF.
 */
export default function ContabilidadSIF({ proyecto, empresa }) {
  return (
    <Suspense fallback={<Center py="xl"><Loader /></Center>}>
      <Embebido
        sesion={sesionPanel}
        idProyecto={proyecto.id}
        idEmpresa={empresa.id_empresa}
        idObligado={empresa.id_obligado_sif}
        nombreEmpresa={empresa.nombre}
        nif={empresa.nif}
        nivel={empresa.nivel || undefined}
      />
    </Suspense>
  )
}
