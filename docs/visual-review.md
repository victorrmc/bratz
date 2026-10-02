# Revisión visual por rondas

Cada captura se puntúa de 1 a 10 en seis criterios:

- **Pers.**: calidad de los personajes.
- **Ropa**: ropa sin clipping.
- **Luz**: iluminación.
- **Comp.**: composición.
- **UI**: legibilidad de la interfaz.
- **Wow**: impacto general.

«—» significa que el criterio no aplica a esa pantalla. La nota de cada captura es la **mínima** de sus criterios.

Las capturas están en `docs/screenshots/<ronda>/`, con un viewport de 390×844 a DPR 2 y calidad alta. Se renderizan por software (SwiftShader), así que no hay GPU real.

## Ronda 1 (`r1`)

| Captura | Pers. | Ropa | Luz | Comp. | UI | Wow | Nota | Problemas detectados |
|---|---|---|---|---|---|---|---|---|
| 00 portada 2D | — | — | — | 8 | 9 | 7 | 7 | Correcta, algo sencilla |
| 01 inicio | 6 | 8 | 6 | 6 | 8 | 6 | 6 | Escena lavada; el título tapa la cabeza |
| 02 estudio | 6 | 8 | 6 | 7 | 3 | 5 | 3 | La UI se queda semitransparente (animación de salida atascada) |
| 03–05 muñeca frente/perfil/espalda | 5 | 8 | 6 | 2 | — | 3 | 2 | Encuadre roto al ocultar el panel (inset = alto de pantalla) |
| 06 cara | 6 | — | 6 | 4 | 7 | 5 | 4 | Encuadre desplazado; mandíbula ancha |
| 07 manos | 4 | — | 6 | 2 | 7 | 3 | 2 | La mano queda bajo el panel |
| 08 pies | 5 | 6 | 6 | 2 | — | 3 | 2 | Encuadre roto |
| 09 Alba / Nayra / Vega | 6 | 8 | 6 | 7 | 8 | 6 | 6 | Muñecas pequeñas en el encuadre; pelo tipo casco |
| 10–12 pelo / maquillaje / uñas | 6 | 8 | 6 | 7 | 8 | 6 | 6 | Pelo con aspecto de casco; piel pálida |
| 13 retos | — | — | — | 8 | 8 | 6 | 6 | Bien, fondo muy rosa |
| 14 reto | 6 | 8 | 6 | 7 | 8 | 6 | 6 | Muñeca pequeña |
| 15 jurado | 6 | 8 | 7 | 6 | 2 | 5 | 2 | El panel del jurado no aparece (misma animación atascada) |
| 16 disco | 6 | 8 | 7 | 7 | 8 | 7 | 6 | Pose rígida |
| 16 centro comercial | 6 | 8 | 4 | 6 | 8 | 4 | 4 | Todo blanco y sin contraste |
| 16 playa | 6 | 8 | 6 | 7 | 8 | 6 | 6 | Correcta |
| 16 alfombra roja | 6 | 8 | 5 | 6 | 8 | 5 | 5 | Fondo blanco quemado, alfombra apenas visible |
| 16 habitación Y2K | 6 | 8 | 4 | 5 | 8 | 4 | 4 | Lavada y sin contraste |
| 16 Ibiza | 6 | 8 | 6 | 7 | 8 | 6 | 6 | Correcta |
| 16 nuestra casa (secreto) | 6 | 8 | 6 | 4 | 8 | 4 | 4 | Igual que Ibiza: los detalles quedan fuera de plano |
| 17 pasarela | 6 | 8 | 6 | 6 | 8 | 6 | 6 | Plano lateral con el fondo fucsia dominando |
| 18 armario | 5 | 8 | 6 | 4 | 8 | 5 | 4 | Cámara recortada; sin miniatura (guardado por script) |
| 19 tienda | 5 | 8 | 6 | 4 | 8 | 5 | 4 | La muñeca queda bajo el panel |
| 20 final pasarela | 6 | 8 | 7 | 5 | 6 | 7 | 5 | El título tapa la cabeza |
| 21 carta | — | — | 7 | 8 | 9 | 8 | 7 | Bonita; el sobre podría lucir más |

**Correcciones aplicadas tras la ronda 1:**

