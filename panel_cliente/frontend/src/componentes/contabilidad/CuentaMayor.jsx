import { lazy, Suspense, useState } from "react"
import { Anchor } from "@mantine/core"

// El mayor de la contabilidad se carga solo al pinchar en una cuenta: así no
// engorda el panel para quien no lo abre. Hay que estar dentro de la
// contabilidad (Embebido) porque necesita su plan de cuentas.
const ModalMayor = lazy(() => import("@contabilidad/pages/informes/ModalMayor.tsx"))

// Una cuenta que abre su mayor. `ejercicio` es el año del asiento o del movimiento.
export default function CuentaMayor({ cuenta, ejercicio, children }) {
  const [abierto, setAbierto] = useState(false)
  const anyo = Number(ejercicio) || new Date().getFullYear()
  return (
    <>
      <Anchor component="button" type="button" fz="inherit" title="Ver el mayor" onClick={() => setAbierto(true)}>
        {children ?? cuenta}
      </Anchor>
      {abierto && (
        <Suspense fallback={null}>
          <ModalMayor cuenta={cuenta} ejercicio={anyo} zIndex={400} alCerrar={() => setAbierto(false)} />
        </Suspense>
      )}
    </>
  )
}
