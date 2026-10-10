import { Alert, Button, FileInput, Group, Select, Stack, Text, Title } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import { textoDeError } from '../../api/errores'
import {
  ensayar,
  importar,
  listarModelos,
  subirArchivo,
  type Destino,
  type Modelo,
  type RespuestaEjecutar,
} from '../../api/importador'
import { alcanza } from '../../api/sesion'
import { avisoDeEjercicio } from './ejercicios'
import InformeImportacion from './InformeImportacion'
import ModelosDeImportacion from './ModelosDeImportacion'

interface Props {
  /** El de la cabecera. Solo para avisar si el archivo no es de ese año. */
  ejercicio: number | null
  nivel: string
}

/**
 * Elegir modelo, elegir archivo y adelante. El modelo trae qué es cada columna
 * y cómo se lee el archivo, así que aquí no se empareja nada.
 *
 * El ejercicio no se manda: cada asiento va al que contenga su fecha. Forzarlo
 * con el del selector metía apuntes de 2025 en 2026 sin decir nada.
 *
 * La comprobación se hace sola al cargar el archivo y no se puede saltar: es lo
 * que evita meter mil apuntes mal de una vez.
 */
export default function PantallaImportador({ ejercicio, nivel }: Props) {
  const [modelos, setModelos] = useState<Modelo[] | null>(null)
  const [idModelo, setIdModelo] = useState<string | null>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [informe, setInforme] = useState<RespuestaEjecutar | null>(null)
  const [idImportacion, setIdImportacion] = useState<number | null>(null)
  const [avisos, setAvisos] = useState<string[]>([])
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viendoModelos, setViendoModelos] = useState(false)

  const cargarModelos = useCallback(() => {
    listarModelos()
      .then(setModelos)
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
  }, [])

  useEffect(cargarModelos, [cargarModelos])

  const modelo = (modelos ?? []).find((uno) => String(uno.id) === idModelo) ?? null
  const destino = (modelo?.destino ?? 'plan') as Destino
  // El plan lo tocan solo los de nivel `cierre`; los otros dos, quien pueda
  // apuntar. Se esconde el botón, no se deja fallar con un 403.
  const puede = modelo === null || alcanza(nivel, destino === 'plan' ? 'cierre' : 'apuntes')
  const importado = informe !== null && !informe.ensayo
  // Del ensayo, que ya dice a qué ejercicio iría cada asiento. Solo avisa.
  const avisoEjercicio =
    informe === null ? null : avisoDeEjercicio(informe.asientos ?? [], ejercicio)

  function empezarDeCero(cambio: () => void) {
    cambio()
    setInforme(null)
    setIdImportacion(null)
    setAvisos([])
    setError(null)
  }

  async function comprobar() {
    if (archivo === null || modelo === null) return
    setError(null)
    setTrabajando(true)
    try {
      const leida = await subirArchivo(archivo, destino, modelo.id)
      setIdImportacion(leida.id_importacion)
      setAvisos(leida.avisos ?? [])
      setInforme(await ensayar({ idImportacion: leida.id_importacion, ejercicio: null }))
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setTrabajando(false)
    }
  }

  async function meterDeVerdad() {
    if (idImportacion === null) return
    setError(null)
    setTrabajando(true)
    try {
      setInforme(await importar({ idImportacion, ejercicio: null }))
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>Importar datos</Title>
        <Button variant="default" onClick={() => setViendoModelos(true)}>
          Modelos de importación…
        </Button>
      </Group>

      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}

      {modelos?.length === 0 && (
        <Alert color="yellow">Todavía no hay ningún modelo. Crea uno para poder importar.</Alert>
      )}

      {!puede && (
        <Alert color="yellow">
          Para traer cuentas del plan hace falta un permiso que esta cuenta de usuario no tiene.
        </Alert>
      )}

      <Group align="flex-end" gap="md">
        <Select
          label="Modelo"
          description="Se definen en «Modelos de importación»"
          data={(modelos ?? []).map((uno) => ({ value: String(uno.id), label: uno.nombre }))}
          value={idModelo}
          onChange={(valor) => empezarDeCero(() => setIdModelo(valor))}
          placeholder="Ninguno elegido"
          w={280}
        />
        <FileInput
          label="Archivo"
          description="CSV o Excel (.xlsx), hasta 20 MB"
          placeholder="Ninguno elegido"
          accept=".csv,.xlsx,text/csv"
          value={archivo}
          onChange={(valor) => empezarDeCero(() => setArchivo(valor))}
          clearable
          w={320}
        />
        <Button
          variant="default"
          onClick={comprobar}
          disabled={archivo === null || modelo === null || !puede || importado}
          loading={trabajando}
        >
          Comprobar el archivo
        </Button>
        <Button
          onClick={meterDeVerdad}
          disabled={informe === null || importado}
          loading={trabajando}
        >
          Importar
        </Button>
      </Group>

      {avisos.map((aviso) => (
        <Alert key={aviso} color="yellow">
          {aviso}
        </Alert>
      ))}

      {avisoEjercicio !== null && (
        <Alert color="yellow" title="Comprueba el ejercicio">
          {avisoEjercicio}
        </Alert>
      )}

      {importado && <Text fw={500}>Importado.</Text>}

      {informe !== null && <InformeImportacion informe={informe} />}

      <ModelosDeImportacion
        abierto={viendoModelos}
        alCerrar={() => {
          setViendoModelos(false)
          cargarModelos()
        }}
      />
    </Stack>
  )
}
