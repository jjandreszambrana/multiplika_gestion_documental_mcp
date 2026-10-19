import { useEffect, useState } from "react"
import { Anchor, Title } from "@mantine/core"
import { IconArrowLeft } from "@tabler/icons-react"
import { api } from "../api"
import MisAccesosSif from "../componentes/contabilidad/MisAccesosSif"

// Asesor contable → Mis accesos al SIF. `onCambiar` avisa a la contabilidad
// (que sigue montada aunque oculta) para que vuelva a leer las empresas.
export default function AccesosSif({ proyecto, onVolver, onCambiar }) {
  const [accesos, setAccesos] = useState(null)
  const cargar = () => {
    api.accesosSif(proyecto.id).then((r) => setAccesos(r.accesos)).catch(() => setAccesos([]))
  }
  useEffect(cargar, [proyecto.id])

  return (
    <>
      <Anchor
        component="button" type="button" onClick={onVolver} mb="lg"
        display="flex" style={{ alignItems: "center", gap: 6 }}
        underline="hover" c="dimmed" fz="13.5px" fw={500}
      >
        <IconArrowLeft size={15} stroke={2} />
        Inicio
      </Anchor>
      <Title order={2} mb="xs">Mis accesos al SIF</Title>
      <MisAccesosSif proyecto={proyecto} accesos={accesos} onCambiar={() => { cargar(); onCambiar() }} />
    </>
  )
}
