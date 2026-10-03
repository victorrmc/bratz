import type { ChallengeDef, Slot, StyleTag } from './types'

// Modo historia «Rumbo a Ibiza»: los cinco capítulos de la mudanza.
// Todos los textos personales están aquí para poder editarlos fácilmente.

export interface Vignette {
  /** Titular corto de la viñeta. */
  title: string
  /** Frases que aparecen una tras otra (breves y cálidas). */
  lines: string[]
}

export interface ChapterDef {
  id: string
  number: number
  title: string
  /** Escenario 3D donde transcurre (ids de src/data/stages.ts). */
  stage: string
  /** Icono de la tarjeta (nombre de src/ui/Icon.tsx). */
  icon: string
  intro: Vignette
  outro: Vignette
  /** Reto de estilo del capítulo (se puntúa con src/game/scoring.ts). */
  challenge: ChallengeDef
  /** Look obligatorio: huecos que hay que llevar y, opcionalmente, una etiqueta de estilo. */
  mustWear: { slots: Slot[]; tag?: StyleTag; count?: number; label: string }
  /** Estrellas mínimas para superar el capítulo. */
  minStars: number
  /** Pose de la foto de recuerdo. */
  pose: string
  /** Pie de foto del recuerdo en el álbum. */
  memory: string
  /** Look de ejemplo que propone «¿Me ayudas?» (solo prendas comunes). */
  suggestion: string[]
}

export const STORY_TEXT = {
  title: 'Rumbo a Ibiza',
  subtitle: 'Nuestra mudanza en cinco capítulos',
  menuLabel: 'Historia',
  albumLabel: 'Recuerdos',
  albumTitle: 'Álbum de recuerdos',
  albumEmpty: 'Todavía no hay recuerdos. ¡Empieza la historia y llenemos este álbum juntos!',
  locked: 'Termina el capítulo anterior para abrir este',
  helpButton: '¿Me ayudas, Víctor?',
  passed: '¡Capítulo superado!',
  failed: 'Casi… ¡prueba otra vez!',
  failedHint: 'El jurado quiere al menos {n} estrellas y el look obligatorio.',
  memoryTitle: 'Nuevo recuerdo',
  memorySaving: 'Revelando la foto…',
  toEnding: 'Ver el final',
  storyDone: '¡Historia completada! Nos vamos a vivir juntos 💛',
}

/** Ayuda a mantener el reto y el look obligatorio sincronizados. */
function chapter(def: Omit<ChapterDef, 'challenge'> & { challenge: Omit<ChallengeDef, 'stage' | 'required'> }): ChapterDef {
  return { ...def, challenge: { ...def.challenge, stage: def.stage, required: def.mustWear.slots } }
}

