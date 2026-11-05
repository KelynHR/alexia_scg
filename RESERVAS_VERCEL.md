# Alexia · Reservas con formulario propio

La agenda guarda las solicitudes en tu propia base de datos y muestra una
confirmación con nombre, fecha, hora, modalidad y folio. No depende de Outlook.
No envía correos, invitaciones ni mensajes automáticamente.

## Lo que incluye

- Formulario de diagnóstico con nombre, empresa, correo, teléfono opcional,
  área de interés y descripción del reto opcional.
- Horarios de 60 minutos, de lunes a viernes: 09:00, 10:00, 11:00, 12:00,
  13:00, 16:00 y 17:00, en horario de Querétaro / centro de México.
- Reservas con una hora de anticipación mínima y hasta 90 días de anticipación.
- Un calendario compartido. Una sola reserva activa por horario, incluso
  cuando dos personas intentan reservar al mismo tiempo.
- Estado inicial «registrada», que ya ocupa el horario.
- Reintentos con la misma solicitud sin crear otra reserva.
- Panel privado en /admin, filtros por fecha/estado y exportación CSV.
- Cambios de estado a «confirmada» o «cancelada». Cancelar libera el horario.
  No borra el registro ni notifica automáticamente a la persona.
- Modal: «Gracias, [nombre]. Tu solicitud ya está registrada», únicamente
  después de guardar. Si hay un error, conserva los campos y permite reintentar.

## Probar en tu computadora

Necesitas Node.js 22 actualizado (22.9 o posterior).
Abre la carpeta del proyecto en VS Code y ejecuta:

```bash
npm ci
npm run setup-local
npm start
```

Abre http://localhost:3000 y el panel http://localhost:3000/admin.
`setup-local` crea un archivo `.env` con una contraseña y un secreto aleatorios.
Abre ese archivo en VS Code y usa el valor de `ADMIN_PASSWORD` para entrar al panel.
No reemplaza un `.env` existente. Si ya existe, completa los campos que falten.

Los datos locales se guardan en `data/reservas.sqlite`, no en el navegador.
Persisten al reiniciar el servidor. No se subirán a Neon automáticamente:
las reservas de prueba locales y las de producción son bases separadas.

## Publicar en Vercel

### 1. Subir el proyecto completo

Sube al repositorio el contenido del ZIP: páginas, carpetas api/, lib/, database/,
scripts/, css/, js/, icons/, package.json, package-lock.json y vercel.json.
No subas node_modules/, dist/, data/ ni `.env`.
El `.gitignore` ya los excluye; si cargas archivos manualmente, respeta esa exclusión.

Importa ese repositorio en Vercel. Mantén la configuración de `vercel.json`:

- Framework: Other.
- Build Command: npm run build.
- Output Directory: dist.
- Node.js: 22.x.
- Root Directory: la carpeta que contiene package.json.

El build copia exclusivamente los archivos públicos. No publica datos locales,
secretos, SQL, pruebas ni código del servidor como archivos descargables.
Las funciones de api/ se despliegan aparte con el runtime de Vercel.

### 2. Conectar almacenamiento persistente

En el proyecto de Vercel, abre Storage / Marketplace e integra una base
PostgreSQL de Neon. Conéctala al proyecto y verifica la variable `DATABASE_URL`.
Debe contener la cadena PostgreSQL completa que entrega Neon.

No uses un archivo SQLite dentro de Vercel: el almacenamiento local de sus
funciones es efímero. Esta app rechaza guardar en producción sin DATABASE_URL
para evitar que una reserva parezca guardada y se pierda después.

### 3. Crear las tablas una vez

Abre el SQL Editor de tu base Neon, copia y ejecuta TODO el archivo
`database/schema.sql`. El script crea las tablas `reservas` y `limites`,
sus índices y la restricción contra horarios duplicados.

El despliegue no ejecuta migraciones ni modifica tablas por sí solo.
Para futuras actualizaciones, revisa los cambios de esquema antes de aplicarlos.

### 4. Configurar variables del servidor

En Vercel → Project → Settings → Environment Variables:

