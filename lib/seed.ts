// Demo seed data for the in-memory store. Shapes follow docs/api-contract.md
// (recovered from the original client bundles). Content strings are French;
// the source material lives in content/*.json at the repository root.
import { LIBRARY_EXERCISE_SOURCES } from "./exercise-library";

// ---------------------------------------------------------------- types

export type ExerciseType = "warmup" | "mainExercises" | "gameApplication" | "freegame" | "cooldown";

export type Exercise = {
  id: string;
  title: string;
  type: ExerciseType;
  description: string;
  duration: number;
  instructions: string;
  parameters: string[];
  objective: string;
  rules: string[];
  coachingPoints: string[];
  contentSections: null;
  exerciseSvg: string;
  setupSvg: string;
  schemaImageUrl: null;
  exerciseScene: null;
  progressionNote: null;
  manually_created: boolean;
  duplicated: boolean;
  createdAt: string;
};

export type TrainingExercises = { id: string; exerciseSvg: string; setupSvg: string };

export type Training = {
  id: string;
  name: string;
  theme: string;
  date: string;
  duration: number;
  ageGroup: string;
  playerCount: number;
  plan: Exercise[];
  exercises: TrainingExercises[];
  manually_created: boolean;
  createdAt: string;
};

export type PlayerSkill = { id: string; name: string; value: number };

export type Player = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: null;
  position: string;
  jerseyNumber: number;
  preferredFoot: "RIGHT" | "LEFT";
  dateOfBirth: string;
  coachNotes: string;
  matches: number;
  goals: number;
  assists: number;
  skills: PlayerSkill[];
  playerSkills: unknown[];
  assistantSkills: unknown[];
  assistantSkillOverlays: unknown[];
  strengths: string[];
  improvements: string[];
  teamContext: { mode: "coach" };
};

export type Analysis = {
  id: string;
  teamFormation: string;
  opponentTeamName: string;
  opponentTeamFormation: string;
  // Filled lazily by GET /api/analysis/:id when missing (contract §7).
  createdAt?: string;
  // Filled by POST /api/analysis/:id/generate-tips.
  tips?: AnalysisTip[];
  tipsGeneratedAt?: string;
};

export type AnalysisTip = {
  id: string;
  category: "defense" | "attack" | "transition" | "setPieces";
  title: string;
  body: string;
};

export type SeasonPlan = {
  id: string;
  teamCategory: string;
  customThemeLabel: string | null;
  seasonThemesPriority: string[];
  trainingDays: string[];
  usualMatchDay: string;
  calendar: {
    preseasonStartDate: string;
    championshipStartDate: string;
    hasWinterBreak: boolean;
    winterBreakStartDate: string;
    winterBreakTrainingResumeDate: string;
    championshipResumeDate: string;
    championshipEndDate: string;
  };
  macroPlan: { name: string; startWeek: number; endWeek: number; objective: string; rationale: string }[];
};

export type SeasonSession = {
  date: string;
  weekIndex: number;
  theme: string;
  mesocycle: string;
  intensity: "low" | "medium" | "high";
  sessionKind: string | null;
  durationMinutes: number;
  objective: string;
  trainingSessionId: string | null;
  status: string;
  hasFeedback: boolean;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  path?: string;
};

export type NextMatch = {
  date: string;
  opponent: string | null;
  homeAway: "home" | "away";
  competition: string | null;
};

// One imported fixture (POST /api/season/calendar, contract §6).
export type SeasonMatch = NextMatch & {
  id: string;
  seasonPlanId: string;
  source: string;
};

// ---------------------------------------------------------------- dates

// "YYYY-MM-DD" for a day offset from today (0 = today, negative = past).
function ymd(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

// ---------------------------------------------------------------- pitch diagrams

// Small inline SVGs (320x200): green field, white lines, dots for players,
// triangles for cones, small white rects for goals. Five variants reused
// across the seeds so every exercise has a distinct-looking diagram.

const dot = (x: number, y: number, fill = "#ffca28") =>
  `<circle cx="${x}" cy="${y}" r="7" fill="${fill}" stroke="#1b5e20" stroke-width="1"/>`;
const cone = (x: number, y: number) => `<path d="M${x} ${y} l6 10 l-12 0 z" fill="#ff7043"/>`;
const goal = (x: number, y: number) => `<rect x="${x}" y="${y}" width="6" height="28" fill="#ffffff"/>`;

function pitchFrame(inner: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" width="320" height="200">` +
    `<rect width="320" height="200" fill="#2e7d32"/>` +
    `<rect x="8" y="8" width="304" height="184" fill="none" stroke="#ffffff" stroke-width="2"/>` +
    `<line x1="160" y1="8" x2="160" y2="192" stroke="#ffffff" stroke-width="2"/>` +
    `<circle cx="160" cy="100" r="24" fill="none" stroke="#ffffff" stroke-width="2"/>` +
    inner +
    `</svg>`
  );
}

