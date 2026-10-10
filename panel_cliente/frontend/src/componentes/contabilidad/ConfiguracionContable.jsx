import { useEffect, useState } from "react"
import {
  Alert, Badge, Button, Card, Checkbox, Group, PasswordInput, Radio, Select, SimpleGrid, Stack, Table, Text,
  TextInput, Title,
} from "@mantine/core"
import { api } from "../../api"

// Administración de la conexión con la contabilidad del SIF (ver
// docs/contabilidad/planificacion.md → fase 2 → "Pantallas de
// configuración"): tres pasos (modo, acceso, empresa u opción de asesorías
// pequeñas) y, ya conectada, el resumen con el estado de cada usuario.

const ESTADO_ACCESO = {
  activo: ["green", "Con acceso"],
  sin_permiso: ["yellow", "Su usuario no tiene permiso en esta empresa"],
  clave_incorrecta: ["red", "Su contraseña ya no vale"],
}
const SIN_ACCESO = ["gray", "Le falta poner su acceso"]
const TEXTO_SIN_CLAVE_PROPIA =
  "Quien no tenga su propio acceso al SIF trabaja con este (para equipos de una o dos personas: en el SIF todo aparecerá hecho con este usuario)"

function Resumen({ proyecto, estado, onCambiar, onEditar, onError, onIrAMiAcceso }) {
  const [usuarios, setUsuarios] = useState([])
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    api.listarUsuariosProyecto(proyecto.id).then(setUsuarios).catch(() => setUsuarios([]))
  }, [proyecto.id])

  const ejecutar = (accion) => {
    setTrabajando(true)
    accion().then(onCambiar).catch((err) => onError(err.message)).finally(() => setTrabajando(false))
  }
  const accesos = Object.fromEntries((estado.accesos || []).map((a) => [a.id_usuario, a]))

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap">
        <Stack gap={2}>
          <Text fw={600}>
            {estado.modo_contable === "asesoria" ? "Asesoría: contabilidad de vuestros clientes" : "Solo vuestra empresa"}
          </Text>
          <Text fz="sm" c="dimmed">
            Acceso de {estado.usuario_clave_gd} en {estado.url_sif_contable}
          </Text>
        </Stack>
        {estado.estado_clave_contable === "activo" ? (
          <Badge color="green" variant="light">La gestión documental está conectada al SIF</Badge>
        ) : (
          <Badge color="red" variant="light">La contraseña de esta conexión ya no vale</Badge>
        )}
      </Group>
      {estado.error_clave_contable && <Alert color="red">{estado.error_clave_contable}</Alert>}
      <Text>
        {estado.modo_contable === "asesoria"
          ? `${estado.empresas} empresas de la asesoría, ${estado.con_contabilidad} con contabilidad autorizada en el SIF.`
          : `Empresa: ${estado.empresas ? "conectada" : "sin conectar"}.`}
        {estado.ultima_sincronizacion && ` Actualizado el ${new Date(estado.ultima_sincronizacion).toLocaleString("es-ES")}.`}
      </Text>
      <Group gap="xs">
        <Button variant="light" loading={trabajando} onClick={() => ejecutar(() => api.sincronizarContabilidadSif(proyecto.id))}>
          Actualizar ahora
        </Button>
        <Button variant="default" onClick={onEditar}>Cambiar acceso…</Button>
      </Group>
      {!estado.mi_acceso && estado.id_usuario_actual && (
        <Alert color="blue" p="sm">
          <Group justify="space-between" wrap="wrap" gap="xs">
            <Text fz="sm">¿El usuario del SIF {estado.usuario_clave_gd} es el tuyo? Úsalo también como tu acceso y no tendrás que escribirlo otra vez.</Text>
            <Button size="xs" loading={trabajando} onClick={() => ejecutar(() => api.usarAccesoGdComoMio(proyecto.id))}>
              Usar este acceso también como el mío
            </Button>
          </Group>
        </Alert>
      )}
      {(
        <Checkbox
          id="conta-sin-clave-propia"
          label={TEXTO_SIN_CLAVE_PROPIA}
          checked={!!estado.conta_sin_clave_propia}
          disabled={trabajando}
          onChange={(e) => {
            const valor = e.currentTarget.checked
            ejecutar(() => api.opcionesContabilidadSif(proyecto.id, { sin_clave_propia: valor }))
          }}
        />
      )}
      <Checkbox
        id="conta-revision-automatica"
        label="Revisar cada noche los saldos raros y el cuadre del IVA, y dejar avisos en Propuestas (no gasta IA)"
        checked={!!estado.conta_revision_automatica}
        disabled={trabajando}
        onChange={(e) => {
          const valor = e.currentTarget.checked
          ejecutar(() => api.opcionesContabilidadSif(proyecto.id, { revision_automatica: valor }))
        }}
      />
      <Title order={4} mt="sm">Usuarios</Title>
      <Text fz="sm" c="dimmed">Cada persona entra al SIF con su propio usuario, para que quede constancia de quién hace cada cosa.</Text>
      <Table>
        <Table.Tbody>
          {usuarios.map((u) => {
            const acceso = accesos[u.id]
            const [color, texto] = acceso ? ESTADO_ACCESO[acceso.estado] || ["gray", acceso.estado] : SIN_ACCESO
            const soyYo = u.id === estado.id_usuario_actual
            return (
              <Table.Tr key={u.id}>
                <Table.Td>{u.nombre}{soyYo && " (tú)"}</Table.Td>
                <Table.Td><Badge color={color} variant="light">{texto}</Badge></Table.Td>
                <Table.Td>
                  {soyYo && (!acceso || acceso.estado !== "activo") && (
                    <Button size="xs" variant="light" onClick={onIrAMiAcceso}>Poner mi acceso</Button>
                  )}
                </Table.Td>
              </Table.Tr>
            )
          })}
        </Table.Tbody>
      </Table>
      <Group>
        <Button
          color="red" variant="subtle" loading={trabajando}
          onClick={() => ejecutar(() => api.desconectarContabilidadSif(proyecto.id))}
        >
          Desconectar del SIF
        </Button>
      </Group>
    </Stack>
  )
}

