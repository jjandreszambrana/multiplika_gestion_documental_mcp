import { useEffect, useState } from "react"
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

  if (error) return <p className="error">{error}</p>
  if (!proyectos) return <p>Cargando...</p>

  if (proyectos.length === 0) {
    return <p>Tu empresa no tiene ningún proyecto de gestión documental activo.</p>
  }

  return (
    <section>
      <h2>Elige un proyecto</h2>
      {proyectos.map((p) => (
        <button key={p.id} className="tarjeta-eleccion" onClick={() => onElegir(p)}>
          {p.nombre}
        </button>
      ))}
    </section>
  )
}
