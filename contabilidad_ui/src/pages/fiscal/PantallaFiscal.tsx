import { Alert, Button, Group, Loader, Modal, Select, Stack, Tabs, Text, Title } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import { esAbortada } from '../../api/cliente'
import { ErrorApi } from '../../api/errores'
import { textoDeError } from '../../api/errores'
import {
  cuadreDeIva,
  modelo303EnExcel,
  textoDelRegistro303,
  resumenDeIva,
  retencionesDelPeriodo,
  type CuadreIva,
  type FiltroFiscal,
  type Periodo,
  type Retenciones,
  type ResumenIva,
} from '../../api/fiscal'
import { guardarFichero, nombreDeFichero } from '../../lib/descarga'
import { guardarPreferencia, leerPreferencia } from '../../lib/preferencias'
import { PERIODO_POR_DEFECTO, PERIODOS } from './periodos'
import VistaCuadre from './VistaCuadre'
import VistaIva from './VistaIva'
import VistaRetenciones from './VistaRetenciones'

interface Props {
  ejercicio: number | null
  usuario: string
}

const PREFERENCIA = 'fiscal.periodo'

/**
 * Los tres resúmenes fiscales del periodo, uno por pestaña.
 *
 * Van juntos porque comparten filtro exacto —ejercicio y periodo—: se pone una
 * vez y sirve para los tres, igual que en Estados contables.
 *
 * **El modelo 303 no está aquí a propósito.** Es un documento guardado, con su
 * fecha y su estado, y sus cifras no se recalculan; ponerlo bajo el mismo
 * filtro que tres consultas vivas invitaría a compararlos como si tuvieran que
 * coincidir.
 *
 * Las tres salen a la vez: cambiar de pestaña no puede quedarse esperando a una
 * llamada que no se lanzó. Cada una guarda su error por separado, para que un
 * fallo de una no borre las otras dos.
 */
