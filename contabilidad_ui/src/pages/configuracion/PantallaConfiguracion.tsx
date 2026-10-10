import {
  Alert,
  Button,
  Group,
  Loader,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useEffect, useState } from 'react'
import {
  fijarAjustes,
  listarCamposDeCuentas,
  type CambiosConfiguracion,
  type CampoDeCuenta,
  type Configuracion,
  type ModoCuenta,
} from '../../api/configuracion'
import { textoDeError } from '../../api/errores'
import { formatearEntero, formatearFecha } from '../../lib/format'
import CuentasPorDefecto from './CuentasPorDefecto'
import DatosFijos from './DatosFijos'
import { valoresDe } from './valores'

interface Props {
  configuracion: Configuracion
  /** El ejercicio elegido, para dar de alta una cuenta que falte. */
  ejercicio: number | null
  /** Rehace la copia que vive en el armazón con lo que devuelve el guardado. */
  alGuardada: (nueva: Configuracion) => void
}

const MODOS = [
  { value: 'correlativo', label: 'Correlativa' },
  { value: 'codigo', label: 'Por el código de la ficha' },
  { value: 'manual', label: 'Manual' },
]

const AYUDA_MODO = 'Cómo se compone el número de una subcuenta nueva.'

/**
 * Ajustes de la contabilidad de la empresa. Nivel `cierre`.
 *
 * Las quince cuentas por defecto no están todavía: la API manda su título solo
 * cuando la cuenta está vacía, y escribirlos aquí sería mantener un diccionario
 * que se queda viejo en cuanto el backend añada una cuenta. Pedido en [1.6].
 */
export default function PantallaConfiguracion({ configuracion, ejercicio, alGuardada }: Props) {
  const [diario, setDiario] = useState(configuracion.diario_defecto)
  const [cliente, setCliente] = useState(configuracion.modo_cuenta_cliente)
  const [proveedor, setProveedor] = useState(configuracion.modo_cuenta_proveedor)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  const [campos, setCampos] = useState<CampoDeCuenta[] | null>(null)
  const [errorCampos, setErrorCampos] = useState<string | null>(null)
  const [cuentas, setCuentas] = useState(() => valoresDe(configuracion.cuentas))

  // Los rótulos de las cuentas no cambian por empresa: se piden una vez.
  useEffect(() => {
    listarCamposDeCuentas()
      .then(setCampos)
      .catch((fallo: unknown) => setErrorCampos(textoDeError(fallo)))
  }, [])

  const guardadas = valoresDe(configuracion.cuentas)
  const cuentasCambiadas = Object.keys(cuentas).filter(
    (campo) => cuentas[campo] !== guardadas[campo],
  )

  const cambiado =
    diario !== configuracion.diario_defecto ||
    cliente !== configuracion.modo_cuenta_cliente ||
    proveedor !== configuracion.modo_cuenta_proveedor ||
    cuentasCambiadas.length > 0

  const porCodigo = cliente === 'codigo' || proveedor === 'codigo'

  async function guardar() {
    setError(null)
    setGuardado(false)
    setGuardando(true)
    try {
      // Solo lo que cambia: lo que no viaja se queda como está.
      const cambios: CambiosConfiguracion = {
        ...(diario === configuracion.diario_defecto ? {} : { diario_defecto: diario }),
        ...(cliente === configuracion.modo_cuenta_cliente
          ? {}
          : { modo_cuenta_cliente: cliente as ModoCuenta }),
        ...(proveedor === configuracion.modo_cuenta_proveedor
          ? {}
          : { modo_cuenta_proveedor: proveedor as ModoCuenta }),
        ...Object.fromEntries(cuentasCambiadas.map((campo) => [campo, cuentas[campo]])),
      }
      const nueva = await fijarAjustes(cambios)
      setCuentas(valoresDe(nueva.cuentas))
      alGuardada(nueva)
      setGuardado(true)
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Stack gap="md">
      <Title order={3}>Configuración</Title>

      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}

      {guardado && (
        <Alert color="green" p="xs" withCloseButton onClose={() => setGuardado(false)}>
          <Text size="sm">Configuración guardada.</Text>
        </Alert>
      )}

      <Paper withBorder p="md">
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="md" verticalSpacing="sm">
            <Select
              label="Diario por defecto"
              description="El libro donde se anotan los asientos si no se elige otro."
              data={(configuracion.diarios ?? []).map((uno) => ({
                value: uno.codigo,
                label: `${uno.codigo} · ${uno.descripcion}`,
              }))}
              value={diario}
              onChange={(valor) => valor && setDiario(valor)}
              allowDeselect={false}
            />
            <Select
              label="Numeración de las cuentas de clientes"
              description={AYUDA_MODO}
              data={MODOS}
              value={cliente}
              onChange={(valor) => valor && setCliente(valor)}
              allowDeselect={false}
            />
            <Select
              label="Numeración de las cuentas de proveedores"
              description={AYUDA_MODO}
              data={MODOS}
              value={proveedor}
              onChange={(valor) => valor && setProveedor(valor)}
              allowDeselect={false}
            />
          </SimpleGrid>

          {porCodigo && (
            <Alert color="yellow">
              Si una ficha no tiene código, el traspaso se detiene y lo indica, en lugar de componer
              un número inventado.
            </Alert>
          )}

          <Group>
            <Button onClick={guardar} disabled={!cambiado} loading={guardando}>
              Guardar
            </Button>
          </Group>
        </Stack>
      </Paper>

      {errorCampos !== null ? (
        <Alert color="red" role="alert">
          {errorCampos}
        </Alert>
      ) : campos === null ? (
        <Loader size="sm" />
      ) : (
        <CuentasPorDefecto
          campos={campos}
          valores={cuentas}
          ancho={configuracion.anchocuentas}
          ejercicio={ejercicio}
          alCambiar={(campo, valor) => setCuentas((antes) => ({ ...antes, [campo]: valor }))}
        />
      )}

      <DatosFijos
        plan={configuracion.tipo_pgc}
        ancho={configuracion.anchocuentas}
        ejerciciosAbiertos={formatearEntero(configuracion.ejercicios_abiertos)}
        proximoPase={formatearEntero(configuracion.prox_pase)}
        proximoDocumento={formatearEntero(configuracion.prox_documento)}
        activaDesde={formatearFecha(configuracion.fecha_alta)}
      />
    </Stack>
  )
}
