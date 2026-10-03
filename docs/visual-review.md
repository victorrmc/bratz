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

## Ronda 3 (`r3`)

| Captura | Pers. | Ropa | Luz | Comp. | UI | Wow | Nota | Problemas detectados |
|---|---|---|---|---|---|---|---|---|
| 00 portada 2D | — | — | — | 8 | 9 | 8 | 8 | Correcta |
| 01 inicio | 7 | 7 | 8 | 8 | 8 | 8 | 7 | Persiste la mancha de la cadera |
| 02 estudio | 7 | 7 | 8 | 7 | 8 | 7 | 7 | Mancha de cadera |
| 03–05 frente/perfil/espalda | 7 | 7 | 8 | 8 | — | 7 | 7 | Mancha de cadera (pierna libre en contrapposto) |
| 06 cara | 8 | — | 8 | 8 | 8 | 8 | 8 | Cara en forma de corazón, sin esquinas |
| 07 manos | 7 | — | 8 | 6 | 8 | 7 | 6 | La mano no queda centrada |
| 08 pies | 7 | 8 | 8 | 7 | — | 7 | 7 | Correcta |
| 09 Alba / Nayra / Vega | 7 | 8 | 8 | 8 | 8 | 8 | 7 | Correctas |
| 10–12 pelo / maquillaje / uñas | 8 | 8 | 8 | 8 | 8 | 8 | 8 | Correctas |
| 13 retos | — | — | 8 | 8 | 8 | 7 | 7 | Correcta |
| 14 reto | 7 | 8 | 8 | 8 | 8 | 7 | 7 | Correcta |
| 15 jurado | 8 | 8 | 8 | 8 | 8 | 8 | 8 | Correcta |
| 16 disco | 7 | 8 | 8 | 8 | 8 | 8 | 7 | Correcta |
| 16 centro comercial | 7 | 8 | 6 | 7 | 8 | 6 | 6 | Sigue algo apagado |
| 16 playa | 7 | 8 | 8 | 8 | 8 | 8 | 7 | Correcta |
| 16 alfombra roja | 7 | 8 | 8 | 8 | 8 | 8 | 7 | Correcta |
| 16 habitación Y2K | 7 | 8 | 7 | 8 | 8 | 7 | 7 | Correcta |
| 16 Ibiza | 7 | 8 | 8 | 8 | 8 | 8 | 7 | Correcta |
| 16 nuestra casa | 7 | 8 | 8 | 8 | 8 | 8 | 7 | Ya es distinta: puerta azul en arco y buganvillas |
| 17 pasarela | 7 | 8 | 8 | 8 | 8 | 8 | 7 | Plano general correcto |
| 18 armario | 7 | 8 | 8 | 6 | 8 | 7 | 6 | La muñeca de fondo compite con las tarjetas |
| 19 tienda | 7 | 8 | 8 | 8 | 8 | 7 | 7 | Correcta |
| 20 final pasarela | 8 | 8 | 8 | 8 | 7 | 8 | 7 | Vestido de hada y corona; el título roza la cabeza |
| 21 carta | — | — | 8 | 8 | 9 | 8 | 8 | Correcta |

**Correcciones aplicadas tras la ronda 3:**

- El deformador de la falda también actúa en la parte alta del muslo, lo que elimina la mancha de la cadera.
- Encuadre de manos centrado en la mano izquierda (uñas y reloj).
- Centro comercial con escaparates saturados y un corazón de neón.
- Fondo del armario velado para que destaquen las tarjetas.
- Piel con acabado de vinilo de muñeca (más brillo y un sheen cálido).
- Cuello más corto y ojos más grandes.

## Ronda 4 (`r4`, final)

| Captura | Pers. | Ropa | Luz | Comp. | UI | Wow | Nota | Comentario |
|---|---|---|---|---|---|---|---|---|
| 00 portada 2D | — | — | — | 8 | 9 | 8 | 8 | Correcta |
| 01 inicio | 7 | 8 | 8 | 8 | 8 | 8 | 7 | Sin manchas; Clara guiña el ojo con la mano en la cadera |
| 02 estudio | 7 | 8 | 8 | 7 | 8 | 7 | 7 | Arco de bombillas; la muñeca aún algo pequeña en vertical |
| 03–05 frente/perfil/espalda | 7 | 8 | 8 | 8 | — | 7 | 7 | Ropa limpia en las tres vistas |
| 06 cara | 8 | — | 8 | 8 | 8 | 8 | 8 | Cara en forma de corazón, ojos grandes, labios carnosos |
| 07 manos | 7 | — | 8 | 7 | 8 | 7 | 7 | Se ven las uñas oscuras y el reloj; las manos son sencillas |
| 08 pies | 7 | 8 | 8 | 7 | — | 7 | 7 | Correcta |
| 09 Alba / Nayra / Vega | 7 | 8 | 8 | 8 | 8 | 8 | 7 | Estilos bien diferenciados |
| 10–12 pelo / maquillaje / uñas | 8 | 8 | 8 | 8 | 8 | 8 | 8 | Correctas |
| 13 retos | — | — | 8 | 8 | 8 | 7 | 7 | Correcta |
| 14 reto | 7 | 8 | 8 | 8 | 8 | 7 | 7 | Correcta |
| 15 jurado | 8 | 8 | 8 | 8 | 8 | 8 | 8 | Correcta |
| 16 disco | 7 | 8 | 8 | 8 | 8 | 8 | 7 | Correcta |
| 16 centro comercial (rediseñado) | 7 | 8 | 7 | 7 | 8 | 7 | 7 | Pared de rayas, corazón de neón y escaparates en ángulo: ya es coherente, aunque algo pastel |
| 16 playa | 7 | 8 | 8 | 8 | 8 | 8 | 7 | Correcta |
| 16 alfombra roja | 7 | 8 | 8 | 8 | 8 | 8 | 7 | Correcta |
| 16 habitación Y2K | 7 | 8 | 7 | 8 | 8 | 7 | 7 | Correcta |
| 16 Ibiza | 7 | 8 | 8 | 8 | 8 | 8 | 7 | Correcta |
| 16 nuestra casa | 7 | 8 | 8 | 8 | 8 | 8 | 7 | Puerta azul, buganvillas y luces |
| 17 pasarela | 7 | 8 | 8 | 8 | 8 | 8 | 7 | Correcta |
| 18 armario | 7 | 8 | 8 | 7 | 8 | 7 | 7 | Mejor con el velo |
| 19 tienda | 7 | 8 | 8 | 8 | 8 | 7 | 7 | Correcta |
| 20 final pasarela | 8 | 8 | 8 | 8 | 7 | 8 | 7 | Vestido de hada y corona en Ibiza |
| 21 carta | — | — | 8 | 8 | 9 | 8 | 8 | Correcta |

