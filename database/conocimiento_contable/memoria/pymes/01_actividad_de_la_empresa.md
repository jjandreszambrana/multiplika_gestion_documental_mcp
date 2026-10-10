---
id: 31301
modelo: pymes
numero: 1
titulo: "Actividad de la empresa"
obligatorio: true
cuadros: []
datos:
  - clave: objeto_social
    descripcion: "Objeto social según estatutos"
    tipo: gd
    formato: texto
  - clave: actividad_real
    descripcion: "Actividad o actividades a las que se dedica realmente la empresa, indicando la principal"
    tipo: manual
    formato: texto
  - clave: identificacion_registro_mercantil
    descripcion: "Identificación en el Registro Mercantil (registro, tomo, folio, hoja, inscripción)"
    tipo: gd
    formato: texto
  - clave: dominante_grupo_menor
    descripcion: "Si es dependiente de un grupo (art. 42 CCom): nombre y domicilio de la dominante que formula las cuentas consolidadas del grupo menor (exigido por el art. 261 LSC)"
    tipo: gd
    formato: texto
  - clave: domicilio_forma_juridica
    descripcion: "Recomendable: denominación, forma jurídica, domicilio social y centros de actividad"
    tipo: gd
    formato: texto
fuentes: [BOE-A-2007-19966/iimodelosdecuentasanuales, BOE-A-2010-10544/a261]
---
# Actividad de la empresa (modelo PYMES)

La nota más sencilla de la memoria PYMES. El modelo pide solo tres cosas: **objeto social**, **actividad** y **datos de inscripción en el Registro Mercantil**.

## Qué contar y en qué orden

1. **Identificación**. Aunque el modelo no lo detalla, conviene empezar por la denominación, la forma jurídica, el NIF y el domicilio social, y si la actividad se realiza en otro lugar (nave, tienda, explotación).
2. **Registro Mercantil**: en qué registro está inscrita la sociedad y los datos de la inscripción (tomo, folio, hoja). Si es una entidad no inscribible en el Registro Mercantil (por ejemplo, una cooperativa, que se inscribe en el registro de cooperativas), indicar su registro.
3. **Objeto social**, tal como está en los estatutos vigentes, de forma resumida si es muy largo.
4. **Actividad real**: lo que la empresa hace de verdad, que suele ser una parte del objeto social. Si hay varias actividades, cuál es la principal por cifra de negocios. Puede añadirse el código CNAE.
5. **Grupo**. El modelo PYMES no lo pide, pero el art. 261 de la Ley de Sociedades de Capital sí exige, a toda sociedad que pueda formular balance abreviado, el **nombre y domicilio de la sociedad dominante que formula las cuentas consolidadas del grupo menor** al que pertenece como dependiente. Solo si la empresa es dependiente de un grupo del art. 42 del Código de Comercio.

## Cuándo se dice "no aplica"

La nota siempre existe. El punto 5 se omite, o se resuelve con una frase, si la empresa no es dependiente de ningún grupo.

## Errores frecuentes

- Copiar el objeto social completo de los estatutos y no decir a qué se dedica la empresa en la práctica.
- Usar los datos registrales de la constitución cuando ha habido cambios de domicilio a otra provincia (cambia el registro y la hoja).
- Considerar "grupo" a varias sociedades de los mismos socios personas físicas sin sociedad dominante: no es grupo del art. 42 y no hay consolidadas.
- Olvidar la mención a la dominante cuando la empresa es filial de un grupo, sobre todo si es extranjero.

## Datos difíciles de conseguir

- **Datos registrales**: están en la escritura de constitución inscrita, en las notas de inscripción posteriores o en una nota simple del Registro Mercantil. Buscar en la GD el documento más reciente.
- **Objeto social vigente**: la última escritura de modificación de estatutos en la GD.
- **Dominante que consolida**: preguntar a la empresa; si es un grupo extranjero, puede no saberlo quien lleva la contabilidad local.
