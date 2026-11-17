import { state, save } from './store.js';
import { uid } from './utils.js';
import { DB } from './exercise-db.js';
import { tn } from './i18n.js';

export const MUSCLES = [
  'Petto', 'Dorso', 'Lombari', 'Spalle', 'Bicipiti', 'Tricipiti', 'Avambracci', 'Trapezi', 'Collo',
  'Quadricipiti', 'Femorali', 'Glutei', 'Abduttori', 'Adduttori', 'Polpacci', 'Addome', 'Cardio', 'Altro',
];

export const EQUIPMENT = ['Bilanciere', 'Bilanciere EZ', 'Manubri', 'Macchina', 'Cavi', 'Corpo libero', 'Kettlebell', 'Multipower',
  'Elastici', 'Palla medica', 'Fitball', 'Foam roller', 'Nessuno', 'Altro'];

export const CATEGORIES = ['Forza', 'Riscaldamento', 'Mobilità', 'Stretching', 'Cardio', 'Pliometria', 'Powerlifting', 'Pesistica olimpica', 'Strongman', 'CrossFit'];

// [id, nome, muscolo, attrezzo, categoria (se non Forza)]
const RAW = [
  // Petto
  ['panca-piana', 'Panca piana', 'Petto', 'Bilanciere'],
  ['panca-inclinata', 'Panca inclinata', 'Petto', 'Bilanciere'],
  ['panca-declinata', 'Panca declinata', 'Petto', 'Bilanciere'],
  ['panca-piana-man', 'Panca piana con manubri', 'Petto', 'Manubri'],
  ['panca-inclinata-man', 'Panca inclinata con manubri', 'Petto', 'Manubri'],
  ['croci-man', 'Croci con manubri', 'Petto', 'Manubri'],
  ['croci-cavi', 'Croci ai cavi', 'Petto', 'Cavi'],
  ['pectoral-machine', 'Pectoral machine', 'Petto', 'Macchina'],
  ['chest-press', 'Chest press', 'Petto', 'Macchina'],
  ['piegamenti', 'Piegamenti (push-up)', 'Petto', 'Corpo libero'],
  ['dip-petto', 'Dip alle parallele', 'Petto', 'Corpo libero'],
  // Dorso
  ['stacco', 'Stacco da terra', 'Dorso', 'Bilanciere'],
  ['trazioni', 'Trazioni alla sbarra', 'Dorso', 'Corpo libero'],
  ['chin-up', 'Trazioni presa supina', 'Dorso', 'Corpo libero'],
  ['lat-machine', 'Lat machine', 'Dorso', 'Cavi'],
  ['lat-machine-stretta', 'Lat machine presa stretta', 'Dorso', 'Cavi'],
  ['rematore-bil', 'Rematore con bilanciere', 'Dorso', 'Bilanciere'],
  ['rematore-man', 'Rematore con manubrio', 'Dorso', 'Manubri'],
  ['pulley', 'Pulley basso', 'Dorso', 'Cavi'],
  ['t-bar', 'T-bar row', 'Dorso', 'Bilanciere'],
  ['pullover-cavi', 'Pullover ai cavi', 'Dorso', 'Cavi'],
  ['row-machine', 'Row machine', 'Dorso', 'Macchina'],
  ['hyperext', 'Hyperextension', 'Dorso', 'Corpo libero'],
  // Spalle
  ['military-press', 'Military press', 'Spalle', 'Bilanciere'],
  ['lento-avanti-man', 'Lento avanti con manubri', 'Spalle', 'Manubri'],
  ['arnold-press', 'Arnold press', 'Spalle', 'Manubri'],
  ['alzate-laterali', 'Alzate laterali', 'Spalle', 'Manubri'],
  ['alzate-laterali-cavi', 'Alzate laterali ai cavi', 'Spalle', 'Cavi'],
  ['alzate-frontali', 'Alzate frontali', 'Spalle', 'Manubri'],
  ['alzate-posteriori', 'Alzate posteriori', 'Spalle', 'Manubri'],
  ['face-pull', 'Face pull', 'Spalle', 'Cavi'],
  ['reverse-pec', 'Reverse pec deck', 'Spalle', 'Macchina'],
  ['shoulder-press', 'Shoulder press', 'Spalle', 'Macchina'],
  ['tirate-mento', 'Tirate al mento', 'Spalle', 'Bilanciere'],
  // Trapezi
  ['scrollate', 'Scrollate con manubri', 'Trapezi', 'Manubri'],
  ['scrollate-bil', 'Scrollate con bilanciere', 'Trapezi', 'Bilanciere'],
  // Bicipiti
  ['curl-bil', 'Curl con bilanciere', 'Bicipiti', 'Bilanciere'],
  ['curl-man', 'Curl con manubri', 'Bicipiti', 'Manubri'],
  ['curl-martello', 'Curl a martello', 'Bicipiti', 'Manubri'],
  ['curl-panca-scott', 'Curl alla panca Scott', 'Bicipiti', 'Bilanciere'],
  ['curl-cavi', 'Curl ai cavi', 'Bicipiti', 'Cavi'],
  ['curl-concentrato', 'Curl concentrato', 'Bicipiti', 'Manubri'],
  ['curl-inclinato', 'Curl su panca inclinata', 'Bicipiti', 'Manubri'],
  // Tricipiti
  ['french-press', 'French press', 'Tricipiti', 'Bilanciere'],
  ['pushdown', 'Pushdown ai cavi', 'Tricipiti', 'Cavi'],
  ['pushdown-corda', 'Pushdown con corda', 'Tricipiti', 'Cavi'],
  ['estensioni-sopra-testa', 'Estensioni sopra la testa', 'Tricipiti', 'Cavi'],
  ['kickback', 'Kickback con manubrio', 'Tricipiti', 'Manubri'],
  ['panca-stretta', 'Panca presa stretta', 'Tricipiti', 'Bilanciere'],
  ['dip-panca', 'Dip su panca', 'Tricipiti', 'Corpo libero'],
  // Avambracci
  ['curl-polso', 'Curl di polso', 'Avambracci', 'Bilanciere'],
  ['farmer-walk', 'Farmer walk', 'Avambracci', 'Manubri'],
  // Gambe
  ['squat', 'Squat', 'Quadricipiti', 'Bilanciere'],
  ['front-squat', 'Front squat', 'Quadricipiti', 'Bilanciere'],
  ['pressa', 'Pressa 45°', 'Quadricipiti', 'Macchina'],
  ['hack-squat', 'Hack squat', 'Quadricipiti', 'Macchina'],
  ['leg-extension', 'Leg extension', 'Quadricipiti', 'Macchina'],
  ['affondi', 'Affondi con manubri', 'Quadricipiti', 'Manubri'],
  ['bulgarian', 'Bulgarian split squat', 'Quadricipiti', 'Manubri'],
  ['goblet-squat', 'Goblet squat', 'Quadricipiti', 'Kettlebell'],
  ['squat-multipower', 'Squat al multipower', 'Quadricipiti', 'Multipower'],
  ['stacco-rumeno', 'Stacco rumeno', 'Femorali', 'Bilanciere'],
  ['stacco-gambe-tese', 'Stacco a gambe tese', 'Femorali', 'Bilanciere'],
  ['leg-curl-sdraiato', 'Leg curl sdraiato', 'Femorali', 'Macchina'],
  ['leg-curl-seduto', 'Leg curl seduto', 'Femorali', 'Macchina'],
  ['good-morning', 'Good morning', 'Femorali', 'Bilanciere'],
  ['hip-thrust', 'Hip thrust', 'Glutei', 'Bilanciere'],
  ['glute-bridge', 'Ponte glutei', 'Glutei', 'Corpo libero'],
  ['abductor', 'Abductor machine', 'Glutei', 'Macchina'],
  ['kickback-cavi', 'Slanci ai cavi', 'Glutei', 'Cavi'],
  ['adductor', 'Adductor machine', 'Adduttori', 'Macchina'],
  ['calf-piedi', 'Calf raise in piedi', 'Polpacci', 'Macchina'],
  ['calf-seduto', 'Calf raise seduto', 'Polpacci', 'Macchina'],
  ['calf-pressa', 'Calf alla pressa', 'Polpacci', 'Macchina'],
  // Addome
  ['crunch', 'Crunch', 'Addome', 'Corpo libero'],
  ['crunch-cavi', 'Crunch ai cavi', 'Addome', 'Cavi'],
  ['plank', 'Plank (secondi)', 'Addome', 'Corpo libero'],
  ['leg-raise', 'Leg raise alla sbarra', 'Addome', 'Corpo libero'],
  ['russian-twist', 'Russian twist', 'Addome', 'Corpo libero'],
  ['ab-wheel', 'Ab wheel', 'Addome', 'Altro'],
  // Cardio / altro
  ['kb-swing', 'Kettlebell swing', 'Glutei', 'Kettlebell'],
  ['burpees', 'Burpees', 'Cardio', 'Corpo libero'],
  ['corsa', 'Tapis roulant (minuti)', 'Cardio', 'Macchina'],
  ['cyclette', 'Cyclette (minuti)', 'Cardio', 'Macchina'],
  ['vogatore', 'Vogatore (minuti)', 'Cardio', 'Macchina'],
  // Riscaldamento: attivazione prima dell'allenamento
  ['jumping-jack', 'Jumping jack', 'Cardio', 'Corpo libero', 'Riscaldamento'],
  ['corsa-posto', 'Corsa sul posto', 'Cardio', 'Corpo libero', 'Riscaldamento'],
  ['skip-alto', 'Skip alto', 'Cardio', 'Corpo libero', 'Riscaldamento'],
  ['corda', 'Salto con la corda', 'Cardio', 'Altro', 'Riscaldamento'],
  ['cyclette-risc', 'Cyclette leggera (minuti)', 'Cardio', 'Macchina', 'Riscaldamento'],
  ['vogatore-risc', 'Vogatore leggero (minuti)', 'Cardio', 'Macchina', 'Riscaldamento'],
  ['rotazioni-braccia', 'Rotazioni delle braccia', 'Spalle', 'Corpo libero', 'Riscaldamento'],
  ['band-pull-apart', 'Band pull-apart', 'Spalle', 'Elastici', 'Riscaldamento'],
  ['face-pull-elastico', 'Face pull con elastico', 'Spalle', 'Elastici', 'Riscaldamento'],
  ['extrarotazioni-elastico', 'Extrarotazioni con elastico', 'Spalle', 'Elastici', 'Riscaldamento'],
  ['scapular-push-up', 'Piegamenti scapolari', 'Dorso', 'Corpo libero', 'Riscaldamento'],
  ['squat-corpo-libero', 'Squat a corpo libero', 'Quadricipiti', 'Corpo libero', 'Riscaldamento'],
  ['affondi-dinamici', 'Affondi dinamici', 'Quadricipiti', 'Corpo libero', 'Riscaldamento'],
  ['ponte-glutei-risc', 'Ponte glutei a corpo libero', 'Glutei', 'Corpo libero', 'Riscaldamento'],
  ['monster-walk', 'Monster walk con elastico', 'Abduttori', 'Elastici', 'Riscaldamento'],
  ['inchworm', 'Inchworm (bruco)', 'Femorali', 'Corpo libero', 'Riscaldamento'],
  ['dead-bug', 'Dead bug', 'Addome', 'Corpo libero', 'Riscaldamento'],
  // Mobilità: ampiezza di movimento delle articolazioni
  ['mob-90-90', 'Mobilità anche 90/90', 'Glutei', 'Corpo libero', 'Mobilità'],
  ['worlds-greatest', "World's greatest stretch", 'Altro', 'Corpo libero', 'Mobilità'],
  ['gatto-cammello', 'Gatto-cammello', 'Lombari', 'Corpo libero', 'Mobilità'],
  ['open-book', 'Rotazioni toraciche (open book)', 'Dorso', 'Corpo libero', 'Mobilità'],
  ['caviglia-muro', 'Mobilità caviglia al muro', 'Polpacci', 'Corpo libero', 'Mobilità'],
  ['squat-profondo', 'Squat profondo tenuto', 'Quadricipiti', 'Corpo libero', 'Mobilità'],
  ['passaggi-bastone', 'Passaggi col bastone', 'Spalle', 'Altro', 'Mobilità'],
  ['cerchi-anca', 'Cerchi controllati dell\'anca', 'Glutei', 'Corpo libero', 'Mobilità'],
  ['cerchi-spalle', 'Cerchi controllati delle spalle', 'Spalle', 'Corpo libero', 'Mobilità'],
  ['flessori-anca', 'Allungamento flessori dell\'anca', 'Quadricipiti', 'Corpo libero', 'Mobilità'],
  ['polsi-mob', 'Mobilità dei polsi', 'Avambracci', 'Corpo libero', 'Mobilità'],
  ['collo-mob', 'Mobilità del collo', 'Collo', 'Corpo libero', 'Mobilità'],
  ['foam-dorso', 'Foam roller dorsale', 'Dorso', 'Foam roller', 'Mobilità'],
  ['foam-quadricipiti', 'Foam roller quadricipiti', 'Quadricipiti', 'Foam roller', 'Mobilità'],
  ['foam-glutei', 'Foam roller glutei', 'Glutei', 'Foam roller', 'Mobilità'],
  // CrossFit: movimenti dei WOD
  ['cf-thruster', 'Thruster', 'Quadricipiti', 'Bilanciere', 'CrossFit'],
  ['cf-thruster-man', 'Thruster con manubri', 'Quadricipiti', 'Manubri', 'CrossFit'],
  ['cf-wall-ball', 'Wall ball', 'Quadricipiti', 'Palla medica', 'CrossFit'],
  ['cf-box-jump', 'Box jump', 'Quadricipiti', 'Altro', 'CrossFit'],
  ['cf-box-jump-over', 'Box jump over', 'Quadricipiti', 'Altro', 'CrossFit'],
  ['cf-step-up-box', 'Box step-up', 'Quadricipiti', 'Manubri', 'CrossFit'],
  ['cf-air-squat', 'Air squat', 'Quadricipiti', 'Corpo libero', 'CrossFit'],
  ['cf-overhead-squat', 'Overhead squat', 'Quadricipiti', 'Bilanciere', 'CrossFit'],
  ['cf-pistol', 'Pistol squat', 'Quadricipiti', 'Corpo libero', 'CrossFit'],
  ['cf-burpee', 'Burpee (CrossFit)', 'Cardio', 'Corpo libero', 'CrossFit'],
  ['cf-burpee-over-bar', 'Burpee over the bar', 'Cardio', 'Corpo libero', 'CrossFit'],
  ['cf-burpee-box', 'Burpee box jump over', 'Cardio', 'Corpo libero', 'CrossFit'],
  ['cf-double-under', 'Double under (corda)', 'Cardio', 'Altro', 'CrossFit'],
  ['cf-single-under', 'Single under (corda)', 'Cardio', 'Altro', 'CrossFit'],
  ['cf-pull-up-kipping', 'Pull-up kipping', 'Dorso', 'Corpo libero', 'CrossFit'],
  ['cf-butterfly', 'Pull-up butterfly', 'Dorso', 'Corpo libero', 'CrossFit'],
  ['cf-chest-to-bar', 'Chest to bar', 'Dorso', 'Corpo libero', 'CrossFit'],
  ['cf-bar-muscle-up', 'Bar muscle-up', 'Dorso', 'Corpo libero', 'CrossFit'],
  ['cf-ring-muscle-up', 'Muscle-up agli anelli', 'Dorso', 'Altro', 'CrossFit'],
  ['cf-ring-row', 'Ring row', 'Dorso', 'Altro', 'CrossFit'],
  ['cf-ring-dip', 'Dip agli anelli', 'Tricipiti', 'Altro', 'CrossFit'],
  ['cf-rope-climb', 'Salita alla fune (rope climb)', 'Dorso', 'Altro', 'CrossFit'],
  ['cf-toes-to-bar', 'Toes to bar', 'Addome', 'Corpo libero', 'CrossFit'],
  ['cf-knees-to-elbow', 'Knees to elbow', 'Addome', 'Corpo libero', 'CrossFit'],
  ['cf-ghd-situp', 'GHD sit-up', 'Addome', 'Macchina', 'CrossFit'],
  ['cf-abmat-situp', 'Sit-up con AbMat', 'Addome', 'Corpo libero', 'CrossFit'],
  ['cf-hollow-hold', 'Hollow hold', 'Addome', 'Corpo libero', 'CrossFit'],
  ['cf-v-up', 'V-up', 'Addome', 'Corpo libero', 'CrossFit'],
  ['cf-l-sit', 'L-sit', 'Addome', 'Corpo libero', 'CrossFit'],
  ['cf-hspu', 'Handstand push-up', 'Spalle', 'Corpo libero', 'CrossFit'],
  ['cf-handstand-walk', 'Handstand walk', 'Spalle', 'Corpo libero', 'CrossFit'],
  ['cf-wall-walk', 'Wall walk', 'Spalle', 'Corpo libero', 'CrossFit'],
  ['cf-push-press', 'Push press', 'Spalle', 'Bilanciere', 'CrossFit'],
  ['cf-push-jerk', 'Push jerk', 'Spalle', 'Bilanciere', 'CrossFit'],
  ['cf-split-jerk', 'Split jerk', 'Spalle', 'Bilanciere', 'CrossFit'],
  ['cf-power-clean', 'Power clean', 'Glutei', 'Bilanciere', 'CrossFit'],
  ['cf-squat-clean', 'Squat clean', 'Quadricipiti', 'Bilanciere', 'CrossFit'],
  ['cf-hang-power-clean', 'Hang power clean', 'Glutei', 'Bilanciere', 'CrossFit'],
  ['cf-clean-and-jerk', 'Clean & jerk', 'Spalle', 'Bilanciere', 'CrossFit'],
  ['cf-power-snatch', 'Power snatch', 'Spalle', 'Bilanciere', 'CrossFit'],
  ['cf-squat-snatch', 'Squat snatch', 'Spalle', 'Bilanciere', 'CrossFit'],
  ['cf-hang-power-snatch', 'Hang power snatch', 'Spalle', 'Bilanciere', 'CrossFit'],
  ['cf-db-snatch', 'Snatch con manubrio', 'Spalle', 'Manubri', 'CrossFit'],
  ['cf-db-clean', 'Clean con manubri', 'Glutei', 'Manubri', 'CrossFit'],
  ['cf-devil-press', 'Devil press', 'Spalle', 'Manubri', 'CrossFit'],
  ['cf-man-maker', 'Man maker', 'Petto', 'Manubri', 'CrossFit'],
  ['cf-sdhp', 'Sumo deadlift high pull', 'Trapezi', 'Bilanciere', 'CrossFit'],
  ['cf-kb-swing-us', 'Kettlebell swing americano', 'Glutei', 'Kettlebell', 'CrossFit'],
  ['cf-kb-snatch', 'Kettlebell snatch', 'Spalle', 'Kettlebell', 'CrossFit'],
  ['cf-kb-clean', 'Kettlebell clean', 'Glutei', 'Kettlebell', 'CrossFit'],
  ['cf-turkish-getup', 'Turkish get-up', 'Addome', 'Kettlebell', 'CrossFit'],
  ['cf-farmers-carry', 'Farmer carry', 'Avambracci', 'Kettlebell', 'CrossFit'],
  ['cf-overhead-lunge', 'Affondi con peso sopra la testa', 'Quadricipiti', 'Bilanciere', 'CrossFit'],
  ['cf-sandbag-carry', 'Trasporto sacco (sandbag carry)', 'Altro', 'Altro', 'CrossFit'],
  ['cf-sled-push', 'Spinta della slitta', 'Quadricipiti', 'Altro', 'CrossFit'],
  ['cf-assault-bike', 'Air bike (assault bike)', 'Cardio', 'Macchina', 'CrossFit'],
  ['cf-ski-erg', 'SkiErg', 'Cardio', 'Macchina', 'CrossFit'],
  ['cf-row', 'Vogatore (calorie)', 'Cardio', 'Macchina', 'CrossFit'],
  ['cf-run', 'Corsa (metri)', 'Cardio', 'Nessuno', 'CrossFit'],
  ['cf-shuttle-run', 'Shuttle run', 'Cardio', 'Nessuno', 'CrossFit'],
  ['cf-mountain-climber', 'Mountain climber', 'Addome', 'Corpo libero', 'CrossFit'],
  ['cf-ball-slam', 'Ball slam', 'Addome', 'Palla medica', 'CrossFit'],
];

