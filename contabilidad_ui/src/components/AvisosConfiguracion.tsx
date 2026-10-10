import { Alert, List, Stack } from '@mantine/core'
import type { Configuracion } from '../api/configuracion'

interface Props {
  configuracion: Configuracion
}

/**
 * Lo que falta por configurar, dicho antes de que el usuario se estrelle
 * contra un error tres semanas después.
 *
 * El título y el texto de cada cuenta los escribe el backend, junto a la
 * columna que declara: aquí no hay diccionario que mantener, y una cuenta
 * nueva sale bien escrita sin tocar nada. `campo` es el nombre de la columna
 * y solo vale para mandarlo a `/configuracion/fijar_cuentas`; no se enseña.
 */
export default function AvisosConfiguracion({ configuracion }: Props) {
  const faltanObligatorias = configuracion.cuentas_sin_poner ?? []
  const opcionales = configuracion.avisos ?? []
  const sinEjercicios = configuracion.ejercicios_abiertos === 0

  if (faltanObligatorias.length === 0 && opcionales.length === 0 && !sinEjercicios) return null

  return (
    <Stack gap="sm" mb="md">
      {faltanObligatorias.length > 0 && (
        <Alert color="red" title="La contabilidad está a medio configurar">
          <List size="sm">
            {faltanObligatorias.map((a) => (
              <List.Item key={a.campo}>
                <strong>{a.titulo}</strong>: {a.aviso}
              </List.Item>
            ))}
          </List>
        </Alert>
      )}

      {sinEjercicios && (
        <Alert color="red" title="Sin ejercicios abiertos">
          No se puede apuntar en ningún sitio hasta que se abra un ejercicio.
        </Alert>
      )}

      {opcionales.length > 0 && (
        <Alert color="yellow" title="Cuentas opcionales sin poner">
          <List size="sm">
            {opcionales.map((a) => (
              <List.Item key={a.campo}>
                <strong>{a.titulo}</strong>: {a.aviso}
              </List.Item>
            ))}
          </List>
        </Alert>
      )}
    </Stack>
  )
}
