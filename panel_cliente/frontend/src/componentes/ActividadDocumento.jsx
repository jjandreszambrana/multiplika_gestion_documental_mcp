import { useEffect, useState } from "react"
import { Alert, Text } from "@mantine/core"
import { api } from "../api"
import TablaActividad from "./TablaActividad"

// Pestaña "Actividad" de la ficha de un documento: lo mismo que la
// pantalla general, filtrado a este documento (últimos 200 apuntes).
export default function ActividadDocumento({ proyecto, idDocumento, refresco }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .listarActividad(proyecto.id, { tipo_objeto: "documento", id_objeto: idDocumento, por_pagina: 200 })
      .then(setDatos)
      .catch((err) => setError(err.message))
  }, [proyecto.id, idDocumento, refresco])

  if (error) return <Alert color="red">{error}</Alert>
  if (!datos) return <Text>Cargando...</Text>
  if (datos.filas.length === 0) return <Text c="dimmed">Todavía no hay actividad apuntada sobre este documento.</Text>
  return <TablaActividad filas={datos.filas} />
}