// movimento del manichino per gli esercizi di base
const BUILTIN_MOVES = {"panca-piana":"bench",
  "panca-inclinata":"bench:incline",
  "panca-declinata":"bench:decline",
  "panca-piana-man":"bench",
  "panca-inclinata-man":"bench:incline",
  "croci-man":"flylying",
  "croci-cavi":"fly",
  "pectoral-machine":"fly",
  "chest-press":"bench:machine",
  "piegamenti":"pushup",
  "dip-petto":"dip",
  "stacco":"deadlift",
  "trazioni":"pullup",
  "chin-up":"pullup:chin",
  "lat-machine":"pulldown",
  "lat-machine-stretta":"pulldown",
  "rematore-bil":"row",
  "rematore-man":"row:one",
  "pulley":"seatedrow",
  "t-bar":"row",
  "pullover-cavi":"straightarm",
  "row-machine":"seatedrow",
  "hyperext":"backext",
  "military-press":"ohpress",
  "lento-avanti-man":"ohpress:seated",
  "arnold-press":"ohpress:seated",
  "alzate-laterali":"latraise",
  "alzate-laterali-cavi":"latraise",
  "alzate-frontali":"frontraise",
  "alzate-posteriori":"reardelt",
  "face-pull":"facepull",
  "reverse-pec":"reardelt",
  "shoulder-press":"ohpress:seated",
  "tirate-mento":"uprightrow",
  "scrollate":"shrug",
  "scrollate-bil":"shrug",
  "curl-bil":"curl",
  "curl-man":"curl",
  "curl-martello":"curl:hammer",
  "curl-panca-scott":"curl:preacher",
  "curl-cavi":"curl",
  "curl-concentrato":"curl:conc",
  "curl-inclinato":"curl:incline",
  "french-press":"skull",
  "pushdown":"pushdown",
  "pushdown-corda":"pushdown:rope",
  "estensioni-sopra-testa":"ohext",
  "kickback":"kickback",
  "panca-stretta":"bench",
  "dip-panca":"dip",
  "curl-polso":"wristcurl",
  "farmer-walk":"walk",
  "squat":"squat",
  "front-squat":"squat:front",
  "pressa":"legpress",
  "hack-squat":"squat",
  "leg-extension":"legext",
  "affondi":"lunge",
  "bulgarian":"lunge:bulgarian",
  "goblet-squat":"squat:goblet",
  "squat-multipower":"squat",
  "stacco-rumeno":"rdl",
  "stacco-gambe-tese":"rdl",
  "leg-curl-sdraiato":"legcurl",
  "leg-curl-seduto":"legcurl:seated",
  "good-morning":"goodmorning",
  "hip-thrust":"hipthrust",
  "glute-bridge":"hipthrust:floor",
  "abductor":"abduction:machine",
  "kickback-cavi":"glutekick",
  "adductor":"adduction:machine",
  "calf-piedi":"calf",
  "calf-seduto":"calf:seated",
  "calf-pressa":"calf",
  "crunch":"crunch",
  "crunch-cavi":"crunch",
  "plank":"plank",
  "leg-raise":"legraise:hanging",
  "russian-twist":"twistseat",
  "ab-wheel":"rollout",
  "kb-swing":"kbswing",
  "burpees":"jump",
  "corsa":"run:treadmill",
  "cyclette":"bike",
  "vogatore":"rowmachine",
  "jumping-jack":"jump", "corsa-posto":"run", "skip-alto":"run", "corda":"jump",
  "cyclette-risc":"bike", "vogatore-risc":"rowmachine", "rotazioni-braccia":"stretch", "band-pull-apart":"stretch",
  "face-pull-elastico":"facepull", "extrarotazioni-elastico":"stretch", "scapular-push-up":"plank",
  "squat-corpo-libero":"squat", "affondi-dinamici":"lunge", "ponte-glutei-risc":"hipthrust:floor", "monster-walk":"walk",
  "inchworm":"stretch", "dead-bug":"crunch", "mob-90-90":"stretch", "worlds-greatest":"lunge", "gatto-cammello":"stretch",
  "open-book":"twist", "caviglia-muro":"stretch", "squat-profondo":"squat", "passaggi-bastone":"stretch",
  "cerchi-anca":"stretch", "cerchi-spalle":"stretch", "flessori-anca":"lunge", "polsi-mob":"stretch", "collo-mob":"stretch",
  "foam-dorso":"roll", "foam-quadricipiti":"roll", "foam-glutei":"roll",
  "cf-thruster":"squat:front", "cf-thruster-man":"squat:front", "cf-wall-ball":"mbthrow", "cf-box-jump":"jump", "cf-box-jump-over":"jump", "cf-step-up-box":"stepup", "cf-air-squat":"squat", "cf-overhead-squat":"squat:overhead", "cf-pistol":"squat", "cf-burpee":"jump", "cf-burpee-over-bar":"jump", "cf-burpee-box":"jump", "cf-double-under":"rope", "cf-single-under":"rope", "cf-pull-up-kipping":"pullup", "cf-butterfly":"pullup", "cf-chest-to-bar":"pullup", "cf-bar-muscle-up":"pullup", "cf-ring-muscle-up":"pullup", "cf-ring-row":"row", "cf-ring-dip":"dip", "cf-rope-climb":"pullup", "cf-toes-to-bar":"legraise:hanging", "cf-knees-to-elbow":"legraise:hanging", "cf-ghd-situp":"crunch:situp", "cf-abmat-situp":"crunch:situp", "cf-hollow-hold":"plank", "cf-v-up":"crunch:vup", "cf-l-sit":"plank", "cf-hspu":"ohpress", "cf-handstand-walk":"plank", "cf-wall-walk":"plank", "cf-push-press":"jerk", "cf-push-jerk":"jerk", "cf-split-jerk":"jerk", "cf-power-clean":"clean", "cf-squat-clean":"clean", "cf-hang-power-clean":"clean", "cf-clean-and-jerk":"clean", "cf-power-snatch":"snatch", "cf-squat-snatch":"snatch", "cf-hang-power-snatch":"snatch", "cf-db-snatch":"snatch", "cf-db-clean":"clean", "cf-devil-press":"snatch", "cf-man-maker":"pushup", "cf-sdhp":"uprightrow", "cf-kb-swing-us":"kbswing", "cf-kb-snatch":"snatch", "cf-kb-clean":"clean", "cf-turkish-getup":"twist", "cf-farmers-carry":"walk", "cf-overhead-lunge":"lunge", "cf-sandbag-carry":"walk", "cf-sled-push":"sled", "cf-assault-bike":"bike", "cf-ski-erg":"rowmachine", "cf-row":"rowmachine", "cf-run":"run", "cf-shuttle-run":"run", "cf-mountain-climber":"climber", "cf-ball-slam":"mbthrow:slam"};

