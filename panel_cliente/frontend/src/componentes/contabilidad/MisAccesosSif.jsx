import { useState } from "react"
import {
  Alert, Badge, Button, Card, Checkbox, Group, PasswordInput, SimpleGrid, Stack, Switch, Text, TextInput, Title,
} from "@mantine/core"
import { api } from "../../api"
import UsuariosSif from "./UsuariosSif"

// Los accesos de cada usuario a la contabilidad del SIF (decisión del
// usuario, [5.9] del canal compartido): cada uno vincula los suyos y ve lo
// que su usuario del SIF le permite. Puede tener varios, a SIF distintos.

const DIRECCION_POR_DEFECTO = "https://facturae.multiplika.net"
const ESTADO = {
  activo: ["green", "Funciona"],
  sin_empresas: ["yellow", "Ese usuario ya no tiene ninguna empresa con contabilidad"],
  clave_incorrecta: ["red", "La contraseña ya no vale: vuelve a ponerla"],
}
const TIPO = { asesoria: "De una asesoría", empresa: "De una empresa", otro: "Del SIF" }

function Acceso({ proyecto, acceso, onCambiar, onError }) {
  const [trabajando, setTrabajando] = useState(false)
  const [viendoUsuarios, setViendoUsuarios] = useState(false)
  const pausado = !!acceso.pausado
  const [color, texto] = pausado ? ["gray", "Pausado: no se usa hasta reanudarlo"] : ESTADO[acceso.estado] || ["gray", acceso.estado]
  const ejecutar = (accion) => {
    setTrabajando(true)
    accion().then(onCambiar).catch((err) => onError(err.message)).finally(() => setTrabajando(false))
  }
  return (
    <Card withBorder>
      <Stack gap="xs">
        <Group justify="space-between" wrap="wrap">
          <Stack gap={0}>
            <Text fw={600}>{acceso.nombre_sif || acceso.usuario_sif}</Text>
            <Text fz="sm" c="dimmed">
              {TIPO[acceso.tipo]} · usuario {acceso.usuario_sif} · {acceso.url_sif} · {acceso.empresas} {acceso.empresas === 1 ? "empresa" : "empresas"}
            </Text>
          </Stack>
          <Badge color={color} variant="light">{texto}</Badge>
        </Group>
        <Switch
          id={`pausa-${acceso.id}`}
          label="Usar este acceso (si lo pausas, sus empresas dejan de verse hasta que lo reanudes)"
          checked={!pausado} disabled={trabajando}
          onChange={(e) => {
            const usar = e.currentTarget.checked
            ejecutar(() => api.pausaAccesoSif(proyecto.id, acceso.id, !usar))
          }}
        />
        <Checkbox
          id={`revision-${acceso.id}`}
          label="Revisar cada noche sus empresas (saldos raros y cuadre del IVA) y dejar avisos en Propuestas. No gasta IA."
          checked={!!acceso.revision_automatica} disabled={trabajando || pausado}
          onChange={(e) => {
            const activa = e.currentTarget.checked
            ejecutar(() => api.revisionAccesoSif(proyecto.id, acceso.id, activa))
          }}
        />
        <Group gap="xs">
          <Button size="xs" variant="light" loading={trabajando} disabled={pausado} onClick={() => ejecutar(() => api.actualizarAccesoSif(proyecto.id, acceso.id))}>
            Actualizar sus empresas
          </Button>
          <Button size="xs" variant="light" disabled={pausado || acceso.estado === "clave_incorrecta"} onClick={() => setViendoUsuarios(true)}>
            Usuarios
          </Button>
          <Button size="xs" variant="subtle" color="red" loading={trabajando} onClick={() => ejecutar(() => api.borrarAccesoSif(proyecto.id, acceso.id))}>
            Quitar este acceso
          </Button>
        </Group>
      </Stack>
      {viendoUsuarios && <UsuariosSif proyecto={proyecto} acceso={acceso} onCerrar={() => setViendoUsuarios(false)} />}
    </Card>
  )
}

export default function MisAccesosSif({ proyecto, accesos, onCambiar }) {
  const [anadiendo, setAnadiendo] = useState(false)
  const [url, setUrl] = useState(DIRECCION_POR_DEFECTO)
  const [usuario, setUsuario] = useState("")
  const [contrasena, setContrasena] = useState("")
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  // El fallo al añadir va dentro del formulario, junto al botón: arriba de la
  // página no se ve y, al repetir, parece que no pasa nada.
  const [errorFormulario, setErrorFormulario] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  const formularioAbierto = anadiendo || accesos?.length === 0

  const anadir = () => {
    setTrabajando(true)
    setErrorFormulario(null)
    api
      .anadirAccesoSif(proyecto.id, { url, usuario, contrasena })
      .then((r) => {
        setResultado(r)
        setUsuario("")
        setContrasena("")
        setAnadiendo(false)
        onCambiar()
      })
      .catch((err) => setErrorFormulario(`${err.message}. Probado: usuario «${usuario}» en ${url}.`))
      .finally(() => setTrabajando(false))
  }

  return (
    <Stack gap="md" maw={760}>
      <Text>
        Para ver la contabilidad, pon tu usuario y contraseña del SIF. La gestión documental entra por ti, no tienes que
        entrar dos veces, y ves lo mismo que ese usuario ve en el SIF: su empresa, o todas las de la asesoría. Si trabajas
        con varios SIF, añade uno por cada uno. Se guardan cifrados y solo los usas tú.
      </Text>
      {resultado && (
        <Alert color="green" withCloseButton onClose={() => setResultado(null)}>
          Acceso añadido: ves {resultado.empresas} {resultado.empresas === 1 ? "empresa" : "empresas"}.
        </Alert>
      )}
      {error && <Alert color="red" withCloseButton onClose={() => setError(null)}>{error}</Alert>}

      {(accesos || []).map((a) => (
        <Acceso key={a.id} proyecto={proyecto} acceso={a} onCambiar={onCambiar} onError={setError} />
      ))}

      {formularioAbierto ? (
        <Card withBorder>
          <Stack gap="sm">
            <Title order={5}>{accesos?.length ? "Añadir otro acceso" : "Tu acceso al SIF"}</Title>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <TextInput id="acceso-sif-url" label="Dirección del SIF" value={url} onChange={(e) => setUrl(e.currentTarget.value)} />
              <TextInput id="acceso-sif-usuario" label="Tu usuario del SIF" value={usuario} onChange={(e) => setUsuario(e.currentTarget.value)} />
              <PasswordInput id="acceso-sif-contrasena" label="Contraseña" value={contrasena} onChange={(e) => setContrasena(e.currentTarget.value)} />
            </SimpleGrid>
            {errorFormulario && <Alert color="red">{errorFormulario}</Alert>}
            <Group>
              <Button onClick={anadir} loading={trabajando} disabled={!url || !usuario || !contrasena}>Probar y guardar</Button>
              {accesos?.length > 0 && <Button variant="default" onClick={() => setAnadiendo(false)}>Cancelar</Button>}
            </Group>
          </Stack>
        </Card>
      ) : (
        <Group>
          <Button variant="light" onClick={() => setAnadiendo(true)}>Añadir acceso</Button>
        </Group>
      )}
    </Stack>
  )
}