// Activity sketches (attackers yellow, defenders red, ball white).
const EXERCISE_VARIANTS: string[] = [
  dot(80, 60) + dot(240, 60) + dot(80, 140) + dot(240, 140) + dot(140, 100, "#ef5350") + dot(180, 100, "#ef5350"),
  dot(70, 50) + dot(70, 100) + dot(70, 150) + dot(250, 50, "#90caf9") + dot(250, 100, "#90caf9") + dot(250, 150, "#90caf9"),
  cone(160, 40) + cone(160, 80) + cone(160, 120) + cone(160, 160) + dot(90, 100) + dot(230, 100),
  goal(2, 86) + goal(312, 86) + dot(90, 70) + dot(90, 130) + dot(140, 100) + dot(180, 70, "#90caf9") + dot(180, 130, "#90caf9") + dot(230, 100, "#90caf9"),
  dot(160, 60) + dot(220, 100) + dot(160, 140) + dot(100, 100) + dot(160, 100, "#ffffff"),
];

// Setup sketches: cones, goals and starting positions only.
const SETUP_VARIANTS: string[] = [
  cone(80, 60) + cone(240, 60) + cone(80, 140) + cone(240, 140),
  cone(160, 50) + cone(160, 150) + goal(2, 86),
  cone(120, 40) + cone(120, 90) + cone(120, 140) + cone(200, 40) + cone(200, 90) + cone(200, 140),
  goal(2, 86) + goal(312, 86) + cone(160, 40) + cone(160, 160),
  cone(160, 50) + cone(160, 150) + goal(2, 86) + goal(312, 86),
];

export function diagram(variant: number, kind: "exercise" | "setup"): string {
  const pool = kind === "exercise" ? EXERCISE_VARIANTS : SETUP_VARIANTS;
  return pitchFrame(pool[variant % pool.length]);
}

// ---------------------------------------------------------------- exercises

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export type ExerciseSource = {
  id: string;
  title: string;
  type: ExerciseType;
  duration: number;
  players: [number, number];
  equipment: string[];
  subTheme: string;
  description: string;
  coachingPoints: string[];
  variations: string[];
  rules: string[];
};

// Maps one content/exercises.json entry to the contract item shape.
function buildExercise(src: ExerciseSource, index: number): Exercise {
  const [playersMin, playersMax] = src.players;
  const squad = playersMin === playersMax ? `${playersMin}` : `${playersMin} à ${playersMax}`;
  return {
    id: src.id,
    title: src.title,
    type: src.type,
    description: src.description,
    duration: src.duration,
    // Briefing composed from the source description plus its progressions.
    instructions: `${src.description} Progressions : ${src.variations.join(" ; ")}.`,
    parameters: [`Joueurs : ${squad}`, `Matériel : ${src.equipment.join(", ")}`],
    objective: capitalize(src.subTheme),
    rules: src.rules,
    coachingPoints: src.coachingPoints,
    contentSections: null,
    exerciseSvg: diagram(index, "exercise"),
    setupSvg: diagram(index, "setup"),
    schemaImageUrl: null,
    exerciseScene: null,
    progressionNote: null,
    manually_created: true,
    duplicated: false,
    createdAt: "2026-09-01T09:30:00.000Z",
  };
}

