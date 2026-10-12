import { Alert, Button, Checkbox, Group, List, Modal, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { leerCodiplika, type Incidencia, type ResultadoLeerErp } from '../../api/bandeja'
import { textoDeError } from '../../api/errores'
import { CasillaFecha } from '../../components/CasillaFecha'
import { fechaParaApi } from '../../lib/fecha'
import { formatearEntero } from '../../lib/format'

interface Props {
  abierto: boolean
  ejercicio: number
  alCerrar: () => void
  /** Tras traer de verdad: las listas tienen que volver a leerse. */
  alTraido: () => void
}

/** Del 1 de enero del ejercicio a hoy, o al 31 de diciembre si ya pasó. */
function fechasPorDefecto(ejercicio: number): [Date, Date] {
  const hoy = new Date()
  const fin = new Date(ejercicio, 11, 31)
  return [new Date(ejercicio, 0, 1), hoy < fin ? hoy : fin]
}

/** Cuántas facturas, cobros y pagos vienen, contados en los documentos leídos. */
function recuento(resultado: ResultadoLeerErp): string {
  const facturas = resultado.documentos.filter((d) => d.tipo === 'facturas').length
  const movimientos = resultado.documentos.length - facturas
  return `${formatearEntero(facturas)} facturas y ${formatearEntero(movimientos)} cobros y pagos`
}

function Incidencias({ incidencias }: { incidencias: Incidencia[] }) {
  if (incidencias.length === 0) return null
  return (
    <Alert color="orange" title="No se pueden traer porque les falta información">
      <List size="sm">
        {incidencias.map((incidencia) => (
          <List.Item key={`${incidencia.tipo}.${incidencia.id_origen}`}>
            {incidencia.tipo === 'facturas' ? 'Factura' : 'Cobro o pago'} {incidencia.id_origen}:{' '}
            {incidencia.faltas.join(', ')}
          </List.Item>
        ))}
      </List>
    </Alert>
  )
}

/** Lo que se sabe de una lectura, de ensayo o de verdad. */
function Resumen({ resultado }: { resultado: ResultadoLeerErp }) {
  const ensayo = resultado.ensayo
  return (
    <Stack gap="sm">
      <Text size="sm">
        {ensayo ? 'Se traerían ' : 'Se han traído '}
        {recuento(resultado)}: {formatearEntero(resultado.nuevas)} nuevos,{' '}
        {formatearEntero(resultado.actualizadas)} con cambios y{' '}
        {formatearEntero(resultado.sin_cambios)} que ya estaban igual.
      </Text>
      {resultado.duplicadas > 0 && (
        <Text size="sm">
          {formatearEntero(resultado.duplicadas)} ya están en la facturación: cuenta la de allí.
        </Text>
      )}
      {resultado.en_conflicto > 0 && (
        <Text size="sm">
          {formatearEntero(resultado.en_conflicto)} no coinciden con la facturación: habrá que elegir
          cuál vale.
        </Text>
      )}
      {resultado.cambiadas_contabilizadas > 0 && (
        <Text size="sm">
          {formatearEntero(resultado.cambiadas_contabilizadas)} han cambiado en Codiplika después de
          contabilizarlas: su asiento no se toca.
        </Text>
      )}
      {!ensayo && (
      <Text size="sm" c="dimmed">
        {resultado.marcados > 0
            ? `Se han marcado ${formatearEntero(resultado.marcados)} en Codiplika (exportación ${resultado.referencia_origen}).`
            : 'No se ha marcado nada en Codiplika.'}
      </Text>
      )}
      <Incidencias incidencias={resultado.incidencias} />
      {resultado.avisos.length > 0 && (
        <Alert color="yellow" title="Para revisar">
          <List size="sm">
            {resultado.avisos.map((aviso, posicion) => (
              <List.Item key={posicion}>{aviso}</List.Item>
            ))}
          </List>
        </Alert>
      )}
    </Stack>
  )
}

/**
 * Traer de Codiplika lo pendiente entre dos fechas. Primero se mira qué
 * vendría sin guardar nada; traer de verdad es un segundo paso a propósito,
 * porque además lo marca en Codiplika.
 */
export default function DialogoTraerCodiplika({ abierto, ejercicio, alCerrar, alTraido }: Props) {
  const [desde, setDesde] = useState<Date | null>(() => fechasPorDefecto(ejercicio)[0])
  const [hasta, setHasta] = useState<Date | null>(() => fechasPorDefecto(ejercicio)[1])
  const [resultado, setResultado] = useState<ResultadoLeerErp | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  // Se decide cada vez; de entrada, lo que diga la conexión.
  const [marcar, setMarcar] = useState(true)

  async function leer(ensayo: boolean) {
    if (!desde || !hasta) return
    setError(null)
    setTrabajando(true)
    try {
      const leido = await leerCodiplika(
        fechaParaApi(desde),
        fechaParaApi(hasta),
        ensayo,
        ensayo ? undefined : marcar,
      )
      if (ensayo) setMarcar(leido.marca_autorizada)
      setResultado(leido)
      if (!ensayo) alTraido()
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setTrabajando(false)
    }
  }

  const traido = resultado !== null && !resultado.ensayo
  const fechasMal = !desde || !hasta || desde > hasta

  return (
    <Modal
      opened={abierto}
      onClose={alCerrar}
      title="Traer de Codiplika"
      size="lg"
      centered
      // Al volver a abrirlo se empieza de cero.
      onExitTransitionEnd={() => {
        setResultado(null)
        setError(null)
      }}
    >
      <Stack gap="md">
        <Group grow>
          <CasillaFecha
            label="Desde"
            value={desde}
            onChange={(valor) => {
              setDesde(valor)
              setResultado(null)
            }}
            disabled={traido}
          />
          <CasillaFecha
            label="Hasta"
            value={hasta}
            onChange={(valor) => {
              setHasta(valor)
              setResultado(null)
            }}
            disabled={traido}
          />
        </Group>

        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}

        {resultado && <Resumen resultado={resultado} />}

        {resultado && !traido && (
          <Checkbox
            label="Marcar en Codiplika lo que se traiga, para que no vuelva a salir"
            description="Si no lo marcas, seguirá saliendo en Codiplika como pendiente de pasar a contabilidad."
            checked={marcar}
            onChange={(e) => setMarcar(e.currentTarget.checked)}
          />
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>
            {traido ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!traido &&
            (resultado ? (
              <Button
                onClick={() => void leer(false)}
                loading={trabajando}
                disabled={resultado.documentos.length === 0}
              >
                Traer
              </Button>
            ) : (
              <Button onClick={() => void leer(true)} loading={trabajando} disabled={fechasMal}>
                Ver qué traería
              </Button>
            ))}
        </Group>
      </Stack>
    </Modal>
  )
}
