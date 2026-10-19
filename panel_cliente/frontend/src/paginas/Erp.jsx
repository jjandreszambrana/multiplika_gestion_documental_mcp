import { useEffect, useState } from "react"
import { Alert, Box, Button, Group, Loader, Select, Tabs, Text, Title } from "@mantine/core"
import { api } from "../api"
import { ConexionErpContenido } from "../componentes/ConexionErp"
import MaestroSif from "../componentes/erp/MaestroSif"
import { MAESTROS } from "../componentes/erp/maestros"

// ERP → Gestión SIF: los maestros de facturación del SIF, como la
// contabilidad: con los accesos al SIF de cada usuario y en la empresa que
// elija. La última pestaña es la conexión que alimenta el CRM.
export default function Erp({ proyecto, onVerAccesos }) {
  const [empresas, setEmpresas] = useState(null)
  const [error, setError] = useState(null)
  const [idEmpresa, setIdEmpresa] = useState(null)
  const [pestana, setPestana] = useState(MAESTROS[0].id)

  useEffect(() => {
    api
      .empresasContables(proyecto.id)
      .then((r) => {
        setEmpresas(r.empresas)
        setIdEmpresa(r.empresas[0] ? String(r.empresas[0].id_empresa) : null)
      })
      .catch((err) => {
        setEmpresas([])
        setError(err.message)
      })
  }, [proyecto.id])

  const empresa = empresas?.find((e) => String(e.id_empresa) === idEmpresa)
  const deEmpresa = pestana !== "conexion"

  return (
    <Tabs value={pestana} onChange={setPestana}>
      <Box style={STICKY} mb="md">
        <Group mb="lg" wrap="nowrap" gap="lg">
          <Title order={2}>Gestión SIF</Title>
          <Tabs.List style={{ flex: 1 }}>
            {MAESTROS.map((m) => <Tabs.Tab key={m.id} value={m.id}>{m.titulo}</Tabs.Tab>)}
            {proyecto.puede_editar && <Tabs.Tab value="conexion">Conexión con el CRM</Tabs.Tab>}
          </Tabs.List>
        </Group>
      </Box>

      {deEmpresa && (
        empresas === null ? <Loader size="sm" /> : !empresa ? (
          <Alert color="blue" mb="md">
            <Group justify="space-between" wrap="wrap" gap="xs">
              <Text fz="sm">{error || "Ninguno de tus accesos al SIF funciona ahora mismo."}</Text>
              <Button size="xs" onClick={onVerAccesos}>Revisar mis accesos</Button>
            </Group>
          </Alert>
        ) : empresas.length > 1 && (
          <Select
            aria-label="Empresa" w={480} maw="100%" mb="md" searchable allowDeselect={false} value={idEmpresa} onChange={setIdEmpresa}
            data={empresas.map((e) => ({ value: String(e.id_empresa), label: `${e.nombre}${e.nif ? ` (${e.nif})` : ""}` }))}
          />
        )
      )}

      {MAESTROS.map((m) => (
        <Tabs.Panel key={m.id} value={m.id}>
          {pestana === m.id && empresa && <MaestroSif key={`${m.id}-${empresa.id_empresa}`} proyecto={proyecto} empresa={empresa} maestro={m} />}
        </Tabs.Panel>
      ))}
      <Tabs.Panel value="conexion">
        {pestana === "conexion" && <ConexionErpContenido proyecto={proyecto} />}
      </Tabs.Panel>
    </Tabs>
  )
}

const STICKY = { position: "sticky", top: 0, zIndex: 20, background: "var(--mantine-color-body)" }
