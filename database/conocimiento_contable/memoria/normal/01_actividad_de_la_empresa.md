---
id: 31101
modelo: normal
numero: 1
titulo: "Actividad de la empresa"
obligatorio: true
cuadros: []
datos:
  - clave: objeto_social
    descripcion: "Objeto social según estatutos y actividad o actividades que realmente ejerce la empresa"
    tipo: gd
    formato: texto
  - clave: domicilio_forma_legal
    descripcion: "Domicilio social, forma jurídica y lugar donde se desarrollan las actividades si es distinto de la sede"
    tipo: gd
    formato: texto
  - clave: naturaleza_explotacion
    descripcion: "Descripción de la naturaleza de la explotación y de las actividades principales"
    tipo: manual
    formato: texto
  - clave: dominante_consolida
    descripcion: "Si la empresa es dominante de un grupo (art. 42 CCom): si formula cuentas consolidadas o qué dispensa del art. 43 CCom aplica"
    tipo: manual
    formato: texto
  - clave: pertenencia_grupo
    descripcion: "Si pertenece a un grupo: dominante directa y dominante última, residencia, Registro Mercantil donde se depositan las consolidadas y fecha de formulación, o causa de exención"
    tipo: gd
    formato: texto
  - clave: moneda_funcional
    descripcion: "Moneda funcional distinta del euro y criterios para determinarla"
    tipo: manual
    formato: texto
fuentes: [BOE-A-2007-19884/A1-4]
---
# Actividad de la empresa (modelo normal)

Es la nota de presentación de la empresa. Quien lea la memoria tiene que saber, al terminarla, quién es la sociedad, a qué se dedica de verdad y si forma parte de un grupo.

## Qué contar y en qué orden

1. **Identificación**: denominación, forma jurídica (SA, SL, cooperativa...), domicilio social y, si la actividad se ejerce en otro sitio (fábrica, almacenes, tiendas), dónde. Conviene añadir los datos registrales (Registro Mercantil, tomo, folio, hoja) y el NIF, aunque el modelo normal no los pida expresamente.
2. **Objeto social y actividad real**. Son dos cosas distintas: el objeto social es lo que dicen los estatutos y suele ser muy amplio; la actividad es lo que la empresa hace de hecho. Hay que dar las dos y, si la empresa tiene varias actividades, decir cuál es la principal (por cifra de negocios).
3. **Naturaleza de la explotación**: cómo gana dinero la empresa (fabrica, distribuye, presta servicios, alquila...), mercados en que opera y, si es útil, número de centros.
4. **Grupo**. Dos casos que pueden darse a la vez:
   - Si es **dominante** (controla a otras según el art. 42 del Código de Comercio): decir si formula cuentas consolidadas o, si no, qué dispensa del art. 43 aplica (por tamaño, por ser a su vez dependiente de un grupo que consolida, etc.).
   - Si es **dependiente**: nombre de la dominante directa y de la dominante última, su residencia, el Registro Mercantil donde están depositadas las consolidadas y la fecha en que se formularon. Si nadie consolida, la causa que lo exime.
5. **Moneda funcional** distinta del euro, solo si existe, con el criterio seguido para fijarla.

## Cuándo se dice "no aplica"

La nota siempre existe. Lo que puede no aplicar son los puntos 4 y 5: si la empresa no es dominante ni dependiente, basta una frase ("La sociedad no forma parte de ningún grupo de sociedades en los términos del artículo 42 del Código de Comercio"). Para la moneda funcional, lo normal es no mencionarla o decir que es el euro.

## Errores frecuentes

- Copiar el objeto social de los estatutos y no decir qué hace la empresa.
- Confundir "grupo" con "empresas de los mismos socios". Que dos sociedades tengan los mismos socios personas físicas no las convierte en grupo del art. 42 si no hay una sociedad dominante; ese caso es una **unidad de decisión** y va en la nota 24 (Otra información).
- No actualizar el domicilio tras un traslado inscrito durante el ejercicio.
- Dar la fecha de formulación de las consolidadas del ejercicio anterior.

## Datos difíciles de conseguir

- Los datos de la dominante última, sobre todo si es extranjera: pedir a la empresa el nombre exacto, el país y dónde deposita sus cuentas.
- La fecha de formulación de las consolidadas cuando las formula otra sociedad: suele llegar tarde; dejarla como dato pendiente.
- El objeto social vigente: buscar en la GD la última escritura de modificación de estatutos, no la de constitución.
