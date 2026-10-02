# Cómo probarlo en el móvil (5 minutos)

1. Abre la URL del juego en el móvil (Chrome o Safari) y **sube el volumen**.
2. Pulsa **«Toca para empezar»**: suena la música y aparece Clara posando en la portada.
3. **Estudio** (1 min):
   - El tutorial de 3 pasos sale solo la primera vez: toca una prenda, gira a Clara con el dedo y pulsa «¡A brillar!».
   - Prueba una categoría de ropa, cambia el color y el estampado de la prenda puesta.
   - Pulsa los botones de la derecha: **cara**, **manos** (uñas oscuras y reloj en la muñeca izquierda) y **pies**.
   - Pellizca para hacer zoom.
   - Pestañas **Pelo**, **Maquillaje** y **Uñas**.
   - Pulsa el dado para un look sorpresa y guárdalo con **Guardar look**.
4. **Fotos** (1 min): cambia de escenario (incluida *Ibiza al atardecer*), elige una pose, un marco y pegatinas, y pulsa el botón redondo. Descarga el PNG.
5. **Retos** (1 min): elige uno, vístete y pulsa **Presentar al jurado**. Mira las estrellas, los comentarios y las monedas.
6. **Tienda**: con las monedas iniciales puedes comprar el *Top de crochet ibicenco* (55).
7. **Pasarela**: Clara desfila con el look actual.
8. **Armario**: el look guardado aparece con su miniatura. Puedes renombrarlo, duplicarlo o borrarlo.
9. **Sonido** (1 min, con el volumen alto):
   - Pulsa el **engranaje** de arriba: mueve los volúmenes de **Música** y **Efectos** por separado y pulsa **«Probar efectos»** (tela, cremallera, tacones y aplausos). En Android, deja la **Vibración** activada: el móvil vibra al ritmo de cada efecto.
   - En **Fotos**, cambia de escenario: la **discoteca** suena a house, **Ibiza al atardecer** a balear chill y **Nuestra casa** (cuando esté desbloqueada) a guitarra.
   - En el **estudio**, ponte una chaqueta (cremallera), unos tacones (taconazo) y unos pendientes (tintineo).
   - En la **pasarela**, la música empieza suave, va subiendo mientras Clara anda (se oyen sus tacones a tempo) y explota con aplausos cuando posa.
   - Presenta un **reto**: el jurado aplaude más cuantas más estrellas saques.

## Ver el final sin completar todo

- **Atajo secreto:** en la portada 3D, toca **5 veces el corazoncito** que hay bajo el título. Se abre la pasarela especial en Ibiza y después la carta.
- **Modo debug:** añade `?debug=1` a la URL (por ejemplo `https://…/bratz/?debug=1`). Aparece una pastilla «FPS» a la izquierda; tócala para ver las opciones:
  - **Desbloquear todo**: monedas, prendas especiales y secretas, y todos los retos.
  - **Saltar al final**: va directamente a la pasarela final y a la carta.
  - **Resetear guardado**: vuelve a empezar desde cero (útil antes de dárselo).
  - **Calidad**: auto / baja / media / alta.

## Antes de regalarlo

- Abre `?debug=1` y pulsa **Resetear guardado**, para que ella empiece desde cero, con el tutorial y sin el final desbloqueado.
- Si quieres cambiar el texto de la carta, la firma o la frase de la portada, edita `src/data/story.ts`.
