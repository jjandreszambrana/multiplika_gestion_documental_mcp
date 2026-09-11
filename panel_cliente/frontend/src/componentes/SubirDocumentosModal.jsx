import { useState } from "react"
import { Alert, Badge, Button, Group, List, Modal, Table, Text, Title } from "@mantine/core"
import { Dropzone, IMAGE_MIME_TYPE, PDF_MIME_TYPE } from "@mantine/dropzone"
import { formatearFecha } from "../formato"

export default function SubirDocumentosModal({
  opened,
  onClose,
  pendientes,
  subiendo,
  error,
  onCerrarError,
  onSubir,
  onDescartar,
}) {
  const [archivosElegidos, setArchivosElegidos] = useState([])

  function agregarArchivos(nuevos) {
    setArchivosElegidos((actuales) => [...actuales, ...nuevos])
  }

  function quitarArchivo(indice) {
    setArchivosElegidos((actuales) => actuales.filter((_, i) => i !== indice))
  }

  async function confirmarSubida() {
    await onSubir(archivosElegidos)
    setArchivosElegidos([])
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Subir documentos" size="lg">
      <List size="sm" spacing="xs" mb="md">
        <List.Item>
          Elige o arrastra aquí el PDF o la foto (varios a la vez si quieres) — todavía no se guarda nada,
          entra en una cola de <b>pendientes</b>.
        </List.Item>
        <List.Item>
          La próxima vez que hables con tu IA, te avisa de lo que tienes en cola y te hace las preguntas de
          siempre (tipo de documento, nombre, si es una versión nueva de algo que ya tenías...) antes de
          guardarlo de verdad.
        </List.Item>
        <List.Item>
          Si tienes una cuenta de correo configurada (menú Configuración → Cuenta de correo), lo que le
          reenvíes entra en esta misma cola sin que tengas que venir al panel.
        </List.Item>
      </List>

      <Dropzone onDrop={agregarArchivos} accept={[...PDF_MIME_TYPE, ...IMAGE_MIME_TYPE]} mb="md">
        <Text ta="center" py="lg" c="dimmed">
          Arrastra aquí tus documentos, o haz clic para elegirlos
        </Text>
      </Dropzone>

      {archivosElegidos.length > 0 && (
        <>
          <List size="sm" mb="sm">
            {archivosElegidos.map((archivo, indice) => (
              <List.Item key={`${archivo.name}-${indice}`}>
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm">{archivo.name}</Text>
                  <Button variant="subtle" color="red" size="xs" onClick={() => quitarArchivo(indice)}>
                    Quitar
                  </Button>
                </Group>
              </List.Item>
            ))}
          </List>
          <Button onClick={confirmarSubida} loading={subiendo} mb="md">
            Subir {archivosElegidos.length} documento{archivosElegidos.length === 1 ? "" : "s"}
          </Button>
        </>
      )}

      {error && (
        <Alert color="red" mb="md" onClose={onCerrarError} withCloseButton>
          {error}
        </Alert>
      )}

      <Title order={5} mb="xs">
        Ya en la cola de pendientes
      </Title>
      {pendientes.length > 0 ? (
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Documento pendiente</Table.Th>
              <Table.Th>Origen</Table.Th>
              <Table.Th>Fecha de alta</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pendientes.map((p) => (
              <Table.Tr key={p.id}>
                <Table.Td>{p.nombre_original}</Table.Td>
                <Table.Td>
                  <Badge variant="light">{p.origen === "email" ? "Email" : "Panel"}</Badge>
                </Table.Td>
                <Table.Td>{formatearFecha(p.fecha_alta)}</Table.Td>
                <Table.Td>
                  <Button variant="subtle" color="red" size="xs" onClick={() => onDescartar(p.id)}>
                    Descartar
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text c="dimmed" size="sm">
          No tienes ningún documento pendiente ahora mismo.
        </Text>
      )}
    </Modal>
  )
}
