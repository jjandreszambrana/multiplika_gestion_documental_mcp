import { opcionesDeTabla } from "@contabilidad/components/tabla.ts"

// Rejilla de Gestión SIF que ocupa lo que queda de pantalla: solo se mueven
// sus filas, y el título, los filtros y los nombres de las columnas se quedan
// a la vista (la página de Gestión SIF va a alto de ventana, ver Erp.jsx)
export function opcionesRejilla() {
  return {
    ...opcionesDeTabla(),
    enablePagination: false,
    enableBottomToolbar: false,
    mantinePaperProps: { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } },
    mantineTableContainerProps: { style: { flex: 1, minHeight: 0, maxHeight: "none", overflowY: "auto" } },
    mantineTableHeadProps: { style: { background: "var(--mantine-color-body)", zIndex: 2 } },
  }
}

export const DERECHA = { mantineTableBodyCellProps: { align: "right" }, mantineTableHeadCellProps: { align: "right" } }