const EXERCISE_SOURCES: ExerciseSource[] = [
  {
    id: "ex_001",
    title: "La rivière aux crocodiles",
    type: "warmup",
    duration: 12,
    players: [6, 14],
    equipment: ["ballons", "coupelles", "chasubles"],
    subTheme: "conduite de balle",
    description:
      "Le terrain est divisé en plusieurs rivières matérialisées par des coupelles. Chaque joueur conduit son ballon et tente de traverser sans se faire toucher par un crocodile (joueurs sans ballon). Un crocodile qui touche le ballon d'un dribbleur le transforme en crocodile ; le dernier dribbleur en jeu gagne la partie.",
    coachingPoints: ["Ballon toujours près du pied", "Tête levée pour repérer les crocodiles", "Change de rythme pour passer", "Protège ton ballon avec le corps"],
    variations: ["Rétrécir la rivière", "Ajouter un crocodile", "Passage obligatoire par une porte"],
    rules: ["Le crocodile doit toucher le ballon, pas le joueur.", "Un dribbleur touché devient crocodile à son tour.", "Ballon sorti de la zone : joueur éliminé pour la manche."],
  },
  {
    id: "ex_004",
    title: "Les déménageurs",
    type: "warmup",
    duration: 12,
    players: [6, 16],
    equipment: ["ballons", "cerceaux", "coupelles"],
    subTheme: "coordination",
    description:
      "Les joueurs transportent les ballons de la maison de départ vers la maison d'arrivée en franchissant un parcours : cloche-pied entre les cerceaux, slalom entre les coupelles, saut du plot. Chaque équipe doit déménager le plus de ballons possible en deux minutes.",
    coachingPoints: ["Regarde où tu poses tes appuis", "Bras écartés pour l'équilibre", "Reste dynamique sans courir trop vite", "Pose le ballon sous le pied pour t'arrêter"],
    variations: ["Ballon porté à l'aller, conduit au retour", "Parcours inversé", "Course face à face avec l'équipe adverse"],
    rules: ["Parcours obligatoire : cerceaux, slalom puis saut.", "Un ballon à la fois par joueur.", "Manches de deux minutes : on additionne les ballons déménagés."],
  },
  {
    id: "ex_005",
    title: "1-2-3 Soleil du dribbleur",
    type: "mainExercises",
    duration: 12,
    players: [6, 14],
    equipment: ["ballons", "coupelles"],
    subTheme: "conduite de balle",
    description:
      "Les joueurs conduisent leur ballon vers le coach qui tourne le dos au groupe. Au signal 1-2-3 Soleil, le coach se retourne : chacun doit arrêter son ballon sous la semelle sans bouger. Tout joueur en mouvement repart au départ.",
    coachingPoints: ["Arrête ton ballon sous la semelle", "Conduis avec des touches courtes", "Tête levée pour surprendre le coach", "Repars vite après le signal"],
    variations: ["Arrêt obligatoire de la semelle", "Franchise libre au dernier signal", "Avancer uniquement du pied faible"],
    rules: ["Au signal, ballon impérativement arrêté sous la semelle.", "Tout joueur qui bouge encore repart à la ligne de départ.", "Le premier arrivé au coach gagne la manche."],
  },
  {
    id: "ex_008",
    title: "Le miroir",
    type: "cooldown",
    duration: 10,
    players: [4, 12],
    equipment: ["coupelles"],
    subTheme: "coordination",
    description:
      "Par deux, face à face, un meneur exécute des mouvements simples (cloche-pied, sauts d'un pied sur l'autre, toucher le sol, pivoter) que son partenaire copie en miroir. Après trente secondes, les rôles s'inversent.",
    coachingPoints: ["Copie vite et proprement", "Reste en rythme avec ton meneur", "Appuis sur l'avant du pied", "Concentre-toi sur l'équilibre et la coordination"],
    variations: ["Version avec ballon entre les pieds", "Mouvements de plus en plus rapides", "Miroir inversé avec mouvements opposés"],
    rules: ["Le copiste reproduit chaque mouvement à l'identique.", "Trente secondes par rôle, puis inversion.", "Pas de parole : tout passe par le regard."],
  },
  {
    id: "ex_010",
    title: "Le match des quatre mini-buts",
    type: "freegame",
    duration: 15,
    players: [8, 12],
    equipment: ["ballons", "coupelles", "mini-buts", "chasubles"],
    subTheme: "jeu réduit",
    description:
      "Match quatre contre quatre (ou trois contre trois) sur un terrain réduit avec deux mini-buts par équipe. Chaque équipe attaque deux buts et défend les deux autres : il faut lever la tête pour trouver le but le moins gardé. Les remises en jeu se font toujours par une passe courte.",
    coachingPoints: ["Lève la tête avant de recevoir", "Cherche le but adverse le moins défendu", "Oriente tes contrôles vers l'avant", "Défends immédiatement après la perte de balle"],
    variations: ["Le coach annonce le but qui compte double", "Trois touches de balle maximum", "Format trois contre trois sur quatre buts"],
    rules: ["Chaque équipe attaque deux mini-buts et défend les deux autres.", "Remise en jeu toujours par une passe courte.", "Le but annoncé par le coach compte double."],
  },
  {
    id: "ex_011",
    title: "Passes en carré en mouvement",
    type: "mainExercises",
    duration: 12,
    players: [8, 16],
    equipment: ["ballons", "coupelles"],
    subTheme: "passe",
    description:
      "Les joueurs occupent les angles d'un carré de huit à dix mètres et se passent le ballon avant de suivre leur passe. Une fois le circuit installé, un deuxième ballon entre en jeu pour augmenter le rythme et la prise d'informations.",
    coachingPoints: ["Ouvre ton pied d'appui vers la cible", "Passe au sol, appuyée et précise", "Enchaîne contrôle et passe en deux touches", "Redresse la tête avant la passe"],
    variations: ["Deux ballons en circulation", "Une touche de balle autorisée", "Changement de sens au signal du coach"],
    rules: ["Suivre sa passe après chaque transmission.", "Passes au sol uniquement, appuyées et précises.", "Deux touches maximum : contrôle puis passe."],
  },
  {
    id: "ex_012",
    title: "Conservation en losange 4v2",
    type: "gameApplication",
    duration: 15,
    players: [6, 12],
    equipment: ["ballons", "coupelles", "chasubles"],
    subTheme: "conservation",
    description:
      "Quatre joueurs occupent les angles d'un losange et conservent le ballon face à deux défenseurs placés à l'intérieur. Le défenseur qui touche le ballon échange sa place avec le joueur qui a perdu la possession.",
    coachingPoints: ["Occupe les angles et reste en mouvement", "Joue à l'opposé du défenseur", "Premier contrôle orienté vers l'espace libre", "Annonce-toi pour aider ton partenaire"],
    variations: ["Deux touches de balle maximum", "Ajouter un joker au centre", "Dix passes consécutives valent un point"],
    rules: ["Rester sur les angles du losange, un joueur par angle.", "Le défenseur qui touche le ballon échange avec le joueur fautif.", "Dix passes consécutives valent un point."],
  },
  {
    id: "ex_013",
    title: "L'école du contrôle orienté",
    type: "mainExercises",
    duration: 12,
    players: [8, 18],
    equipment: ["ballons", "coupelles", "plots"],
    subTheme: "contrôle orienté",
    description:
      "Par deux, dans des couloirs matérialisés : un serveur passe le ballon au sol, le receveur réalise un contrôle orienté vers l'avant pour franchir le portillon, puis rend le ballon. On tourne après cinq répétitions, des deux pieds.",
    coachingPoints: ["Contrôle du pied intérieur vers l'espace", "Corps ouvert avant la réception", "Première touche déjà tournée vers l'avant", "Reste précis malgré le rythme"],
    variations: ["Pression passive du serveur après la passe", "Ballon en cloche pour un contrôle aérien", "Enchaîner contrôle puis tir"],
    rules: ["Contrôle obligatoirement orienté vers l'avant.", "Franchir le portillon après chaque contrôle.", "Cinq répétitions puis rotation, des deux pieds."],
  },
  {
    id: "ex_016",
    title: "Le jeu des trois zones",
    type: "gameApplication",
    duration: 18,
    players: [10, 18],
    equipment: ["ballons", "coupelles", "chasubles"],
    subTheme: "progression",
    description:
      "Le terrain est découpé en trois zones dans la largeur. Une équipe marque un point en contrôlant le ballon dans la zone adverse après avoir franchi les deux zones précédentes en possession. Le ballon peut changer de zone en une passe ou après conduite.",
    coachingPoints: ["Cherche le joueur placé dans la zone suivante", "Écarte le jeu pour ouvrir les axes", "Redouble de passes courtes pour progresser", "Change d'orientation si l'axe est fermé"],
    variations: ["Quatre touches de balle maximum par joueur", "Supériorité numérique dans la zone du milieu", "Franchir les trois zones en moins de dix secondes"],
    rules: ["Franchir les zones en possession, dans l'ordre.", "Un point quand le ballon est contrôlé dans la zone adverse.", "Le ballon change de zone par la passe ou la conduite."],
  },
  {
    id: "ex_020",
    title: "Rondo 5v2",
    type: "mainExercises",
    duration: 12,
    players: [7, 14],
    equipment: ["ballons", "coupelles", "chasubles"],
    subTheme: "rondo",
    description:
      "Dans un carré de dix mètres, cinq joueurs conservent le ballon autour de deux défenseurs. Le défenseur qui intercepte ou touche le ballon prend la place du joueur qui l'a perdu.",
    coachingPoints: ["Prends l'information avant de recevoir", "Premier contrôle loin du défenseur", "Joue dans le bon pied du partenaire", "Après la passe, remets-toi en soutien"],
    variations: ["Une touche de balle maximum", "Version quatre contre deux", "Un point toutes les dix passes"],
    rules: ["Deux défenseurs à l'intérieur du carré de dix mètres.", "Celui qui perd le ballon prend la place du défenseur.", "Compter les séries de dix passes réussies."],
  },
  {
    id: "ex_022",
    title: "Le mur vivant",
    type: "mainExercises",
    duration: 15,
    players: [6, 12],
    equipment: ["ballons", "coupelles"],
    subTheme: "jeu en appui",
    description:
      "Deux carrés de conservation trois contre un sont séparés de dix mètres. Chaque carré conserve face à un défenseur, et le mur vivant se rend disponible au centre pour relayer le ballon d'un carré à l'autre en une touche. Chaque aller-retour réussi rapporte un point.",
    coachingPoints: ["Rends-toi disponible dans l'axe", "Une touche, orientée vers le carré cible", "Appelle le ballon avec la voix et le corps", "Après la relance, propose la solution suivante"],
    variations: ["Deux murs vivants de chaque côté", "Le mur devient défenseur au signal du coach", "Passage obligatoire par le mur pour marquer"],
    rules: ["Le mur relaye en une touche d'un carré à l'autre.", "Chaque aller-retour réussi rapporte un point.", "Le mur ne peut ni dribbler ni conserver le ballon."],
  },
  {
    id: "ex_023",
    title: "Jeu de position 4v4+2",
    type: "gameApplication",
    duration: 18,
    players: [8, 12],
    equipment: ["ballons", "coupelles", "chasubles"],
    subTheme: "jeu de position",
    description:
      "Un quatre contre quatre se joue avec deux jokers qui évoluent sur les côtés. Les jokers jouent toujours avec l'équipe qui possède le ballon, sans compter de but : l'objectif est de conserver et de progresser. Le coach arrête régulièrement le jeu pour montrer les espaces libres à occuper.",
    coachingPoints: ["Occupe les espaces libres, pas les pieds des partenaires", "Crée le surnombre autour du ballon", "Après la passe, change de zone", "Rythme : attirer, fixer, renverser"],
    variations: ["Les jokers passent à deux touches", "Marquer seulement après un changement d'aile", "Supprimer un joker pour complexifier"],
    rules: ["Les jokers jouent toujours avec l'équipe en possession.", "Aucun but : on marque des séquences de conservation.", "Le coach arrête le jeu pour corriger les placements."],
  },
  {
    id: "ex_025",
    title: "Le déclencheur de pressing",
    type: "gameApplication",
    duration: 18,
    players: [10, 16],
    equipment: ["ballons", "coupelles", "chasubles"],
    subTheme: "pressing",
    description:
      "Un six contre six se joue sur un terrain en trois zones. L'équipe qui presse ne le fait qu'après un déclencheur précis (passe en retrait, contrôle raté, ballon dans le coin). Elle gagne un point lorsqu'elle récupère le ballon dans le tiers adverse.",
    coachingPoints: ["Premier presseur : course en courbe, fermer l'intérieur", "Tout le bloc se met en mouvement ensemble", "Ferme les lignes de passe proches", "Au mot du coach, monte en bloc"],
    variations: ["Le coach annonce le déclencheur à voix haute", "Pressing à deux imposé sur le porteur", "Zone de récupération bonus agrandie"],
    rules: ["Pressing uniquement après un déclencheur précis.", "Point marqué si récupération dans le tiers adverse.", "Le bloc monte ensemble, jamais seul."],
  },
  {
    id: "ex_030",
    title: "Coordination en échelle de rythme",
    type: "warmup",
    duration: 12,
    players: [6, 16],
    equipment: ["échelle de rythme", "coupelles"],
    subTheme: "coordination",
    description:
      "Quatre ateliers d'échelle de rythme : pas chassés, un pied par case, double pas, pas croisés. Chaque joueur traverse l'échelle puis enchaîne une accélération sur cinq mètres. On tourne d'atelier en atelier au signal du coach.",
    coachingPoints: ["Appuis sur l'avant du pied, chevilles dynamiques", "Bras actifs et coordonnés", "Regarde loin devant, pas tes pieds", "Accélère proprement après la dernière case"],
    variations: ["Enchaîner l'échelle avec conduite de balle", "Duel en sortie d'échelle", "Réagir à un signal du coach en plein parcours"],
    rules: ["Respecter la consigne technique de chaque atelier.", "Accélération sur cinq mètres après chaque passage.", "Rotation d'atelier au signal du coach."],
  },
  {
    id: "ex_037",
    title: "Conservation en supériorité 8v6",
    type: "gameApplication",
    duration: 18,
    players: [14, 14],
    equipment: ["ballons", "coupelles", "chasubles"],
    subTheme: "conservation",
    description:
      "Possession huit contre six sur un espace de quarante mètres sur trente : l'équipe en supériorité conserve et cherche les passes dans les intervalles, l'équipe en infériorité défend en bloc et contre-attaque vers deux mini-buts dès la récupération. Séquences de quatre minutes.",
    coachingPoints: ["Jeu dans les intervalles, corps orienté vers l'avant", "Change d'orientation quand l'axe est fermé", "En infériorité : bloc compact, on défend ensemble", "Après récupération : première passe vers l'avant"],
    variations: ["Dix passes consécutives valent un point", "Quatre secondes maximum pour contre-attaquer", "Ajouter un joker latéral"],
    rules: ["Dix passes consécutives valent un point.", "L'équipe en infériorité attaque les deux mini-buts après récupération.", "Séquences de quatre minutes puis échange des rôles."],
  },
  {
    id: "ex_039",
    title: "Jeu de position avec appui intérieur",
    type: "gameApplication",
    duration: 20,
    players: [12, 16],
    equipment: ["ballons", "coupelles", "chasubles", "buts"],
    subTheme: "jeu de position",
    description:
      "Un six contre six plus deux appuis intérieurs évoluant dans des couloirs centraux. Pour qu'un but compte, le ballon doit avoir transité par un appui intérieur dans les dix secondes précédentes. Les appuis changent de rôle avec les joueurs de champ toutes les cinq minutes.",
    coachingPoints: ["L'appui intérieur sert de relais, pas de finisseur", "Après la passe à l'appui, repars en profondeur", "Cherche la passe qui élimine plusieurs adversaires", "Fixe avant de donner"],
    variations: ["Une touche pour les appuis", "L'appui peut sortir du couloir pour combiner", "Pressing interdit sur les appuis pendant trois secondes"],
    rules: ["Un but compte seulement après une passe à un appui intérieur.", "Les appuis évoluent dans les couloirs centraux.", "Rotation appuis/joueurs de champ toutes les cinq minutes."],
  },
  {
    id: "ex_040",
    title: "Contre-attaque en 6 secondes",
    type: "gameApplication",
    duration: 18,
    players: [10, 16],
    equipment: ["ballons", "coupelles", "chasubles", "buts"],
    subTheme: "transition",
    description:
      "Sur demi-terrain, une équipe attaque et l'autre défend en bloc médian. Dès que l'équipe défensive récupère le ballon, elle dispose de six secondes pour finir sur le but opposé ; les attaquants en retard défendent la contre-attaque. On inverse les rôles toutes les six minutes.",
    coachingPoints: ["Premier regard vers l'avant à la récupération", "Le porteur fixe le premier défenseur, les autres sprintent", "Écarte le jeu pour ouvrir la contre-attaque", "Si la contre-attaque échoue, on repart en circulation"],
    variations: ["Compte à rebours porté à huit secondes", "Deux vagues successives de contre-attaque", "Contre-attaque obligatoirement passée par le côté"],
    rules: ["Six secondes maximum pour finir après la récupération.", "Rôles inversés toutes les six minutes.", "Si la contre-attaque échoue, retour en circulation."],
  },
  {
    id: "ex_048",
    title: "Sortie de balle guidée 8v8",
    type: "gameApplication",
    duration: 20,
    players: [14, 16],
    equipment: ["ballons", "coupelles", "chasubles", "buts"],
    subTheme: "sortie de balle",
    description:
      "Le terrain est divisé en trois zones horizontales. L'équipe qui construit part du gardien et doit traverser le tiers médian en possession pour marquer ; un but précédé d'une sortie de balle complète compte double. L'adversaire presse haut et marque un point dès qu'il récupère dans le tiers de construction.",
    coachingPoints: ["Le gardien participe : il fait le surnombre derrière", "Étire le bloc adverse : largeur maximale au départ", "Cherche la passe qui élimine la première ligne", "Si la première ligne est fermée, joue la seconde"],
    variations: ["Pressing adverse à quatre joueurs imposé", "Interdiction du jeu long", "Trois joueurs derrière pour construire"],
    rules: ["Un but précédé d'une sortie de balle complète compte double.", "L'adversaire marque un point en récupérant dans le tiers de construction.", "Traverser le tiers médian en possession avant de marquer."],
  },
  {
    id: "ex_049",
    title: "Gestion des émotions avant match",
    type: "cooldown",
    duration: 15,
    players: [10, 16],
    equipment: ["ballons", "coupelles"],
    subTheme: "gestion émotionnelle",
    description:
      "Atelier de préparation mentale intégré à la séance : après un échauffement dynamique, chaque joueur identifie une situation stressante vécue en match, puis répète une routine courte (respiration, phrase-clé, geste d'ancrage) dans un exercice simple de passes. Un échange en cercle termine l'atelier.",
    coachingPoints: ["Respire deux fois profondément avant de te concentrer", "Choisis une phrase courte et positive", "Répète la même routine à chaque ballon", "Parle de tes émotions sans honte : c'est une force"],
    variations: ["Routine répétée sous la pression du chrono", "Partage de routines en petits groupes", "Rituel collectif avant un match cinq contre cinq"],
    rules: ["Chaque joueur choisit une phrase-clé courte et positive.", "Répéter la routine à chaque ballon du rondo.", "Échange en cercle sans jugement en fin d'atelier."],
  },
];