| Variable | Valor |
| --- | --- |
| DATABASE_URL | Conexión PostgreSQL de tu base Neon. |
| APP_ORIGIN | El dominio HTTPS final exacto, sin ruta ni barra final; por ejemplo https://app.alexia.com.mx. |
| ADMIN_PASSWORD | Contraseña privada de al menos 16 caracteres. |
| ADMIN_SESSION_SECRET | Secreto aleatorio de al menos 32 caracteres. |

Puedes generar la contraseña y el secreto con `npm run setup-local` y copiarlos
desde tu `.env` a las variables privadas de Vercel. No publiques el archivo ni
pegues sus valores en el chat o en el HTML. El proyecto no incluye credenciales.

Si usarás una dirección https://tu-proyecto.vercel.app, esa es APP_ORIGIN.
Para dominios adicionales usa una redirección al dominio canónico: los envíos
solo se aceptan desde APP_ORIGIN. En Preview, usa variables y base de prueba
separadas y la dirección exacta de ese despliegue, o prueba solo en Production.
Nunca conectes pruebas de Preview a tu base de reservas reales.

Después de guardar las variables, haz Redeploy.

### 5. Validar el flujo publicado

1. Abre el sitio conectado a internet y recarga para actualizar la app instalada.
2. Elige una fecha hábil y un horario. Completa y envía el formulario.
3. Comprueba el modal y su folio.
4. Entra en https://TU_DOMINIO/admin y confirma que aparece la solicitud.
5. Abre el sitio en otro dispositivo: ese horario debe aparecer ocupado.
6. Cancela la reserva de prueba desde el panel y confirma que el horario se libera.

Si la conexión o la configuración falla, la app no mostrará éxito ni habilitará
reservas usando horarios de una copia offline. Abrir solo index.html con doble
clic o usar un hosting exclusivamente estático no ejecuta las API.

## Protección de los datos

- El listado y el CSV requieren sesión de administrador. La página HTML del
  acceso es pública, pero no contiene datos de reservas.
- Sesión de 8 horas, cookie HttpOnly, SameSite=Strict y Secure en Vercel.
- Cambiar ADMIN_PASSWORD o ADMIN_SESSION_SECRET y volver a desplegar invalida
  las sesiones emitidas con los valores anteriores.
- Comprobación de origen, validación de campos y consultas parametrizadas.
- Límite de intentos de acceso y reservas por IP, y campo señuelo contra bots
  simples. Estos controles básicos no sustituyen un servicio contra bots
  distribuidos; puedes reforzarlos con las reglas de Firewall de Vercel.
- Consulta pública de disponibilidad: solo fecha y hora ocupadas, sin nombres,
  correos, teléfonos ni retos de otras personas.
- Respuestas privadas/API sin caché; el service worker no almacena esas rutas.
- Texto del formulario mostrado como texto, sin ejecutar HTML; CSV protegido
  frente a fórmulas en los datos de las celdas.
- Las reservas reales permanecerán hasta que el administrador establezca y
  aplique su política de conservación. Los datos de límites expiran y se
  eliminan automáticamente en solicitudes posteriores.

## Cambiar horarios y campos

Los horarios están en `lib/config.js` y en el bloque de agenda de index.html.
Mantén ambos sincronizados. La duración es fija de 60 minutos y la base bloquea
un inicio de horario; si agregas turnos de distinta duración o nuevos horarios
solapados, debes ampliar también la restricción de solapamientos del modelo.

## Pruebas incluidas

```bash
npm test
npm run build
```

Las pruebas usan SQLite temporal y un DOM de prueba, sin enviar correos ni
escribir en una base remota. Cubren guardado persistente, reintentos, concurrencia,
validación, disponibilidad, autenticación, cancelación, exportación y confirmación
posterior al guardado. Se hizo además una prueba HTTP local del flujo completo.

No se ha desplegado este proyecto ni se ha creado/conectado una base Neon real.
La validación visual en navegador continúa pendiente por restricciones del entorno.

## Documentación oficial

- [Almacenamiento en Vercel Marketplace](https://vercel.com/docs/marketplace-storage)
- [SQLite y almacenamiento efímero en Vercel](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel)
- [Funciones Node.js de Vercel](https://vercel.com/docs/functions/runtimes/node-js)
- [Driver serverless de Neon](https://neon.com/docs/serverless/serverless-driver)
