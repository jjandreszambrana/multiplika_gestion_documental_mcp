---
id: 31310
modelo: pymes
numero: 10
titulo: "Otra información"
obligatorio: true
cuadros: [desglose_perdidas_y_ganancias, desglose_balance]
datos:
  - clave: plantilla_media
    descripcion: "Número medio de personas empleadas en el ejercicio"
    tipo: manual
    formato: numero
  - clave: acuerdos_fuera_balance
    descripcion: "Naturaleza y propósito de negocio de los acuerdos que no figuran en balance ni en otra nota, si son significativos"
    tipo: manual
    formato: texto
  - clave: partidas_excepcionales
    descripcion: "Importe y naturaleza de ingresos o gastos de cuantía o incidencia excepcional"
    tipo: contabilidad
    formato: tabla
  - clave: subvenciones_recibidas
    descripcion: "Subvenciones, donaciones y legados recibidos, con el ente público concedente y si es Administración local, autonómica, estatal o internacional"
    tipo: gd
    formato: tabla
  - clave: compromisos_garantias_contingencias
    descripcion: "Importe global de compromisos financieros, garantías y contingencias fuera de balance, naturaleza y forma de las garantías reales, y compromisos por pensiones por separado"
    tipo: gd
    formato: tabla
  - clave: hechos_posteriores
    descripcion: "Naturaleza y efecto financiero de las circunstancias significativas posteriores al cierre no reflejadas en balance ni en la cuenta de pérdidas y ganancias"
    tipo: manual
    formato: texto
  - clave: otra_informacion_imagen_fiel
    descripcion: "Cualquier otra información necesaria para la imagen fiel o que la empresa quiera dar voluntariamente"
    tipo: manual
    formato: texto
  - clave: periodo_medio_pago
    descripcion: "Periodo medio de pago a proveedores en días, ejercicio y anterior"
    tipo: contabilidad
    formato: tabla
fuentes: [BOE-A-2007-19966/iimodelosdecuentasanuales, BOE-A-2016-1112/a6, BOE-A-2010-10708/datercera, BOE-A-2010-10544/a261]
---
# Otra información (modelo PYMES)

Agrupa lo que en el modelo normal son varias notas: plantilla, subvenciones, compromisos fuera de balance y **hechos posteriores al cierre**. Se añade, por otras normas, el **periodo medio de pago a proveedores**.

## Qué contar y en qué orden

1. **Plantilla media** del ejercicio (y del anterior). Un solo número: el modelo PYMES no pide desglose por categoría, sexo ni discapacidad. Se calcula ponderando por tiempo y jornada: un trabajador a media jornada durante todo el año cuenta 0,5.
2. **Acuerdos fuera de balance** significativos: su naturaleza y para qué sirven (por ejemplo, un contrato de suministro a largo plazo con penalizaciones, una venta de cartera de clientes sin recurso).
3. **Ingresos y gastos excepcionales**: importe y naturaleza (siniestros, multas, indemnizaciones extraordinarias, venta de un inmueble importante). Y las **subvenciones, donaciones y legados** recibidos, con el ente concedente y su nivel (local, autonómico, estatal, internacional). Como el modelo PYMES no tiene nota de subvenciones, aquí van sus importes, lo imputado a resultados y el saldo pendiente (cuentas 130 a 132 y 740 a 747).
4. **Compromisos, garantías y contingencias** que no están en el balance: avales prestados por la empresa, garantías reales sobre sus bienes por deudas de terceros, pedidos firmes de inmovilizado, litigios no provisionados. Importe global, con la naturaleza de las garantías reales; los compromisos por pensiones, por separado. El art. 261 LSC exige estos datos de forma global a toda sociedad que pueda formular balance abreviado, como en la práctica las que aplican el PGC PYMES.
5. **Hechos posteriores al cierre**: los hechos importantes ocurridos entre el cierre y la formulación que no se han reflejado en las cifras, con su efecto financiero. Si no hay ninguno, decirlo expresamente, siempre después de preguntar.
6. **Otra información** necesaria para la imagen fiel o voluntaria. Aquí suele ir, si la empresa lo desea, la **propuesta de aplicación del resultado**, que el modelo PYMES no exige como nota propia.
7. **Periodo medio de pago a proveedores** (Ley 15/2010 y Resolución del ICAC de 29-1-2016): nota con el título que fija la resolución y un cuadro con el periodo medio de pago en días del ejercicio y del anterior. En este modelo no se piden las ratios ni los totales de pagos.

## Cuándo se dice "no aplica"

La nota siempre existe: la plantilla media y el periodo medio de pago se informan siempre. Los puntos 2 a 4 y 6 solo si hay contenido. El 5 siempre, aunque sea en negativo.

## Errores frecuentes

- Dar la plantilla al cierre en lugar de la media.
- Olvidar los avales bancarios que la empresa ha prestado (por ejemplo, ante la Administración en una licitación).
- No incluir los hechos posteriores porque "este modelo no tiene nota de hechos posteriores": están aquí.
- Calcular el periodo medio de pago con facturas de inmovilizado o de Administraciones públicas, que no cuentan.

## Datos difíciles de conseguir

- **Plantilla media**: programa de nóminas o informe de plantilla media de la Seguridad Social.
- **Avales y garantías**: pólizas de avales y certificados bancarios en la GD.
- **Hechos posteriores**: preguntar a la dirección; revisar en la GD documentos fechados después del cierre.
- **Periodo medio de pago**: requiere fechas de factura y de pago por proveedor; el SIF puede calcularlo si las tiene, pero no está entre sus cuadros actuales.