- Se elimina la animación de salida entre pantallas, que bajo carga se quedaba a medias y dejaba la UI fantasma o sin montar.
- El cálculo de márgenes ignora los paneles ocultos.
- La tienda informa de la altura de su panel.
- Encuadre de manos corregido.
- Centro comercial, habitación y alfombra roja con más saturación y menos exposición.
- Los detalles de «Nuestra casa» se acercan al encuadre.
- Título del final más pequeño.
- Pelo con mechones peinados y caoba más oscuro.
- Mandíbula más fina, labios de Clara más carnosos y piel más cálida.
- Codos sin bulto.

## Ronda 2 (`r2`)

| Captura | Pers. | Ropa | Luz | Comp. | UI | Wow | Nota | Problemas detectados |
|---|---|---|---|---|---|---|---|---|
| 00 portada 2D | — | — | — | 8 | 9 | 7 | 7 | Correcta |
| 01 inicio | 7 | 7 | 7 | 7 | 8 | 7 | 7 | Una pequeña mancha de piel atraviesa el vestido en la cadera |
| 02 estudio | 7 | 7 | 7 | 7 | 8 | 7 | 7 | UI ya correcta; la muñeca se ve algo pequeña |
| 03–05 frente/perfil/espalda | 7 | 7 | 7 | 8 | — | 7 | 7 | Mancha de cadera; cuello largo |
| 06 cara | 7 | — | 7 | 7 | 8 | 7 | 7 | Mandíbula con «esquinas» |
| 07 manos | 6 | — | 7 | 6 | 8 | 6 | 6 | Mano pequeña y medio oculta |
| 08 pies | 7 | 7 | 7 | 7 | — | 6 | 6 | Zapatos algo toscos |
| 09 Alba / Nayra / Vega | 7 | 8 | 7 | 7 | 8 | 7 | 7 | Correctas |
| 10–12 pelo / maquillaje / uñas | 7 | 8 | 7 | 7 | 8 | 7 | 7 | Mechones algo marcados |
| 13 retos | — | — | 7 | 8 | 8 | 7 | 7 | Correcta |
| 14 reto | 7 | 8 | 7 | 7 | 8 | 7 | 7 | Correcta |
| 15 jurado | 7 | 8 | 7 | 8 | 8 | 8 | 7 | ¡Ya visible con estrellas y comentarios! |
| 16 disco | 7 | 8 | 7 | 7 | 8 | 7 | 7 | Correcta |
| 16 centro comercial | 7 | 8 | 6 | 6 | 8 | 6 | 6 | Aún pálido |
| 16 playa | 7 | 8 | 7 | 7 | 8 | 7 | 7 | Correcta |
| 16 alfombra roja | 7 | 8 | 7 | 7 | 8 | 7 | 7 | Mucho mejor con el photocall oscuro |
| 16 habitación Y2K | 7 | 8 | 6 | 7 | 8 | 6 | 6 | Más color, pero plana |
| 16 Ibiza | 7 | 8 | 7 | 7 | 8 | 7 | 7 | Correcta |
| 16 nuestra casa | 7 | 8 | 6 | 5 | 8 | 5 | 5 | Aún parecida a Ibiza |
| 17 pasarela | 6 | 8 | 6 | 4 | 8 | 5 | 4 | Cámara demasiado cerca en vertical; destello gigante delante |
| 18 armario | 6 | 8 | 7 | 5 | 8 | 6 | 5 | Captura tomada tras la pasarela con la cámara aún cerca |
| 19 tienda | 7 | 8 | 7 | 7 | 8 | 7 | 7 | La muñeca ya se ve encima del panel |
| 20 final pasarela | 7 | 8 | 7 | 5 | 7 | 7 | 5 | Plano demasiado cerrado |
| 21 carta | — | — | 7 | 8 | 9 | 8 | 7 | Correcta |

**Correcciones aplicadas tras la ronda 2:**

- Escenario «Nuestra casa» rediseñado: pared encalada con puerta azul en arco, guirnalda de luces, buganvillas, cielo de hora azul y el columpio y la mesa con dos tazas en plano.
- Mandíbula con afinado progresivo (cara en forma de corazón, sin esquinas).
- Parte alta del muslo más fina para que no atraviese la ropa en la cadera.
- Cámara de la pasarela que se aleja en vertical y destellos de los fotógrafos fuera del plano.
- Centro comercial con más color.
- Pose de reposo más natural.
