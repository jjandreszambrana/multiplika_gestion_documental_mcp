import { NavLink } from '@mantine/core'
import {
  IconArrowsExchange,
  IconBook,
  IconBooks,
  IconBuilding,
  IconBuildingBank,
  IconCalculator,
  IconCalendar,
  IconChecklist,
  IconChartBar,
  IconCircleDashed,
  IconCoin,
  IconFileDownload,
  IconFileInvoice,
  IconFileOff,
  IconFileText,
  IconInbox,
  IconKey,
  IconLink,
  IconListDetails,
  IconLock,
  IconPencil,
  IconPlug,
  IconReceipt,
  IconReportMoney,
  IconSettings,
  IconSitemap,
  IconStack2,
  IconTemplate,
  IconTrash,
  IconUsers,
  type Icon,
} from '@tabler/icons-react'
import { alcanza } from '../api/sesion'
import type { Seccion } from './secciones'

const ICONO_GRUPO: Record<string, Icon> = {
  'Plan contable': IconSitemap,
  Diario: IconBook,
  Traspasos: IconArrowsExchange,
  Informes: IconChartBar,
  Fiscal: IconReceipt,
  Inmovilizado: IconBuilding,
  Utilidades: IconSettings,
}

const ICONO_SECCION: Record<string, Icon> = {
  plan: IconListDetails,
  enlace: IconLink,
  asientos: IconPencil,
  eliminados: IconTrash,
  plantillas: IconTemplate,
  diario_b: IconStack2,
  traspaso_emitidas: IconFileInvoice,
  traspaso_recibidas: IconFileDownload,
  bandeja: IconInbox,
  mayor: IconBooks,
  balance: IconCalculator,
  estados_contables: IconReportMoney,
  fiscal: IconCoin,
  declaraciones: IconFileText,
  inmovilizado: IconBuildingBank,
  sin_ficha: IconFileOff,
  cierre: IconLock,
  importador: IconFileDownload,
  ejercicios: IconCalendar,
  configuracion: IconSettings,
  conexiones: IconPlug,
  usuarios_sif: IconUsers,
  accesos: IconKey,
  propuestas: IconChecklist,
  conciliacion: IconBuildingBank,
}

function icono(Componente: Icon | undefined) {
  const Elegido = Componente ?? IconCircleDashed
  return <Elegido size={17} stroke={1.75} />
}

interface Props {
  secciones: readonly Seccion[]
  nivel: string
  /** Rol del SIF; nulo si no se sabe. */
  rol: number | null
  activa: string
  /** Secciones que este SIF no tiene. */
  ocultas: ReadonlySet<string>
  alElegir: (id: string) => void
}

/**
 * Las secciones con `grupo` cuelgan de un apartado que se despliega, plegado de
 * entrada; el apartado aparece donde va la primera de las suyas, para no
 * reordenar el menú.
 */
export default function MenuModulo({ secciones, nivel, rol, activa, ocultas, alElegir }: Props) {
  const visibles = secciones.filter(
    (s) =>
      !ocultas.has(s.id) &&
      alcanza(nivel, s.nivelMinimo) &&
      (!s.soloRoles || (rol !== null && s.soloRoles.includes(rol))),
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
            leftSection={icono(ICONO_GRUPO[seccion.grupo])}
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
      leftSection={icono(ICONO_SECCION[seccion.id])}
      active={seccion.id === activa}
      onClick={() => alElegir(seccion.id)}
    />
  )
}
