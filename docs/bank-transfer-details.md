# Datos de transferencia

El administrador configura la cuenta por sucursal en `/admin/transferencias/`: banco, tipo de cuenta, número como texto (conserva ceros iniciales), titular, RUT y correo opcional. Puede guardar un borrador sin habilitarlo. Solo administradores activos de esa sucursal pueden guardar; el cliente solo puede leer una cuenta habilitada. No se incluyen claves, contraseñas, credenciales bancarias ni acceso a servicios financieros.

La pantalla de pago muestra los datos habilitados, el monto y botones para copiar todos los datos, cada campo o el monto sin formato monetario. «Copiar todos» genera texto con una línea por campo y su etiqueta. La web no puede garantizar que una aplicación bancaria interprete ese texto o complete automáticamente el formulario: depende del banco y del dispositivo. Siempre revisar el destinatario y el monto dentro del banco antes de pagar.

Se usa Clipboard API cuando está disponible en contexto seguro. Para el acceso LAN HTTP se intenta copia nativa mediante selección temporal y `execCommand('copy')`; si el navegador la rechaza, se muestra el texto seleccionable para copiar manualmente. No se lee el portapapeles automáticamente ni se inicia una transferencia. El mensaje «copiado» depende de la respuesta del navegador, no prueba la aceptación del texto por una aplicación bancaria.

Los datos se actualizan al abrir el pago, cada ocho segundos y al recuperar el foco. Si falla la lectura, se retiran los datos para evitar mostrar una cuenta que podría estar desactualizada. El administrador debe reintentar la carga antes de poder guardar si falla la lectura inicial. El RUT se normaliza sin puntos, con guion automático y dígito verificador en mayúscula. Se valida formato y dígito verificador con módulo 11 tanto en la web como en PostgreSQL; no se comprueba titularidad, existencia ni relación con la cuenta bancaria. Los errores aparecen bajo el campo correspondiente; el servidor devuelve también la clave del campo en `DETAIL`. No se corrige automáticamente un dígito verificador equivocado.

El proyecto sigue en modo de demostración: se conserva «No transfieras dinero real» y se permiten comprobantes de muestra cuando no se ha configurado una cuenta. No cambia la simulación de tarjeta, la revisión manual del comprobante ni los pedidos existentes. No hay cuenta ficticia permanente precargada; los datos temporales usados para la prueba se retiraron.

## Verificación

- Migración `202611160001_bank_details.sql` aplicada en local.
- `tests/bank-details.test.mjs` comprueba texto completo y ceros iniciales.
- `tests/staff-roles.integration.mjs` prueba escritura solo por administrador, cuenta deshabilitada oculta al cliente, formato inválido y normalización con una sucursal temporal.
- Se comprobó el formulario administrativo y el mensaje de copia en el navegador mediante la dirección LAN, sin enviar pedidos ni realizar pagos. El portapapeles virtual de la herramienta de navegador no reflejó la copia nativa; el pegado en una app bancaria real queda pendiente de la prueba manual del usuario.

El usuario confirmó el 16 de noviembre de 2026 que «Copiar todos los datos» fue reconocido correctamente por Banco Falabella y Mercado Pago en sus pruebas. No garantiza compatibilidad con otras versiones o bancos.

La migración `202611160002_bank_validation.sql` incorpora módulo 11 y errores específicos. `tests/bank-validation.test.mjs` cubre formato, pegado, K, dígito 0, entradas inválidas y errores de los demás campos; la integración de roles comprueba además la validación en PostgreSQL. Se verificó en el navegador que un RUT incorrecto muestra error sin modificar los datos guardados.