// Hand-curated sources first (their diagram variants stay stable), then the
// generated library (lib/exercise-library.ts); listed in id order.
export const seedExercises: Exercise[] = [...EXERCISE_SOURCES, ...LIBRARY_EXERCISE_SOURCES]
  .map(buildExercise)
  .sort((a, b) => a.id.localeCompare(b.id));

// ---------------------------------------------------------------- trainings

// Finds seeded exercises by id, keeping the block order of the source session.
function pickExercises(ids: string[]): Exercise[] {
  return ids.map((id) => {
    const exercise = seedExercises.find((e) => e.id === id);
    if (!exercise) throw new Error(`seed error: unknown exercise ${id}`);
    return exercise;
  });
}

type TrainingSource = {
  id: string;
  name: string;
  theme: string;
  ageGroup: string;
  playerCount: number;
  duration: number;
  daysAgo: number;
  exerciseIds: string[];
};

// Maps one content/trainings.json session (its blocks) to the contract shape.
function buildTraining(src: TrainingSource): Training {
  const plan = pickExercises(src.exerciseIds);
  return {
    id: src.id,
    name: src.name,
    theme: src.theme,
    date: ymd(-src.daysAgo),
    duration: src.duration,
    ageGroup: src.ageGroup,
    playerCount: src.playerCount,
    plan,
    exercises: plan.map((e) => ({ id: e.id, exerciseSvg: e.exerciseSvg, setupSvg: e.setupSvg })),
    manually_created: false,
    createdAt: isoDaysAgo(src.daysAgo + 1),
  };
}

