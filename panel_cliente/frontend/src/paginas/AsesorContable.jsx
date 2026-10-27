import { useEffect, useState } from "react"
import {
  ActionIcon, Alert, Anchor, Badge, Box, Button, Grid, Group, Modal, NavLink, Paper, Stack, Tabs, Text, TextInput, Title, Tooltip,
} from "@mantine/core"
import { IconMenu2, IconMessageCircle, IconSearch } from "@tabler/icons-react"
import { api } from "../api"
import Markdown from "../componentes/Markdown"
import MemoriaAnual from "../componentes/contabilidad/MemoriaAnual"
import Conciliacion from "../componentes/contabilidad/Conciliacion"
import PropuestasContables from "../componentes/contabilidad/PropuestasContables"
import ContabilidadSIF from "./ContabilidadSIF"
import SelectorEmpresa, { fondoEmpresa } from "../componentes/SelectorEmpresa"
import { ALTO_INDICE } from "../theme"

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
            <Paper withBorder p="xs" mah={ALTO_INDICE} style={{ overflowY: "auto" }}>
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


// Cada usuario vincula sus propios accesos al SIF ([5.9] del canal
// compartido): las pestañas de una empresa salen cuando tiene alguno, y la
// empresa elegida dice con qué acceso se habla.
function Contabilidad({ proyecto, cabecera, versionAccesos, onVerAccesos }) {
  const [accesos, setAccesos] = useState(null)
  const [empresas, setEmpresas] = useState(null)
  const [idEmpresa, setIdEmpresa] = useState(null)
  const [errorEmpresas, setErrorEmpresas] = useState(null)
  const [pestana, setPestana] = useState("biblioteca")
  // Las pestañas se montan la primera vez que se abren y luego se quedan
  // (ocultas): al volver, la contabilidad sigue donde se dejó.
  const [abiertas, setAbiertas] = useState(() => new Set(["biblioteca"]))
  // Hueco a la derecha de la empresa donde la contabilidad pone su ejercicio
  const [hueco, setHueco] = useState(null)
  const abrir = (valor) => {
    setPestana(valor)
    setAbiertas((previas) => new Set(previas).add(valor))
  }

  const cargar = () => {
    api.accesosSif(proyecto.id).then((r) => setAccesos(r.accesos)).catch(() => setAccesos([]))
    setErrorEmpresas(null)
    api
      .empresasContables(proyecto.id)
      .then((r) => {
        setEmpresas(r.empresas)
        setIdEmpresa((actual) => (r.empresas.some((e) => String(e.id_empresa) === actual) ? actual : r.empresas[0] ? String(r.empresas[0].id_empresa) : null))
      })
      .catch((err) => {
        setEmpresas([])
        setErrorEmpresas(err.message)
      })
  }
  // versionAccesos sube al cambiar los accesos en su pantalla del menú
  const [entrada, setEntrada] = useState(false)
  useEffect(() => {
    setEntrada(false)
    cargar()
  }, [proyecto.id, versionAccesos]) // eslint-disable-line react-hooks/exhaustive-deps
  // Con acceso al SIF se entra directamente en la contabilidad.
  useEffect(() => {
    if (entrada || accesos === null || accesos === undefined) return
    setEntrada(true)
    if (accesos.length > 0 && pestana === "biblioteca") abrir("contabilidad")
  }, [accesos]) // eslint-disable-line react-hooks/exhaustive-deps

  const conAcceso = accesos?.length > 0
  const empresa = empresas?.find((e) => String(e.id_empresa) === idEmpresa)
  const deEmpresa = ["contabilidad", "propuestas", "conciliacion", "memoria"].includes(pestana)
  const sinAccesoQueFuncione = conAcceso && !empresas?.length

  return (
    <Tabs value={pestana} onChange={abrir}>
      {/* El título y las pestañas se quedan arriba al bajar por la página. */}
      <Box style={{ ...STICKY, ...(deEmpresa && empresa && { background: fondoEmpresa(empresa.id_empresa) }) }} mb={deEmpresa ? 0 : "md"}>
        {cabecera(
        <Tabs.List style={{ flex: 1 }}>
          {conAcceso && <Tabs.Tab value="contabilidad">Contabilidad</Tabs.Tab>}
          <Tabs.Tab value="biblioteca">Biblioteca</Tabs.Tab>
          {conAcceso && <Tabs.Tab value="propuestas">Propuestas</Tabs.Tab>}
          {conAcceso && <Tabs.Tab value="conciliacion">Conciliación</Tabs.Tab>}
          {conAcceso && <Tabs.Tab value="memoria">Memoria anual</Tabs.Tab>}
        </Tabs.List>
        )}
      </Box>

      {deEmpresa && (
        sinAccesoQueFuncione ? (
          <Alert color="blue" mb="md">
            <Group justify="space-between" wrap="wrap" gap="xs">
              <Text fz="sm">{errorEmpresas || "Ninguno de tus accesos al SIF funciona ahora mismo."}</Text>
              <Button size="xs" onClick={onVerAccesos}>Revisar mis accesos</Button>
            </Group>
          </Alert>
        ) : (
          <Group
            justify="space-between" wrap="nowrap" mb="md" p={4}
            style={{ borderRadius: "0 0 var(--mantine-radius-sm) var(--mantine-radius-sm)", background: empresa && fondoEmpresa(empresa.id_empresa) }}
          >
            {empresas?.length > 1 ? (
              <SelectorEmpresa id="conta-empresa-activa" empresas={empresas} value={idEmpresa} onChange={setIdEmpresa} />
            ) : <span />}
            {pestana === "contabilidad" && <div ref={setHueco} />}
          </Group>
        )
      )}

      <Tabs.Panel value="biblioteca"><Biblioteca proyecto={proyecto} /></Tabs.Panel>
      <Tabs.Panel value="contabilidad">
        {abiertas.has("contabilidad") && empresa && <ContabilidadSIF key={empresa.id_empresa} proyecto={proyecto} empresa={empresa} hueco={hueco} />}
      </Tabs.Panel>
      <Tabs.Panel value="propuestas">
        {abiertas.has("propuestas") && empresa && <PropuestasContables key={empresa.id_empresa} proyecto={proyecto} empresa={empresa} />}
      </Tabs.Panel>
      <Tabs.Panel value="conciliacion">
        {abiertas.has("conciliacion") && empresa && <Conciliacion key={empresa.id_empresa} proyecto={proyecto} empresa={empresa} />}
      </Tabs.Panel>
      <Tabs.Panel value="memoria">
        {abiertas.has("memoria") && empresa && <MemoriaAnual key={empresa.id_empresa} proyecto={proyecto} empresa={empresa} />}
      </Tabs.Panel>
    </Tabs>
  )
}

