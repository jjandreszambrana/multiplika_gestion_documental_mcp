import { ActionIcon, Alert, Checkbox, Group, Select, Stack, Text, Textarea, TextInput, Tooltip } from '@mantine/core'
import { IconBook } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import type { TablaDeAmortizacion } from '../../api/inmovilizado'
import CasillaDeCuenta from '../../components/CasillaDeCuenta'
import { CasillaFecha } from '../../components/CasillaFecha'
import { expandirCuenta } from '../../lib/cuenta'
import { soloImporte } from '../../lib/dinero'
import ModalMayor from '../informes/ModalMayor'

/** Lo que se teclea. Los importes viven como texto hasta que se envían. */
export interface DatosBien {
  descripcion: string
  /** Clave de la fila de la tabla de la ley. Vacía si no se ha elegido tipo. */
  tipo: string
  valor: string
  porcentaje: string
  fechaInicio: Date | null
  fechaCompra: Date | null
  valorResidual: string
  /** Lo que traía amortizado de otra contabilidad. Vacío en un bien nuevo. */
  amortizadoInicial: string
  /** Marca de segunda mano: dobla el porcentaje que propone la tabla. */
  usado: boolean
  anotaciones: string
  cuentaActivo: string
  cuentaAmortizacion: string
  cuentaGasto: string
}

export const BIEN_EN_BLANCO: DatosBien = {
  descripcion: '',
  tipo: '',
  valor: '',
  porcentaje: '',
  fechaInicio: null,
  fechaCompra: null,
  valorResidual: '',
  amortizadoInicial: '',
  usado: false,
  anotaciones: '',
  cuentaActivo: '',
  cuentaAmortizacion: '',
  cuentaGasto: '',
}

interface Props {
  datos: DatosBien
  alCambiar: (datos: DatosBien) => void
  /** Dígitos de una cuenta en esta empresa: el punto se rellena hasta ahí. */
  ancho: number
  /**
   * Con meses ya dotados, cuatro campos no se pueden cambiar y la API responde
   * 400. Se bloquean antes, en vez de dejar teclear algo que se va a perder.
   */
  conAmortizaciones: boolean
  /** Se llama al elegir «Crear la cuenta…», con el código ya expandido. */
  alCrearCuenta: (campo: CampoDeCuenta, codigo: string) => void
  /** Nula mientras no llegue, o si no se pudo traer: se teclea a mano. */
  tabla: TablaDeAmortizacion | null
  /** Ejercicio del que se abre el mayor de una cuenta. */
  ejercicio: number | null
}

/** Las tres casillas de cuenta del formulario. */
export type CampoDeCuenta = 'cuentaActivo' | 'cuentaAmortizacion' | 'cuentaGasto'

const AVISO_AMORTIZADO =
  'Este bien ya tiene meses amortizados, así que el valor, lo ya amortizado al entrar, la ' +
  'fecha de inicio y sus dos cuentas no se pueden cambiar: lo ya apuntado en los libros ' +
  'dejaría de cuadrar. El porcentaje y el valor residual sí, y solo afectan a lo que queda ' +
  'por amortizar.'

/**
 * Los campos de un bien, compartidos por el alta y la corrección.
 *
 * Van en cuatro bloques, no en una columna: qué es el bien, cuándo entró, qué
 * costó y a qué ritmo, y dónde se apunta. Puestos uno debajo de otro son nueve
 * casillas seguidas y no se ve de un vistazo qué tiene que ver con qué.
 *
 * El orden del tabulador es el de lectura, que es como se rellena: descripción,
 * fechas, importes y cuentas.
 *
 * El porcentaje se teclea a mano: la tabla de la Ley del Impuesto sobre
 * Sociedades, que es la que permitiría proponerlo por tipo de bien, todavía no
 * la sirve la API.
 */
