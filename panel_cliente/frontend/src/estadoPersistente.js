import { useEffect, useState } from "react"

// Filtros de las listas: se guardan en la pestaña del navegador para que,
// al abrir un elemento y volver, la lista siga como la dejó el usuario.
// Duran hasta que cambie el filtro o se cierre la pestaña.
export function useEstadoPersistente(clave, inicial) {
  const [valor, setValor] = useState(() => {
    try {
      const guardado = sessionStorage.getItem(clave)
      return guardado === null ? inicial : JSON.parse(guardado)
    } catch {
      return inicial
    }
  })
  useEffect(() => {
    try {
      sessionStorage.setItem(clave, JSON.stringify(valor))
    } catch {
      // sin almacenamiento (modo privado, bloqueado...): solo no se recuerda
    }
  }, [clave, valor])
  return [valor, setValor]
}
