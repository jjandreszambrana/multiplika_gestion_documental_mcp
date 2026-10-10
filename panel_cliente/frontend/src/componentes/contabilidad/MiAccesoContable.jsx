import { useState } from "react"
import { Alert, Button, Group, PasswordInput, SimpleGrid, Stack, Text, TextInput } from "@mantine/core"
import { api } from "../../api"

// El acceso personal de cada usuario a la contabilidad del SIF: se guarda
// cifrado y privado (nadie más, ni el administrador, puede usarlo).

export default function MiAccesoContable({ proyecto, miAcceso, onCambiar }) {
  const [usuario, setUsuario] = useState("")
  const [contrasena, setContrasena] = useState("")
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)

  const guardar = () => {
    setTrabajando(true)
    setError(null)
    api
      .guardarMiAccesoContable(proyecto.id, { usuario, contrasena })
      .then((r) => {
        setResultado(r)
        setContrasena("")
        onCambiar()
      })
      .catch((err) => setError(err.message))
      .finally(() => setTrabajando(false))
  }

  const quitar = () => {
    setTrabajando(true)
    api.borrarMiAccesoContable(proyecto.id).then(onCambiar).catch((err) => setError(err.message)).finally(() => setTrabajando(false))
  }

  return (
    <Stack gap="md" maw={640}>
      <Text>
        Tu usuario y contraseña del SIF. Con ellos la GD entra en la contabilidad por ti: no tienes que entrar dos
        veces, ves las empresas que el SIF te permite y en el SIF queda que lo has hecho tú. Se guardan cifrados y
        solo los usas tú.
      </Text>
      {miAcceso?.estado === "activo" && !resultado && <Alert color="green">Tienes tu acceso puesto y funciona.</Alert>}
      {miAcceso?.estado === "clave_incorrecta" && (
        <Alert color="red">Tu clave del SIF ya no funciona (¿la has cambiado?). Vuelve a escribirla.</Alert>
      )}
      {resultado && <Alert color="green">Correcto: ves {resultado.empresas} de las {resultado.de} empresas de esta GD.</Alert>}
      {error && <Alert color="red" withCloseButton onClose={() => setError(null)}>{error}</Alert>}
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput id="mi-acceso-usuario" label="Usuario del SIF" value={usuario} onChange={(e) => setUsuario(e.currentTarget.value)} />
        <PasswordInput id="mi-acceso-contrasena" label="Contraseña" value={contrasena} onChange={(e) => setContrasena(e.currentTarget.value)} />
      </SimpleGrid>
      <Group>
        <Button onClick={guardar} loading={trabajando} disabled={!usuario || !contrasena}>Probar y guardar</Button>
        {miAcceso && <Button variant="subtle" color="red" onClick={quitar} loading={trabajando}>Quitar mi acceso</Button>}
      </Group>
    </Stack>
  )
}
