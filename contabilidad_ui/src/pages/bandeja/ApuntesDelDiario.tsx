import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { listarApuntes, type PaginaDeApuntes } from "../../api/asientos";
import { textoDeError } from "../../api/errores";
import {
  formatearEntero,
  formatearFecha,
  formatearImporte,
} from "../../lib/format";
import { importeParaApi } from "../diario/filtro";
import ModalMayor from "../informes/ModalMayor";

interface Props {
  /** `aaaa-mm-dd` (o con hora: se usa el día). Con lo que se rellena al abrir. */
  fecha: string;
  importe: number;
  /** Cuenta del proveedor/cliente del registro y su estado, para explicar por qué no está contabilizado. */
  cuentaTercero?: string | null;
  estado?: string;
}

const POR_BUSQUEDA = 100;

/**
 * Búsqueda libre en el diario desde el registro que se está mirando. Se abre
 * rellena con su fecha y su importe, y busca; después se puede cambiar
 * cualquier casilla (fechas, importes, concepto, documento) y volver a buscar.
 * Confirmados y borradores juntos. Solo mira.
 */
export default function ApuntesDelDiario({
  fecha,
  importe,
  cuentaTercero,
  estado,
}: Props) {
  const dia = fecha.slice(0, 10);
  const cifra = Math.abs(importe).toFixed(2).replace(".", ",");
  // Se busca en todo el ejercicio del registro: el apunte puede estar lejos de su fecha
  const anyo = dia.slice(0, 4) || String(new Date().getFullYear());
  const [desde, setDesde] = useState(`${anyo}-01-01`);
  const [hasta, setHasta] = useState(`${anyo}-12-31`);
  const [importeDesde, setImporteDesde] = useState(cifra);
  const [importeHasta, setImporteHasta] = useState(cifra);
  const [concepto, setConcepto] = useState("");
  const [documento, setDocumento] = useState("");
  const [pagina, setPagina] = useState<PaginaDeApuntes | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mayor, setMayor] = useState<{
    cuenta: string;
    ejercicio: number;
    pase?: number;
  } | null>(null);
  const ejercicioDelRegistro =
    Number(dia.slice(0, 4)) || new Date().getFullYear();

  async function buscar(
    valores = { desde, hasta, importeDesde, importeHasta, concepto, documento },
  ) {
    setError(null);
    setBuscando(true);
    try {
      setPagina(
        await listarApuntes({
          ejercicio: null,
          cuenta: "",
          desde: valores.desde,
          hasta: valores.hasta,
          incluir: "todas",
          diario: "",
          concepto: valores.concepto.trim(),
          documento: valores.documento.trim(),
          asientoDesde: "",
          asientoHasta: "",
          importeDesde: importeParaApi(valores.importeDesde),
          importeHasta: importeParaApi(valores.importeHasta),
          idBorrador: null,
          offset: 0,
          limit: POR_BUSQUEDA,
        }),
      );
    } catch (fallo) {
      setError(textoDeError(fallo));
    } finally {
      setBuscando(false);
    }
  }

  // Al pasar a otro registro, la búsqueda vuelve a sus datos y se lanza sola.
  useEffect(() => {
    const inicial = {
      desde: `${anyo}-01-01`,
      hasta: `${anyo}-12-31`,
      importeDesde: cifra,
      importeHasta: cifra,
      concepto: "",
      documento: "",
    };
    setDesde(inicial.desde);
    setHasta(inicial.hasta);
    setImporteDesde(cifra);
    setImporteHasta(cifra);
    setConcepto("");
    setDocumento("");
    void buscar(inicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyo, cifra]);

  // Está en el diario pero en otra cuenta: el programa no lo da por contabilizado y el contable tiene que saberlo.
  const enOtraCuenta =
    estado === "pendiente" && cuentaTercero && pagina
      ? [
          ...new Map(
            pagina.apuntes
              .filter(
                (a) => !a.cuenta.startsWith("57") && a.cuenta !== cuentaTercero,
              )
              .map((a) => [a.pase, a]),
          ).values(),
        ]
      : [];
  const enSuCuenta =
    !!cuentaTercero &&
    !!pagina &&
    pagina.apuntes.some((a) => a.cuenta === cuentaTercero);

  const enlace = (cuenta: string, ejercicio = ejercicioDelRegistro, pase?: number) => (
    <Anchor
      component="button"
      type="button"
      fz="inherit"
      ff="monospace"
      title="Ver el mayor"
      onClick={() => setMayor({ cuenta, ejercicio, pase })}
    >
      {cuenta}
    </Anchor>
  );

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void buscar();
        }}
      >
        <Stack gap="xs">
          <Text fw={600} size="sm">
            Buscar en el diario
          </Text>
          <Group grow align="flex-start">
            <TextInput
              label="Fecha desde"
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.currentTarget.value)}
            />
            <TextInput
              label="Fecha hasta"
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.currentTarget.value)}
            />
            <TextInput
              label="Importe desde"
              inputMode="decimal"
              value={importeDesde}
              onChange={(e) => setImporteDesde(e.currentTarget.value)}
            />
            <TextInput
              label="Importe hasta"
              inputMode="decimal"
              value={importeHasta}
              onChange={(e) => setImporteHasta(e.currentTarget.value)}
            />
          </Group>
          <Group grow align="flex-end">
            <TextInput
              label="Concepto"
              value={concepto}
              onChange={(e) => setConcepto(e.currentTarget.value)}
            />
            <TextInput
              label="Documento"
              value={documento}
              onChange={(e) => setDocumento(e.currentTarget.value)}
            />
            <Button
              type="submit"
              loading={buscando}
              style={{ flex: "0 0 auto" }}
            >
              Buscar
            </Button>
          </Group>

          {enOtraCuenta.length > 0 && !enSuCuenta && (
            <Alert
              color="orange"
              title="Puede que ya esté contabilizado, pero en otra cuenta"
            >
              En el diario hay un apunte con ese importe en otra cuenta:{" "}
              {enOtraCuenta.slice(0, 3).map((a, i) => (
                <span key={a.pase}>
                  {i > 0 && ", "}asiento {a.asiento} (cuenta{" "}
                  {enlace(a.cuenta, a.ejercicio, a.pase)})
                </span>
              ))}
              . El programa solo da un registro por contabilizado si coincide la
              cuenta ({enlace(cuentaTercero ?? "")}), por eso sigue como «por
              contabilizar». Si es el mismo pago, no lo contabilices:
              descártalo.
            </Alert>
          )}
          {error && <Alert color="red">{error}</Alert>}
          <Text size="xs" c="dimmed">
            Se marca CONTABILIZADO cuando el diario tiene un apunte en la cuenta
            del proveedor (o cliente) con el mismo importe, o el mismo número de
            factura, con fecha a 5 días o menos. Si solo coincide el concepto,
            queda pendiente de que lo mires.
          </Text>
          {pagina && pagina.apuntes.length === 0 && (
            <Text size="sm" c="dimmed">
              No hay ningún apunte con eso.
            </Text>
          )}
          {pagina && pagina.apuntes.length > 0 && (
            <>
              {pagina.total > pagina.apuntes.length && (
                <Text size="sm" c="dimmed">
                  Hay {formatearEntero(pagina.total)} apuntes; se ven los
                  primeros {formatearEntero(pagina.apuntes.length)}. Afina la
                  búsqueda.
                </Text>
              )}
              <Table.ScrollContainer minWidth={600} mah={320}>
                <Table fz="sm" stickyHeader>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Fecha</Table.Th>
                      <Table.Th>Asiento</Table.Th>
                      <Table.Th>Cuenta</Table.Th>
                      <Table.Th>Concepto</Table.Th>
                      <Table.Th>Documento</Table.Th>
                      <Table.Th ta="right">Debe</Table.Th>
                      <Table.Th ta="right">Haber</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {pagina.apuntes.map((a) => (
                      <Table.Tr key={a.pase}>
                        <Table.Td>{formatearFecha(a.fecha)}</Table.Td>
                        <Table.Td>
                          {a.asiento}{" "}
                          {a.es_borrador && (
                            <Badge size="xs" variant="light" color="yellow">
                              borrador
                            </Badge>
                          )}
                        </Table.Td>
                        <Table.Td>{enlace(a.cuenta, a.ejercicio, a.pase)}</Table.Td>
                        <Table.Td>{a.concepto}</Table.Td>
                        <Table.Td>{a.documento}</Table.Td>
                        <Table.Td ta="right">
                          {a.debe.isZero() ? "" : formatearImporte(a.debe)}
                        </Table.Td>
                        <Table.Td ta="right">
                          {a.haber.isZero() ? "" : formatearImporte(a.haber)}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </>
          )}
        </Stack>
      </form>
      <ModalMayor
        cuenta={mayor?.cuenta ?? ""}
        ejercicio={mayor?.ejercicio ?? null}
        pase={mayor?.pase}
        zIndex={400}
        alCerrar={() => setMayor(null)}
      />
    </>
  );
}
