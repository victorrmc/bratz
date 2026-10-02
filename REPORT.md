# Rumbo a Ibiza: informe

Juego web 3D de «crear y vestir muñecas fashion», hecho como regalo para Clara. El tema central es que nos vamos a vivir juntos a Ibiza.

Stack:

- **Base:** Vite 8, React 19 y TypeScript.
- **3D:** three.js r186 con @react-three/fiber, @react-three/drei y @react-three/postprocessing.
- **Estado e interfaz:** zustand y framer-motion.
- **Audio:** Web Audio sintetizado.
- **Fuentes:** @fontsource (Fredoka y Nunito).

No usa backend ni recursos externos en tiempo de ejecución. Todo, incluidas las muñecas, se genera por código.

## Qué se ha construido

### Personajes (100 % originales y procedurales)

- **Cuatro muñecas**, cada una con ficha (personalidad, estilo y frase) en el selector del estudio:
  - **Clara**, la protagonista, de estilo glam mediterráneo.
  - **Nayra**, deportiva street.
  - **Vega**, rockera.
  - **Alba**, romántica boho.
- **Clara según la descripción:**
  - Pelo caoba recogido en moño bajo, con raya al medio y la frente despejada.
  - Piel clara, cejas arqueadas, ojos oscuros y labios carnosos.
  - Uñas oscuras y un reloj inteligente de correa clara en la **muñeca izquierda**.
- **Cuerpo paramétrico:**
  - Torso con sección superelíptica y busto y glúteos esculpidos.
  - Extremidades por barrido con perfiles de radio y una cabeza esculpida con forma de corazón.
  - Manos con dedos y uñas, y pies con flexión plantar según la altura del tacón.
- **Esqueleto jerárquico** con 15 articulaciones y cinemática inversa de dos huesos para los brazos.
- **Ocho poses** (natural, mano en la cadera, paz, beso, mano en el pelo, pierna cruzada, saludo, estrella) más una pose de portada y el ciclo de paseo de pasarela.
- **Animación en reposo:** respiración, balanceo, cambio de peso, parpadeo y balanceo de coletas.
- **Cara pintada en textura** (estilo muñeca) con capas de maquillaje: ojos con iris, brillos y pestañas, cejas y labios con volumen. Tres expresiones: sonrisa, guiño y seria.

### Vestidor

| Categoría | Opciones |
|---|---|
| Tops | 15 |
| Partes de abajo | 14 |
| Vestidos y monos | 15 (incluidas la cola de sirena y el vestido de hada) |
| Chaquetas y capas | 14 (incluidas las alas de hada) |
| Calzado | 14 (plataformas, botas, deportivas, tacones, sandalias…) |
| Bolsos | 12 |
| Joyas | 16 (pendientes, collares y pulseras) |
| Gafas | 12 |
| Gorros | 12 |
| Accesorios del pelo | 14 |

- La mayoría de prendas permiten editar el color y, en ropa, bolsos y gorros, también el estampado.
- Hay 14 estampados procedurales en canvas, recoloreables: denim, escocés, leopardo, cebra, purpurina, lentejuelas, satén, rejilla, corazones, estrellas, flores, rayas, escamas y liso.
- **Materiales físicos por tejido:**
  - Sheen en telas.
  - Clearcoat en charol y vinilo.
  - Iridiscencia en lo holográfico, las perlas y las escamas.
  - Metal y gemas en joyería.
- **Sin clipping:** la ropa son capas desplazadas sobre la superficie del cuerpo. Las faldas se deforman cada frame para envolver las piernas en cualquier pose.
- **Peluquería:** 16 peinados con color base, mechas, puntas de color fantasía (shader propio) y brillo ajustable.
- **Maquillaje por capas:** sombra, delineado (fino, gato o gráfico), pestañas, colorete, iluminador, labios (mate, gloss o metalizado) y pegatinas o gemas (estrellas, corazones, brillantes, pecas, mariposa). Cada uno con su paleta y su intensidad.
- **Uñas:** cinco formas, doce colores y cuatro acabados, visibles con la cámara de manos.
- **Etiquetas y rareza:** cada prenda tiene etiquetas de estilo y una rareza (común, especial o secreta).

### Modos de juego

