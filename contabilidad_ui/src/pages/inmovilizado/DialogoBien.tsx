import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { textoDeError } from '../../api/errores'
import {
  altaDeBien,
  editarBien,
  marcarRevisado,
  type ApuntePideFicha,
  type Bien,
} from '../../api/inmovilizado'
import { aCadenaApi } from '../../lib/dinero'
import { usePlanEnMemoria } from '../../components/PlanEnMemoria'
import { fechaParaApi } from '../../lib/fecha'
import DialogoCuentaAlVuelo from '../diario/DialogoCuentaAlVuelo'
import { importeTecleado } from '../diario/lineas'
import FormularioBien, {
  BIEN_EN_BLANCO,
  type CampoDeCuenta,
  type DatosBien,
} from './FormularioBien'
import { useTablaAmortizacion } from './useTablaAmortizacion'

interface Props {
  abierto: boolean
  /** Nulo para dar de alta; el bien, para corregirlo. */
  bien: Bien | null
  /**
   * El bien del que cuelga, cuando lo que se da de alta es una mejora. Se
   * amortiza aparte y sale de los libros el día que salga el bien.
   */
  mejoraDe: Bien | null
  /**
   * El apunte que pedía ficha, cuando el alta viene del repaso. Rellena lo que
   * se sabe y, al guardar, calla el aviso de ese apunte.
   */
  desdeApunte?: ApuntePideFicha | null
  ancho: number
  /** El del selector de la cabecera: es el plan en el que se da de alta. */
  ejercicio: number | null
  alCerrar: () => void
  /** Con el id del bien que se ha dado de alta o corregido. */
  alGuardado: (idBien: number) => void
}

/** Importe listo para la API: cadena con punto. Vacío se queda vacío. */
function importeParaApi(texto: string): string {
  return texto.trim() === '' ? '' : importeTecleado(texto).toString()
}

function datosDe(bien: Bien): DatosBien {
  return {
    descripcion: bien.descripcion,
    tipo: bien.tipo_ley ?? '',
    valor: bien.valor_adquisicion.toString(),
    porcentaje: String(bien.porcentaje_anual),
    fechaInicio: bien.fecha_inicio ? new Date(bien.fecha_inicio) : null,
    fechaCompra: bien.fecha_compra ? new Date(bien.fecha_compra) : null,
    valorResidual: bien.valor_residual.toString(),
    amortizadoInicial: bien.amortizado_inicial.isZero() ? '' : bien.amortizado_inicial.toString(),
    usado: bien.usado ?? false,
    anotaciones: bien.anotaciones ?? '',
    cuentaActivo: bien.cuenta_activo ?? '',
    cuentaAmortizacion: bien.cuenta_amortizacion ?? '',
    cuentaGasto: bien.cuenta_gasto ?? '',
  }
}

/**
 * Alta y corrección de un bien. Nivel `apuntes`. Es el mismo formulario: al
 * corregir llega relleno y, si el bien ya tiene meses dotados, con cuatro
 * campos bloqueados.
 *
 * El alta **no hace ningún asiento**: solo apunta el bien para que entre en las
 * dotaciones.
 */
