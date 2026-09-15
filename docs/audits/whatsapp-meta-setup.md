# Preparación segura de WhatsApp y Meta

Estado verificado el 15 de septiembre de 2026: el asistente propio está preparado pero deliberadamente apagado. El agente entrenado actualmente dentro de Meta Business/WhatsApp continúa siendo el canal activo; esta integración no lo reemplaza ni migra el número.

## Arquitectura preparada

```text
Cliente de WhatsApp
  → Meta WhatsApp Cloud API
  → /api/whatsapp/webhook
  → validación de verify token y firma HMAC
  → deduplicación por message_id y rate limit
  → catálogo/reglas FZAC + Supabase server-side
  → respuesta segura o handoff humano
```

Controles implementados:

- GET valida `hub.verify_token` con comparación segura.
- POST exige una firma `x-hub-signature-256` válida.
- El body tiene límite de 256 KiB y el endpoint aplica rate limit.
- `external_message_id` es único para evitar reprocesar un evento.
- El teléfono completo no se persiste: se guarda hash privado y últimos cuatro dígitos.
- Costos, margen, proveedor interno, prompts y secretos no forman parte de las respuestas.
- Un pedido no se expone por conocer solamente un teléfono; cualquier consulta sensible requiere identidad validada o atención humana.
- La integración usa service role únicamente en servidor.

## Estado que debe conservar Render

```text
WHATSAPP_BOT_ENABLED=false
WHATSAPP_BOT_DRY_RUN=true
```

Los secretos (`WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`) y los identificadores de Meta se cargan como variables privadas de Render; nunca se versionan.

## Configuración real en Meta, sin activarla todavía

1. Confirmar en Meta Business que el número y el agente actual admiten coexistencia con Cloud API sin perder el uso manual ni el entrenamiento existente.
2. Usar la app de Meta existente o crear una app Business y agregar el producto **WhatsApp**.
3. Configurar el callback: `https://materiales-fzac-8xmp.onrender.com/api/whatsapp/webhook`.
4. Definir en Meta el mismo verify token guardado como `WHATSAPP_VERIFY_TOKEN` en Render.
5. Suscribir el webhook al campo `messages`.
6. Guardar en Render, sin exponerlos: token de acceso permanente, Phone Number ID, Business Account ID, App Secret y una versión Graph API vigente.
7. Con `WHATSAPP_BOT_ENABLED=false`, probar el challenge GET, token incorrecto, firma inválida y evento sobredimensionado.
8. Solo después de confirmar coexistencia, cambiar temporalmente a `WHATSAPP_BOT_ENABLED=true` conservando `WHATSAPP_BOT_DRY_RUN=true`. Verificar que se registra una conversación pero no se envía un mensaje real.
9. Revisar duplicados, logs sin PII completa, rate limit y handoff.
10. Pasar `WHATSAPP_BOT_DRY_RUN=false` únicamente con aprobación explícita y una ventana supervisada. Tener preparado el rollback inmediato a `WHATSAPP_BOT_ENABLED=false`.

El agente nativo de Meta es adecuado para FAQ entrenada. El bot propio agrega valor solo cuando se necesiten catálogo, precios FZAC, disponibilidad y estados reales del e-commerce. No se recomienda migrar a Cloud API-only hasta que Meta confirme la coexistencia para esta cuenta y este número.