export const CHAPTERS: ChapterDef[] = [
  chapter({
    id: 'cap-maleta',
    number: 1,
    title: 'Hacer la maleta',
    stage: 'room',
    icon: 'bag',
    intro: {
      title: 'Capítulo 1 · Hacer la maleta',
      lines: ['Cajas por todas partes, cinta de embalar y una lista que no se acaba.', 'Lo primero: un look cómodo para el viaje… y que no falte el bolso.'],
    },
    outro: {
      title: '¡Maleta cerrada!',
      lines: ['Ha cerrado a la primera (bueno, a la tercera, sentándonos encima).', 'Mañana, rumbo al puerto.'],
    },
    challenge: {
      id: 'historia-maleta',
      title: 'Lista para el viaje',
      brief: 'Cómoda para cargar cajas pero con estilo: street y un poquito Y2K. Bolso y calzado obligatorios.',
      icon: 'bag',
      wantedTags: ['street', 'y2k', 'deportivo'],
      harmony: 'libre',
      minAccessories: 2,
    },
    mustWear: { slots: ['bag', 'shoes'], label: 'Bolso de viaje y calzado cómodo' },
    minStars: 3,
    pose: 'wave',
    memory: 'El día que cerramos la maleta',
    suggestion: ['top-babytee', 'pant-flare', 'sh-chunky', 'bag-mochila', 'ha-coletero', 'br-pulseras'],
  }),
  chapter({
    id: 'cap-ferry',
    number: 2,
    title: 'El ferry',
    stage: 'ferry',
    icon: 'plane',
    intro: {
      title: 'Capítulo 2 · El ferry',
      lines: ['Brisa salada, gaviotas y la isla asomando al fondo.', 'Para la cubierta: algo fresco y unas gafas de sol, que aquí arriba pega fuerte.'],
    },
    outro: {
      title: '¡Tierra a la vista!',
      lines: ['Ya se ven las casitas blancas de Ibiza.', 'Dicen que el mar trae suerte a quien llega enamorada.'],
    },
    challenge: {
      id: 'historia-ferry',
      title: 'Brisa en cubierta',
      brief: 'Look marinero y fresquito, con los colores del mar. Gafas de sol obligatorias.',
      icon: 'sun',
      wantedTags: ['playa', 'ibiza', 'street'],
      palette: ['#ffffff', '#7fd6ff', '#7fa2e0', '#f3e6d4'],
      minAccessories: 2,
    },
    mustWear: { slots: ['glasses'], label: 'Gafas de sol' },
    minStars: 3,
    pose: 'hair',
    memory: 'Cruzando el mar hacia nuestra isla',
    suggestion: ['top-tirantes', 'short-denim', 'sh-esparto', 'gl-playa', 'hat-pamela', 'bag-tote'],
  }),
  chapter({
    id: 'cap-playa',
    number: 3,
    title: 'Primer día en la playa',
    stage: 'beach',
    icon: 'sun',
    intro: {
      title: 'Capítulo 3 · Primer día en la playa',
      lines: ['Las cajas pueden esperar: hoy toca estrenar la playa.', 'Arena, agua turquesa y un sombrero, que no queremos ser gambas el primer día.'],
    },
    outro: {
      title: 'Atardecer de postal',
      lines: ['Primer baño, primera puesta de sol, primera arena en todas partes.', 'Creo que nos va a gustar vivir aquí.'],
    },
    challenge: {
      id: 'historia-playa',
      title: 'Día de estreno',
      brief: 'Playero y muy ibicenco, con los colores del verano. Sombrero obligatorio.',
      icon: 'sun',
      wantedTags: ['playa', 'ibiza'],
      bannedTags: ['invierno'],
      palette: ['#3de0c4', '#ffffff', '#ff9b4a', '#d9b98a', '#f3e6d4', '#e3b45a'],
      minAccessories: 2,
    },
    mustWear: { slots: ['hat'], label: 'Sombrero o gorro para el sol' },
    minStars: 3,
    pose: 'peace',
    memory: 'Nuestro primer día de playa',
    suggestion: ['top-bikini', 'skirt-pareo', 'sh-sandalias', 'hat-pamela', 'bag-cesta', 'nk-conchas'],
  }),
  chapter({
    id: 'cap-daltvila',
    number: 4,
    title: 'Cena en Dalt Vila',
    stage: 'daltvila',
    icon: 'moon',
    intro: {
      title: 'Capítulo 4 · Cena en Dalt Vila',
      lines: ['Subimos por las murallas cuando ya se encienden los farolillos.', 'Una cena bonita merece un look romántico… con un toque ibicenco.'],
    },
    outro: {
      title: 'Una noche entre murallas',
      lines: ['Velas, mar a lo lejos y tú riéndote de mis chistes malos.', 'Ha sido la mejor cena de nuestra vida (hasta la próxima).'],
    },
    challenge: {
      id: 'historia-daltvila',
      title: 'Cena a la luz de los farolillos',
      brief: 'Romántico y elegante, en colores que se lleven bien. Calzado obligatorio y algo ibicenco.',
      icon: 'heart',
      wantedTags: ['romantico', 'elegante', 'ibiza'],
      bannedTags: ['deportivo'],
      harmony: 'analogo',
      minAccessories: 2,
    },
    mustWear: { slots: ['shoes'], tag: 'ibiza', count: 1, label: 'Calzado y al menos una prenda ibicenca' },
    minStars: 3,
    pose: 'kiss',
    memory: 'Cena entre murallas y farolillos',
    suggestion: ['top-campesina', 'skirt-satin', 'sh-bailarinas', 'nk-perlas', 'ha-perlas'],
  }),
  chapter({
    id: 'cap-casa',
    number: 5,
    title: 'Estrenar la casa',
    stage: 'casa',
    icon: 'home',
    intro: {
      title: 'Capítulo 5 · Estrenar la casa',
      lines: ['La puerta azul, las buganvillas y dos tazas esperando en la mesa.', 'Hoy estrenamos nuestra casa: blanco ibicenco y flores en el pelo.'],
    },
    outro: {
      title: 'Bienvenida a casa',
      lines: ['Las cajas siguen sin deshacer, pero ya huele a hogar.', 'Tengo algo que enseñarte…'],
    },
    challenge: {
      id: 'historia-casa',
      title: 'Blanco ibicenco',
      brief: 'Boho, ibicenco y romántico, en blancos y tonos arena. Un adorno en el pelo obligatorio.',
      icon: 'flower',
      wantedTags: ['boho', 'ibiza', 'romantico'],
      palette: ['#ffffff', '#f3e6d4', '#d9b98a', '#fff6f0', '#ffb3d9'],
      minAccessories: 2,
    },
    mustWear: { slots: ['hairAcc'], label: 'Un adorno en el pelo' },
    minStars: 3,
    pose: 'hip',
    memory: 'La primera tarde en nuestra casa',
    suggestion: ['top-campesina', 'skirt-tul', 'sh-esparto', 'ha-corona-flores', 'nk-conchas', 'bag-cesta'],
  }),
]

export const CHAPTER_BY_ID: Record<string, ChapterDef> = Object.fromEntries(CHAPTERS.map((c) => [c.id, c]))