export const BUILTIN = RAW.map(([id, name, muscle, equipment, category]) => ({
  id: 'b-' + id, name: tn(name), muscle, equipment, category: category || (muscle === 'Cardio' ? 'Cardio' : 'Forza'), rank: 1, move: BUILTIN_MOVES[id] || '',
}));

/** Libreria importata (876 esercizi, nomi originali in inglese) */
export const LIBRARY = DB.map(([id, name, muscle, equipment, category, level, mechanic, secondary, move]) => ({
  id, name, muscle, equipment, category, level, mechanic, secondary, move, lib: true, rank: 2,
}));

const staticMap = new Map([...BUILTIN, ...LIBRARY].map((e) => [e.id, e]));

export function getExercise(id) {
  return staticMap.get(id) || state.customExercises.find((e) => e.id === id) ||
    { id, name: 'Esercizio eliminato', muscle: 'Altro', equipment: 'Altro', missing: true };
}

export function allExercises() {
  return [...state.customExercises.map((e) => ({ ...e, rank: 0, category: e.category || 'Forza' })), ...BUILTIN, ...LIBRARY];
}

/* ---------- Ricerca in italiano anche sui nomi inglesi ---------- */
const ALIASES = {
  panca: ['bench'], piana: ['flat', 'bench press'], inclinata: ['incline'], declinata: ['decline'],
  distensioni: ['press'], spinte: ['press'], spinta: ['press'], lento: ['press'], militare: ['military'],
  rematore: ['row'], trazioni: ['pull-up', 'pullup', 'chin-up', 'chinup', 'pullups'], trazione: ['pull-up', 'chin-up'],
  lat: ['lat pulldown', 'pulldown', 'lats'], pulley: ['cable row', 'seated cable'], stacco: ['deadlift'], stacchi: ['deadlift'],
  rumeno: ['romanian'], gambe: ['leg'], tese: ['stiff'], squat: ['squat'], affondi: ['lunge'], affondo: ['lunge'],
  pressa: ['leg press'], croci: ['fly', 'flye', 'crossover'], alzate: ['raise'], laterali: ['lateral', 'side'],
  frontali: ['front'], posteriori: ['rear', 'reverse fly'], scrollate: ['shrug'], curl: ['curl'], martello: ['hammer'],
  french: ['french', 'skull', 'lying triceps'], estensioni: ['extension'], estensione: ['extension'],
  polpacci: ['calf'], polpaccio: ['calf'], addome: ['ab ', 'abdominal', 'crunch', 'sit-up'], addominali: ['ab ', 'abdominal', 'crunch', 'sit-up'],
  ponte: ['bridge'], glutei: ['glute', 'hip'], manubri: ['dumbbell'], manubrio: ['dumbbell'], bilanciere: ['barbell'],
  cavi: ['cable'], cavo: ['cable'], macchina: ['machine'], elastico: ['band'], elastici: ['band'],
  piegamenti: ['push-up', 'pushup'], flessioni: ['push-up', 'pushup'], parallele: ['dip'], sbarra: ['pull-up', 'chin-up', 'hanging'],
  stretta: ['close-grip', 'close grip', 'narrow'], larga: ['wide'], inversa: ['reverse'], supina: ['supinated', 'chin'],
  seduto: ['seated'], piedi: ['standing'], sdraiato: ['lying'], tirate: ['upright row'], mento: ['upright'],
  salto: ['jump'], salti: ['jump'], corsa: ['running', 'treadmill', 'jog'], bici: ['bike', 'bicycle', 'cycling'],
  vogatore: ['rowing'], allungamento: ['stretch'], spalle: ['shoulder', 'deltoid'], petto: ['chest', 'pec'],
  dorso: ['back', 'lats', 'row'], schiena: ['back'], bicipiti: ['bicep', 'curl'], tricipiti: ['tricep'], collo: ['neck'],
  polso: ['wrist'], avambracci: ['forearm', 'wrist'], cosce: ['thigh', 'leg'], femorali: ['hamstring', 'leg curl'],
  quadricipiti: ['quad', 'leg extension'], kettlebell: ['kettlebell'], girata: ['clean'], strappo: ['snatch'],
  slancio: ['jerk'], rotazioni: ['rotation', 'twist'], torsioni: ['twist'], plank: ['plank'],
  riscaldamento: ['warm'], mobilita: ['mobility', 'stretch', 'roller'], stretching: ['stretch'],
};

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// le traduzioni devono combaciare con l'inizio di una parola ("chin" non deve trovare "machine")
const aliasRe = Object.fromEntries(Object.entries(ALIASES).map(([k, list]) => [k, list.map((a) => new RegExp('(^|[^a-z])' + escRe(a)))]));

const HAY = new WeakMap();
/** true se tutte le parole della ricerca trovano corrispondenza (nome, muscolo, attrezzo o traduzione) */
export function matchExercise(e, query) {
  const words = norm(query).split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return true;
  // testo di ricerca normalizzato una volta sola per esercizio (961 esercizi a ogni lettera)
  const hay = HAY.get(e) ?? HAY.set(e, norm(`${e.name} ${e.muscle} ${e.equipment} ${e.category || ''} ${(e.secondary || []).join(' ')} `)).get(e);
  return words.every((w) => hay.includes(w) || (aliasRe[w] || []).some((re) => re.test(hay)));
}

export function addCustomExercise({ name, muscle, equipment }) {
  const ex = { id: 'c-' + uid(), name: name.trim(), muscle, equipment, custom: true };
  state.customExercises.push(ex);
  save();
  return ex;
}