export const seedTrainings: Training[] = [
  buildTraining({
    id: "tr_001",
    name: "Conduite de balle et jeux réduits",
    theme: "technique",
    ageGroup: "U6-U9",
    playerCount: 12,
    duration: 60,
    daysAgo: 9,
    exerciseIds: ["ex_004", "ex_001", "ex_005", "ex_010", "ex_008"],
  }),
  buildTraining({
    id: "tr_003",
    name: "Passe, contrôle et appui : la base technique",
    theme: "technique",
    ageGroup: "U10-U13",
    playerCount: 14,
    duration: 75,
    daysAgo: 5,
    exerciseIds: ["ex_020", "ex_011", "ex_013", "ex_022", "ex_012"],
  }),
  buildTraining({
    id: "tr_007",
    name: "Sortie de balle et construction",
    theme: "tactique",
    ageGroup: "U15-U18",
    playerCount: 16,
    duration: 85,
    daysAgo: 2,
    exerciseIds: ["ex_011", "ex_039", "ex_048", "ex_037", "ex_040"],
  }),
];

// ---------------------------------------------------------------- players

// Contract enums for the French position codes used in content/players.json.
const POSITION_BY_CONTENT: Record<string, string> = {
  GARDIEN: "GK",
  DEFENSEUR_CENTRAL: "DC",
  LATERAL_DROIT: "DD",
  LATERAL_GAUCHE: "DG",
  MILIEU_DEFENSIF: "MDC",
  MILIEU_CENTRAL: "MC",
  MILIEU_OFFENSIF: "MOC",
  AILIER_DROIT: "AD",
  AILIER_GAUCHE: "AG",
  ATTAQUANT: "BU",
};

