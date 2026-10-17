import {
  Alert,
  Button,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  SimpleGrid,
  Stack,
  TextInput,
} from '@mantine/core'
import { useState, type FormEvent } from 'react'
import type { DatosLineaB, LineaDiarioB } from '../../api/diarioB'
import { textoDeError } from '../../api/errores'
import { CasillaFecha } from '../../components/CasillaFecha'
import { expandirCuenta } from '../../lib/cuenta'
import { aCadenaApi, soloImporte } from '../../lib/dinero'
import { fechaDeApi, fechaParaApi } from '../../lib/fecha'
import { importeTecleado } from '../diario/lineas'

interface Props {
  /** Nula para dar de alta una nueva. */
  linea: LineaDiarioB | null
  /** Ejercicio con el que nace una línea nueva. */
  ejercicio: number | null
  ancho: number
  alCerrar: () => void
  /** Al editar, recibe solo lo que ha cambiado. */
  alGuardar: (datos: DatosLineaB) => Promise<void>
}

/** El importe como se enseña en la casilla: con coma y sin ceros de relleno si es cero. */
function importeEnCasilla(linea: LineaDiarioB | null, campo: 'debe' | 'haber'): string {
  if (!linea || linea[campo].isZero()) return ''
  return linea[campo].toFixed(2).replace('.', ',')
}

/**
 * Alta y edición de una línea del diario B. Es mantenimiento directo de la
 * tabla: no mueve saldos ni comprueba que el asiento cuadre, y se dice.
 * El `pase` lo pone el programa.
 */
export default function DialogoLineaB({ linea, ejercicio, ancho, alCerrar, alGuardar }: Props) {
  const [anio, setAnio] = useState<number | string>(linea?.ejercicio ?? ejercicio ?? '')
  const [asiento, setAsiento] = useState<number | string>(linea?.asiento ?? '')
  const [fecha, setFecha] = useState(linea?.fecha ?? '')
  const [cuenta, setCuenta] = useState(linea?.cuenta ?? '')
  const [concepto, setConcepto] = useState(linea?.concepto ?? '')
  const [documento, setDocumento] = useState(linea?.documento ?? '')
  const [debe, setDebe] = useState(importeEnCasilla(linea, 'debe'))
  const [haber, setHaber] = useState(importeEnCasilla(linea, 'haber'))
  const [diario, setDiario] = useState(linea?.diario ?? '')
  const [enLibro, setEnLibro] = useState(linea ? linea.contabilizado === 1 : true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  function datos(): DatosLineaB {
    return {
      ...(anio !== '' && { ejercicio: Number(anio) }),
      ...(asiento !== '' && { asiento: Number(asiento) }),
      ...(fecha !== '' && { fecha }),
      cuenta: cuenta.trim(),
      debe: aCadenaApi(importeTecleado(debe)),
      haber: aCadenaApi(importeTecleado(haber)),
      concepto: concepto.trim(),
      documento: documento.trim(),
      diario: diario.trim(),
      contabilizado: enLibro ? 1 : 0,
    }
  }

  /** Al editar, solo lo que cambia respecto a la línea guardada. */
  function cambios(original: LineaDiarioB): DatosLineaB {
    const antes: DatosLineaB = {
      ejercicio: original.ejercicio,
      asiento: original.asiento,
      fecha: original.fecha ?? undefined,
      cuenta: original.cuenta,
      debe: aCadenaApi(original.debe),
      haber: aCadenaApi(original.haber),
      concepto: original.concepto ?? '',
      documento: original.documento ?? '',
      diario: original.diario ?? '',
      contabilizado: original.contabilizado,
    }
    const ahora = datos()
    return Object.fromEntries(
      Object.entries(ahora).filter(([campo, valor]) => antes[campo as keyof DatosLineaB] !== valor),
    ) as DatosLineaB
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      await alGuardar(linea ? cambios(linea) : datos())
    } catch (fallo) {
      setError(textoDeError(fallo))
      setGuardando(false)
    }
  }

  return (
    <Modal
      opened
      onClose={alCerrar}
      title={linea ? 'Cambiar la línea' : 'Nueva línea del diario B'}
      size="lg"
      centered
    >
      <form onSubmit={(e) => void enviar(e)}>
        <Stack gap="md">
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}

          <Alert color="gray">Esta línea no mueve saldos ni comprueba que el asiento cuadre.</Alert>

          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <NumberInput
              label="Ejercicio"
              value={anio}
              onChange={setAnio}
              allowDecimal={false}
              allowNegative={false}
              data-autofocus
            />
            <NumberInput
              label="Asiento"
              value={asiento}
              onChange={setAsiento}
              allowDecimal={false}
              allowNegative={false}
            />
            <CasillaFecha
              label="Fecha"
              value={fechaDeApi(fecha)}
              onChange={(valor) => setFecha(fechaParaApi(valor))}
              clearable
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="Cuenta"
              value={cuenta}
              onChange={(e) => setCuenta(e.currentTarget.value)}
              onBlur={() => setCuenta((c) => expandirCuenta(c, ancho))}
              ff="monospace"
            />
            <TextInput
              label="Documento"
              value={documento}
              onChange={(e) => setDocumento(e.currentTarget.value)}
            />
          </SimpleGrid>

          <TextInput
            label="Concepto"
            value={concepto}
            onChange={(e) => setConcepto(e.currentTarget.value)}
          />

          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <TextInput
              label="Debe"
              value={debe}
              onChange={(e) => setDebe(soloImporte(e.currentTarget.value))}
              inputMode="decimal"
              styles={{ input: { textAlign: 'right' } }}
            />
            <TextInput
              label="Haber"
              value={haber}
              onChange={(e) => setHaber(soloImporte(e.currentTarget.value))}
              inputMode="decimal"
              styles={{ input: { textAlign: 'right' } }}
            />
            <TextInput
              label="Diario"
              value={diario}
              onChange={(e) => setDiario(e.currentTarget.value)}
              maxLength={30}
            />
          </SimpleGrid>

          <Checkbox
            label="En el libro (si no, queda como borrador)"
            checked={enLibro}
            onChange={(e) => setEnLibro(e.currentTarget.checked)}
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={alCerrar}>
              Cancelar
            </Button>
            <Button type="submit" loading={guardando}>
              Guardar
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
