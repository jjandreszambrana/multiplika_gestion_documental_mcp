import { Alert, Button, Checkbox, Group, Modal, Stack, Text } from '@mantine/core'
import { useEffect, useState, type FormEvent } from 'react'
import { textoDeError } from '../../api/errores'
import {
  fijarCuentasDeFicha,
  sugerirCuentasDeFicha,
  type CampoDeCuenta,
  type CuentaSugerida,
  type Ficha,
} from '../../api/maestros'
import { expandirCuenta } from '../../lib/cuenta'
import CasillaDeCuenta from './CasillaDeCuenta'

interface Props {
  /** Identificador del maestro al que pertenece la ficha, el que espera la API. */
  idMaestro: string
  campos: CampoDeCuenta[]
  ficha: Ficha | null
  ancho: number
  alCerrar: () => void
  /** `enlazadas` son las cuentas que además han quedado asignadas al tercero. */
  alGuardada: (ficha: Ficha, enlazadas: string[]) => void
}

/** Las cuentas de una ficha concreta: un proveedor, una serie, un tipo de IVA. */
export default function DialogoCuentasDeFicha({
  idMaestro,
  campos,
  ficha,
  ancho,
  alCerrar,
  alGuardada,
}: Props) {
  const [valores, setValores] = useState<Record<string, string>>({})
  const [sugeridas, setSugeridas] = useState<Record<string, CuentaSugerida>>({})
  const [errorSugerir, setErrorSugerir] = useState<string | null>(null)
  const [crearEnPlan, setCrearEnPlan] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (ficha === null) return
    const inicial: Record<string, string> = {}
    for (const cuenta of ficha.cuentas ?? []) inicial[cuenta.campo] = cuenta.valor
    setValores(inicial)
    setSugeridas({})
    setError(null)
    setErrorSugerir(null)

    let vigente = true
    sugerirCuentasDeFicha(idMaestro, ficha.id_ficha)
      .then((respuesta) => {
        if (!vigente) return
        const propuestas = respuesta.sugerencias ?? []
        setSugeridas(Object.fromEntries(propuestas.map((s) => [s.campo, s])))
        // Solo se rellena lo que está en blanco: la cuenta que la ficha ya
        // tiene la puso alguien y no se pisa con una propuesta.
        setValores((antes) => {
          const con = { ...antes }
          for (const s of propuestas) {
            if (s.sugerencia !== '' && (con[s.campo] ?? '') === '') con[s.campo] = s.sugerencia
          }
          return con
        })
      })
      .catch((fallo: unknown) => vigente && setErrorSugerir(textoDeError(fallo)))

    return () => {
      vigente = false
    }
  }, [ficha, idMaestro])

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (ficha === null) return
    setError(null)
    setGuardando(true)
    try {
      const respuesta = await fijarCuentasDeFicha(idMaestro, ficha.id_ficha, valores, crearEnPlan)
      alGuardada(respuesta.ficha, respuesta.enlazado_en_terceros ?? [])
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setGuardando(false)
    }
  }

  function heredadoDe(campo: string): string {
    return (ficha?.cuentas ?? []).find((c) => c.campo === campo)?.heredado ?? ''
  }

  return (
    <Modal
      opened={ficha !== null}
      onClose={alCerrar}
      title={ficha?.etiqueta ?? ''}
      centered
      size="md"
    >
      {ficha !== null && (
        <form onSubmit={enviar}>
          <Stack gap="md">
            {error && (
              <Alert color="red" role="alert">
                {error}
              </Alert>
            )}

            {errorSugerir && (
              <Alert color="yellow" p="xs">
                <Text size="sm">No se pudieron traer las cuentas propuestas: {errorSugerir}</Text>
              </Alert>
            )}

            {campos.map((campo, posicion) => (
              <CasillaDeCuenta
                key={campo.campo}
                campo={campo}
                heredado={heredadoDe(campo.campo)}
                sugerida={sugeridas[campo.campo]}
                valor={valores[campo.campo] ?? ''}
                alEscribir={(tecleado) => setValores((v) => ({ ...v, [campo.campo]: tecleado }))}
                alSalir={() =>
                  setValores((v) => ({
                    ...v,
                    [campo.campo]: expandirCuenta(v[campo.campo] ?? '', ancho),
                  }))
                }
                autoFocus={posicion === 0}
              />
            ))}

            <Checkbox
              label="Dar de alta en el plan las cuentas que no existan"
              description="Sin esta opción, si la cuenta no está en el plan no se guarda ningún cambio"
              checked={crearEnPlan}
              onChange={(e) => setCrearEnPlan(e.currentTarget.checked)}
            />

            <Text fz="xs" c="dimmed">
              Vaciar una casilla borra la cuenta asignada. La del propio cliente o proveedor es
              la excepción: se puede cambiar por otra, pero no dejar en blanco, porque puede
              tener apuntes.
            </Text>

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
      )}
    </Modal>
  )
}