1. **Estudio libre:**
   - Girar la muñeca con el dedo y hacer zoom con pellizco o rueda.
   - Cámaras predefinidas: cuerpo, cara, manos y pies.
   - Botón «Sorpréndeme» para un look aleatorio y guardado de looks.
2. **Sesión de fotos:**
   - Siete escenarios: discoteca de neón, centro comercial, playa al atardecer, alfombra roja con flashes, habitación Y2K, Ibiza al atardecer y el secreto **Nuestra casa en Ibiza**.
   - Ocho poses, expresión, cinco marcos y ocho pegatinas arrastrables.
   - Disparo con flash y sonido, y descarga en PNG de 1080×1440.
3. **Retos de estilo:**
   - Quince retos, con cuenta atrás opcional en los que la tienen.
   - Puntuación de 1 a 5 estrellas según etiquetas, colores (paleta o armonía), accesorios y look completo.
   - Jurado de tres personajes originales con comentarios divertidos.
4. **Pasarela:** desfile con cámara cinematográfica en tres planos, luces LED, flashes y música propia.
5. **Armario:** guardar, renombrar, duplicar, borrar y ponerse looks, con miniatura renderizada.

### Progresión y sorpresas

- **Monedas de purpurina:** se ganan en los retos (solo cuenta la mejora sobre la mejor puntuación) y se gastan en la tienda (prendas especiales).
- **Prendas secretas con nombres de Ibiza:**
  - Cola de sirena de Es Vedrà y Top de conchas de Cala Comte: se ganan superando el reto de la sirena.
  - Vestido de hada de los almendros y Alas de hada de luz: reto del hada.
  - Perlas del Mediterráneo: completar 10 retos.
  - Tiara de perlas: encontrar el corazón escondido.
  - Corona de hada: ver el final.
- **Final:** se desbloquea al completar los 15 retos o al tocar 5 veces el corazón de la portada. Lleva a una pasarela especial en Ibiza (Clara de hada, con pétalos y el atardecer frente a Es Vedrà) y a una carta animada sobre mudarnos juntos. El texto se edita en `src/data/story.ts`.
- **Escenario secreto:** «Nuestra casa en Ibiza», una pared encalada con puerta azul en arco, buganvillas, guirnalda de luces, columpio y una mesa con dos tazas.
- **Onboarding:** tres pasos interactivos (tocar una prenda, girar a Clara y ver lo de las monedas).

### Sonido

- Música pop original sintetizada con Web Audio, con tres pistas (menú, pasarela y final), batería, bajo, pads, arpegios y melodía.
- Efectos: clic, destello, moneda, obturador, fanfarria y error.
- Arranca con «Toca para empezar». Los botones de silencio están siempre visibles.

### Rendimiento y compatibilidad

- **Calidad automática** (baja, media o alta), con selector manual en `?debug=1`.
- **DPR adaptativo** con PerformanceMonitor: baja la resolución y después la calidad.
- **Niveles de detalle geométrico** por calidad.
- **Menos llamadas de dibujo:** las piezas se fusionan por hueso y material, y las manos se precalculan en varios niveles de flexión.
- **Lienzo ajustado:** el canvas 3D ocupa solo la zona libre de paneles.
- **Desenfoque:** el glassmorphism con desenfoque real solo se activa en calidad alta. En las demás se imita con degradados, porque el desenfoque sobre el 3D es muy caro.
- **Carga:** una portada 2D instantánea. El motor 3D se descarga y construye tras el primer toque, con barra de progreso, y cada modo va en su propio trozo de código.
- **Pantalla:** vertical y horizontal (en horizontal el panel va a la derecha), áreas seguras del notch y objetivos táctiles de 44 px o más.
- **Sin WebGL:** se muestra un mensaje amable.

## Capturas destacadas (ronda final)

| | | |
|---|---|---|
| ![Portada](docs/screenshots/r4/01-inicio.png) | ![Estudio](docs/screenshots/r4/02-estudio.png) | ![Cara](docs/screenshots/r4/06-muneca-cara.png) |
| ![Nuestra casa](docs/screenshots/r4/16-foto-casa.png) | ![Jurado](docs/screenshots/r4/15-jurado.png) | ![Carta](docs/screenshots/r4/21-carta.png) |

