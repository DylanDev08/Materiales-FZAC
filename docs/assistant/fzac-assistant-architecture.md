# Arquitectura del asistente FZAC

## Objetivo

El asistente ayuda a encontrar productos, entender stock y precios visibles, calcular una compra inicial, explicar entrega/retiro, orientar sobre pagos y consultar pedidos propios. No reemplaza las validaciones del backend ni toma decisiones financieras.

## Capas

1. Entrenamiento offline en Python
   - Fuente: `data/assistant/intents.es-AR.json`.
   - Entrenador: `scripts/assistant/train_intents.py`.
   - Resultado versionado: `lib/assistant/generated/intent-model.json`.
   - No usa servicios externos, claves ni datos de clientes.

2. Inferencia en Next.js
   - `lib/assistant/ml-intents.ts` carga el artefacto generado.
   - El mensaje actual tiene prioridad sobre el historial.
   - El contexto solo completa respuestas breves y ambiguas.
   - La salida incluye intencion, confianza, margen y origen de la decision.

3. Orquestacion comercial
   - `app/api/assistant/route.ts` consulta catalogo y pedidos propios.
   - Las respuestas de pagos, devoluciones y seguridad usan reglas deterministicas.
   - Las conversaciones se persisten solo despues de validar propiedad por usuario o visitante.

4. Estado y estimaciones
   - `lib/assistant/conversation-state.ts` extrae proyecto, superficie, dimensiones, manos, margen, espesor y distancia.
   - `lib/assistant/estimators.ts` calcula rangos de pintura, placas estandar y volumen de obra.
   - Cada resultado explica supuestos y pide datos faltantes. No convierte volumen en bolsas sin una dosificacion valida.

5. Conocimiento FZAC
   - `lib/assistant/knowledge.ts` recupera respuestas publicadas desde `assistant_knowledge` y usa el contenido estático versionado solo como respaldo ante una caída o configuración incompleta.
   - Cada coincidencia incluye una fuente interna visible y acciones hacia la politica o flujo correspondiente.
   - Las fichas de producto se leen del catalogo activo; precio y stock siguen siendo datos server-side y se revalidan en checkout.
   - La metadata conserva el identificador de conocimiento usado para facilitar auditoria y mejora del corpus.

6. Catalogo dinamico
   - `lib/assistant/catalog-intelligence.ts` construye una vista temporal de productos y categorias activos.
   - Busca por nombre, SKU, marca, rubro, subcategoria, descripcion y ficha tecnica, con sinonimos comunes de obra.
   - Una alta o modificacion desde Admin invalida la cache; en otras instancias aparece en un maximo de 20 segundos.
   - Los productos nuevos no requieren reentrenar el clasificador: el ML detecta la intencion y la recuperacion consulta la informacion vigente.
   - Las alternativas son sugerencias del mismo rubro/unidad. Nunca se garantiza equivalencia tecnica sin revisar medidas, rendimiento y fabricante.

7. Administracion y versionado
   - `/admin/conocimiento` permite al administrador crear, editar, publicar o pausar respuestas verificadas.
   - El API `/api/admin/assistant-knowledge` exige sesión administrativa, Zod y rate limit; no expone datos técnicos al cliente.
   - El trigger `archive_assistant_knowledge_version` conserva el contenido anterior en `assistant_knowledge_versions` antes de cada actualización.
   - RLS permite a visitantes leer únicamente contenido activo. La administración, versiones y feedback quedan fuera del acceso anónimo.

8. Capa de lenguaje opcional
   - `lib/assistant/language-model.ts` puede mejorar la redaccion sobre una respuesta ya fundamentada.
   - Esta desactivada por defecto y el asistente funciona sin proveedor externo.
   - El endpoint debe ser HTTPS y estar permitido por host; la clave solo existe en servidor.
   - Se redactan emails, identificadores y secuencias numericas antes de enviar contexto.
   - La salida se descarta si agrega numeros o enlaces, excede el limite o demora mas de cuatro segundos.

9. Inteligencia de precios
   - `/admin/precios-mercado` administra fuentes y observaciones privadas.
   - Las referencias se normalizan por unidad y cantidad, vencen y se deduplican por huella.
   - El asistente solo informa un rango con al menos dos observaciones de dos fuentes activas y verificadas.
   - Los feeds deben ser HTTPS, estar permitidos por host, pasar Zod y respetar limites de tiempo y tamano.
   - Una referencia nunca modifica el precio FZAC, checkout, stock ni pedidos.

10. Calidad e interfaz
   - Maximo de cuatro acciones por respuesta.
   - Historial local acotado y bloqueo durante cada envio.
   - Los enlaces recuperados se limitan a rutas internas FZAC antes de guardarlos o mostrarlos.
   - Escalamiento humano solo para reclamos sensibles o intentos sin resolucion.
   - Cada respuesta basada en conocimiento recibe una traza anónima. El voto útil/por mejorar se guarda sin copiar mensajes, datos del carrito ni información de pago.

## Limites de seguridad

El modelo nunca puede:

- aprobar o rechazar pagos;
- descontar o modificar stock;
- crear reembolsos;
- consultar pedidos de otro usuario;
- ejecutar contenido enviado por el cliente;
- leer claves, tokens o variables privadas;
- reemplazar la validacion Zod, autenticacion, RLS o rate limits.

Los importes, unidades, stock y estados se obtienen desde servicios server-side existentes. El texto del usuario se limita, normaliza y nunca se concatena en SQL.

## Flujo de entrenamiento

```text
Corpus JSON -> validacion Python -> entrenamiento Naive Bayes
            -> evaluacion de regresion -> modelo JSON versionado
            -> inferencia TypeScript en Render
```

Comandos:

```bash
npm run assistant:train
npm run assistant:check
npm run assistant:test
npm run assistant:test:persistence
```

`assistant:check` debe ejecutarse en CI para impedir que el corpus y el modelo publicado queden desincronizados.

## Estado actual y evolucion

La maquina de estados y las calculadoras de pintura, placas y volumen de obra ya estan separadas del route handler. La persistencia, la continuidad, las fuentes y el feedback se prueban con una conversacion temporal y limpieza automatica mediante `assistant:test:persistence`.

La recuperacion de conocimiento FZAC cubre politicas comerciales y fichas publicas del catalogo, y su contenido se administra desde el panel sin desplegar código. Un proveedor generativo futuro debe ser opcional, server-side y limitado a redactar sobre datos previamente autorizados; nunca debe convertirse en fuente de verdad de pagos, pedidos o stock.
