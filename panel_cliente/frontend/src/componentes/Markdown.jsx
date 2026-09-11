import { TypographyStylesProvider } from "@mantine/core"
import ReactMarkdown from "react-markdown"

// react-markdown no interpreta HTML embebido salvo que se le añada
// rehype-raw a propósito — así que el markdown de un documento (el que
// generó la IA leyendo el fichero del cliente) se renderiza sin riesgo
// de que algo dentro ejecute HTML/JS.
export default function Markdown({ children }) {
  return (
    <TypographyStylesProvider>
      <ReactMarkdown>{children}</ReactMarkdown>
    </TypographyStylesProvider>
  )
}
