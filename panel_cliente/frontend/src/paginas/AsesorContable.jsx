import { useEffect, useState } from "react"
import {
  Alert, Anchor, Badge, Grid, Group, Modal, NavLink, Paper, Select, Stack, Switch, Tabs, Text, TextInput, Title,
} from "@mantine/core"
import { IconSearch } from "@tabler/icons-react"
import { api } from "../api"
import Markdown from "../componentes/Markdown"
import ConfiguracionContable from "../componentes/contabilidad/ConfiguracionContable"
import MemoriaAnual from "../componentes/contabilidad/MemoriaAnual"
import MiAccesoContable from "../componentes/contabilidad/MiAccesoContable"
import PropuestasContables from "../componentes/contabilidad/PropuestasContables"
import ContabilidadSIF from "./ContabilidadSIF"

// Biblioteca del asesor contable (ver docs/contabilidad/planificacion.md,
// fase 1): índice entero (llega de una vez, sin esperas al desplegar), buscador y tema.
// El admin activa o desactiva aquí el apartado para esta GD.

function Rama({ nodo, idTema, onElegirTema }) {
  if (nodo.tipo === "tema") {
    return (
      <NavLink
        label={`${nodo.posicion} ${nodo.titulo}`}
        active={nodo.id === idTema}
        onClick={() => onElegirTema(nodo.id)}
      />
    )
  }
  return (
    <NavLink
      label={`${nodo.posicion} ${nodo.titulo}`}
      description={nodo.resumen}
      childrenOffset={14}
    >
      {nodo.hijos.map((h) => (
        <Rama key={h.id} nodo={h} idTema={idTema} onElegirTema={onElegirTema} />
      ))}
    </NavLink>
  )
}

function Activacion({ proyecto, onCambiarModulo, onError }) {
  const [guardando, setGuardando] = useState(false)
  if (!proyecto.es_admin) return null
  return (
    <Switch
      label="Activado en esta gestión documental"
      checked={!!proyecto.modulo_contable}
      disabled={guardando}
      onChange={(e) => {
        const activo = e.currentTarget.checked
        setGuardando(true)
        api
          .actualizarModuloContable(proyecto.id, activo)
          .then(() => onCambiarModulo(activo))
          .catch((err) => onError(err.message))
          .finally(() => setGuardando(false))
      }}
    />
  )
}

