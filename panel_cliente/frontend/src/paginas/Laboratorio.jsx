import { lazy, Suspense, useEffect, useState } from "react"
import { Alert, Button, Center, Group, Loader, Stack, Text, Title } from "@mantine/core"
import { api, sesionPanel } from "../api"
import SelectorEmpresa, { fondoEmpresa } from "../componentes/SelectorEmpresa"

// Carga diferida: las pantallas solo se descargan al abrir este apartado.
const EmbebidoLaboratorio = lazy(() => import("@contabilidad/EmbebidoLaboratorio.tsx"))

// Laboratorio: muestras, informes, facturación y portal de clientes, sobre el
// SIF de la empresa que se elija (con los accesos al SIF de cada usuario).
// Es independiente de la contabilidad. No tiene interruptor: sale si el SIF lo da en alguna empresa.
export default function Laboratorio({ proyecto, onVerAccesos }) {
  const [empresas, setEmpresas] = useState(null)
  const [error, setError] = useState(null)
  const [idEmpresa, setIdEmpresa] = useState(null)

  useEffect(() => {
    api
      .empresasContables(proyecto.id)
      .then((r) => {
        // Solo las empresas donde el SIF da el laboratorio
        const conLaboratorio = r.empresas.filter((e) => proyecto.empresas_laboratorio?.includes(e.id_empresa))
        setEmpresas(conLaboratorio)
        setIdEmpresa(conLaboratorio[0] ? String(conLaboratorio[0].id_empresa) : null)
      })
      .catch((err) => {
        setEmpresas([])
        setError(err.message)
      })
  }, [proyecto.id])

  const empresa = empresas?.find((e) => String(e.id_empresa) === idEmpresa)

  if (empresas === null) return <Loader size="sm" />
  if (!empresa) {
    return (
      <Alert color="blue">
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Text fz="sm">{error || "Ninguno de tus accesos al SIF funciona ahora mismo."}</Text>
          <Button size="xs" onClick={onVerAccesos}>Revisar mis accesos</Button>
        </Group>
      </Alert>
    )
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="nowrap" p={4} style={{ borderRadius: "var(--mantine-radius-sm)", background: fondoEmpresa(empresa.id_empresa) }}>
        <Title order={4}>Laboratorio</Title>
        {empresas.length > 1 && <SelectorEmpresa empresas={empresas} value={idEmpresa} onChange={setIdEmpresa} />}
      </Group>
      <Suspense fallback={<Center py="xl"><Loader /></Center>}>
        <EmbebidoLaboratorio key={empresa.id_empresa} sesion={sesionPanel} idProyecto={proyecto.id} idEmpresa={empresa.id_empresa} />
      </Suspense>
    </Stack>
  )
}
