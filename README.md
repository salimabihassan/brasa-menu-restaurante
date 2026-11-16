# BRASA · Pedidos con retiro

Prototipo de portafolio para Workana y Upwork. Una web responsive en español de Chile con precios CLP enteros. Marca, dirección y productos ficticios.

## Ejecutar

Node.js 20.9 o superior.

```sh
npm install
npm run dev
```

Abrir http://localhost:3000. `npm run build` genera la versión estática en `out/`. `npm run typecheck` comprueba TypeScript.

## Probar el recorrido

1. Agregar productos y extras al carrito.
2. Completar nombre y teléfono ficticios.
3. Adjuntar una imagen/PDF de muestra (máximo 1 MB) o elegir tarjeta simulada.
4. Abrir `/local/` (cocina). Aprobar/rechazar comprobante, aceptar el pedido, marcar listo y entregado.
5. Volver a «Mi pedido» para consultar historial. Si el comprobante fue rechazado, adjuntar otro.
6. Activar sonido en el panel; los pendientes de revisión generan recordatorios cada 60 segundos mientras esté abierto.

## Conexión opcional a Supabase

Para desarrollar y verificar primero en este computador: seguir `docs/local-development.md`. `npm run db:start`, `npm run db:setup` y `npm run dev` activan el entorno local; `npm run test:local` prueba la API real sin publicar nada.

La integración está preparada en `lib/supabase.ts` y `lib/cloud-orders.ts`, con migración PostgreSQL y datos iniciales en `supabase/`. Ver `docs/supabase-setup.md` para activar un proyecto nuevo. Sin variables públicas configuradas sigue funcionando la demo local. Con Supabase configurado, usa acceso del personal, comprobantes privados y sincronización cada 8 segundos; no mezcla ni migra automáticamente los pedidos locales anteriores.

## Límites del modo local

La persistencia usa localStorage de este navegador y origen. La sincronización entre pestañas funciona mediante eventos storage; no existe sincronización entre dispositivos ni backend. El panel está abierto intencionalmente para la demo, sin autenticación. No usar datos personales ni comprobantes reales. Los comprobantes quedan en el navegador, no en un almacenamiento privado remoto. Las imágenes de producto y fuentes requieren internet.

No hay cobros, transferencias, boletas ni notificaciones push reales. La tarjeta simula exclusivamente un resultado aprobado. Los recordatorios dependen del panel abierto y pueden retrasarse si el navegador suspende la pestaña.

## Trabajo pendiente

Crear/configurar el proyecto Supabase y validar Auth/Storage entre dispositivos. La migración SQL ya incorpora autorización por sucursal, validación de precios, idempotencia y control de versión de los pedidos. Faltan pasarela real, webhooks, recuperación de pagos y protección contra abuso para abrirlo a una audiencia amplia. No publicar como sistema comercial antes de completar estas integraciones.

`lib/catalog.ts` separa catálogo, sucursal, tipos e importes. Cada pedido contiene branchId y copia de nombres, precios y extras. La interfaz omite el selector mientras existe una sola sucursal. El modelo objetivo está en `docs/data-model.md`.

## GitHub

El repositorio incluye .gitignore para dependencias, builds y secretos. No se ha creado ni publicado un repositorio GitHub. No incluir archivos .env ni datos reales al subirlo.

La administración del menú está en `/admin/`, separada de la web pública `/`. Ver [gestión del menú](docs/menu-management.md).