Todas las capturas, de cada ronda, están en `docs/screenshots/`.

## Resultados de las pruebas

| Prueba | Resultado | Objetivo |
|---|---|---|
| Unitarias (Vitest) | **35/35** en verde | todas en verde |
| Cobertura de `src/game` | **98,66 %** de sentencias, 92,99 % de ramas y 98,86 % de funciones | más del 80 % |
| E2E (Playwright, SwiftShader) | **24/24** en verde: 8 flujos en 390×844, 412×915 y 1440×900 | todas en verde |
| Errores de consola en E2E | **0** (la fixture `errors` hace fallar cualquier test que registre uno) | 0 |
| Lighthouse móvil | rendimiento **96**, accesibilidad **100** | más de 70 y más de 90 |
| Métricas de Lighthouse | FCP 2,1 s · LCP 2,3 s · TBT 80 ms · CLS 0,011 | — |
| FPS en el estudio, CPU 4x más lenta | **29,7** de media (otra ejecución: 30,2), calidad baja | 30 o más |
| FPS en la pasarela, CPU 4x más lenta | **35,5** de media | 30 o más |
| Bundle inicial | **unos 139 kB gzip** (JS de entrada y CSS) | menos de 1,5 MB |
| Bundle 3D (tras «Toca para empezar») | unos 420 kB gzip más | — |

Los flujos E2E cubren:

- El onboarding.
- Ponerse prendas de todas las categorías, peinado, maquillaje y uñas, y probar todas las cámaras.
- Guardar un look, recargar la página y usar el armario (renombrar, duplicar y borrar).
- Una foto en cada escenario, comprobando la firma del PNG.
- Un reto, con su puntuación y sus monedas.
- Comprar en la tienda.
- El final del corazón, con la carta y la foto del escenario secreto.
- El final completando los 15 retos.

Los datos crudos de FPS están en `docs/perf.json`. Se miden con `node scripts/perf.mjs`.

**Sobre los FPS:** este entorno no tiene GPU, así que el renderizado se hace por software con SwiftShader, que es muchísimo más lento que cualquier móvil real. El sistema adaptativo reduce la resolución y la calidad hasta rondar los 30 fps incluso en esas condiciones. En un móvil real con GPU, la calidad automática se queda en media o alta.

## Histórico de puntuaciones visuales

Detalle completo, con criterios y problemas de cada captura, en [`docs/visual-review.md`](docs/visual-review.md).

| Ronda | Nota media | Nota mínima | Principales correcciones tras la ronda |
|---|---|---|---|
| 1 | 4,7 | 2 | Sin animaciones de salida que dejaban la interfaz a medias, márgenes con paneles ocultos, encuadre de manos, pelo con mechones, cara de Clara refinada |
| 2 | 6,5 | 4 | «Nuestra casa» rediseñada, mandíbula en forma de corazón, muslo sin atravesar la ropa, cámara de pasarela, centro comercial con más color |
| 3 | 7,1 | 6 | Falda sin manchas en la cadera, manos con uñas y reloj, velo en el armario, piel de vinilo, ojos más grandes |
| 4 (final) | 7,2 | 7 | Centro comercial rediseñado (de 6 a 7) |
| Tarea 1 (muñecas) | — | Pers. 8 | Ojos 3D, relieve de cara y torso, piel con subsurface, manos y uñas nuevas (solo personajes; ver abajo) |

(24 capturas por ronda.) Las notas son estrictas: un 8 significa «parece un juego comercial».

## Limitaciones conocidas

- **Criterio visual no cumplido del todo:** en la última ronda ninguna captura baja de 7, pero muchas se quedan en 7 y no en 8. El factor limitante es el acabado de las muñecas, que son 100 % procedurales y no modelos esculpidos a mano. Es la mayor diferencia frente a un juego comercial.
- **FPS medidos con renderizado por software:** en el estudio con la CPU 4x más lenta la media es de 29,7 a 30,2 fps, justo en el límite de 30. Habría que medirlo en un móvil real.
- **No está desplegado todavía:**
  - El repositorio es **privado**, y GitHub Pages en repos privados requiere un plan de pago.
  - Pages no está activado.
  - Todavía no existe la rama `main`.
  - El workflow `.github/workflows/deploy.yml` ya está listo. Se despliega solo al hacer push a `main` en cuanto Pages esté activado con «Source: GitHub Actions».
