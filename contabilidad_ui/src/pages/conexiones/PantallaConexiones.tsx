import { Alert, Badge, Button, Group, Loader, Paper, Stack, Table, Text, Title } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import {
  crearConexion,
  editarConexion,
  eliminarConexion,
  listarConexiones,
  listarTuneles,
  probarConexion,
  type Conexion,
  type ResultadoPrueba,
  type Tunel,
} from '../../api/conexiones'
import { textoDeError } from '../../api/errores'
import { formatearFecha } from '../../lib/format'
import DialogoConfirmar from '../traspasos/DialogoConfirmar'
import DialogoConexion from './DialogoConexion'

interface Props {
  idObligado: number
  nombreEmpresa: string
}

type Confirmacion = 'activar' | 'desactivar' | 'quitar' | null

/**
 * La conexión de esta empresa con Codiplika, de donde la bandeja trae
 * facturas, cobros y pagos. La ven quienes la pueden gestionar: el
 * superadministrador, los administradores y el usuario de la propia empresa.
 *
 * El orden es el que pide el SIF: se guarda (nace apagada), se prueba, se mira
 * que al otro lado está esta empresa y entonces se activa.
 */
export default function PantallaConexiones({ idObligado, nombreEmpresa }: Props) {
  const [conexion, setConexion] = useState<Conexion | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [probando, setProbando] = useState(false)
  const [prueba, setPrueba] = useState<ResultadoPrueba | null>(null)
  const [confirmar, setConfirmar] = useState<Confirmacion>(null)
  const [tuneles, setTuneles] = useState<Tunel[] | null>(null)

  const cargar = useCallback(() => {
    listarConexiones(idObligado)
      .then((lista) => setConexion(lista.find((c) => c.tipo === 'codiplika') ?? null))
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
  }, [idObligado])

  useEffect(cargar, [cargar])

  useEffect(() => {
    listarTuneles()
      .then(({ tuneles = [] }) => setTuneles(tuneles))
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
  }, [])

  async function probar(id: number) {
    setError(null)
    setProbando(true)
    try {
      setPrueba(await probarConexion(id))
      cargar() // la prueba queda anotada en la conexión
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setProbando(false)
    }
  }

  if ((conexion === undefined || tuneles === null) && !error) return <Loader size="sm" />
  const sinTuneles = tuneles?.length === 0

  return (
    <Stack gap="md" maw={760}>
      <Title order={3}>Conexión con Codiplika</Title>
      <Text size="sm" c="dimmed">
        Para que la contabilidad traiga a su bandeja las facturas, cobros y pagos que esta
        empresa hace en Codiplika.
      </Text>

      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}

      {conexion === null && (
        <Paper withBorder p="lg">
          <Stack gap="sm" align="flex-start">
            <Text>{nombreEmpresa} no está conectada con Codiplika.</Text>
            {sinTuneles ? (
              <Text size="sm" c="dimmed">
                Este servidor no tiene acceso configurado a otros programas. Pídelo al
                administrador de la plataforma.
              </Text>
            ) : (
              <Button onClick={() => setEditando(true)}>Conectar con Codiplika</Button>
            )}
          </Stack>
        </Paper>
      )}

      {conexion && (
        <Paper withBorder p="lg">
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={600}>{conexion.nombre}</Text>
              {conexion.activa ? (
                <Badge color="green">En uso</Badge>
              ) : (
                <Badge color="gray">Apagada</Badge>
              )}
            </Group>

            <Text size="sm">{destino(conexion)}</Text>
            <Text size="sm" c="dimmed">
              {conexion.tiene_password ? 'Contraseña guardada.' : 'Sin contraseña.'}
            </Text>

            {!conexion.activa && (
              <Alert color="yellow">
                Está apagada: la contabilidad todavía no la usa. Pruébala, comprueba que los
                datos que salen son de {nombreEmpresa} y actívala.
              </Alert>
            )}

            {conexion.ultima_prueba && !prueba && (
              <Text size="sm" c="dimmed">
                Última prueba, el {formatearFecha(conexion.ultima_prueba)} a las{' '}
                {conexion.ultima_prueba.slice(11, 16)}:{' '}
                {conexion.resultado_prueba}
              </Text>
            )}

            {prueba && <ResultadoDePrueba prueba={prueba} nombreEmpresa={nombreEmpresa} />}

            <Group>
              <Button onClick={() => void probar(conexion.id)} loading={probando}>
                Probar
              </Button>
              {conexion.activa ? (
                <Button variant="default" onClick={() => setConfirmar('desactivar')}>
                  Apagar
                </Button>
              ) : (
                <Button
                  variant="default"
                  disabled={prueba?.ok === false}
                  onClick={() => setConfirmar('activar')}
                >
                  Activar
                </Button>
              )}
              <Button variant="default" onClick={() => setEditando(true)}>
                Cambiar datos
              </Button>
              <Button variant="subtle" color="red" onClick={() => setConfirmar('quitar')}>
                Quitar
              </Button>
            </Group>
          </Stack>
        </Paper>
      )}

      {editando && (
        <DialogoConexion
          conexion={conexion ?? null}
          tuneles={tuneles ?? []}
          nombreEmpresa={nombreEmpresa}
          alCerrar={() => setEditando(false)}
          alGuardar={async ({ tipo: _tipo, ...datos }) => {
            const guardada = conexion
              ? await editarConexion(conexion.id, datos)
              : await crearConexion(idObligado, { tipo: 'codiplika', ...datos })
            setConexion(guardada)
            setPrueba(null) // lo probado era el destino de antes
            setEditando(false)
          }}
        />
      )}

      {conexion && (
        <DialogoConfirmar
          abierto={confirmar !== null}
          titulo={
            confirmar === 'activar'
              ? 'Activar la conexión'
              : confirmar === 'desactivar'
                ? 'Apagar la conexión'
                : 'Quitar la conexión'
          }
          texto={
            confirmar === 'activar'
              ? `La contabilidad de ${nombreEmpresa} podrá traer datos de esta base de Codiplika. Hazlo solo si la prueba enseña facturas y clientes de ${nombreEmpresa}.`
              : confirmar === 'desactivar'
                ? 'La contabilidad dejará de traer datos de Codiplika hasta que la actives otra vez. Los datos guardados no se pierden.'
                : 'Se borran los datos de la conexión. Lo que ya se trajo a la contabilidad se queda donde está.'
          }
          rotulo={confirmar === 'activar' ? 'Activar' : confirmar === 'desactivar' ? 'Apagar' : 'Quitar'}
          alCerrar={() => setConfirmar(null)}
          alConfirmar={async () => {
            if (confirmar === 'quitar') {
              await eliminarConexion(conexion.id)
              setConexion(null)
              setPrueba(null)
            } else {
              setConexion(await editarConexion(conexion.id, { activa: confirmar === 'activar' }))
            }
            setConfirmar(null)
          }}
        />
      )}
    </Stack>
  )
}

