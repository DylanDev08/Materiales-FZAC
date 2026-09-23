# Estado comercial de Materiales FZAC

Checkpoint de producción posterior a la auditoría comercial del 23/09/2026.

## Catálogo

- 1770 productos activos con precio de venta mayor a cero.
- 1767 productos con fuente/costo de proveedor.
- 2 productos sin imagen real: Clavos y Placa Drywall 12,5mm.
- 3 productos manuales sin costo/fuente de proveedor: Cemento Portland x 50kg, Clavos y Placa Drywall 12,5mm.
- Universo Pinturas conserva margen 0% hasta aprobación comercial explícita.
- Yesera Rosarina conserva regla 20% base / 10% sobre $60.000.
- Las reglas por proveedor se administran desde Auditoría de precios; guardar y aplicar son acciones separadas.

## Rentabilidad

El panel privado incluye reporte imprimible/PDF con:
- costo proveedor;
- precio FZAC;
- margen configurado y markup real;
- stock;
- unidades vendidas;
- facturación;
- costo estimado vendido;
- ganancia bruta estimada;
- comisiones informadas por el proveedor de pagos;
- contribución después de comisiones;
- cobertura de costos.

Las ventas sin costo proveedor conocido quedan fuera del cálculo de ganancia para no sobreestimarla.

## Pagos

- Checkout Pro y Card Brick comparten por defecto las credenciales del mismo ambiente.
- Card Brick sigue detrás de MERCADOPAGO_CARD_ENABLED.
- Producción real continúa fail-closed hasta completar credenciales/webhook y confirmar PAYMENTS_PRODUCTION_CONFIRMED.

## Seguridad

- Panel y APIs administrativas exigen MFA/AAL2.
- La RPC que aplica reglas masivas de precios es service_role-only.
- Quality Gate y CodeQL deben permanecer verdes antes del deploy canónico.
