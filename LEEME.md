# Plantilla web inmobiliaria

Misma web que Zurban (inicio, propiedad, ficha, calculadora, admin con conexión a Zonaprop), preparada para usarse con cualquier inmobiliaria.

## Qué se cambia para cada inmobiliaria

1. **`config.js`**: nombre, corredor/a y matrícula, WhatsApp, mail, dirección, horarios, redes, dominio, estadísticas, colores y datos de Supabase. Todo lo visible de la web sale de acá.
2. **Textos del `<head>`** de `index.html` y `calculadora.html` (`<title>`, `description`, `og:...`). Son los que muestran Google y WhatsApp al compartir el link, y no pueden leerse desde `config.js`.
3. **`/files/og-image.jpg`**: la imagen que aparece al compartir el link (1200 × 630 px).

## Pasos para una inmobiliaria nueva

1. **GitHub**: crear un repositorio nuevo y subir todos estos archivos.
2. **Supabase**: crear un proyecto nuevo.
   - En SQL Editor, correr `supabase_esquema.sql`.
   - En Authentication, desactivar "Allow new users to sign up" y crear el usuario del admin.
   - En Project Settings > API, copiar la URL y la clave *publishable* y pegarlas en `config.js`.
3. **Vercel**: crear un proyecto nuevo desde ese repositorio y cargar las variables de entorno:
   - `SUPABASE_URL`, `SUPABASE_KEY`: las mismas de `config.js`.
   - `ANTHROPIC_API_KEY`: para el botón "Generar descripción con IA".
   - `CONTACTO_EMAIL`, `ADMIN_EMAILS`.
   - `ZP_CLIENT_ID`, `ZP_CLIENT_SECRET`, `ZP_INMOBILIARIA`, `ZP_ENTORNO`: solo si la inmobiliaria tiene API de Zonaprop.
4. **Probar** la web en la dirección `.vercel.app` y cargar las propiedades desde `/admin`.
5. **Dominio**: agregarlo en Vercel (Settings > Domains) y cambiar la delegación o los registros DNS donde esté delegado.

## Cambios respecto de la versión anterior de Zurban

- Se restauraron las secciones de estadísticas ("Nosotros"), servicios, contacto (el formulario guarda en "consultas"), pie de página y botón flotante de WhatsApp.
- El botón de IA del admin ahora usa `/api/ai` en Vercel, en lugar de la función vieja de Netlify.
- Los colores, incluidos los del flyer, salen de `config.js`.
- La música se puede apagar con `musica: false`.