const FOOT_BY_CONTENT: Record<string, "RIGHT" | "LEFT"> = { DROIT: "RIGHT", GAUCHE: "LEFT" };

// Short strengths / axes de progrès per contract position.
const TRAITS: Record<string, { strengths: string[]; improvements: string[] }> = {
  GK: { strengths: ["Jeu au pied", "Placement"], improvements: ["Sorties aériennes"] },
  DC: { strengths: ["Jeu de tête", "Lecture du jeu"], improvements: ["Vitesse de rotation"] },
  DD: { strengths: ["Endurance", "Centre"], improvements: ["Pied faible"] },
  DG: { strengths: ["Endurance", "Centre"], improvements: ["Jeu intérieur"] },
  MDC: { strengths: ["Récupération", "Interceptions"], improvements: ["Relance sous pression"] },
  MC: { strengths: ["Conservation de balle", "Passe courte"], improvements: ["Jeu long"] },
  MOC: { strengths: ["Vision de jeu", "Dernière passe"], improvements: ["Repli défensif"] },
  BU: { strengths: ["Finition", "Jeu dos au but"], improvements: ["Pressing"] },
  AG: { strengths: ["Dribble", "Vitesse"], improvements: ["Choix de dernier geste"] },
  AD: { strengths: ["Dribble", "Vitesse"], improvements: ["Centre du pied gauche"] },
};

