# Plantillas de asiento con ayuda de la IA

Decidido el 2026-10-11. Escribir una plantilla de asiento (asiento predefinido)
a mano es difícil: fórmulas, claves, literales entre comillas. En vez de eso, el
contable cuenta con sus palabras qué asiento quiere y la IA la monta.

## Cómo va

1. En Contabilidad › Diario › Asientos predefinidos, **Crear con ayuda de la
   IA…** abre el chat lateral con la petición empezada (sin enviar). Desde
   Claude, igual: basta pedirlo.
2. La IA lee `guia_plantillas_asiento_gd` (método, ayuda del SIF, catálogo y dos
   ejemplos), busca las subcuentas con `buscar_cuenta_contable_gd` y escribe la
   definición.
3. La prueba con `probar_plantilla_asiento_gd` (comprobar + previsualizar en el
   SIF, sin guardar) y corrige por las rutas de los errores.
4. Enseña el asiento de la prueba. Con el visto bueno,
   `guardar_plantilla_asiento_gd` la crea **retirada**: el contable la revisa en
   el editor y la pone en uso. La IA no cambia plantillas existentes.

## Dónde está

- `database/plantillas_asiento.py`: el método y los ejemplos (nómina con varios
  empleados; periodificación con reversión), comprobados contra el motor del SIF.
- `mcp_server/herramientas/_herr_plantillas_asiento.py`: las cuatro herramientas
  (tres de lectura). Visibles solo con el asesor contable activo y acceso al SIF.
- `_mod_contabilidad_sif.pedir_con_errores`: un 400 del SIF vuelve entero, con
  su lista `errores`; `pedir` lo recortaría.
- Panel: evento del navegador `gd:preguntar-ia` (`App.jsx`) que abre el chat con
  el texto puesto en la caja.

## Pendiente

- Plantillas de serie comunes a todas las empresas, pedidas al SIF en [5.12].

## El freno del chat lateral

El chat se rinde tras 8 consultas seguidas sin contestar, para que una IA en
bucle no gaste sin límite. Montar una plantilla necesita más (guía, varias
cuentas, probar, corregir): en cuanto la IA usa la guía o la prueba de
plantillas, el freno de esa pregunta sube a 15 (`HERRAMIENTAS_TAREA_LARGA` en
`panel_cliente/chat_ia.py`). El resto de preguntas sigue con 8.
