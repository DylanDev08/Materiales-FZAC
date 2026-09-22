# Backup y recuperación — Materiales FZAC

Última revisión: 2026-09-22

## Objetivo

Poder recuperar operación sin improvisar si una migración, deploy o incidente afecta datos.

## Fuente de verdad

- Base productiva: Supabase `gooxgjzetziwnxhuymmx`
- Código y migraciones: `DylanDev08/Materiales-FZAC`
- Rama productiva: `main`

## Qué debe preservarse

Prioridad alta:
- `orders`
- `order_items`
- `payments`
- `payment_events`
- `products`
- `inventory_movements`
- `purchase_tickets`
- `purchase_ticket_items`
- `stock_reservations`
- `profiles`
- `addresses`
- `consumer_refund_requests`
- tablas financieras y de proveedores

No considerar `public.users.password` ni `public.users.refreshToken` parte de un backup útil: esos secretos legacy fueron retirados y deben permanecer NULL.

## Antes de una migración sensible

1. Confirmar project ref.
2. Ejecutar Quality Gate.
3. Ejecutar la migración en `BEGIN ... ROLLBACK` cuando sea posible.
4. Verificar advisors de seguridad/performance.
5. Registrar conteos de tablas críticas.
6. No ejecutar DELETE/UPDATE masivo manual sin consulta previa y plan de rollback.

## Restore drill completo

El conector actual no expone una operación de snapshot/restore sobre una copia aislada de la base. El drill correcto debe hacerse en una rama/proyecto temporal de Supabase o desde un backup administrado.

Crear una rama de Supabase puede tener costo y requiere aprobación explícita antes de crearla.

Una prueba válida debe demostrar:

1. esquema reconstruido desde migraciones;
2. funciones/RLS presentes;
3. datos restaurados desde backup;
4. conteos de órdenes/pagos/productos consistentes;
5. una orden pagada conserva items, pago, ticket y movimientos;
6. stock final coincide;
7. login de prueba y lectura RLS funcionan;
8. no se modificó producción.

## Checks mínimos post-restore

```text
stock negativo = 0
provider_payment_id duplicados = 0
órdenes activas sin items = 0
pagos aprobados desalineados = 0
payment_events trabados = 0
credenciales legacy = 0
```

## Rollback de aplicación

Si el problema es solo código:
- volver al último commit sano;
- redeploy;
- no revertir automáticamente una migración que ya recibió escrituras.

Si código y DB dependen del mismo cambio:
- restaurar primero compatibilidad del código;
- reconciliar datos;
- recién después evaluar una migración compensatoria.

## Frecuencia recomendada

Antes de cobros reales:
- ejecutar al menos un restore drill completo.

Después:
- verificar backups periódicamente;
- repetir restore drill tras cambios grandes de pagos, stock o esquema.
