/*
  The fallback library: 47 CC0 / public-domain files on Wikimedia Commons that
  `convex/audio/cc0.ts` copies into Convex storage as `provider: "cc0"` rows.

  Why it exists: the Soundstripe key is a 30-day trial, and it is entitled to
  songs only — `/sound_effects` answers 403 — so without this the sound-effect
  tab would be empty today and both tabs would empty out the day the trial ends.
  These rows are ours outright: CC0 and public domain carry no attribution
  requirement, though the seed records the author and the source page anyway.

  Each entry is a Commons file name plus the classification the source does not
  have. Everything factual — the audio, its duration, its licence, its author,
  and a music track's genre — is resolved from Commons when the seed runs, so a
  file whose licence changed is skipped rather than silently imported. `mood`,
  `categories` and `tags` are our own reading of the material, written in the
  vocabulary Soundstripe uses (the 13 moods it tags songs with) so that a library
  mixing both providers filters as one.
*/

export type Cc0Entry = {
  /* Commons file name without the `File:` prefix. Also the row's `externalId`:
     Commons names are unique and stable, so re-seeding updates in place. */
  file: string;
  kind: "music" | "sfx";
  /* Commons file names are not titles — "406243 stubb typewriter-ding-near-mono"
     is an upload id and a slug. The panel shows this instead. */
  title: string;
  /* Music. Genres come from the file's Commons categories; these do not. */
  mood?: string[];
  bpm?: number;
  /* Sound effects. */
  categories?: string[];
  tags?: string[];
};

