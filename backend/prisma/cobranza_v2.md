# Cobranza App v2 - Data Model Guide

Este diseno implementa tu requerimiento completo en PostgreSQL:

- Roles fijos: `ADMIN`, `AUXILIAR`, `COBRADOR`.
- Usuarios creados por admin (`created_by_admin_id`).
- Clientes por cobrador (`clients.collector_id`).
- Prestamos con interes fijo 20% y calculo automatico (`loans.total_amount`, `loans.pending_amount`).
- Pagos ligados a prestamo y cobrador (`payments`).
- Gastos por cobrador (`expenses`).
- Cierre diario consolidado y auto-cierre (`daily_cash_closures`, `fn_auto_close_previous_day`).
- Actividad de cobrador y alerta >3h (`collector_activity`, `fn_emit_inactivity_alerts`).
- Notificaciones para admin (`notifications`).
- Seguridad con RLS por rol y por ownership.

## Archivos

- SQL ejecutable completo: `backend/prisma/cobranza_v2.sql`

## Como aplicarlo

1. Crear una base nueva (recomendado para no romper el esquema actual).
2. Ejecutar:

```sql
\i backend/prisma/cobranza_v2.sql
```

3. Crear usuario admin inicial desde SQL (ejemplo):

```sql
insert into users (full_name, email, phone, password_hash, role_id, status)
select
  'Administrador',
  'admin@cobros.local',
  '3000000000',
  '<bcrypt_hash>',
  r.id,
  'ACTIVE'
from roles r
where r.code = 'ADMIN';
```

## Operacion diaria

- Cierre manual:

```sql
select fn_close_cash_day('<collector_uuid>', current_date, '<collector_uuid>', false, 'Cierre manual');
```

- Auto-cierre (ejecutar 00:00+):

```sql
select fn_auto_close_previous_day(now());
```

- Alertas de inactividad (cada 15 min):

```sql
select fn_emit_inactivity_alerts(now());
```

## Contexto de seguridad (RLS)

Antes de consultas por request autenticado, el backend debe setear:

```sql
set local app.user_id = '<authenticated_user_uuid>';
set local app.role = 'ADMIN'; -- o AUXILIAR / COBRADOR
```

Sin ese contexto, las politicas RLS no sabran que filas autorizar.