export default function FormularioBien({
  datos,
  alCambiar,
  ancho,
  conAmortizaciones,
  alCrearCuenta,
  tabla,
  ejercicio,
}: Props) {
  const [mayorDe, setMayorDe] = useState('')
  const elegido = (tabla?.elementos ?? []).find((fila) => fila.clave === datos.tipo) ?? null

  // El coeficiente de la ley es un máximo fiscal: se avisa, pero no se impide.
  // Amortizar más deprisa no es un error, es una diferencia en el impuesto.
  const coeficiente =
    elegido === null
      ? null
      : datos.usado
        ? elegido.coeficiente_maximo_usado
        : elegido.coeficiente_maximo
  const maximo = coeficiente === null ? null : Number(coeficiente)
  const tecleado = Number(datos.porcentaje.replace(',', '.'))
  const seMax = maximo !== null && Number.isFinite(tecleado) && tecleado > maximo

  const tipos = useMemo(
    () =>
      (tabla?.elementos ?? []).map((fila) => ({
        value: fila.clave,
        label: `${fila.elemento} · ${fila.coeficiente_maximo} %`,
      })),
    [tabla],
  )

  /** El que propone la tabla para ese tipo, doblado si el bien es usado. */
  function propuesto(clave: string, usado: boolean): string | null {
    const fila = (tabla?.elementos ?? []).find((f) => f.clave === clave)
    if (!fila) return null
    return usado ? fila.coeficiente_maximo_usado : fila.coeficiente_maximo
  }

  /** Elegir un tipo pone su porcentaje; cambiarlo después es cosa del usuario. */
  function elegirTipo(clave: string | null) {
    alCambiar({
      ...datos,
      tipo: clave ?? '',
      porcentaje: (clave && propuesto(clave, datos.usado)) || datos.porcentaje,
    })
  }

  /** Marcar «usado» rehace la propuesta, que es a lo que sirve la casilla. */
  function marcarUsado(usado: boolean) {
    alCambiar({
      ...datos,
      usado,
      porcentaje: (datos.tipo && propuesto(datos.tipo, usado)) || datos.porcentaje,
    })
  }

  function cambiar<C extends keyof DatosBien>(campo: C, valor: DatosBien[C]) {
    alCambiar({ ...datos, [campo]: valor })
  }

  function casillaDeCuenta(campo: CampoDeCuenta, etiqueta: string) {
    return (
      <Group gap={4} wrap="nowrap" align="flex-end">
        <div style={{ flex: 1 }}>
          <CasillaDeCuenta
            id={campo}
            label={etiqueta}
            obligatoria={false}
            valor={datos[campo]}
            ancho={ancho}
            alCambiar={(valor) => cambiar(campo, valor)}
            alCrear={(codigo) => alCrearCuenta(campo, codigo)}
            deshabilitada={conAmortizaciones && campo !== 'cuentaGasto'}
          />
        </div>
        <Tooltip label="Ver el mayor">
          <ActionIcon
            variant="subtle"
            size="lg"
            aria-label={`Ver el mayor de ${etiqueta.toLowerCase()}`}
            disabled={datos[campo].trim() === ''}
            onClick={() => setMayorDe(expandirCuenta(datos[campo], ancho))}
          >
            <IconBook size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    )
  }

  return (
    <Stack gap="md">
      {conAmortizaciones && (
        <Alert color="yellow" role="status">
          {AVISO_AMORTIZADO}
        </Alert>
      )}

      <TextInput
        label="Descripción"
        value={datos.descripcion}
        onChange={(e) => cambiar('descripcion', e.currentTarget.value)}
        required
        autoFocus
      />

      <Group grow align="flex-start">
        <CasillaFecha
          label="Fecha de compra"
          value={datos.fechaCompra}
          onChange={(valor) => cambiar('fechaCompra', valor as Date | null)}
          clearable
        />
        <CasillaFecha
          label="Se amortiza desde"
          value={datos.fechaInicio}
          onChange={(valor) => cambiar('fechaInicio', valor as Date | null)}
          disabled={conAmortizaciones}
          clearable
          required
        />
      </Group>

      {tabla !== null && (
        <Stack gap={4}>
          <Group align="flex-end" gap="md">
            <Select
              label="Tipo de bien"
              data={tipos}
              value={datos.tipo === '' ? null : datos.tipo}
              onChange={elegirTipo}
              searchable
              clearable
              style={{ flex: 1 }}
            />
            <Checkbox
              label="Es un bien usado"
              checked={datos.usado}
              onChange={(e) => marcarUsado(e.currentTarget.checked)}
              pb={8}
            />
          </Group>
          <Text size="xs" c="dimmed">
            {datos.usado ? tabla.usados.regla : tabla.advertencia}
          </Text>
        </Stack>
      )}

      {/* Las tres casillas de números, sin nada debajo de ninguna: un texto de
          ayuda bajo una sola desnivelaba la fila entera. */}
      <Group grow align="flex-start">
        <TextInput
          label="Valor"
          value={datos.valor}
          onChange={(e) => cambiar('valor', soloImporte(e.currentTarget.value))}
          disabled={conAmortizaciones}
          required
          inputMode="decimal"
        />
        <TextInput
          label="Valor residual"
          value={datos.valorResidual}
          onChange={(e) => cambiar('valorResidual', soloImporte(e.currentTarget.value))}
          inputMode="decimal"
        />
        <TextInput
          label="Porcentaje anual"
          value={datos.porcentaje}
          onChange={(e) => cambiar('porcentaje', soloImporte(e.currentTarget.value))}
          required
          inputMode="decimal"
        />
      </Group>

      {seMax && (
        <Alert color="yellow" role="status">
          {`Este porcentaje pasa del máximo que admite Hacienda para este tipo de bien, que es ` +
            `el ${coeficiente} %. Puedes dejarlo: amortizar más deprisa no es un error, es una ` +
            `diferencia que se ajusta en el impuesto.`}
        </Alert>
      )}

      {/* Aparte, y con la explicación al lado en vez de debajo: es el caso raro
          —el bien que viene de otra contabilidad— y no tiene por qué descolocar
          la fila de los números. */}
      <Group align="flex-start" gap="md" wrap="nowrap">
        <TextInput
          label="Ya amortizado al entrar"
          value={datos.amortizadoInicial}
          onChange={(e) => cambiar('amortizadoInicial', soloImporte(e.currentTarget.value))}
          disabled={conAmortizaciones}
          inputMode="decimal"
          w={200}
        />
        <Text size="xs" c="dimmed" pt={28} style={{ flex: 1 }}>
          Solo para bienes que vienen de otra contabilidad. No genera ningún asiento: los saldos
          ya vienen en el asiento de apertura.
        </Text>
      </Group>

      <Stack gap={4}>
        <Group grow align="flex-start">
          {casillaDeCuenta('cuentaActivo', 'Cuenta del activo')}
          {casillaDeCuenta('cuentaAmortizacion', 'Cuenta de amortización')}
          {casillaDeCuenta('cuentaGasto', 'Cuenta de gasto')}
        </Group>
        <Text size="xs" c="dimmed">
          Si las dejas vacías se usan las de la configuración de la empresa.
        </Text>
      </Stack>

      <Textarea
        label="Anotaciones"
        value={datos.anotaciones}
        onChange={(e) => cambiar('anotaciones', e.currentTarget.value)}
        autosize
        minRows={2}
        maxRows={6}
        maxLength={5000}
      />

      <ModalMayor cuenta={mayorDe} ejercicio={ejercicio} alCerrar={() => setMayorDe('')} />
    </Stack>
  )
}
