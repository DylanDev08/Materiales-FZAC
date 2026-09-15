# Protección de `main` en GitHub

Repositorio: `DylanDev08/Materiales-FZAC`.

Estado: **activa y verificada mediante la API de GitHub el 15 de septiembre de 2026**.

Configuración de producción elegida para conservar el flujo directo de Dylan:

- Status check requerido: `validate` del workflow **FZAC quality gate**.
- Rama actualizada antes de integrar: requerida (`strict`).
- Pull request obligatorio: no, para no bloquear el trabajo directo del propietario.
- Force push: bloqueado.
- Eliminación de rama: bloqueada.
- Historial lineal: requerido.
- Resolución de conversaciones: requerida cuando exista un pull request.
- Bypass de administradores: permitido para recuperación operativa.

El job `validate` cubre typecheck, lint, integridad del asistente, controles de seguridad, auditoría de dependencias de producción y build. La protección quedó aplicada antes del push final; como `enforce_admins` está desactivado, el propietario conserva recuperación operativa, mientras que el check sigue siendo obligatorio para integraciones sin bypass.

Si fuera necesario reproducirla manualmente: GitHub → **Settings** → **Branches** → **Add branch protection rule** → patrón `main`; exigir el check `validate`, exigir rama actualizada, impedir force pushes y borrado, y guardar.
