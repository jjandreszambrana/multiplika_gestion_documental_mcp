import { Alert, Button, Code, Stack, Text } from '@mantine/core'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  /** Cambia al cambiar de pantalla, para que el aviso no se quede pegado. */
  llave: string | number
  children: ReactNode
}

interface Estado {
  fallo: Error | null
}

/**
 * Lo que queda en pie cuando un componente revienta.
 *
 * Sin esto, un fallo de programación desmonta el árbol y deja la pantalla
 * muerta: si el fallo ocurre dentro de un diálogo, se queda la capa gris encima
 * y no se puede ni cerrar. Pasó de verdad el 28/08/2026 con un filtro guardado
 * de una versión anterior.
 *
 * No arregla nada ni disimula: dice que ha fallado, enseña el mensaje para
 * poder contarlo y deja volver a intentarlo.
 */
export default class RedDeSeguridad extends Component<Props, Estado> {
  state: Estado = { fallo: null }

  static getDerivedStateFromError(fallo: Error): Estado {
    return { fallo }
  }

  componentDidUpdate(anteriores: Props) {
    if (anteriores.llave !== this.props.llave && this.state.fallo) this.setState({ fallo: null })
  }

  componentDidCatch(fallo: Error, info: ErrorInfo) {
    // Al registro del navegador, que es donde se mira cuando alguien lo cuenta.
    console.error('Fallo sin recoger en la interfaz:', fallo, info.componentStack)
  }

  render() {
    const { fallo } = this.state
    if (!fallo) return this.props.children

    return (
      <Alert color="red" title="Algo ha fallado en esta pantalla" role="alert">
        <Stack gap="sm" align="flex-start">
          <Text size="sm">
            El fallo está en el programa, no en tus datos: no se ha perdido nada de lo que ya
            estuviera guardado.
          </Text>
          <Code block>{fallo.message}</Code>
          <Button size="xs" onClick={() => this.setState({ fallo: null })}>
            Volver a intentarlo
          </Button>
        </Stack>
      </Alert>
    )
  }
}
