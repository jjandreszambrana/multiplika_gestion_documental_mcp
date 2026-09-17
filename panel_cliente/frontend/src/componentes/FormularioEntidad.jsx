import { Autocomplete, SimpleGrid, Textarea, TextInput } from "@mantine/core"

const TIPOS_SUGERIDOS = ["cliente", "proveedor", "empleado"]

// Formulario compartido entre "crear entidad" (Entidades.jsx) y "editar
// entidad" (EntidadDetalle.jsx) — mismos 11 campos en los dos sitios.
// "Tipo" es texto libre con sugerencias (Autocomplete), no una lista
// cerrada — mismo catálogo abierto que tipo_documento en documentos.
export default function FormularioEntidad({ valores, onChange, tiposConocidos = [] }) {
  function campo(clave) {
    return {
      value: valores[clave] || "",
      onChange: (e) => onChange({ ...valores, [clave]: e.currentTarget.value }),
    }
  }

  const opcionesTipo = [...new Set([...TIPOS_SUGERIDOS, ...tiposConocidos])]

  return (
    <>
      <SimpleGrid cols={2} spacing="10" mb="10">
        <TextInput label="Nombre" required {...campo("nombre")} />
        <Autocomplete
          label="Tipo" placeholder="cliente, proveedor, empleado..." data={opcionesTipo}
          value={valores.tipo || ""} onChange={(v) => onChange({ ...valores, tipo: v })}
          required
        />
      </SimpleGrid>
      <SimpleGrid cols={2} spacing="10" mb="10">
        <TextInput label="Teléfono" {...campo("telefono")} />
        <TextInput label="Email" type="email" {...campo("email")} />
      </SimpleGrid>
      <TextInput label="Dirección" mb="10" {...campo("direccion")} />
      <SimpleGrid cols={3} spacing="10" mb="10">
        <TextInput label="Localidad" {...campo("localidad")} />
        <TextInput label="Provincia" {...campo("provincia")} />
        <TextInput label="Código postal" {...campo("codigo_postal")} />
      </SimpleGrid>
      <SimpleGrid cols={2} spacing="10" mb="10">
        <TextInput label="País" {...campo("pais")} />
        <TextInput label="Código (ERP)" description="Para vincular con el ERP, si aplica" {...campo("codigo")} />
      </SimpleGrid>
      <Textarea label="Observaciones" autosize minRows={2} {...campo("observaciones")} />
    </>
  )
}
