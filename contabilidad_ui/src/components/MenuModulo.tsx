import { NavLink } from '@mantine/core'
import { alcanza } from '../api/sesion'
import { SECCIONES, type Seccion } from './secciones'

interface Props {
  nivel: string
  /** Rol del SIF; nulo si no se sabe. */
  rol: number | null
  activa: string
  alElegir: (id: string) => void
}

/**
 * Las secciones con `grupo` cuelgan de un apartado que se despliega, plegado de
 * entrada; el apartado aparece donde va la primera de las suyas, para no
 * reordenar el menú.
 */
export default function MenuModulo({ nivel, rol, activa, alElegir }: Props) {
  const visibles = SECCIONES.filter(
    (s) => alcanza(nivel, s.nivelMinimo) && (!s.soloRoles || (rol !== null && s.soloRoles.includes(rol))),
  )
  const yaPuestos = new Set<string>()

  return (
    <>
      {visibles.map((seccion) => {
        if (seccion.grupo === undefined) {
          return <Enlace key={seccion.id} seccion={seccion} activa={activa} alElegir={alElegir} />
        }
        if (yaPuestos.has(seccion.grupo)) return null
        yaPuestos.add(seccion.grupo)

        const dentro = visibles.filter((s) => s.grupo === seccion.grupo)
        return (
          <NavLink
            key={seccion.grupo}
            label={seccion.grupo}
            // Abierto si dentro está lo que se está viendo: si no, se entra al
            // módulo y el menú no dice dónde estás.
            defaultOpened={dentro.some((s) => s.id === activa)}
          >
            {dentro.map((s) => (
              <Enlace key={s.id} seccion={s} activa={activa} alElegir={alElegir} />
            ))}
          </NavLink>
        )
      })}
    </>
  )
}

function Enlace({
  seccion,
  activa,
  alElegir,
}: {
  seccion: Seccion
  activa: string
  alElegir: (id: string) => void
}) {
  return (
    <NavLink
      label={seccion.etiqueta}
      active={seccion.id === activa}
      onClick={() => alElegir(seccion.id)}
    />
  )
}