/** A dónde se conecta, en una frase. */
function destino(c: Conexion): string {
  return `Por «${c.tunel}», a la base «${c.base_datos}» de ${c.host}:${c.puerto} con el usuario ${c.usuario || '(sin usuario)'}.`
}

interface Detalle {
  base_datos?: string
  ultima_factura?: { numero_factura?: string; fecha?: string; cliente?: string } | null
  series?: string[]
  facturas?: number
  facturas_pendientes?: number
  compras_pendientes?: number
  clientes?: number
  proveedores?: number
}

/** Lo que la prueba ha visto al otro lado, para reconocer a la empresa. */
function ResultadoDePrueba({ prueba, nombreEmpresa }: { prueba: ResultadoPrueba; nombreEmpresa: string }) {
  if (!prueba.ok) {
    return (
      <Alert color="red" title="No se ha podido conectar">
        {prueba.mensaje}
      </Alert>
    )
  }
  const d = (prueba.detalle ?? {}) as Detalle
  const filas: [string, string][] = [
    ['Base de datos', d.base_datos ?? '—'],
    [
      'Última factura',
      d.ultima_factura
        ? `${d.ultima_factura.numero_factura ?? '—'} del ${d.ultima_factura.fecha ?? '—'} a ${d.ultima_factura.cliente ?? '—'}`
        : 'Ninguna',
    ],
    ['Series', d.series?.length ? d.series.join(', ') : 'Ninguna'],
    ['Facturas', `${d.facturas ?? 0} (${d.facturas_pendientes ?? 0} sin pasar a contabilidad)`],
    ['Compras sin pasar a contabilidad', String(d.compras_pendientes ?? 0)],
    ['Clientes', String(d.clientes ?? 0)],
    ['Proveedores', String(d.proveedores ?? 0)],
  ]
  return (
    <Alert color="green" title="Conectado">
      <Stack gap="xs">
        <Text size="sm">¿Son de {nombreEmpresa}? Míralo antes de activarla.</Text>
        <Table withRowBorders={false} verticalSpacing={2}>
          <Table.Tbody>
            {filas.map(([clave, valor]) => (
              <Table.Tr key={clave}>
                <Table.Td c="dimmed" w={240}>
                  {clave}
                </Table.Td>
                <Table.Td>{valor}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Stack>
    </Alert>
  )
}