function Asistente({ proyecto, estado, onCambiar, onCancelar, onError }) {
  const [modo, setModo] = useState(estado.modo_contable || "")
  const [url, setUrl] = useState(estado.url_sif_contable || "")
  const [usuario, setUsuario] = useState(estado.usuario_clave_gd || "")
  const [contrasena, setContrasena] = useState("")
  const [prueba, setPrueba] = useState(null)
  const [idObligado, setIdObligado] = useState(estado.id_obligado_sif_fijo ? String(estado.id_obligado_sif_fijo) : null)
  const [sinClavePropia, setSinClavePropia] = useState(!!estado.conta_sin_clave_propia)
  const [esMio, setEsMio] = useState(true)
  const [trabajando, setTrabajando] = useState(false)

  const datos = () => ({
    modo, url: url || null, usuario, contrasena: contrasena || null,
    id_obligado_fijo: idObligado ? Number(idObligado) : null, sin_clave_propia: sinClavePropia, es_mio: esMio,
  })
  const probar = () => {
    setTrabajando(true)
    setPrueba(null)
    api.probarContabilidadSif(proyecto.id, datos()).then(setPrueba).catch((err) => onError(err.message)).finally(() => setTrabajando(false))
  }
  const guardar = () => {
    setTrabajando(true)
    api
      .conectarContabilidadSif(proyecto.id, datos())
      .then((r) => {
        if (r.aviso) onError(r.aviso)
        onCambiar(!!r.aviso)
      })
      .catch((err) => onError(err.message))
      .finally(() => setTrabajando(false))
  }

  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Text fw={600}>1. ¿Cómo vais a usar la contabilidad?</Text>
        <Radio.Group value={modo} onChange={(v) => { setModo(v); setPrueba(null) }}>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Card withBorder p="sm"><Radio value="asesoria" label="Somos una asesoría y llevamos la contabilidad de nuestros clientes" /></Card>
            <Card withBorder p="sm"><Radio value="empresa" label="Solo nuestra propia empresa" /></Card>
          </SimpleGrid>
        </Radio.Group>
      </Stack>

      {modo && (
        <Stack gap="xs">
          <Text fw={600}>2. Acceso {modo === "asesoria" ? "de la asesoría" : "de la empresa"} al SIF</Text>
          <Text fz="sm" c="dimmed">
            {modo === "asesoria"
              ? "Un usuario de la asesoría en el SIF (no un administrador del SIF). Solo se usa para leer qué empresas son vuestras."
              : "Un usuario con acceso a la contabilidad de vuestra empresa en el SIF."}
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <TextInput id="conta-url" label="Dirección del SIF" placeholder="https://sif2.multiplika.net" value={url} onChange={(e) => setUrl(e.currentTarget.value)} />
            <TextInput id="conta-usuario" label="Usuario" value={usuario} onChange={(e) => setUsuario(e.currentTarget.value)} />
            <PasswordInput
              id="conta-contrasena" label="Contraseña"
              placeholder={estado.usuario_clave_gd ? "Déjala vacía para no cambiarla" : ""}
              value={contrasena} onChange={(e) => setContrasena(e.currentTarget.value)}
            />
          </SimpleGrid>
          <Group>
            <Button variant="light" onClick={probar} loading={trabajando} disabled={!usuario}>Probar</Button>
            {prueba && modo === "asesoria" && (
              <Text c="green">Correcto: {prueba.vinculadas} empresas de la asesoría, {prueba.con_contabilidad} con contabilidad autorizada.</Text>
            )}
            {prueba && modo === "empresa" && <Text c="green">Correcto: el acceso llega a {prueba.empresas.length} empresas.</Text>}
          </Group>
        </Stack>
      )}

      {prueba && (
        <Stack gap="xs">
          <Text fw={600}>3. {modo === "empresa" ? "¿Qué empresa es la vuestra?" : "Últimos detalles"}</Text>
          {modo === "empresa" && (
            <Select
              id="conta-empresa" placeholder="Elige la empresa" value={idObligado} onChange={setIdObligado}
              data={prueba.empresas.map((e) => ({ value: String(e.id_obligado), label: `${e.nombre}${e.nif ? ` (${e.nif})` : ""}` }))}
            />
          )}
          <Checkbox
            id="conta-asistente-es-mio"
            label={`¿El usuario del SIF ${usuario} es el tuyo? Si es así, queda también como tu acceso y no tendrás que escribirlo otra vez`}
            checked={esMio} onChange={(e) => setEsMio(e.currentTarget.checked)}
          />
          <Checkbox
            id="conta-asistente-sin-clave" label={TEXTO_SIN_CLAVE_PROPIA}
            checked={sinClavePropia} onChange={(e) => setSinClavePropia(e.currentTarget.checked)}
          />
          <Group>
            <Button onClick={guardar} loading={trabajando} disabled={modo === "empresa" && prueba.empresas.length > 1 && !idObligado}>
              Guardar y conectar
            </Button>
            {onCancelar && <Button variant="default" onClick={onCancelar}>Cancelar</Button>}
          </Group>
        </Stack>
      )}
    </Stack>
  )
}

export default function ConfiguracionContable({ proyecto, estado, onCambiar, onIrAMiAcceso }) {
  const [editando, setEditando] = useState(false)
  const [error, setError] = useState(null)
  const conectada = !!estado?.modo_contable

  const cambiado = (conAviso) => {
    setEditando(false)
    if (!conAviso) setError(null)
    onCambiar()
  }

  return (
    <Stack gap="md">
      {error && <Alert color="red" withCloseButton onClose={() => setError(null)}>{error}</Alert>}
      {conectada && !editando ? (
        <Resumen
          proyecto={proyecto} estado={estado} onCambiar={() => cambiado()} onEditar={() => setEditando(true)}
          onError={setError} onIrAMiAcceso={onIrAMiAcceso}
        />
      ) : (
        <Asistente
          proyecto={proyecto} estado={estado || {}} onCambiar={cambiado} onError={setError}
          onCancelar={conectada ? () => setEditando(false) : null}
        />
      )}
    </Stack>
  )
}