export const CC0_MANIFEST: Cc0Entry[] = [
  /* ── Music ───────────────────────────────────────────────────────────── */
  /* Komiku, Monplaisir and Bauchamp release through the Free Music Archive
     under CC0; Commons mirrors the albums with the FMA genre categories intact. */
  { file: "Komiku - 55 - Sunset on the beach.ogg", kind: "music", title: "Sunset on the Beach", mood: ["Chill", "Happy"] },
  { file: "Komiku - 64 - First Dance.ogg", kind: "music", title: "First Dance", mood: ["Fun", "Happy"] },
  { file: "Komiku - 60 - The Strawberry.ogg", kind: "music", title: "The Strawberry", mood: ["Fun", "Quirky"] },
  { file: "Komiku - 05 - Surfing.ogg", kind: "music", title: "Surfing", mood: ["Fun", "Happy"] },
  { file: "Komiku - 39 - Swimming with the fish.ogg", kind: "music", title: "Swimming with the Fish", mood: ["Calm", "Chill"] },
  { file: "Komiku - 33 - Space MTV.ogg", kind: "music", title: "Space MTV", mood: ["Fun", "Quirky"] },
  { file: "Komiku - 13 - The Wind.ogg", kind: "music", title: "The Wind", mood: ["Calm", "Reflective"] },
  { file: "Komiku - 02 - Remember the time we use to play.ogg", kind: "music", title: "Remember the Time We Used to Play", mood: ["Reflective", "Hopeful"] },
  { file: "Komiku - 07 - Run against the universe.ogg", kind: "music", title: "Run Against the Universe", mood: ["Fun", "Inspiring"] },
  { file: "Komiku - 25 - Space Bicycle.ogg", kind: "music", title: "Space Bicycle", mood: ["Quirky", "Fun"] },
  { file: "Monplaisir - 11 - I am the Coyote.ogg", kind: "music", title: "I Am the Coyote", mood: ["Quirky", "Fun"] },
  { file: "Monplaisir - 33 - Level 4.ogg", kind: "music", title: "Level 4", mood: ["Quirky", "Suspenseful"] },
  { file: "Monplaisir - 07 - Free To Use 7.ogg", kind: "music", title: "Free to Use 7", mood: ["Reflective", "Calm"] },
  { file: "Monplaisir - 22 - Lost somewhere between the sleep and the wake.ogg", kind: "music", title: "Lost Somewhere Between the Sleep and the Wake", mood: ["Reflective", "Chill"] },
  /* Bauchamp titles their loops with the tempo, which is where the BPM comes
     from — measured by the artist, not by us. */
  { file: "Bauchamp - 126 cha cha loop.ogg", kind: "music", title: "Cha Cha Loop", mood: ["Fun", "Happy"], bpm: 126, tags: ["loop"] },
  { file: "Bauchamp - 128 housy stab and bass.ogg", kind: "music", title: "Housy Stab and Bass", mood: ["Fun", "Happy"], bpm: 128, tags: ["loop"] },
  { file: "Bauchamp - 140 three step.ogg", kind: "music", title: "Three Step", mood: ["Suspenseful", "Quirky"], bpm: 140, tags: ["loop"] },
  { file: "Bauchamp - 90 vie organique moog.ogg", kind: "music", title: "Vie Organique Moog", mood: ["Chill", "Reflective"], bpm: 90, tags: ["loop", "moog"] },

  /* ── Sound effects ───────────────────────────────────────────────────── */
  /* Categories follow Soundstripe's sound-effect vocabulary so both providers
     can share one row of chips. */
  { file: "Wilhelm Scream.ogg", kind: "sfx", title: "Wilhelm Scream", categories: ["Human", "Comedy"], tags: ["scream", "voice", "classic"] },
  { file: "Horn stab.mp3", kind: "sfx", title: "Horn Stab", categories: ["Musical", "Transitions"], tags: ["brass", "stinger", "accent"] },
  { file: "Sucesso.ogg", kind: "sfx", title: "Retro Success", categories: ["Interface", "Musical"], tags: ["success", "win", "game", "8-bit"] },
  { file: "Acerto efeito sonoro retrô.oga", kind: "sfx", title: "Retro Correct", categories: ["Interface"], tags: ["correct", "game", "8-bit"] },
  { file: "Erro efeito sonoro retrô.oga", kind: "sfx", title: "Retro Error", categories: ["Interface"], tags: ["error", "wrong", "game", "8-bit"] },
  { file: "Fim efeito sonoro retrô.oga", kind: "sfx", title: "Retro Game Over", categories: ["Interface", "Musical"], tags: ["game over", "end", "8-bit"] },
  { file: "Virada de Carta.ogg", kind: "sfx", title: "Card Flip", categories: ["Foley"], tags: ["card", "flip", "paper", "swipe"] },
  { file: "Deslizando o dedo no piano.ogg", kind: "sfx", title: "Piano Glissando", categories: ["Musical"], tags: ["piano", "glissando", "sweep"] },
  { file: "647712 unfa braam.flac", kind: "sfx", title: "Cinematic Braam", categories: ["Cinematic", "Transitions"], tags: ["braam", "trailer", "impact", "brass"] },
  { file: "Magical appearance.ogg", kind: "sfx", title: "Magical Appearance", categories: ["Comedy", "Musical"], tags: ["magic", "sparkle", "appear"] },
  { file: "Comic spring up or magic trick.ogg", kind: "sfx", title: "Comic Spring Up", categories: ["Comedy"], tags: ["boing", "spring", "cartoon"] },
  { file: "Comic vanishing magic trick.ogg", kind: "sfx", title: "Comic Vanish", categories: ["Comedy"], tags: ["vanish", "cartoon", "magic"] },
  { file: "Music Box Sound Effect.ogg", kind: "sfx", title: "Music Box Melody", categories: ["Musical"], tags: ["music box", "chime", "twinkle"] },
  { file: "Whoom bass.ogg", kind: "sfx", title: "Bass Whoom", categories: ["Transitions", "Cinematic"], tags: ["whoosh", "boom", "impact"] },
  { file: "Sting.ogg", kind: "sfx", title: "Sting", categories: ["Musical", "Transitions"], tags: ["sting", "accent", "hit"] },
  { file: "Knocking on wood or door.ogg", kind: "sfx", title: "Knock on Wood", categories: ["Foley"], tags: ["knock", "door", "wood"] },
  { file: "Knock on door.wav", kind: "sfx", title: "Door Knock", categories: ["Foley"], tags: ["knock", "door"] },
  { file: "Typing - Model M 1986.ogg", kind: "sfx", title: "Mechanical Keyboard Typing", categories: ["Technology", "Foley"], tags: ["keyboard", "typing", "office"] },
  { file: "IBM M2 sound.ogg", kind: "sfx", title: "Keyboard Clatter", categories: ["Technology", "Foley"], tags: ["keyboard", "typing", "office"] },
  { file: "Cash register.ogg", kind: "sfx", title: "Cash Register", categories: ["Foley", "Technology"], tags: ["cash", "register", "sale"] },
  { file: "Simple Happy Beep.ogg", kind: "sfx", title: "Happy Beep", categories: ["Interface"], tags: ["notification", "beep", "alert"] },
  { file: "Music Box.ogg", kind: "sfx", title: "Music Box Chime", categories: ["Interface", "Musical"], tags: ["notification", "chime"] },
  { file: "277021 sandermotions applause-2.wav", kind: "sfx", title: "Applause", categories: ["Human"], tags: ["applause", "clap", "crowd", "celebration"] },
  { file: "Holga shuttersound.ogg", kind: "sfx", title: "Camera Shutter", categories: ["Technology", "Foley"], tags: ["camera", "shutter", "photo", "click"] },
  { file: "406243 stubb typewriter-ding-near-mono.wav", kind: "sfx", title: "Typewriter Ding", categories: ["Foley", "Interface"], tags: ["typewriter", "bell", "ding"] },
  { file: "Rain (1).ogg", kind: "sfx", title: "Rain", categories: ["Ambiance"], tags: ["rain", "weather", "ambience"] },
  { file: "Phonk Riser (1) Sample.wav", kind: "sfx", title: "Riser", categories: ["Transitions"], tags: ["riser", "build", "sweep"] },
  { file: "Little robot buzzing.ogg", kind: "sfx", title: "Robot Buzz", categories: ["Technology", "Comedy"], tags: ["robot", "buzz", "sci-fi"] },
  { file: "Finger clicks.ogg", kind: "sfx", title: "Finger Clicks", categories: ["Human", "Foley"], tags: ["click", "snap", "fingers"] },
];
