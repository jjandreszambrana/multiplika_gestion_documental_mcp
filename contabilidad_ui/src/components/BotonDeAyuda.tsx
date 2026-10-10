import { ActionIcon, Loader, Modal, Text, Tooltip, TypographyStylesProvider } from '@mantine/core'
import { IconHelp } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { listarAyudas, obtenerAyuda, type AyudaEnLista } from '../api/ayuda'
import { textoDeError } from '../api/errores'
import Markdown from 'react-markdown'

/**
 * La ayuda de una pantalla, escrita y servida por el backend. Aquí no se copia
 * ni una línea: si una regla cambia, cambia allí y se ve el mismo día.
 *
 * Se busca en el listado por su clave, así que si el servidor no la tiene, no
 * se enseña ningún enlace en vez de dejar uno que no lleva a nada.
 */
export default function BotonDeAyuda({ clave }: { clave: string }) {
  const [ficha, setFicha] = useState<AyudaEnLista | null>(null)
  // Hasta que llega el listado no se sabe si esta pantalla tiene ayuda.
  const [buscada, setBuscada] = useState(false)
  const [texto, setTexto] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [abierta, setAbierta] = useState(false)

  useEffect(() => {
    listarAyudas()
      .then((respuesta) => {
        setFicha((respuesta.ayudas ?? []).find((una) => una.clave === clave) ?? null)
        setBuscada(true)
      })
      // Si el listado falla, el botón se enseña igual y el error se ve al
      // abrirlo: esconderlo dejaría la pantalla sin ayuda y sin explicación.
      .catch((fallo: unknown) => {
        setError(textoDeError(fallo))
        setBuscada(false)
      })
  }, [clave])

  function abrir() {
    setAbierta(true)
    if (texto !== null) return
    obtenerAyuda(clave)
      .then((ayuda) => setTexto(ayuda.texto))
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
  }

  // Con el listado leído y sin ayuda para esta pantalla, no hay nada que abrir.
  if (ficha === null && buscada) return null

  const titulo = ficha?.titulo ?? 'Ayuda'

  return (
    <>
      {/* El título de la ayuda lo escribe el servidor, así que sirve de rótulo
          sin escribir nada aquí. */}
      <Tooltip label={titulo} withArrow>
        <ActionIcon variant="subtle" color="gray" aria-label={titulo} onClick={abrir}>
          <IconHelp size={20} />
        </ActionIcon>
      </Tooltip>

      <Modal opened={abierta} onClose={() => setAbierta(false)} title={titulo} size="lg">
        {error !== null ? (
          <Text c="red" role="alert">
            {error}
          </Text>
        ) : texto === null ? (
          <Loader size="sm" />
        ) : (
          <TypographyStylesProvider>
            <Markdown>{texto}</Markdown>
          </TypographyStylesProvider>
        )}
      </Modal>
    </>
  )
}