- **Textos de la carta provisionales:** el texto de la carta, la fecha («Próxima parada: Ibiza ✈ 2026») y la firma están en `src/data/story.ts` como borrador, a falta del texto definitivo.
- **Audio:** los navegadores exigen un gesto del usuario antes de sonar, por eso la música empieza tras «Toca para empezar».

## Cómo añadir prendas nuevas

1. Abre `src/data/items.ts` y añade una línea en la categoría correspondiente con el helper `it(...)`:
   ```ts
   it('top-mi-prenda', 'Mi top nuevo', 'tops', 'top', 'satin', '#ff5fae', ['glam', 'fiesta'], {
     params: { neck: 'v', hem: 1.05, sleeve: 0, straps: 'thin' },
     pattern: 'estrellas',
     color2: '#ffffff',
   }),
   ```
   - **Id** único y **nombre** visible.
   - **Categoría** y **plantilla** (`model`). Las plantillas existentes son:
     - Prendas: `top`, `pants`, `skirt`, `dress`, `jumpsuit`, `jacket`, `cape`, `wings`, `mermaid`, `fairy`, `shellTop`.
     - Calzado: `heels`, `platform`, `boots`, `kneeboots`, `sneakers`, `sandals`, `ballet`, `wedge`, `flipflops`.
     - Bolsos: `baguette`, `heartBag`, `clutch`, `backpack`, `basket`, `tote`, `fanny`, `studded`, `fringeBag`, `furBag`, `discoBag`, `shellBag`.
     - Joyas, gafas, gorros y accesorios del pelo: consulta `src/three/clothes/accessories.ts`.
   - **Tejido** (`cotton`, `satin`, `denim`, `vinyl`, `leather`, `holo`, `sequin`, `knit`, `mesh`, `metal`, `gem`, `plastic`, `fur`, `pearl`, `scales` o `petal`), **color** y **etiquetas de estilo**.
   - **Opciones:** `params` (escote, largo, mangas, vuelo, tirantes…), `pattern`, `color2`, `rarity: 'especial'` con `price`, o `rarity: 'secreta'` con `unlock` y `story`.
2. Sin tocar más código, la prenda aparece en el estudio, en la tienda (si es especial o secreta), en la puntuación de los retos y en el modo «Sorpréndeme».
3. Lo mismo vale para el resto de datos:
   - Peinados en `src/data/hair.ts`, por composición de piezas.
   - Retos en `src/data/challenges.ts`.
   - Muñecas en `src/data/characters.ts`.
   - Escenarios y poses en `src/data/stages.ts`.
   - Textos del final en `src/data/story.ts`.
4. Ejecuta `npm test`: los tests comprueban que cada categoría tiene al menos 12 prendas, que los ids son únicos y que las especiales tienen precio.

## Muñecas con acabado comercial (tarea 1)

Objetivo: subir la nota más baja de la revisión visual (la calidad de los personajes) de 7 a 8. Todo sigue siendo procedural: no se añade ningún recurso externo.

**Cara y ojos** (`src/three/face.ts`):

- **Ojos 3D.** La cara pintada recorta el almendrado (un `alphaMap` con `alphaTest`) y detrás va un ojo de verdad:
  - Globo que sigue la superficie de la cara, con el **iris hundido** 0,7 mm.
  - **Córnea transparente** en casquete sobre el iris, con mezcla aditiva y un IOR alto: solo aporta reflejos del entorno y brillos especulares que se mueven con la cámara.
  - **Párpados con volumen:** la línea de pestañas en relieve, un párpado inferior de piel y un pliegue sobre el ojo que reutiliza la textura pintada (conserva sombra y pestañas).
  - Textura del globo con esclerótica sombreada en las comisuras, iris con fibras, collarete y anillo límbico, pupila y la sombra que proyecta el párpado.
  - Los dos ojos se fusionan por material: **5 llamadas de dibujo** en total. El parpadeo oculta el ojo 3D y muestra el párpado pintado. El guiño cambia a una variante de geometría con un solo ojo.
