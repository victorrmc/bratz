# Cómo probarlo en el móvil (5 minutos)

1. Abre **https://victorrmc.github.io/bratz/** en el móvil (Chrome o Safari) y **sube el volumen**.
2. Pulsa **«Toca para empezar»**: suena la música y aparece Clara posando en la portada.
3. **Estudio** (1 min):
   - El tutorial de 3 pasos sale solo la primera vez: toca una prenda, gira a Clara con el dedo y pulsa «¡A brillar!».
   - Prueba una categoría de ropa, cambia el color y el estampado de la prenda puesta.
   - Pulsa los botones de la derecha: **cara**, **manos** (uñas oscuras y reloj en la muñeca izquierda) y **pies**.
   - Pellizca para hacer zoom.
   - Pestañas **Pelo**, **Maquillaje** y **Uñas**.
   - Pulsa el dado para un look sorpresa y guárdalo con **Guardar look**.
4. **Fotos** (1 min): cambia de escenario (incluidos *Ibiza al atardecer*, con el sol que baja, y el nuevo *Ferry a Ibiza*), elige una pose, un marco y pegatinas, y pulsa el botón redondo. Descarga el PNG.
5. **Retos** (1 min): elige uno, vístete y pulsa **Presentar al jurado**. Mira las estrellas, los comentarios y las monedas.
6. **Tienda**: con las monedas iniciales puedes comprar el *Top de crochet ibicenco* (55).
7. **Pasarela**: Clara desfila con el look actual.
8. **Armario**: el look guardado aparece con su miniatura. Puedes renombrarlo, duplicarlo o borrarlo.

## Instalarlo y jugar sin conexión

- **Android (Chrome):** menú ⋮ → «Instalar aplicación». **iPhone (Safari):** Compartir → «Añadir a pantalla de inicio».
- Ábrelo una vez con conexión y espera unos segundos: después funciona en modo avión.

## Ver el final sin completar todo

- **Atajo secreto:** en la portada 3D, toca **5 veces el corazoncito** que hay bajo el título. Se abre la pasarela especial en Ibiza y después la carta.
- **Modo debug:** añade `?debug=1` a la URL (por ejemplo `https://victorrmc.github.io/bratz/?debug=1`). Aparece una pastilla «FPS» a la izquierda; tócala para ver las opciones:
  - **Desbloquear todo**: monedas, prendas especiales y secretas, y todos los retos.
  - **Saltar al final**: va directamente a la pasarela final y a la carta.
  - **Resetear guardado**: vuelve a empezar desde cero (útil antes de dárselo).
  - **Calidad**: auto / baja / media / alta.

## Antes de regalarlo

- Abre `?debug=1` y pulsa **Resetear guardado**, para que ella empiece desde cero, con el tutorial y sin el final desbloqueado.
- Si quieres cambiar el texto de la carta, la firma o la frase de la portada, edita `src/data/story.ts`.