// Five contract skills per player, values 5-9, deterministic across seeds.
function skillSet(seed: number): PlayerSkill[] {
  const base = 5 + (seed % 3);
  return [
    { id: "speed", name: "Vitesse", value: base + (seed % 2) },
    { id: "technique", name: "Technique", value: base + ((seed + 1) % 2) },
    { id: "endurance", name: "Endurance", value: base },
    { id: "vision", name: "Vision de jeu", value: base + ((seed + 1) % 3) },
    { id: "mental", name: "Mental", value: base + (seed % 3) },
  ];
}

// Rows mirror content/players.json: [id, firstName, lastName, position, jersey, foot, dateOfBirth].
const PLAYER_ROWS: [string, string, string, string, number, string, string][] = [
  ["pl_001", "Lucas", "Mercier", "GARDIEN", 1, "DROIT", "2013-03-14"],
  ["pl_002", "Hugo", "Lefèvre", "DEFENSEUR_CENTRAL", 4, "DROIT", "2013-06-02"],
  ["pl_003", "Enzo", "Garcia", "LATERAL_DROIT", 2, "DROIT", "2013-09-21"],
  ["pl_004", "Nathan", "Dubois", "LATERAL_GAUCHE", 3, "GAUCHE", "2014-01-30"],
  ["pl_005", "Rayan", "Benali", "MILIEU_DEFENSIF", 6, "DROIT", "2013-11-08"],
  ["pl_006", "Théo", "Moreau", "MILIEU_CENTRAL", 8, "DROIT", "2014-04-17"],
  ["pl_007", "Malo", "Giraud", "MILIEU_OFFENSIF", 10, "GAUCHE", "2013-07-25"],
  ["pl_008", "Timéo", "Lambert", "AILIER_DROIT", 7, "GAUCHE", "2014-02-11"],
  ["pl_009", "Ismaël", "Cherif", "ATTAQUANT", 9, "DROIT", "2013-05-19"],
  ["pl_010", "Yanis", "Fontaine", "GARDIEN", 16, "DROIT", "2010-08-03"],
  ["pl_011", "Gabriel", "Rousseau", "DEFENSEUR_CENTRAL", 5, "DROIT", "2011-10-27"],
  ["pl_012", "Aaron", "Diallo", "MILIEU_CENTRAL", 6, "DROIT", "2011-02-15"],
  ["pl_013", "Noé", "Vasseur", "AILIER_GAUCHE", 11, "GAUCHE", "2010-06-09"],
  ["pl_014", "Mathis", "Perrin", "ATTAQUANT", 19, "DROIT", "2011-12-01"],
];

