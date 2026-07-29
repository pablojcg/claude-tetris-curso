---
name: weather
description: Consulta el clima actual de una ciudad específica. Úsala cuando el usuario pregunte por el clima, la temperatura, o el pronóstico de una ciudad (p. ej. "qué clima hace en Madrid", "temperatura en Bogotá", "/weather Lima").
---

# Weather

Consulta el clima actual de una ciudad usando el servicio gratuito `wttr.in` (no requiere API key).

## Pasos

1. Identifica la ciudad solicitada por el usuario. Si no la especificó, usa **Bogotá, Colombia** como ciudad por defecto.
2. Usa `WebFetch` para pedir el endpoint en formato texto plano:
   ```
   https://wttr.in/{ciudad}?format=%l:+%C+%t+(sensacion+%f)+%h+humedad+%w+viento
   ```
   Reemplaza `{ciudad}` con el nombre de la ciudad, codificado para URL (espacios como `+` o `%20`, sin tildes si falla la primera vez).
3. Si el usuario pide más detalle (pronóstico de varios días), usa en su lugar:
   ```
   https://wttr.in/{ciudad}?format=j1
   ```
   que devuelve JSON con el pronóstico de los próximos días, y resume los campos relevantes (`weatherDesc`, `maxtempC`, `mintempC`, `avghumidity`).
4. Presenta la respuesta al usuario en español, de forma breve: ciudad, condición, temperatura y sensación térmica como mínimo.
5. Si la petición falla (ciudad no encontrada, servicio caído), dilo claramente y sugiere revisar el nombre de la ciudad.

## Notas

- No se requiere autenticación ni clave de API.
- Si el nombre de la ciudad es ambiguo (existen varias ciudades con ese nombre), usa el resultado que devuelva el servicio y acláralo si es relevante (p. ej. incluye el país).