const STICKY = {
  position: "sticky", top: 0, zIndex: 20, background: "var(--mantine-color-body)",
  marginTop: "calc(-1 * var(--mantine-spacing-xs))", paddingTop: "var(--mantine-spacing-xs)",
}

export default function AsesorContable({ proyecto, pantallaCompleta, onAlternarMenu, onAlternarChat, versionAccesos, onVerAccesos }) {
  // `pestanas`: la contabilidad pone las suyas en la misma fila que el título
  const cabecera = (pestanas = null) => (
      <Group justify="space-between" mb={pantallaCompleta ? "xs" : "lg"} wrap="nowrap" gap="lg">
        <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
          {pantallaCompleta && (
            <Tooltip label="Menú de la gestión documental">
              <ActionIcon variant="default" size="lg" aria-label="Abrir o cerrar el menú de la gestión documental" onClick={onAlternarMenu}>
                <IconMenu2 size={18} />
              </ActionIcon>
            </Tooltip>
          )}
          <Title order={pantallaCompleta ? 4 : 2}>Contabilidad</Title>
        </Group>
        {pestanas}
        {onAlternarChat && (
          <Tooltip label="Chat con la IA">
            <ActionIcon variant="light" size="lg" aria-label="Abrir o cerrar el chat con la IA" onClick={onAlternarChat}>
              <IconMessageCircle size={18} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
  )
  return (
    <>
      {proyecto.modulo_contable ? (
        <Contabilidad proyecto={proyecto} cabecera={cabecera} versionAccesos={versionAccesos} onVerAccesos={onVerAccesos} />
      ) : (
        <>
        {cabecera()}
        <Text c="dimmed">
          Con el apartado activado, la IA de esta gestión documental trabaja como asesor contable y fiscal: consulta una
          biblioteca propia (plan contable, IVA, sociedades, cierre, análisis financiero...) antes de responder y, si cada
          uno pone su acceso al SIF, también la contabilidad real de sus empresas.
        </Text>
        </>
      )}
    </>
  )
}