### Conclusión honesta

**No se cumple** el criterio de «ninguna captura por debajo de 8» con mi propia puntuación, que es estricta:

- La interfaz, la iluminación, la ropa (sin clipping) y los escenarios llegan a 7–8.
- El criterio que más baja la nota es la **calidad de los personajes (7)**. Las muñecas son 100 % procedurales, construidas con geometría generada por código y una cara pintada en textura. Tienen un estilo de muñeca coherente y bonito, pero no alcanzan el acabado de un personaje modelado y esculpido a mano por un artista.
- El **centro comercial**, que era el escenario más flojo (6), sube a 7 tras rediseñarlo. Ya no queda ninguna captura por debajo de 7.

Subir de 7 a 8 de forma generalizada necesitaría modelos GLB/VRM hechos por un artista. El sistema está preparado para incorporarlos en `/assets`.

## Cara (objetivo: estilo Bratz)

Banco de capturas propio, generado con `node scripts/face-shots.mjs <ronda>` sobre el servidor de desarrollo (`npx vite --port 5173`). Usa la vista de desarrollo (`?cam=face&doll=…&expr=…&mk=…&rot=…`) con la misma luz en todas las rondas.

- 4 muñecas × 6 expresiones (sonrisa, dientes, risa, guiño, sorpresa, seria).
- 3 maquillajes de frente: el **propio** de cada muñeca, uno **natural** casi sin maquillaje y uno de **fiesta** (gráfico, pestañas drama, labios metalizados y estrellas).
- Además, la vista a ¾ con el maquillaje propio.
- Hojas en `docs/screenshots/cara/<ronda>/`: una por muñeca y `todas.jpg`. En las hojas por muñeca, cada fila es un maquillaje o una vista y cada columna una expresión. Las capturas sueltas no se versionan.

Criterios, de 1 a 10, medidos frente al estilo Bratz y no frente a una muñeca genérica:

- **Ojos:** tamaño, forma de almendra, iris, pestañas y brillos.
- **Cejas:** arco, grosor y distancia al ojo.
- **Labios:** volumen, arco de Cupido y acabado.
- **Forma:** contorno de la cara, mandíbula, barbilla y perfil a ¾.
- **Piel:** volumen, colorete, nariz e iluminador.
- **Expr.:** expresiones y ojos cerrados.

Por eso la nota es más baja que el 8 que sacaba «06 cara» en la ronda 4: allí se medía si la cara era correcta, aquí si es Bratz.

### Ronda 0 (`r0`, punto de partida)

| Muñeca | Ojos | Cejas | Labios | Forma | Piel | Expr. | Nota | Problemas detectados |
|---|---|---|---|---|---|---|---|---|
| Clara | 6 | 5 | 5 | 5 | 6 | 5 | 5 | Ojos correctos pero pequeños para Bratz y con mucho blanco. Cejas finas y lejos del ojo. Labios finos y granates. Barbilla en punta |
| Nayra | 4 | 5 | 4 | 5 | 6 | 5 | 4 | Las gafas de su look tapan los ojos. Labios metalizados que se ven grises |
| Vega | 6 | 4 | 5 | 5 | 6 | 5 | 4 | La diadema rosa tapa las cejas y la frente. Labios mate oscuros y pequeños |
| Alba | 6 | 5 | 6 | 5 | 6 | 5 | 5 | Las pecas quedan bien. Mismos ojos y cejas que Clara; la cara apenas se distingue |

Problemas comunes a las cuatro:

- **Sonrisa:** una franja blanca entre los labios que no se lee ni como dientes ni como brillo.
- **Ojos cerrados (risa, guiño):** solo hay una línea de pestañas sobre la piel. Con sombra intensa, el párpado se convierte en una mancha de color saturado (fiesta).
- **Pestañas inferiores:** parecen pelos sueltos.
- **Nariz:** dos manchas y una línea.
- **Forma:** la cara es un triángulo invertido, con mandíbula muy afilada y barbilla larga. El cuello es largo y fino.
- **Maquillaje de fiesta:** aparecen dos discos grises de borde duro bajo el rabillo del ojo, también en el lado sin estrellas. Coinciden con las elipses metálicas que `paintFace` pinta en el mapa de metal para las gemas (siempre en los dos lados). Hay que confirmarlo en la fase 5.
- **Diferenciación:** las cuatro muñecas comparten forma de cara, ojos y cejas. Solo cambian el color y tres parámetros.
