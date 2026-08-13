# Cierre de módulos de IA FZAC

Fecha: 2026-08-12
Alcance: asistente comercial, seguridad, grounding, privacidad, observabilidad y evaluaciones.

## Resumen ejecutivo

El asistente funciona con una arquitectura híbrida y controlada: clasificación local entrenada offline, reglas comerciales determinísticas, recuperación de información vigente y una capa generativa opcional que solo puede reescribir hechos autorizados. Ningún modelo confirma pagos, cambia stock, crea pedidos, procesa devoluciones ni decide permisos.

## Módulos terminados

| Módulo | Estado | Resultado |
| --- | --- | --- |
| Clasificador local | Terminado | Naive Bayes versionado, reproducible y sin datos de clientes. |
| Orquestador | Terminado | Rutas tipadas para seguridad, cálculos, catálogo, pedidos propios, conocimiento y guía. |
| Herramientas | Terminado | Consultas server-side de solo lectura con trazas sanitizadas. |
| Catálogo vivo | Terminado | Productos, categorías, precio y stock salen de información vigente y se revalidan fuera del chat. |
| Conocimiento FZAC | Terminado | Corpus administrable, versionado, con fuente y fecha de actualización. |
| Cálculos | Terminado | Rangos explicables de pintura, placas y volumen; no inventa dosificaciones. |
| Seguridad | Terminado | Bloqueo de prompt injection, exfiltración, código y datos de terceros; redacción de PII y pago. |
| Privacidad | Terminado | Persistencia permanente solo con consentimiento; sin consentimiento funciona en sesión. |
| LLM opcional | Preparado | HTTPS, allowlist, timeout, límite de respuesta, grounding, fallback y circuit breaker. Desactivado por defecto. |
| Calidad | Terminado | Feedback, cola humana, confianza, grounding, eventos de seguridad y uso de herramientas. |
| Precios de mercado | Preparado | Referencias privadas verificadas y normalizadas; nunca cambian precio ni checkout. |
| Evaluación | Terminado | Casos determinísticos para consultas normales, aislamiento, ataques, redacción y métricas. |

## Controles de datos

- Un pedido se consulta únicamente con el `user_id` de la sesión autenticada.
- Los visitantes no pueden consultar pedidos privados.
- Los textos sensibles se reemplazan antes de persistir o invocar un proveedor externo.
- Las trazas guardan nombre, estado, duración y cantidad de resultados, no payloads ni credenciales.
- El historial persistente depende del consentimiento de preferencias y de la validación de propiedad de la conversación.
- El conocimiento recuperado se trata como datos, nunca como instrucciones ejecutables.

## Límites deliberados

- El chatbot no compra, cobra, reembolsa ni modifica inventario.
- Una alternativa de catálogo no se presenta como equivalente técnico garantizado.
- La inteligencia de mercado necesita al menos dos observaciones verificadas de fuentes distintas.
- El aprendizaje desde conversaciones no es automático: una persona revisa y publica conocimiento.
- El proveedor generativo permanece desactivado hasta contar con contrato, clave, host permitido y evaluación de privacidad.

## Trabajo humano pendiente

1. Aprobar el contenido comercial y técnico cargado en el panel de conocimiento.
2. Definir proveedores y permisos contractuales si se habilita un LLM externo.
3. Cargar fuentes comerciales autorizadas y comparables para referencias de mercado.
4. Revisar periódicamente votos negativos, derivaciones y consultas sin resolver.
5. Validar con responsables de FZAC rendimientos, unidades, zonas de entrega y políticas antes de publicarlos.

## Validación requerida antes de producción

```bash
corepack pnpm run typecheck
corepack pnpm run lint
corepack pnpm run assistant:check
corepack pnpm run assistant:eval
corepack pnpm run security:check
corepack pnpm run build
```

La integración opcional con un proveedor externo no es requisito para publicar: el flujo local y fundamentado es el modo seguro predeterminado.

## Resultado de validación

| Control | Resultado |
| --- | --- |
| TypeScript | OK |
| ESLint | OK |
| Modelo offline | OK: 140 documentos, 13 intenciones y 32 casos de evaluación |
| Evaluación de orquestación y seguridad | OK: 7/7 |
| Smoke conversacional | OK: cambios de tema, conocimiento, cálculos, handoff y ataques |
| E2E de conocimiento y seguridad | OK: 28/28 en la compilación local |
| Build de producción | OK: 74 páginas generadas |
| Auditoría de dependencias productivas | OK: sin vulnerabilidades conocidas |
| Persistencia remota | Bloqueada por infraestructura: el hostname configurado de Supabase no resolvió por DNS durante la validación |

La falla de persistencia no se silenció: el chat conservó el modo sin escrituras y las consultas de catálogo devolvieron indisponibilidad temporal. Antes de producción se debe reactivar o corregir el proyecto Supabase configurado y volver a ejecutar `corepack pnpm run assistant:test:persistence`.