export default function PantallaFiscal({ ejercicio, usuario }: Props) {
  const guardado = leerPreferencia<Periodo>(usuario, PREFERENCIA)

  const [periodo, setPeriodo] = useState<Periodo>(guardado ?? PERIODO_POR_DEFECTO)
  const [consulta, setConsulta] = useState<FiltroFiscal | null>(null)
  const [iva, setIva] = useState<ResumenIva | null>(null)
  const [retenciones, setRetenciones] = useState<Retenciones | null>(null)
  const [cuadre, setCuadre] = useState<CuadreIva | null>(null)
  const [errorIva, setErrorIva] = useState<string | null>(null)
  const [errorRetenciones, setErrorRetenciones] = useState<string | null>(null)
  const [errorCuadre, setErrorCuadre] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [bajando, setBajando] = useState(false)
  const [errorExcel, setErrorExcel] = useState<string | null>(null)
  const [avisoExcel, setAvisoExcel] = useState<string | null>(null)
  const [preguntarRegistro, setPreguntarRegistro] = useState(false)

  const cargar = useCallback(
    async (senal: AbortSignal) => {
      if (consulta === null) return
      setCargando(true)

      // Cada una por su lado: si el cuadre falla, el IVA se sigue viendo.
      const traer = async <T,>(
        pedir: () => Promise<T>,
        guardar: (valor: T | null) => void,
        avisar: (texto: string | null) => void,
      ) => {
        avisar(null)
        try {
          guardar(await pedir())
        } catch (fallo) {
          if (esAbortada(fallo)) return
          guardar(null)
          avisar(textoDeError(fallo))
        }
      }

      await Promise.all([
        traer(() => resumenDeIva(consulta, senal), setIva, setErrorIva),
        traer(() => retencionesDelPeriodo(consulta, senal), setRetenciones, setErrorRetenciones),
        traer(() => cuadreDeIva(consulta, senal), setCuadre, setErrorCuadre),
      ])

      setCargando(false)
    },
    [consulta],
  )

  useEffect(() => {
    const corte = new AbortController()
    void cargar(corte.signal)
    return () => corte.abort()
  }, [cargar])

  function ver() {
    if (ejercicio === null) return
    guardarPreferencia(usuario, PREFERENCIA, periodo)
    setConsulta({ ejercicio, periodo })
  }

  async function bajarExcel(registrar?: boolean) {
    if (consulta === null) return
    setPreguntarRegistro(false)
    setErrorExcel(null)
    setAvisoExcel(null)
    setBajando(true)
    try {
      const fichero = await modelo303EnExcel(consulta, registrar)
      guardarFichero(
        fichero,
        nombreDeFichero(`modelo_303_${consulta.ejercicio}_${consulta.periodo}`, 'xlsx'),
      )
      setAvisoExcel(textoDelRegistro303(fichero))
    } catch (fallo) {
      // 409: el periodo no está registrado y hay que preguntar antes de bajarlo.
      if (fallo instanceof ErrorApi && fallo.estado === 409) setPreguntarRegistro(true)
      else setErrorExcel(textoDeError(fallo))
    } finally {
      setBajando(false)
    }
  }

  return (
    <Stack gap="md">
      <Title order={3}>IVA y retenciones</Title>

      <Group align="flex-end" gap="md" wrap="wrap">
        <Select
          label="Periodo"
          data={PERIODOS}
          value={periodo}
          onChange={(valor) => setPeriodo(valor ?? PERIODO_POR_DEFECTO)}
          allowDeselect={false}
          w={230}
        />
        <Button onClick={ver} disabled={ejercicio === null}>
          Ver
        </Button>
        {consulta !== null && (
          <Button variant="default" onClick={() => void bajarExcel()} loading={bajando}>
            Descargar Excel del 303
          </Button>
        )}
        {cargando && <Loader size="xs" mb={12} />}
      </Group>

      <Modal
        opened={preguntarRegistro}
        onClose={() => setPreguntarRegistro(false)}
        title="¿Registrar la declaración de este periodo?"
      >
        <Stack gap="md">
          <Text size="sm">
            Si la registras, queda guardado lo que mandas a la gestoría. Si cambia algo más
            adelante, se actualizará sola al volver a bajarla.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => void bajarExcel(false)}>
              No, solo bajarla
            </Button>
            <Button onClick={() => void bajarExcel(true)}>Sí, registrar</Button>
          </Group>
        </Stack>
      </Modal>

      {avisoExcel !== null && (
        <Alert color="blue" withCloseButton onClose={() => setAvisoExcel(null)}>
          {avisoExcel}
        </Alert>
      )}

      {errorExcel !== null && (
        <Alert color="red" role="alert" title="No se pudo bajar el Excel del 303">
          {errorExcel}
        </Alert>
      )}

      {consulta === null && (
        <Text size="sm" c="dimmed">
          Elige el periodo y pulsa Ver.
        </Text>
      )}

      {consulta !== null && (
        <Tabs defaultValue="iva" keepMounted={false} variant="outline" radius="sm">
          <Tabs.List>
            <Tabs.Tab value="iva" fw={600} fz="sm" px="lg">
              IVA del periodo
            </Tabs.Tab>
            <Tabs.Tab value="retenciones" fw={600} fz="sm" px="lg">
              Retenciones
            </Tabs.Tab>
            <Tabs.Tab value="cuadre" fw={600} fz="sm" px="lg">
              Cuadre con facturación
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="iva" pt="md">
            {errorIva !== null ? (
              <Alert color="red" role="alert" title="No se pudo cargar el IVA del periodo">
                {errorIva}
              </Alert>
            ) : (
              iva !== null && <VistaIva iva={iva} />
            )}
          </Tabs.Panel>

          <Tabs.Panel value="retenciones" pt="md">
            {errorRetenciones !== null ? (
              <Alert color="red" role="alert" title="No se pudieron cargar las retenciones">
                {errorRetenciones}
              </Alert>
            ) : (
              retenciones !== null && <VistaRetenciones retenciones={retenciones} />
            )}
          </Tabs.Panel>

          <Tabs.Panel value="cuadre" pt="md">
            {errorCuadre !== null ? (
              <Alert color="red" role="alert" title="No se pudo cargar el cuadre">
                {errorCuadre}
              </Alert>
            ) : (
              cuadre !== null && <VistaCuadre cuadre={cuadre} />
            )}
          </Tabs.Panel>
        </Tabs>
      )}
    </Stack>
  )
}
