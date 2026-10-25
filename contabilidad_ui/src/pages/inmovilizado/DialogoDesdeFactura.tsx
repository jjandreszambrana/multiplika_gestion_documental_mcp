import { Alert, Button, Group, Modal, Radio, Stack, Text, Textarea } from '@mantine/core'
import { useState } from 'react'
import { textoDeError } from '../../api/errores'
import { fichaDesdeFactura, type Bien } from '../../api/inmovilizado'
import { usePlanEnMemoria } from '../../components/PlanEnMemoria'
import { fechaParaApi } from '../../lib/fecha'
import DialogoCuentaAlVuelo from '../diario/DialogoCuentaAlVuelo'
import { importeTecleado } from '../diario/lineas'
import SelectorDeBien from './SelectorDeBien'
import FormularioBien, {
  BIEN_EN_BLANCO,
  type CampoDeCuenta,
  type DatosBien,
} from './FormularioBien'
import { useTablaAmortizacion } from './useTablaAmortizacion'

/** Lo que la pantalla de recibidas sabe de la factura que trae el bien. */
export interface FacturaConBien {
  id_factura: number
  numero_factura: string
  proveedor: string
  importe: string
  /** La que dispara el aviso. La dice la API, no se deduce del código. */
  cuenta_de_inmovilizado: string
}

interface Props {
  /** Nula con el diálogo cerrado. */
  factura: FacturaConBien | null
  ancho: number
  ejercicio: number | null
  alCerrar: () => void
  alHecho: (mensaje: string) => void
}

type Respuesta = 'bien' | 'mejora' | 'no_es_bien'

function importeParaApi(texto: string): string {
  return texto.trim() === '' ? '' : importeTecleado(texto).toString()
}

/**
 * La ficha del bien que trae una factura de compra, y su asiento, de una vez.
 * Nivel `apuntes`.
 *
 * Es el camino que evita el olvido: hasta que existió, la ficha había que
 * acordarse de teclearla después, y el bien que no la tiene no se amortiza
 * nunca sin que nadie se entere.
 */
export default function DialogoDesdeFactura({
  factura,
  ancho,
  ejercicio,
  alCerrar,
  alHecho,
}: Props) {
  const plan = usePlanEnMemoria()
  const tabla = useTablaAmortizacion(factura !== null)
  const [respuesta, setRespuesta] = useState<Respuesta>('bien')
  const [datos, setDatos] = useState<DatosBien>(BIEN_EN_BLANCO)
  const [padre, setPadre] = useState<Bien | null>(null)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [alta, setAlta] = useState<{ campo: CampoDeCuenta; codigo: string } | null>(null)

  const creaFicha = respuesta !== 'no_es_bien'

  function cerrar() {
    setRespuesta('bien')
    setDatos(BIEN_EN_BLANCO)
    setPadre(null)
    setMotivo('')
    setError(null)
    alCerrar()
  }

  async function enviar() {
    if (factura === null) return
    setError(null)
    setGuardando(true)
    try {
      const salida = await fichaDesdeFactura({
        id_factura: factura.id_factura,
        respuesta,
        ...(creaFicha
          ? {
              descripcion: datos.descripcion.trim(),
              porcentaje_anual: importeParaApi(datos.porcentaje),
              fecha_inicio: fechaParaApi(datos.fechaInicio),
              // Vacío deja el de la factura, que es la base sin IVA.
              valor_adquisicion: importeParaApi(datos.valor),
              valor_residual: importeParaApi(datos.valorResidual),
              cuenta_activo: datos.cuentaActivo.trim(),
              cuenta_amortizacion: datos.cuentaAmortizacion.trim(),
              cuenta_gasto: datos.cuentaGasto.trim(),
              ...(respuesta === 'mejora' ? { id_bien_padre: padre?.id ?? 0 } : {}),
            }
          : { motivo: motivo.trim() }),
        contabilizar: true,
      })
      // El asiento puede no salir aunque la ficha sí: el motivo lo escribe la
      // API y se enseña tal cual, en vez de dar por hecho que fue todo bien.
      alHecho(
        salida.contabilizada
          ? `Factura ${salida.numero_factura} contabilizada en el asiento ${salida.asiento ?? ''}.`
          : salida.motivo,
      )
      cerrar()
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      opened={factura !== null}
      onClose={cerrar}
      title="Esta factura trae un bien de inmovilizado"
      size="lg"
      centered
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}

        {factura !== null && (
          <Stack gap={0}>
            <Text fw={600}>{factura.proveedor}</Text>
            <Text size="sm" c="dimmed">
              {`${factura.numero_factura} · ${factura.importe} · Cuenta ${factura.cuenta_de_inmovilizado}`}
            </Text>
          </Stack>
        )}

        <Radio.Group value={respuesta} onChange={(v) => setRespuesta(v as Respuesta)}>
          <Stack gap="xs">
            <Radio value="bien" label="Es un bien nuevo" />
            <Radio value="mejora" label="Es una mejora de otro bien" />
            <Radio value="no_es_bien" label="No es un bien" />
          </Stack>
        </Radio.Group>

        {respuesta === 'mejora' && <SelectorDeBien valor={padre} alElegir={setPadre} />}

        {creaFicha && (
          <>
            <FormularioBien
              datos={datos}
              alCambiar={setDatos}
              ancho={ancho}
              conAmortizaciones={false}
              alCrearCuenta={(campo, codigo) => setAlta({ campo, codigo })}
              tabla={tabla}
              ejercicio={ejercicio}
            />
            <Text size="xs" c="dimmed">
              El valor sale de la base de la factura, sin IVA.
            </Text>
          </>
        )}

        {!creaFicha && (
          <Stack gap={4}>
            <Textarea
              label="Por qué no es un bien"
              value={motivo}
              onChange={(e) => setMotivo(e.currentTarget.value)}
              autosize
              minRows={2}
            />
            <Text size="xs" c="dimmed">
              No se volverá a preguntar por esta factura.
            </Text>
          </Stack>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            loading={guardando}
            disabled={respuesta === 'mejora' && padre === null}
            onClick={() => void enviar()}
          >
            Guardar y contabilizar
          </Button>
        </Group>
      </Stack>

      <DialogoCuentaAlVuelo
        codigo={alta?.codigo ?? null}
        ejercicio={ejercicio}
        alCerrar={() => setAlta(null)}
        alCreada={(cuenta) => {
          if (alta !== null) setDatos((previos) => ({ ...previos, [alta.campo]: cuenta.codigo }))
          setAlta(null)
          plan.refrescar()
        }}
      />
    </Modal>
  )
}
