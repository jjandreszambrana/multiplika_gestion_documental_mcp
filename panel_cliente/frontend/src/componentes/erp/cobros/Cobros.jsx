import { useCallback, useState } from "react"
import { Group, SegmentedControl, Stack, Title } from "@mantine/core"
import { api } from "../../../api"
import Cartera from "./Cartera"
import CobrosHechos from "./CobrosHechos"
import Remesas from "./Remesas"

// Cobros de la empresa en el SIF: lo que queda por cobrar (los recibos de
// las facturas de venta), los cobros ya anotados (deshacer, devolución) y
// las remesas SEPA. Todo con el acceso al SIF de cada usuario.

export default function Cobros({ proyecto, empresa }) {
  const pedir = useCallback(
    (ruta, cuerpo) => api.erpSif(proyecto.id, empresa.id_empresa, ruta, cuerpo),
    [proyecto.id, empresa.id_empresa],
  )
  const [vista, setVista] = useState("cartera")
  return (
    <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
      <Group justify="space-between">
        <Title order={3}>Cobros</Title>
        <SegmentedControl
          value={vista} onChange={setVista}
          data={[{ value: "cartera", label: "Por cobrar" }, { value: "hechos", label: "Cobros anotados" }, { value: "remesas", label: "Remesas" }]}
        />
      </Group>
      {vista === "cartera" && <Cartera pedir={pedir} />}
      {vista === "hechos" && <CobrosHechos pedir={pedir} />}
      {vista === "remesas" && <Remesas proyecto={proyecto} empresa={empresa} pedir={pedir} />}
    </Stack>
  )
}
