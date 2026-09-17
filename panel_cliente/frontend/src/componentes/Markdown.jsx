import { TypographyStylesProvider } from "@mantine/core"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

// react-markdown no interpreta HTML embebido salvo que se le añada
// rehype-raw a propósito — así que el markdown de un documento (el que
// generó la IA leyendo el fichero del cliente) se renderiza sin riesgo
// de que algo dentro ejecute HTML/JS.
//
// remarkGfm añade la sintaxis "GitHub-flavored" que markdown puro no
// entiende: tablas, ~~tachado~~, listas de tareas y enlaces sueltos
// (https://...) sin corchetes. Sin esto, una tabla se veía como una
// línea de texto con barras verticales sueltas en vez de una tabla real
// — el CSS de .contenido-documento para tablas ya existía, pero nunca
// llegaba a aplicarse porque react-markdown no generaba ningún <table>.
export default function Markdown({ children }) {
  return (
    <TypographyStylesProvider>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </TypographyStylesProvider>
  )
}
