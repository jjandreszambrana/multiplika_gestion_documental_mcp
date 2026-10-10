---
id: 31115
modelo: normal
numero: 15
titulo: "Información sobre medio ambiente"
obligatorio: false
cuadros: [inmovilizado_material, desglose_perdidas_y_ganancias]
datos:
  - clave: activos_medioambientales
    descripcion: "Sistemas, equipos e instalaciones del inmovilizado material para reducir el impacto o proteger el medio ambiente: naturaleza, destino, valor contable, amortización acumulada y deterioro"
    tipo: manual
    formato: tabla
  - clave: gastos_medioambientales
    descripcion: "Gastos del ejercicio para proteger y mejorar el medio ambiente y su destino"
    tipo: manual
    formato: tabla
  - clave: provisiones_medioambientales
    descripcion: "Riesgos cubiertos por provisiones medioambientales (litigios, indemnizaciones) con la información de la nota 14"
    tipo: gd
    formato: texto
  - clave: contingencias_medioambientales
    descripcion: "Contingencias medioambientales con la información de la nota 14"
    tipo: gd
    formato: texto
  - clave: inversiones_medioambientales
    descripcion: "Inversiones del ejercicio por razones medioambientales"
    tipo: manual
    formato: numero
  - clave: compensaciones_terceros
    descripcion: "Compensaciones a recibir de terceros por actuaciones medioambientales"
    tipo: gd
    formato: numero
fuentes: [BOE-A-2007-19884/A15-3, BOE-A-2007-19884/A14-3]
---
# Información sobre medio ambiente (modelo normal)

Recoge lo que la empresa ha invertido y gastado para **reducir su impacto ambiental** y los riesgos medioambientales que tiene. No es una memoria de sostenibilidad: solo cifras contables y riesgos con efecto en las cuentas.

## Qué contar y en qué orden

1. **Activos medioambientales**: instalaciones y equipos cuyo fin es proteger el medio ambiente (depuradoras, filtros de emisiones, placas solares para autoconsumo, sistemas de tratamiento de residuos), con su naturaleza, destino, valor contable, amortización acumulada y deterioro, siempre que se puedan identificar uno por uno. El SIF da los saldos del inmovilizado, pero no sabe qué elemento es medioambiental: la empresa debe señalarlo.
2. **Gastos del ejercicio** con fin medioambiental y su destino: gestión de residuos, análisis de vertidos, tasas ambientales, mantenimiento de depuradoras, consultoría ambiental.
3. **Inversiones del ejercicio** por razones medioambientales (las altas del punto 1 de este año).
4. **Provisiones medioambientales** (descontaminación de suelos, restauración de canteras, sanciones previstas), con la misma información que exige la nota 14 para cualquier provisión.
5. **Contingencias medioambientales**, también con el formato de la nota 14.
6. **Compensaciones de terceros** previstas (seguros de responsabilidad ambiental, subvenciones ligadas).

## Cuándo se dice "no aplica"

Formalmente, si no hay nada significativo no se rellena (norma 10.ª). En la práctica casi todas las memorias incluyen la nota con una frase del tipo "Dada la actividad de la sociedad, no tiene responsabilidades, gastos, activos, provisiones ni contingencias de naturaleza medioambiental que pudieran ser significativos". La IA debe proponerla así solo **después de preguntar**: una industria, un taller o una explotación agraria rara vez puede decir que no tiene nada.

## Errores frecuentes

- Poner la frase de "no aplica" en una empresa con actividad potencialmente contaminante (química, metal, alimentación con vertidos, gestión de residuos).
- Contar como medioambiental todo el gasto de limpieza ordinaria.
- No relacionar los activos de esta nota con el cuadro de inmovilizado de la nota 5.
- Olvidar las subvenciones recibidas para inversiones ambientales, que también van en la nota 18.

## Datos difíciles de conseguir

- **Qué elementos del inmovilizado son medioambientales**: hay que preguntarlo; a veces se identifican por la factura de compra en la GD.
- **Gastos ambientales**: suelen estar dispersos en las cuentas de servicios exteriores (subgrupo 62); pedir a la empresa que los señale o usar los proveedores (gestores de residuos autorizados).
- **Autorizaciones ambientales, inspecciones y expedientes**: documentos de la administración ambiental en la GD.
