# Revisión legal, consumidor y privacidad - Materiales FZAC

Fecha: 31 de julio de 2026  
Alcance: términos, privacidad, arrepentimiento, devoluciones, reembolsos, datos personales y controles de base.

> Documento técnico y operativo. La revisión jurídica final debe realizarla un profesional matriculado y la información fiscal debe validarla el responsable impositivo.

## Resumen ejecutivo

El proyecto ya contaba con solicitud de arrepentimiento, número de trámite, email de constancia, seguimiento por cliente, gestión administrativa y reembolso total idempotente de Mercado Pago. La revisión actualiza el marco visible a la Disposición 954/2025, elimina cláusulas potencialmente restrictivas y refuerza el acceso y la protección de datos.

## Controles implementados

| Área | Estado | Evidencia |
| --- | --- | --- |
| Acceso al arrepentimiento | Implementado | Enlace visible sobre el header en desktop y mobile, además de home/footer |
| Uso sin registro | Implementado | Formulario público; número de pedido opcional |
| Código de trámite | Implementado | Número aleatorio, respuesta inmediata e idempotencia única en base |
| Constancia | Implementado | Pantalla y email Resend cuando está configurado |
| Duplicados | Protegido | Índice único por `idempotency_key` y recuperación del trámite existente |
| Abuso de API | Reforzado | Same-origin, JSON obligatorio, máximo 16 KiB y rate limit |
| Privacidad de solicitudes | Reforzado | RLS forzada, sin acceso anónimo directo y sin escrituras de cliente |
| Gestión admin | Implementado | Autenticación admin, límite de cambios, nota obligatoria y auditoría |
| Reembolso MP | Implementado | Solo pago aprobado, idempotencia, conciliación y RPC transaccional |
| Stock por devolución | Protegido | Restitución dentro de la misma transición transaccional y una sola vez |
| Datos de tarjeta | No almacenados | Procesamiento externo; secretos server-side |
| Derechos de datos | Documentados | Acceso, rectificación, actualización y supresión con plazos y contacto |

## Flujo de devolución

1. El consumidor inicia el trámite sin autenticación obligatoria.
2. La API valida origen, tamaño, formato, teléfono, email y texto seguro.
3. Se genera un código único y se intenta vincular la orden solo si email o usuario coinciden.
4. El administrador revisa la solicitud y registra una resolución auditada.
5. Aprobar el trámite no mueve dinero automáticamente.
6. Si corresponde, un administrador procesa el reembolso sobre un pago Mercado Pago aprobado.
7. Mercado Pago confirma la devolución y la RPC actualiza pago, orden, ticket, stock, notificaciones y auditoría en una transición.
8. Si el proveedor devuelve el dinero pero la actualización local falla, el sistema bloquea la repetición y crea una conciliación administrativa.

## Base de datos y exposición

- `consumer_refund_requests` contiene PII y no tiene lectura anónima.
- El usuario autenticado puede leer únicamente solicitudes vinculadas a su `auth.uid()`.
- Las altas públicas pasan por una ruta server-side con `service_role`; esa clave no llega al navegador.
- Las mutaciones administrativas pasan por `requireAdmin`, validación de origen, Zod y rate limit.
- Email y teléfono se guardan porque son necesarios para la constancia y coordinación; no se solicita DNI.
- La metadata tiene una prohibición expresa de guardar tarjetas, contraseñas o tokens.
- No se implementa borrado automático: pedidos, pagos, garantías y reclamos pueden estar sujetos a conservación legal. Las solicitudes de supresión deben analizarse caso por caso.

## Riesgos y pendientes antes de producción

- Completar en Render `FZAC_LEGAL_NAME`, `FZAC_CUIT`, `FZAC_LEGAL_ADDRESS` y `FZAC_CUSTOMER_SERVICE_HOURS` con datos reales.
- Aplicar la migración `20260731000000_consumer_legal_data_hardening.sql` al proyecto remoto y verificar permisos.
- Validar textos con asesor legal, especialmente excepciones aplicables a materiales personalizados, usados o integrados a procesos productivos.
- Definir y documentar una política interna de conservación por categoría de dato.
- Confirmar que Resend entregue constancias desde un dominio verificado.
- Integrar facturación fiscal antes de denominar factura al comprobante interno.
- El rate limiter en memoria es una primera barrera por instancia; para múltiples contenedores se recomienda un límite distribuido o protección equivalente en el edge.

## Normativa consultada

- Ley 24.240 de Defensa del Consumidor.
- Código Civil y Comercial, artículos 1105 a 1116.
- Disposición 954/2025 sobre derecho de arrepentimiento.
- Resolución 270/2020 sobre protección al consumidor en comercio electrónico.
- Ley 25.326 de Protección de Datos Personales.

