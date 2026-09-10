import { useEffect, useState } from "react"
import { Alert, Card, Stack, Text, Title } from "@mantine/core"
import { api } from "../api"

export default function ElegirProyecto({ idTenant, onElegir }) {
  const [proyectos, setProyectos] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .listarProyectosDeLaEmpresa(idTenant)
      .then((todos) => {
        const propios = todos.filter((p) => p.tipo_producto === "gestion_documental")
        if (propios.length === 1) {
          onElegir(propios[0])
        } else {
          setProyectos(propios)
        }
      })
      .catch((err) => setError(err.message))
  }, [idTenant])

  if (error) return <Alert color="red">{error}</Alert>
  if (!proyectos) return <Text>Cargando...</Text>

  if (proyectos.length === 0) {
    return <Text>Tu empresa no tiene ningún proyecto de gestión documental activo.</Text>
  }

  return (
    <>
      <Title order={2} mb="lg">
        Elige un proyecto
      </Title>
      <Stack gap="sm">
        {proyectos.map((p) => (
          <Card key={p.id} withBorder component="button" type="button" onClick={() => onElegir(p)} ta="left">
            {p.nombre}
          </Card>
        ))}
      </Stack>
    </>
  )
}