function Biblioteca({ proyecto }) {
  const [raiz, setRaiz] = useState(null)
  const [texto, setTexto] = useState("")
  const [resultados, setResultados] = useState(null)
  const [idTema, setIdTema] = useState(null)
  const [tema, setTema] = useState(null)
  const [fuente, setFuente] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.arbolContable(proyecto.id).then((r) => setRaiz(r.nodos)).catch((err) => setError(err.message))
  }, [proyecto.id])

  useEffect(() => {
    if (!idTema) return
    setTema(null)
    api.obtenerTemaContable(proyecto.id, idTema).then(setTema).catch((err) => setError(err.message))
  }, [proyecto.id, idTema])

  const buscar = (e) => {
    e.preventDefault()
    if (!texto.trim()) return setResultados(null)
    api.buscarTemasContables(proyecto.id, texto).then((r) => setResultados(r.temas)).catch((err) => setError(err.message))
  }

  const abrirFuente = (idFuente) =>
    api.obtenerFuenteContable(proyecto.id, idFuente).then(setFuente).catch((err) => setError(err.message))

  return (
    <>
      {error && (
        <Alert color="red" mb="md" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {(
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Paper withBorder p="xs">
              <form onSubmit={buscar}>
                <TextInput
                  id="buscar-tema-contable" aria-label="Buscar en la biblioteca" placeholder="Buscar: leasing, prorrata, 555..."
                  leftSection={<IconSearch size={16} />} value={texto} onChange={(e) => setTexto(e.currentTarget.value)} mb="xs"
                />
              </form>
              {resultados ? (
                <>
                  <Anchor component="button" type="button" fz="sm" mb="xs" onClick={() => setResultados(null)}>
                    Volver al índice
                  </Anchor>
                  {resultados.length === 0 && <Text fz="sm" c="dimmed">No hay temas con esas palabras.</Text>}
                  {resultados.map((t) => (
                    <NavLink
                      key={t.id} label={t.titulo} description={t.ruta.map((r) => r.titulo).join(" › ")}
                      active={t.id === idTema} onClick={() => setIdTema(t.id)}
                    />
                  ))}
                </>
              ) : !raiz ? (
                <Text fz="sm">Cargando...</Text>
              ) : raiz.length === 0 ? (
                <Text fz="sm" c="dimmed">La biblioteca todavía no tiene temas.</Text>
              ) : (
                raiz.map((n) => (
                  <Rama key={n.id} nodo={n} idTema={idTema} onElegirTema={setIdTema} />
                ))
              )}
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Paper withBorder p="lg">
              {!idTema ? (
                <Text c="dimmed">Elige un tema del índice o búscalo.</Text>
              ) : !tema ? (
                <Text>Cargando...</Text>
              ) : (
                <Stack gap="sm">
                  <Text fz="sm" c="dimmed">{tema.ruta.map((r) => r.titulo).join(" › ")}</Text>
                  <Title order={3}>{tema.titulo}</Title>
                  {tema.avisos.map((a) => (
                    <Alert key={a} color="yellow" p="xs">{a}</Alert>
                  ))}
                  <Markdown>{tema.cuerpo}</Markdown>
                  {tema.fuentes.length > 0 && (
                    <Group gap="xs">
                      <Text fz="sm" fw={500}>Normas citadas:</Text>
                      {tema.fuentes.map((f) =>
                        f.disponible ? (
                          <Badge key={f.id} variant="light" style={{ cursor: "pointer" }} onClick={() => abrirFuente(f.id)}>
                            {f.id}
                          </Badge>
                        ) : (
                          <Badge key={f.id} variant="outline" color="gray">{f.id}</Badge>
                        ),
                      )}
                    </Group>
                  )}
                  {tema.relacionados.length > 0 && (
                    <Group gap="xs">
                      <Text fz="sm" fw={500}>Relacionados:</Text>
                      {tema.relacionados.map((r) => (
                        <Anchor key={r.id} component="button" type="button" fz="sm" onClick={() => setIdTema(r.id)}>
                          {r.titulo}
                        </Anchor>
                      ))}
                    </Group>
                  )}
                </Stack>
              )}
            </Paper>
          </Grid.Col>
        </Grid>
      )}

      <Modal opened={!!fuente} onClose={() => setFuente(null)} size="lg" title={fuente?.articulo || fuente?.id}>
        {fuente && (
          <Stack gap="sm">
            {fuente.titulo_norma && <Text fz="sm" c="dimmed">{fuente.titulo_norma}</Text>}
            <Markdown>{fuente.texto}</Markdown>
            <Text fz="xs" c="dimmed">
              Fuente: Agencia Estatal Boletín Oficial del Estado. Texto consolidado de carácter informativo
              {fuente.vigente_desde ? `, versión vigente desde el ${fuente.vigente_desde}` : ""}.
            </Text>
          </Stack>
        )}
      </Modal>
    </>
  )
}


// Las pestañas que dependen del SIF solo salen con la GD conectada; las de
// una empresa, con la empresa elegida (en modo empresa solo hay una).
function Contabilidad({ proyecto }) {
  const [estado, setEstado] = useState(null)
  const [empresas, setEmpresas] = useState(null)
  const [idEmpresa, setIdEmpresa] = useState(null)
  const [errorEmpresas, setErrorEmpresas] = useState(null)
  const [pestana, setPestana] = useState("biblioteca")

  const cargar = () => {
    api.estadoContabilidadSif(proyecto.id).then(setEstado).catch(() => setEstado({}))
    setErrorEmpresas(null)
    api
      .empresasContables(proyecto.id)
      .then((r) => {
        setEmpresas(r.empresas)
        setIdEmpresa((actual) => actual ?? (r.empresas[0] ? String(r.empresas[0].id_obligado_sif) : null))
      })
      .catch((err) => {
        setEmpresas([])
        setErrorEmpresas(err.message)
      })
  }
  useEffect(cargar, [proyecto.id])

  const conectada = !!estado?.modo_contable
  const empresa = empresas?.find((e) => String(e.id_obligado_sif) === idEmpresa)
  const deEmpresa = ["contabilidad", "propuestas", "memoria"].includes(pestana)

  return (
    <Tabs value={pestana} onChange={setPestana} keepMounted={false}>
      <Tabs.List mb="md">
        <Tabs.Tab value="biblioteca">Biblioteca</Tabs.Tab>
        {conectada && <Tabs.Tab value="contabilidad">Contabilidad</Tabs.Tab>}
        {conectada && <Tabs.Tab value="propuestas">Propuestas</Tabs.Tab>}
        {conectada && <Tabs.Tab value="memoria">Memoria anual</Tabs.Tab>}
        {conectada && <Tabs.Tab value="mi-acceso">Mi acceso al SIF</Tabs.Tab>}
        {proyecto.es_admin && <Tabs.Tab value="configuracion">Conexión con el SIF</Tabs.Tab>}
      </Tabs.List>

      {deEmpresa && (
        errorEmpresas ? (
          <Alert color="yellow" mb="md">
            {errorEmpresas}{" "}
            <Anchor component="button" type="button" onClick={() => setPestana("mi-acceso")}>Poner mi acceso</Anchor>
          </Alert>
        ) : empresas?.length > 1 ? (
          <Select
            id="conta-empresa-activa" aria-label="Empresa" mb="md" maw={420} searchable value={idEmpresa} onChange={setIdEmpresa}
            data={empresas.map((e) => ({ value: String(e.id_obligado_sif), label: `${e.nombre}${e.nif ? ` (${e.nif})` : ""}` }))}
          />
        ) : null
      )}

      <Tabs.Panel value="biblioteca"><Biblioteca proyecto={proyecto} /></Tabs.Panel>
      <Tabs.Panel value="contabilidad">
        {empresa && <ContabilidadSIF key={empresa.id_obligado_sif} proyecto={proyecto} empresa={{ ...empresa, id_obligado: empresa.id_obligado_sif }} />}
      </Tabs.Panel>
      <Tabs.Panel value="propuestas">{empresa && <PropuestasContables proyecto={proyecto} empresa={empresa} />}</Tabs.Panel>
      <Tabs.Panel value="memoria">{empresa && <MemoriaAnual key={empresa.id_obligado_sif} proyecto={proyecto} empresa={empresa} />}</Tabs.Panel>
      <Tabs.Panel value="mi-acceso"><MiAccesoContable proyecto={proyecto} miAcceso={estado?.mi_acceso} onCambiar={cargar} /></Tabs.Panel>
      <Tabs.Panel value="configuracion"><ConfiguracionContable proyecto={proyecto} estado={estado} onCambiar={cargar} /></Tabs.Panel>
    </Tabs>
  )
}

export default function AsesorContable({ proyecto, onCambiarModulo }) {
  const [error, setError] = useState(null)
  return (
    <>
      <Group justify="space-between" mb="lg" wrap="wrap">
        <Title order={2}>Asesor contable</Title>
        <Activacion proyecto={proyecto} onCambiarModulo={onCambiarModulo} onError={setError} />
      </Group>
      {error && <Alert color="red" mb="md" withCloseButton onClose={() => setError(null)}>{error}</Alert>}
      {proyecto.modulo_contable ? (
        <Contabilidad proyecto={proyecto} />
      ) : (
        <Text c="dimmed">
          Con el apartado activado, la IA de esta gestión documental trabaja como asesor contable y fiscal: consulta una
          biblioteca propia (plan contable, IVA, sociedades, cierre, análisis financiero...) antes de responder y, si la
          conectáis con la contabilidad del SIF, también la contabilidad real de la empresa.
        </Text>
      )}
    </>
  )
}