const ATTACKING_POSITIONS = ["BU", "AG", "AD", "MOC"];

export const seedPlayers: Player[] = PLAYER_ROWS.map(
  ([id, firstName, lastName, position, jerseyNumber, foot, dateOfBirth], index) => {
    const contractPosition = POSITION_BY_CONTENT[position] ?? "MC";
    const traits = TRAITS[contractPosition] ?? { strengths: [], improvements: [] };
    const attacking = ATTACKING_POSITIONS.includes(contractPosition);
    return {
      id,
      firstName,
      lastName,
      nickname: null,
      position: contractPosition,
      jerseyNumber,
      preferredFoot: FOOT_BY_CONTENT[foot] ?? "RIGHT",
      dateOfBirth,
      coachNotes: "",
      matches: 8 + (index % 5),
      goals: attacking ? 3 + (index % 4) : index % 2,
      assists: attacking ? 1 + (index % 3) : index % 3,
      skills: skillSet(index),
      playerSkills: [],
      assistantSkills: [],
      assistantSkillOverlays: [],
      strengths: traits.strengths,
      improvements: traits.improvements,
      teamContext: { mode: "coach" },
    };
  },
);

// ---------------------------------------------------------------- analysis

export const seedAnalyses: Analysis[] = [
  { id: "an_1", teamFormation: "4-3-3", opponentTeamName: "FC Lyon", opponentTeamFormation: "4-4-2" },
];

// ---------------------------------------------------------------- season

// Full example plan from contract §5, used by GET /api/season-plan.
export const seedSeasonPlan: SeasonPlan = {
  id: "plan_1",
  teamCategory: "u15",
  customThemeLabel: null,
  seasonThemesPriority: ["pressing", "finishing"],
  trainingDays: ["tuesday", "thursday"],
  usualMatchDay: "saturday",
  calendar: {
    preseasonStartDate: "2026-08-01",
    championshipStartDate: "2026-09-01",
    hasWinterBreak: true,
    winterBreakStartDate: "2026-12-20",
    winterBreakTrainingResumeDate: "2027-01-04",
    championshipResumeDate: "2027-01-10",
    championshipEndDate: "2027-06-30",
  },
  macroPlan: [
    {
      name: "Bloc 1 — Développement",
      startWeek: 1,
      endWeek: 6,
      objective: "pressing",
      rationale: "Installer les principes de pressing en bloc sur la première période.",
    },
    {
      name: "Bloc 2 — Consolidation",
      startWeek: 7,
      endWeek: 16,
      objective: "finishing",
      rationale: "Consolider la finition et les transitions après la trêve hivernale.",
    },
  ],
};

// Three planned sessions for plan_1 (contract §6).
export const seedSeasonSessions: SeasonSession[] = [
  {
    date: "2026-09-01",
    weekIndex: 1,
    theme: "pressing",
    mesocycle: "Bloc 1 — Développement",
    intensity: "medium",
    sessionKind: "development",
    durationMinutes: 75,
    objective: "Découvrir les déclencheurs de pressing",
    trainingSessionId: "tr_007",
    status: "planned",
    hasFeedback: false,
  },
  {
    date: "2026-09-03",
    weekIndex: 1,
    theme: "possessionRetention",
    mesocycle: "Bloc 1 — Développement",
    intensity: "low",
    sessionKind: "recovery",
    durationMinutes: 60,
    objective: "Récupérer et conserver le ballon sous pression",
    trainingSessionId: "tr_003",
    status: "planned",
    hasFeedback: false,
  },
  {
    date: "2026-09-08",
    weekIndex: 2,
    theme: "transitionOffense",
    mesocycle: "Bloc 1 — Développement",
    intensity: "high",
    sessionKind: "matchPrep",
    durationMinutes: 80,
    objective: "Conclure vite dès la récupération",
    trainingSessionId: "tr_007",
    status: "planned",
    hasFeedback: false,
  },
];

// The demo "next match" lands five days after server start so the home card
// always has data (contract §1: match.date must be >= the ?from= window).
export function seedNextMatch(): NextMatch {
  return { date: ymd(5), opponent: "FC Lyon", homeAway: "home", competition: "Championnat U15" };
}

// ---------------------------------------------------------------- notifications

export function seedNotifications(): Notification[] {
  return [
    {
      id: "notif_1",
      title: "Séance générée",
      body: "Ta séance « Sortie de balle et construction » est prête à consulter.",
      createdAt: new Date(Date.now() - 26 * 3_600_000).toISOString(),
      readAt: null,
      path: "/trainings/tr_007",
    },
    {
      id: "notif_2",
      title: "Bienvenue sur Nextrainers",
      body: "Complète ton profil pour des séances encore mieux adaptées.",
      createdAt: new Date(Date.now() - 72 * 3_600_000).toISOString(),
      readAt: new Date(Date.now() - 48 * 3_600_000).toISOString(),
      path: "/profile",
    },
  ];
}