export default function DialogoBien({
  abierto,
  bien,
  mejoraDe,
  ancho,
  ejercicio,
  desdeApunte,
  alCerrar,
  alGuardado,
}: Props) {
  const plan = usePlanEnMemoria()
  const tabla = useTablaAmortizacion(abierto)
  const [datos, setDatos] = useState<DatosBien>(
    bien
      ? datosDe(bien)
      : desdeApunte
        ? {
            ...BIEN_EN_BLANCO,
            // Lo que el apunte ya sabe. El porcentaje y la fecha de entrada en
            // uso los pone una persona: de un apunte no se deducen.
            descripcion: desdeApunte.concepto,
            valor: desdeApunte.importe.toString(),
            cuentaActivo: desdeApunte.cuenta,
          }
        : BIEN_EN_BLANCO,
  )
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [alta, setAlta] = useState<{ campo: CampoDeCuenta; codigo: string } | null>(null)

  // Con dotaciones hechas la API rechaza cuatro campos. `ultima_dotacion` viene
  // vacía mientras el bien no se haya amortizado ningún mes.
  const conAmortizaciones = bien !== null && bien.ultima_dotacion !== ''

  function cerrar() {
    setError(null)
    alCerrar()
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      const comunes = {
        descripcion: datos.descripcion.trim(),
        porcentaje_anual: importeParaApi(datos.porcentaje),
        fecha_compra: fechaParaApi(datos.fechaCompra),
        valor_residual: importeParaApi(datos.valorResidual),
        cuenta_gasto: datos.cuentaGasto.trim(),
        tipo_ley: datos.tipo,
        usado: datos.usado,
        anotaciones: datos.anotaciones.trim(),
      }

      let idGuardado = bien?.id ?? 0
      if (bien === null) {
        const { id } = await altaDeBien({
          ...comunes,
          valor_adquisicion: importeParaApi(datos.valor),
          fecha_inicio: fechaParaApi(datos.fechaInicio),
          cuenta_activo: datos.cuentaActivo.trim(),
          cuenta_amortizacion: datos.cuentaAmortizacion.trim(),
          ref_tipo: '',
          ref_id: 0,
          amortizado_inicial: importeParaApi(datos.amortizadoInicial) || '0',
          // Cero es un bien; con un id es una mejora de ese bien.
          id_bien_padre: mejoraDe?.id ?? 0,
        })
        idGuardado = id
        // El aviso de ese apunte deja de salir, y queda dicho en qué ficha
        // acabó. Sin esto volvería a preguntar cada vez.
        if (desdeApunte) {
          await marcarRevisado({
            pase: desdeApunte.pase,
            ref_tipo: desdeApunte.ref_tipo,
            ref_id: desdeApunte.ref_id,
            cuenta: desdeApunte.cuenta,
            importe: aCadenaApi(desdeApunte.importe),
            resultado: 'ficha',
            id_inmovilizado: id,
          })
        }
      } else {
        // Los cuatro campos bloqueados no se mandan: la API los rechazaría.
        await editarBien({
          id_inmovilizado: bien.id,
          ...comunes,
          ...(conAmortizaciones
            ? {}
            : {
                valor_adquisicion: importeParaApi(datos.valor),
                amortizado_inicial: importeParaApi(datos.amortizadoInicial) || '0',
                fecha_inicio: fechaParaApi(datos.fechaInicio),
                cuenta_activo: datos.cuentaActivo.trim(),
                cuenta_amortizacion: datos.cuentaAmortizacion.trim(),
              }),
        })
      }
      alGuardado(idGuardado)
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      opened={abierto}
      onClose={cerrar}
      title={
        mejoraDe !== null
          ? 'Añadir una mejora'
          : bien === null
            ? 'Nuevo bien de inmovilizado'
            : 'Corregir el bien'
      }
      size="lg"
      centered
    >
      <form onSubmit={enviar}>
        <Stack gap="md">
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}

          {mejoraDe !== null && (
            <Stack gap={4}>
              <Text fw={600}>{mejoraDe.descripcion}</Text>
              <Text size="sm">
                Una mejora se amortiza aparte, con su propio valor y su propio ritmo. Sale de los
                libros el día que salga el bien.
              </Text>
            </Stack>
          )}

          <FormularioBien
            datos={datos}
            alCambiar={setDatos}
            ancho={ancho}
            conAmortizaciones={conAmortizaciones}
            alCrearCuenta={(campo, codigo) => setAlta({ campo, codigo })}
            tabla={tabla}
            ejercicio={ejercicio}
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={cerrar}>
              Cancelar
            </Button>
            <Button type="submit" loading={guardando}>
              Guardar
            </Button>
          </Group>
        </Stack>
      </form>

      {/* Las tres cuentas de un bien son de apuntes, así que el alta al vuelo
          del diario vale tal cual: se crea sin perder lo ya tecleado. */}
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