- **Normal map de la cara** generado en canvas: punta y aletas de la nariz, orificios, filtrum, borde del bermellón, línea entre labios, comisuras, surco del mentón, barbilla y pómulos. Sigue la forma de los labios de cada expresión.

**Cuerpo** (`src/three/body.ts`):

- **Normal map del torso** calculado a partir de la superficie real: clavículas en S con el hueco supraclavicular, escotadura yugular, esternón, ombligo y crestas de la cadera. Por detrás: columna, omóplatos y hoyuelos lumbares. El torso pasa a UV paramétricas (antes no se usaban).
- **Codos sin escalón:** los perfiles de brazo y antebrazo empalman.

**Piel** (`src/three/materials.ts`): la piel tiene un **subsurface aproximado**: *wrap lighting* que tiñe de rojizo la zona del terminador, más un **rim cálido** en los bordes (orejas, dedos, perfil). Se aplica con `onBeforeCompile` a cuerpo, manos y cabeza. En calidad baja se mantiene el wrap, pero sin rim ni normal maps.

**Manos** (`src/three/body.ts` y `src/three/nails.ts`):

- Palma esculpida que sigue la línea de nudillos (el meñique nace más arriba), con nudillos y tendones en el dorso y eminencias tenar e hipotenar en la palma.
- Dedos de una sola pieza con tres falanges, abultamiento en las articulaciones y yemas.
- Pulgar con base carnosa.
- La palma empalma con la muñeca sin anillo.
- **Uñas con grosor**, canto en la punta y curva en C.

**Clara intacta:** su ficha, el moño bajo caoba (`#5a2018`), las uñas oscuras y el reloj en la muñeca izquierda no cambian. El E2E lo comprueba.

`src/three/DollRig.ts` solo cambia lo imprescindible para montar las piezas: el material de cabeza, los ojos, el torso y las manos.

### Antes y después

| | Antes | Después |
|---|---|---|
| Ojos | ![antes](docs/screenshots/munecas/antes-03-ojos.png) | ![después](docs/screenshots/munecas/despues-03-ojos.png) |
| Cara en 3/4 | ![antes](docs/screenshots/munecas/antes-02-cara-tres-cuartos.png) | ![después](docs/screenshots/munecas/despues-02-cara-tres-cuartos.png) |
| Manos | ![antes](docs/screenshots/munecas/antes-05-manos-cerca.png) | ![después](docs/screenshots/munecas/despues-05-manos-cerca.png) |
| Cuerpo | ![antes](docs/screenshots/munecas/antes-07-cuerpo-tres-cuartos.png) | ![después](docs/screenshots/munecas/despues-07-cuerpo-tres-cuartos.png) |

La puntuación está en [`docs/visual-review.md`](docs/visual-review.md#tarea-muñecas-con-acabado-comercial-munecas): personajes **8** en todas las capturas de cara, manos y cuerpo (antes, de 6 a 8).

### Pruebas y rendimiento

| Prueba | Resultado |
|---|---|
| Unitarias (`npm test`) | 35/35 |
| E2E (`npm run e2e`) | **30/30** en verde, con los 2 tests nuevos de `tests/e2e/munecas.spec.ts` en los 3 viewports y 0 errores de consola |
| Build y carga inicial | sin cambios en el bundle inicial (unos 138 kB gzip); el trozo 3D crece unos 5 kB gzip |
| FPS en el estudio, CPU 4x más lenta | 30,0 (antes 29,7) |
| FPS en la pasarela, CPU 4x más lenta | 33,4 (antes 35,5; dentro de la variación entre ejecuciones con SwiftShader) |

## Estructura

```
src/data    catálogo tipado (prendas, peinados, maquillaje, retos, muñecas, escenarios, textos)
src/game    lógica pura: puntuación, economía, desbloqueos, guardado y migración, armario
src/store   estado global (zustand)
src/three   motor 3D: cuerpo, cara, pelo, ropa, materiales, texturas, escenas, efectos
src/ui      pantallas, componentes, iconos SVG propios
src/audio   música y efectos con Web Audio
tests/      unitarios (Vitest) y E2E (Playwright)
scripts/    capturas, medición de FPS y utilidades de revisión
```
