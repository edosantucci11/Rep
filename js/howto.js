// Spiegazioni in italiano: "come si esegue" per ogni schema di movimento,
// adattate all'attrezzo e alle varianti riconosciute nel nome dell'esercizio.
import { parseMove, loadOf } from './moves.js';
import { HOWTO } from './i18n.js';

const EQ = {
  barbell: 'il bilanciere', dumbbell: 'i manubri', kettlebell: 'il kettlebell', cable: 'la maniglia del cavo',
  band: "l'elastico", ball: 'la palla medica', machine: 'le maniglie della macchina', none: '',
};

const T = {
  squat: (e) => ({
    steps: [
      `In piedi, piedi alla larghezza delle spalle e punte leggermente in fuori${e.load === 'barbell' ? ', con il bilanciere appoggiato sui trapezi' : e.load === 'dumbbell' ? ', un manubrio per mano lungo i fianchi' : e.load === 'kettlebell' ? ', il kettlebell tenuto al petto' : ', braccia in avanti per equilibrio'}.`,
      'Inspira, contrai addome e glutei e mantieni la schiena neutra.',
      'Scendi spingendo le anche indietro e piegando le ginocchia, che seguono la direzione delle punte dei piedi.',
      'Arriva almeno con le cosce parallele al pavimento, talloni sempre a terra.',
      'Risali spingendo con tutto il piede ed espira in salita.',
    ],
    tips: ['Non far cedere le ginocchia verso l\'interno.', 'Sguardo avanti, petto aperto: la schiena non deve arrotondarsi.'],
  }),
  rdl: (e) => ({
    steps: [
      `In piedi, piedi alla larghezza delle anche, ${e.eq || 'il peso'} davanti alle cosce.`,
      'Sblocca leggermente le ginocchia e tienile così per tutto il movimento.',
      'Spingi le anche indietro e fai scendere il peso lungo le gambe, con la schiena dritta.',
      'Scendi finché senti allungare i femorali (circa a metà tibia).',
      'Risali spingendo le anche in avanti e contraendo i glutei.',
    ],
    tips: ['Il peso resta sempre vicino alle gambe.', 'La schiena non si arrotonda: se succede, riduci l\'escursione.'],
  }),
  deadlift: (e) => ({
    steps: [
      `Piedi alla larghezza delle anche, ${e.eq || 'il bilanciere'} sopra la metà del piede.`,
      'Piegati e afferra il peso appena fuori dalle gambe, braccia tese.',
      'Petto in fuori, schiena neutra, scapole sopra il bilanciere: inspira e contrai l\'addome.',
      'Spingi il pavimento con le gambe e porta il peso lungo le gambe fino a essere in piedi.',
      'Torna giù con controllo spingendo prima le anche indietro, poi piegando le ginocchia.',
    ],
    tips: ['Non tirare con la schiena arrotondata.', 'Bilanciere sempre a contatto con le gambe.'],
  }),
  goodmorning: () => ({
    steps: [
      'In piedi con il bilanciere sui trapezi, piedi alla larghezza delle anche.',
      'Ginocchia leggermente piegate, addome contratto.',
      'Spingi le anche indietro e inclina il busto in avanti con la schiena dritta.',
      'Scendi fino a quasi parallelo, poi risali contraendo glutei e femorali.',
    ],
    tips: ['Usa carichi moderati: è un esercizio di controllo.', 'Mai arrotondare la zona lombare.'],
  }),
  lunge: (e) => ({
    steps: [
      `In piedi${e.eq ? `, con ${e.eq}` : ''}, busto dritto e addome contratto.`,
      e.opt.bulgarian ? 'Appoggia il dorso del piede posteriore su una panca dietro di te.' : 'Fai un passo lungo in avanti (o indietro) con una gamba.',
      'Scendi piegando entrambe le ginocchia fino a circa 90°, ginocchio posteriore vicino al pavimento.',
      'Il ginocchio anteriore resta sopra il piede, senza superare troppo la punta.',
      'Spingi con il tallone anteriore per tornare su. Completa le ripetizioni e cambia gamba.',
    ],
    tips: ['Busto verticale per i quadricipiti, leggermente inclinato per i glutei.', 'Non lasciare che il ginocchio cada verso l\'interno.'],
  }),
  stepup: (e) => ({
    steps: [
      `Mettiti davanti a un rialzo stabile${e.eq ? ` con ${e.eq}` : ''}.`,
      'Appoggia tutto il piede sul rialzo.',
      'Spingi con la gamba sul rialzo e sali fino a distenderla, senza darti lo slancio con l\'altra.',
      'Scendi con controllo e ripeti; poi cambia gamba.',
    ],
    tips: ['Più è alto il rialzo, più lavorano i glutei.', 'Ginocchio allineato al piede.'],
  }),
  legpress: () => ({
    steps: [
      'Siediti con schiena e bacino ben appoggiati allo schienale.',
      'Piedi sulla pedana alla larghezza delle spalle, a metà altezza.',
      'Sblocca il carico e piega le ginocchia portandole verso il petto, senza staccare il bacino.',
      'Spingi la pedana con tutto il piede fino quasi a distendere le gambe.',
    ],
    tips: ['Non bloccare del tutto le ginocchia in alto.', 'Se il bacino si stacca dallo schienale, riduci l\'escursione.'],
  }),
  legext: () => ({
    steps: [
      'Regola la macchina: ginocchia allineate al perno e cuscinetto sopra le caviglie.',
      'Siediti con la schiena appoggiata e tieni le maniglie.',
      'Distendi le gambe fino in alto contraendo i quadricipiti.',
      'Fermati un istante e torna giù lentamente.',
    ],
    tips: ['Movimento controllato, senza slanci.', 'Non staccare il bacino dal sedile.'],
  }),
  legcurl: (e) => ({
    steps: [
      e.opt.seated ? 'Siediti sulla macchina con il cuscinetto dietro le caviglie e quello superiore sulle cosce.' : 'Sdraiati a pancia in giù sulla macchina, cuscinetto sopra i talloni e ginocchia appena fuori dalla panca.',
      'Afferra le maniglie e contrai l\'addome.',
      'Fletti le ginocchia portando i talloni verso i glutei.',
      'Torna lentamente alla posizione iniziale senza distendere di colpo.',
    ],
    tips: ['Il bacino resta fermo: non sollevarlo.', 'La fase di ritorno lenta è la più efficace.'],
  }),
  calf: (e) => ({
    steps: [
      e.opt.seated ? 'Siediti con le punte dei piedi sulla pedana e il cuscinetto sopra le ginocchia.' : `In piedi${e.eq ? ` con ${e.eq}` : ''}, punte dei piedi su un rialzo e talloni liberi.`,
      'Lascia scendere i talloni sotto il livello delle punte per allungare i polpacci.',
      'Sali sulle punte il più in alto possibile.',
      'Tieni la contrazione un secondo, poi scendi lentamente.',
    ],
    tips: ['Escursione completa, senza rimbalzi.', 'Ginocchia ferme: lavora solo la caviglia.'],
  }),
  hipthrust: (e) => ({
    steps: [
      e.opt.floor || e.load !== 'barbell' ? 'Sdraiati a pancia in su, ginocchia piegate e piedi a terra vicini ai glutei.' : 'Appoggia la parte alta della schiena a una panca, bilanciere sopra le anche.',
      'Piedi alla larghezza delle anche, tibie verticali nella posizione alta.',
      'Spingi con i talloni e solleva il bacino fino ad allineare spalle, anche e ginocchia.',
      'Contrai forte i glutei in alto, poi scendi con controllo.',
    ],
    tips: ['Mento leggermente verso il petto: evita di inarcare la schiena.', 'Spingi con i talloni, non con le punte.'],
  }),
  backext: (e) => ({
    steps: [
      e.opt.floor ? 'Sdraiati a pancia in giù, braccia distese in avanti.' : 'Posizionati sulla panca per hyperextension con il cuscinetto sotto le anche e i talloni bloccati.',
      e.opt.floor ? 'Solleva insieme braccia, petto e gambe da terra.' : 'Parti con il busto piegato verso il basso e la schiena neutra.',
      e.opt.floor ? 'Mantieni un istante contraendo glutei e lombari.' : 'Risali fino ad allineare busto e gambe, contraendo glutei e lombari.',
      'Torna giù lentamente.',
    ],
    tips: ['Non andare oltre la linea del corpo in alto.', 'Movimento lento e controllato.'],
  }),
  nordic: () => ({
    steps: [
      'In ginocchio su un tappetino, caviglie bloccate da un compagno o da un supporto.',
      'Busto dritto, anche distese e addome contratto.',
      'Lasciati cadere in avanti lentamente frenando con i femorali.',
      'Quando non riesci più a frenare, appoggia le mani e spingi per tornare su.',
    ],
    tips: ['Tieni il corpo in linea da ginocchia a testa.', 'È molto intenso: inizia con poche ripetizioni.'],
  }),
  glutekick: (e) => ({
    steps: [
      'Mettiti a quattro zampe: mani sotto le spalle e ginocchia sotto le anche.',
      e.load === 'cable' ? 'Aggancia la cavigliera al cavo basso.' : 'Contrai l\'addome per tenere la schiena neutra.',
      'Spingi una gamba indietro e in alto contraendo il gluteo.',
      'Torna giù con controllo. Completa le ripetizioni e cambia gamba.',
    ],
    tips: ['Non inarcare la schiena per salire di più.', 'Il bacino resta fermo e parallelo al pavimento.'],
  }),
  bench: (e) => {
    if (e.opt.machine || (e.load === 'machine' && !e.opt.incline && !e.opt.decline)) {
      return {
        steps: ['Regola il sedile: le maniglie sono all\'altezza del petto.', 'Schiena appoggiata e scapole addotte.', 'Spingi le maniglie in avanti fino quasi a distendere le braccia.', 'Torna indietro lentamente fino a sentire allungare il petto.'],
        tips: ['Non staccare la schiena dallo schienale.', 'Gomiti a circa 45° dal busto.'],
      };
    }
    return {
      steps: [
        `Sdraiati sulla panca${e.opt.incline ? ' inclinata (30-45°)' : e.opt.decline ? ' declinata' : e.opt.floor ? ' (o a terra)' : ''}${e.load === 'barbell' || e.load === 'none' ? ': occhi sotto il bilanciere,' : ','} piedi ben piantati a terra.`,
        `Afferra ${e.eq || 'il bilanciere'} poco oltre la larghezza delle spalle e stringi le scapole.`,
        'Porta il peso sopra il petto a braccia tese.',
        'Scendi con controllo fino a sfiorare il petto, gomiti a circa 45° dal busto.',
        'Spingi verso l\'alto fino a distendere le braccia ed espira.',
      ],
      tips: ['Mantieni glutei e scapole sempre appoggiati alla panca.', 'Polsi dritti, sopra i gomiti.'],
    };
  },
  pushup: (e) => ({
    steps: [
      `Mani a terra poco più larghe delle spalle${e.opt.incline ? ', appoggiate su un rialzo' : ''}${e.opt.decline ? ', piedi su un rialzo' : ''}.`,
      'Corpo in linea retta dalla testa ai talloni, addome e glutei contratti.',
      'Piega i gomiti e scendi fino a sfiorare il pavimento con il petto.',
      'Spingi per tornare su a braccia distese.',
    ],
    tips: ['Non far cadere il bacino.', 'Gomiti a circa 45° dal busto, non aperti a T.'],
  }),
  dip: () => ({
    steps: [
      'Afferra le parallele e sollevati a braccia tese.',
      'Inclina leggermente il busto in avanti (più petto) o tienilo dritto (più tricipiti).',
      'Piega i gomiti e scendi finché le spalle arrivano all\'altezza dei gomiti.',
      'Spingi per tornare su senza bloccare di scatto i gomiti.',
    ],
    tips: ['Spalle basse e lontane dalle orecchie.', 'Se senti dolore alle spalle, riduci la profondità.'],
  }),
  ohpress: (e) => ({
    steps: [
      `${e.opt.seated || e.load === 'machine' ? 'Seduto con la schiena appoggiata' : 'In piedi, piedi alla larghezza delle anche'}, ${e.eq || 'il peso'} all'altezza delle spalle.`,
      'Contrai addome e glutei per non inarcare la schiena.',
      'Spingi il peso verso l\'alto fino a distendere le braccia sopra la testa.',
      'Riscendi con controllo all\'altezza delle spalle.',
    ],
    tips: ['Avambracci verticali sotto il peso.', 'Non spingere la testa in avanti: è il peso che passa davanti al viso.'],
  }),
  jerk: (e) => ({
    steps: [
      `${e.eq ? e.eq.charAt(0).toUpperCase() + e.eq.slice(1) : 'Il bilanciere'} appoggiato sulle spalle davanti, gomiti in avanti.`,
      'Fai un piccolo piegamento delle gambe (pochi centimetri) con il busto dritto.',
      'Distendi le gambe in modo esplosivo e usa la spinta per portare il peso sopra la testa.',
      'Blocca le braccia distese, stabilizza e riporta il peso sulle spalle.',
    ],
    tips: ['Il piegamento è breve e veloce.', 'Testa che "passa sotto" il bilanciere a fine spinta.'],
  }),
  row: (e) => ({
    steps: [
      e.opt.one ? 'Appoggia mano e ginocchio dello stesso lato su una panca; l\'altra mano tiene il peso.' : `In piedi con ${e.eq || 'il bilanciere'}, ginocchia leggermente piegate.`,
      'Inclina il busto in avanti (circa 45°) con la schiena dritta.',
      'Tira il peso verso l\'addome portando i gomiti indietro vicino al corpo.',
      'Stringi le scapole in alto, poi scendi lentamente a braccia tese.',
    ],
    tips: ['Non usare lo slancio del busto.', 'Il collo resta in linea con la schiena.'],
  }),
  seatedrow: (e) => ({
    steps: [
      e.load === 'machine' ? 'Siediti con il petto contro il cuscinetto e afferra le maniglie.' : 'Siediti al pulley con i piedi sulla pedana e le ginocchia leggermente piegate.',
      'Schiena dritta e petto in fuori.',
      'Tira le maniglie verso l\'addome portando i gomiti indietro.',
      'Stringi le scapole, poi torna in avanti lentamente distendendo le braccia.',
    ],
    tips: ['Il busto resta quasi fermo.', 'Spalle basse, lontane dalle orecchie.'],
  }),
  pullup: (e) => ({
    steps: [
      `Afferra la sbarra ${e.opt.chin ? 'con i palmi verso di te' : 'con i palmi in avanti'}, poco più larghi delle spalle.`,
      'Parti appeso a braccia tese, spalle attive (non "appese").',
      'Tira portando il petto verso la sbarra finché il mento la supera.',
      'Scendi lentamente fino a distendere le braccia.',
    ],
    tips: ['Evita di dondolare con le gambe.', 'Se non riesci, usa un elastico o la macchina assistita.'],
  }),
  pulldown: () => ({
    steps: [
      'Siediti alla lat machine con le cosce bloccate sotto i cuscinetti.',
      'Afferra la barra poco più larga delle spalle.',
      'Tira la barra verso la parte alta del petto, petto in fuori e gomiti verso il basso.',
      'Risali lentamente fino a distendere le braccia.',
    ],
    tips: ['Non tirare dietro la nuca.', 'Non inclinarti troppo indietro.'],
  }),
  straightarm: () => ({
    steps: [
      'In piedi davanti al cavo alto, afferra la barra a braccia quasi tese.',
      'Inclina leggermente il busto in avanti.',
      'Porta la barra verso le cosce con un arco, tenendo le braccia distese.',
      'Torna su lentamente fino a sentire allungare i dorsali.',
    ],
    tips: ['I gomiti restano quasi bloccati.', 'Spalle basse durante tutto il movimento.'],
  }),
  pullover: (e) => ({
    steps: [
      `Sdraiato sulla panca, tieni ${e.eq || 'un manubrio'} con entrambe le mani sopra il petto.`,
      'Gomiti leggermente piegati e fermi.',
      'Porta il peso dietro la testa con un arco fino a sentire allungare petto e dorsali.',
      'Riporta il peso sopra il petto con lo stesso arco.',
    ],
    tips: ['Addome contratto per non inarcare la schiena.', 'Usa un carico moderato.'],
  }),
  curl: (e) => ({
    steps: [
      e.opt.preacher ? 'Siediti alla panca Scott con la parte posteriore delle braccia sul cuscino.'
        : e.opt.incline ? 'Siediti su una panca inclinata con le braccia distese verso il basso.'
        : e.opt.conc ? 'Siediti, appoggia il gomito all\'interno della coscia.'
        : `In piedi, ${e.eq || 'il peso'} in mano a braccia distese lungo i fianchi.`,
      `${e.opt.hammer ? 'Presa neutra (palmi uno di fronte all\'altro)' : e.opt.reverse ? 'Presa prona (palmi verso il basso)' : 'Palmi rivolti in avanti'}, gomiti fermi vicino al busto.`,
      'Fletti i gomiti e porta il peso verso le spalle contraendo i bicipiti.',
      'Scendi lentamente fino a distendere le braccia.',
    ],
    tips: ['Non oscillare con la schiena.', 'I gomiti non si spostano in avanti.'],
  }),
  wristcurl: (e) => ({
    steps: [
      'Siediti e appoggia gli avambracci sulle cosce, polsi appena oltre le ginocchia.',
      `Tieni ${e.eq || 'il peso'} con i palmi ${e.opt.reverse ? 'verso il basso' : 'verso l\'alto'}.`,
      'Lascia scendere il peso piegando i polsi verso il basso.',
      'Fletti i polsi verso l\'alto, solo con gli avambracci.',
    ],
    tips: ['Movimento piccolo e controllato.', 'Gli avambracci restano fermi sulle cosce.'],
  }),
  ohext: (e) => ({
    steps: [
      `${e.opt.seated ? 'Seduto' : 'In piedi'}, tieni ${e.eq || 'il peso'} sopra la testa a braccia distese.`,
      'Gomiti stretti e rivolti in avanti.',
      'Piega i gomiti e porta il peso dietro la testa.',
      'Distendi le braccia contraendo i tricipiti.',
    ],
    tips: ['Solo gli avambracci si muovono.', 'Addome contratto per non inarcare la schiena.'],
  }),
  skull: (e) => ({
    steps: [
      `Sdraiato sulla panca, ${e.eq || 'il bilanciere'} sopra il petto a braccia tese.`,
      'Inclina leggermente le braccia verso la testa e tienile ferme.',
      'Piega i gomiti e porta il peso verso la fronte.',
      'Distendi le braccia contraendo i tricipiti.',
    ],
    tips: ['I gomiti non si aprono verso l\'esterno.', 'Scendi lentamente, con controllo.'],
  }),
  pushdown: (e) => ({
    steps: [
      `In piedi davanti al cavo alto, afferra ${e.opt.rope ? 'la corda' : 'la barra'}.`,
      'Gomiti stretti ai fianchi, busto leggermente inclinato in avanti.',
      'Spingi verso il basso fino a distendere le braccia.',
      'Risali lentamente fino a circa 90°, senza muovere i gomiti.',
    ],
    tips: ['Solo gli avambracci si muovono.', 'Non usare il peso del corpo per spingere.'],
  }),
  kickback: (e) => ({
    steps: [
      `Busto inclinato in avanti, ${e.eq || 'il manubrio'} in mano.`,
      'Porta il braccio parallelo al busto, gomito piegato a 90°.',
      'Distendi il gomito portando il peso indietro.',
      'Torna lentamente a 90° tenendo fermo il braccio.',
    ],
    tips: ['Il braccio resta fermo vicino al busto.', 'Usa un carico leggero e controlla il movimento.'],
  }),
  latraise: (e) => ({
    steps: [
      `In piedi, ${e.eq || 'i manubri'} lungo i fianchi, gomiti leggermente piegati.`,
      'Solleva le braccia lateralmente fino all\'altezza delle spalle.',
      'Guida il movimento con i gomiti, mignoli appena più alti dei pollici.',
      'Scendi lentamente.',
    ],
    tips: ['Non salire oltre le spalle.', 'Niente slancio con il busto.'],
  }),
  frontraise: (e) => ({
    steps: [
      `In piedi, ${e.eq || 'il peso'} davanti alle cosce.`,
      'Solleva le braccia in avanti, quasi tese, fino all\'altezza delle spalle.',
      'Fermati un istante e scendi lentamente.',
    ],
    tips: ['Busto fermo e addome contratto.', 'Non salire oltre la linea degli occhi.'],
  }),
  reardelt: (e) => ({
    steps: [
      e.load === 'machine' ? 'Siediti alla macchina rivolto verso lo schienale e afferra le maniglie.' : `Busto inclinato in avanti, ${e.eq || 'i manubri'} sotto il petto.`,
      'Gomiti leggermente piegati.',
      'Apri le braccia lateralmente portandole all\'indietro, fino alla linea delle spalle.',
      'Torna lentamente.',
    ],
    tips: ['Pensa a portare le mani "larghe", non indietro.', 'Non stringere troppo le scapole: lavora sui deltoidi posteriori.'],
  }),
  facepull: () => ({
    steps: [
      'Imposta il cavo all\'altezza del viso e afferra la corda con presa prona.',
      'Fai un passo indietro, braccia tese in avanti.',
      'Tira la corda verso il viso aprendo le mani ai lati delle orecchie, gomiti alti.',
      'Torna lentamente in avanti.',
    ],
    tips: ['I gomiti restano all\'altezza delle spalle.', 'Ottimo per la salute delle spalle: usa un carico leggero.'],
  }),
  uprightrow: (e) => ({
    steps: [
      `In piedi, ${e.eq || 'il bilanciere'} davanti alle cosce, presa alla larghezza delle spalle.`,
      'Tira il peso verso l\'alto lungo il corpo guidando con i gomiti.',
      'Fermati quando i gomiti arrivano all\'altezza delle spalle.',
      'Scendi lentamente.',
    ],
    tips: ['Non salire oltre le spalle se senti fastidio.', 'Presa non troppo stretta.'],
  }),
  shrug: (e) => ({
    steps: [
      `In piedi, ${e.eq || 'il peso'} in mano a braccia distese.`,
      'Solleva le spalle verso le orecchie il più in alto possibile.',
      'Tieni la contrazione un secondo.',
      'Abbassa lentamente.',
    ],
    tips: ['Non ruotare le spalle: su e giù.', 'Le braccia restano distese.'],
  }),
  rotation: (e) => ({
    steps: [
      `Gomito piegato a 90°${e.load === 'cable' || e.load === 'band' ? ', impugna il cavo o l\'elastico' : ''}.`,
      'Tieni il gomito fermo (vicino al fianco o all\'altezza della spalla).',
      'Ruota l\'avambraccio verso l\'esterno (o l\'interno) usando solo la spalla.',
      'Torna lentamente.',
    ],
    tips: ['Carico leggero: è un esercizio per la cuffia dei rotatori.', 'Movimento lento e controllato.'],
  }),
  fly: (e) => ({
    steps: [
      e.load === 'cable' ? 'In piedi al centro dei cavi alti, una maniglia per mano, busto leggermente inclinato.'
        : e.load === 'machine' ? 'Siediti alla pectoral machine, schiena appoggiata e braccia aperte.'
        : 'Sdraiato sulla panca, manubri sopra il petto con i palmi uno di fronte all\'altro.',
      'Gomiti leggermente piegati e fissi.',
      'Apri le braccia con un arco ampio fino a sentire allungare il petto.',
      'Richiudi le braccia con lo stesso arco contraendo il petto.',
    ],
    tips: ['Non scendere oltre la linea delle spalle.', 'Pensa ad "abbracciare" un albero.'],
  }),
  crunch: (e) => ({
    steps: e.opt.reverse ? [
      'Sdraiati a pancia in su, braccia lungo i fianchi, ginocchia piegate e sollevate.',
      'Porta le ginocchia verso il petto staccando il bacino da terra.',
      'Torna giù lentamente senza appoggiare i piedi.',
    ] : e.load === 'cable' ? [
      'In ginocchio davanti al cavo alto, tieni la corda ai lati della testa.',
      'Fletti il busto arrotondando la schiena e porta i gomiti verso le cosce.',
      'Contrai l\'addome e torna su lentamente.',
    ] : [
      'Sdraiati a pancia in su, ginocchia piegate e piedi a terra.',
      'Mani incrociate sul petto o vicine alle tempie.',
      `Solleva ${e.opt.situp ? 'tutto il busto fino a sederti' : 'testa e spalle da terra arrotolando la schiena'} contraendo l'addome.`,
      'Torna giù lentamente.',
    ],
    tips: ['Non tirare il collo con le mani.', 'Espira mentre sali.'],
  }),
  legraise: (e) => ({
    steps: [
      e.opt.hanging ? 'Appeso alla sbarra, braccia tese e corpo fermo.' : 'Sdraiati a pancia in su, mani sotto i glutei o lungo i fianchi.',
      `Solleva ${e.opt.knee ? 'le ginocchia verso il petto' : 'le gambe tese'} contraendo l'addome.`,
      'Arriva fino a circa 90° (o oltre se riesci senza slancio).',
      'Scendi lentamente senza dondolare.',
    ],
    tips: ['La zona lombare resta aderente al pavimento (da sdraiato).', 'Niente slancio.'],
  }),
  plank: () => ({
    steps: [
      'Appoggia gli avambracci a terra, gomiti sotto le spalle.',
      'Distendi le gambe e appoggiati sulle punte dei piedi.',
      'Corpo in linea retta: addome e glutei contratti.',
      'Mantieni la posizione respirando normalmente per il tempo indicato.',
    ],
    tips: ['Non alzare né abbassare il bacino.', 'Sguardo verso il pavimento.'],
  }),
  climber: () => ({
    steps: [
      'Parti in posizione di plank a braccia tese.',
      'Porta un ginocchio verso il petto.',
      'Rapidamente torna indietro e porta l\'altro ginocchio, alternando.',
      'Mantieni il ritmo con il bacino basso.',
    ],
    tips: ['Spalle sopra le mani.', 'Addome sempre contratto.'],
  }),
  flutter: () => ({
    steps: [
      'Sdraiati a pancia in su, mani sotto i glutei.',
      'Solleva le gambe tese di qualche centimetro da terra.',
      'Alterna piccoli movimenti su e giù delle gambe.',
      'Mantieni la zona lombare a contatto con il pavimento.',
    ],
    tips: ['Più le gambe sono basse, più è difficile.', 'Respira in modo regolare.'],
  }),
  twistseat: (e) => ({
    steps: [
      `Siediti a terra con le ginocchia piegate e tieni ${e.eq || 'la palla medica'} davanti al petto.`,
      'Inclina il busto indietro a circa 45° con la schiena dritta; per renderlo più difficile solleva i piedi da terra.',
      'Ruota il busto da un lato portando il peso vicino al fianco.',
      'Torna al centro e ruota dall\'altro lato: ogni lato conta una ripetizione.',
    ],
    tips: ['Ruota le spalle, non solo le braccia.', 'Mantieni l\'addome contratto e la schiena neutra.'],
  }),
  woodchop: (e) => ({
    steps: [
      `In piedi di lato ${e.load === 'cable' ? 'al cavo alto' : 'con il peso tenuto a due mani'}, piedi alla larghezza delle spalle.`,
      'Parti con le braccia tese in alto, dal lato del cavo.',
      'Porta le mani in diagonale verso il ginocchio opposto ruotando busto e anche.',
      'Torna lentamente in alto controllando la rotazione. Completa le ripetizioni e cambia lato.',
    ],
    tips: ['La forza parte dalle anche e dal busto, le braccia restano quasi tese.', 'Ruota anche il piede posteriore.'],
  }),
  twist: (e) => ({
    steps: [
      `Seduto o in piedi, tieni ${e.eq || 'il peso'} davanti al petto.`,
      'Contrai l\'addome e mantieni la schiena dritta.',
      'Ruota il busto da un lato, poi dall\'altro, controllando il movimento.',
    ],
    tips: ['Ruota il busto, non solo le braccia.', 'Movimento controllato, senza strappi.'],
  }),
  sidebend: (e) => ({
    steps: [
      `In piedi, ${e.eq || 'un manubrio'} in una mano lungo il fianco.`,
      'Piegati lateralmente verso il peso.',
      'Torna dritto contraendo gli obliqui del lato opposto.',
      'Completa le ripetizioni e cambia lato.',
    ],
    tips: ['Non ruotare il busto: solo inclinazione laterale.', 'Bacino fermo.'],
  }),
  rollout: () => ({
    steps: [
      'In ginocchio, afferra la ruota (o il bilanciere) sotto le spalle.',
      'Contrai l\'addome e i glutei.',
      'Fai rotolare la ruota in avanti allungando il corpo il più possibile senza inarcare la schiena.',
      'Torna indietro usando l\'addome.',
    ],
    tips: ['Se la schiena si inarca, riduci l\'escursione.', 'Movimento lento.'],
  }),
  kbswing: () => ({
    steps: [
      'Piedi poco più larghi delle spalle, kettlebell a terra davanti a te.',
      'Afferralo, spingi le anche indietro e fallo oscillare tra le gambe.',
      'Spingi le anche in avanti in modo esplosivo: il kettlebell sale fino all\'altezza del petto.',
      'Lascialo ricadere tra le gambe e ripeti.',
    ],
    tips: ['La spinta viene dalle anche, non dalle braccia.', 'Schiena neutra in ogni momento.'],
  }),
  clean: (e) => ({
    steps: [
      `Parti come nello stacco, ${e.eq || 'il bilanciere'} vicino alle tibie.`,
      'Tira con le gambe e, superate le ginocchia, estendi le anche in modo esplosivo.',
      'Solleva le spalle e porta i gomiti velocemente in avanti sotto il bilanciere.',
      'Ricevi il peso sulle spalle con un piegamento delle gambe, poi alzati.',
    ],
    tips: ['Bilanciere sempre vicino al corpo.', 'Impara la tecnica con carichi leggeri.'],
  }),
  snatch: (e) => ({
    steps: [
      `Presa larga su ${e.eq || 'il bilanciere'}, partenza come nello stacco.`,
      'Tira con le gambe ed estendi le anche in modo esplosivo.',
      'Porta il bilanciere sopra la testa in un unico movimento passandoci sotto.',
      'Ricevi a braccia tese in accosciata, poi alzati.',
    ],
    tips: ['Esercizio tecnico: impara con un istruttore.', 'Braccia sempre tese in ricezione.'],
  }),
  jump: () => ({
    steps: [
      'In piedi, piedi alla larghezza delle anche.',
      'Piegati rapidamente portando le braccia indietro.',
      'Salta in modo esplosivo spingendo con le gambe e slanciando le braccia in alto.',
      'Atterra morbido sulle punte piegando le ginocchia e ripeti.',
    ],
    tips: ['Atterra con le ginocchia allineate ai piedi.', 'Qualità prima della quantità.'],
  }),
  jack: () => ({
    steps: [
      'In piedi, piedi uniti e braccia lungo i fianchi.',
      'Salta aprendo le gambe e portando le braccia sopra la testa.',
      'Salta di nuovo tornando alla posizione iniziale.',
      'Mantieni un ritmo costante.',
    ],
    tips: ['Atterra sulle punte.', 'Respira in modo regolare.'],
  }),
  run: (e) => ({
    steps: [
      e.opt.treadmill ? 'Sali sul tapis roulant e parti a velocità bassa.' : 'Inizia con qualche minuto di riscaldamento a ritmo leggero.',
      'Busto eretto, sguardo avanti, braccia piegate a circa 90°.',
      'Appoggia il piede sotto il corpo, non troppo avanti.',
      'Aumenta gradualmente l\'intensità e mantieni il ritmo per il tempo indicato.',
    ],
    tips: ['Passi corti e frequenti affaticano meno le articolazioni.', 'Respira in modo regolare.'],
  }),
  walk: (e) => ({
    steps: [
      `Afferra ${e.eq || 'i pesi'} e mettiti in piedi con la schiena dritta.`,
      'Spalle basse e addome contratto.',
      'Cammina a passi corti e controllati per la distanza o il tempo indicati.',
      'Appoggia i pesi piegando le gambe, non la schiena.',
    ],
    tips: ['Non lasciare che i pesi ti tirino di lato.', 'Presa salda.'],
  }),
  sled: () => ({
    steps: [
      'Afferra le maniglie della slitta con le braccia distese.',
      'Inclina il busto in avanti mantenendo la schiena dritta.',
      'Spingi con passi corti e potenti, spingendo con tutto il piede.',
      'Mantieni l\'inclinazione costante per tutta la distanza.',
    ],
    tips: ['Ginocchia avanti, spinta dalle gambe.', 'Addome contratto.'],
  }),
  bike: () => ({
    steps: [
      'Regola la sella: a pedale in basso il ginocchio resta leggermente piegato.',
      'Mani sul manubrio, schiena dritta e spalle rilassate.',
      'Pedala in modo fluido, spingendo e tirando il pedale.',
      'Regola resistenza e cadenza in base all\'allenamento.',
    ],
    tips: ['Non dondolare con il bacino.', 'Inizia piano per scaldarti.'],
  }),
  rowmachine: () => ({
    steps: [
      'Siediti al vogatore, piedi bloccati e maniglia tra le mani a braccia tese.',
      'Spingi prima con le gambe, poi inclina il busto leggermente indietro.',
      'Tira la maniglia verso l\'addome con le braccia.',
      'Torna in avanti nell\'ordine inverso: braccia, busto, gambe.',
    ],
    tips: ['Circa il 60% della forza viene dalle gambe.', 'Schiena dritta, mai arrotondata.'],
  }),
  rope: () => ({
    steps: [
      'Impugna la corda, gomiti vicini ai fianchi.',
      'Fai girare la corda con i polsi, non con le braccia.',
      'Salta di pochi centimetri, atterrando sulle punte.',
      'Mantieni un ritmo costante.',
    ],
    tips: ['Salti bassi e leggeri.', 'Ginocchia morbide.'],
  }),
  hipflex: () => ({
    steps: [
      'In piedi con la schiena dritta, eventualmente tenendoti a un supporto.',
      'Solleva un ginocchio verso il petto fino all\'altezza delle anche.',
      'Torna giù lentamente e cambia gamba.',
    ],
    tips: ['Busto fermo.', 'Movimento controllato.'],
  }),
  abduction: (e) => ({
    steps: [
      e.load === 'machine' ? 'Siediti alla macchina con i cuscinetti sul lato esterno delle ginocchia.' : 'In piedi di lato al supporto, cavigliera o elastico sulla gamba esterna.',
      'Busto fermo e addome contratto.',
      'Allarga la gamba (o le gambe) verso l\'esterno.',
      'Torna lentamente.',
    ],
    tips: ['Non inclinare il busto.', 'Controlla la fase di ritorno.'],
  }),
  adduction: (e) => ({
    steps: [
      e.load === 'machine' ? 'Siediti alla macchina con i cuscinetti sul lato interno delle ginocchia.' : 'In piedi di lato al supporto, cavigliera sulla gamba interna.',
      'Busto fermo e addome contratto.',
      'Porta la gamba (o le gambe) verso l\'interno.',
      'Torna lentamente.',
    ],
    tips: ['Movimento controllato.', 'Non usare lo slancio.'],
  }),
  mbthrow: (e) => ({
    steps: e.opt.slam ? [
      'In piedi con la palla medica sopra la testa a braccia tese.',
      'Lanciala con forza a terra davanti a te piegando busto e gambe.',
      'Riprendila e ripeti.',
    ] : [
      'In piedi davanti a un muro o a un compagno, palla medica al petto.',
      'Carica il movimento con le gambe e il busto.',
      'Lancia la palla in modo esplosivo.',
      'Riprendila al rimbalzo e ripeti.',
    ],
    tips: ['Usa tutto il corpo, non solo le braccia.', 'Scegli una palla adatta al lancio.'],
  }),
  roll: (e) => ({
    steps: [
      `Posiziona il foam roller sotto la zona da trattare (${(e.muscle || '').toLowerCase()}).`,
      'Sostieni il peso con mani o avambracci per regolare la pressione.',
      'Fai rotolare lentamente il corpo avanti e indietro per 30-60 secondi.',
      'Sui punti più tesi fermati qualche secondo respirando.',
    ],
    tips: ['Pressione intensa ma non dolorosa.', 'Evita ossa e articolazioni.'],
  }),
  neck: () => ({
    steps: [
      'Seduto o in piedi con la schiena dritta.',
      'Muovi lentamente la testa nella direzione indicata, senza forzare.',
      'Torna al centro e ripeti.',
    ],
    tips: ['Movimenti lenti e controllati.', 'Interrompi se senti dolore.'],
  }),
  stretch: (e) => ({
    steps: [
      `Assumi la posizione mostrata e porta lentamente in allungamento ${{
        Quadricipiti: 'la parte anteriore della coscia', Femorali: 'la parte posteriore della coscia', Polpacci: 'il polpaccio',
        Petto: 'il petto', Spalle: 'la spalla', Tricipiti: 'il tricipite', Dorso: 'la schiena', Lombari: 'la zona lombare',
        Glutei: 'il gluteo', Abduttori: 'la parte esterna dell\'anca', Adduttori: 'l\'interno coscia', Addome: 'l\'addome',
        Collo: 'il collo', Trapezi: 'i trapezi', Avambracci: 'l\'avambraccio', Bicipiti: 'il bicipite',
      }[e.muscle] || 'il muscolo'}.`,
      'Fermati quando senti una tensione moderata, mai dolore.',
      'Mantieni 20-30 secondi respirando lentamente e rilassandoti.',
      'Se l\'esercizio è su un lato, ripeti dall\'altra parte.',
    ],
    tips: ['Niente molleggi: allungamento statico e graduale.', 'Ideale a fine allenamento.'],
  }),
};

const MODS = [
  [/\b(one[- ]arm|single[- ]arm|un braccio)\b/i, 'Esegui un braccio alla volta, poi cambia lato.'],
  [/\b(one[- ]leg|single[- ]leg|una gamba)\b/i, 'Esegui su una gamba sola, poi cambia lato.'],
  [/alternat/i, 'Alterna destra e sinistra a ogni ripetizione.'],
  [/\b(close[- ]grip|narrow|stretta)\b/i, 'Presa stretta: lavorano di più i tricipiti e la parte interna.'],
  [/\b(wide[- ]grip|wide|larga)\b/i, 'Presa larga.'],
  [/\b(reverse[- ]grip|underhand|supinat|supina)\b/i, 'Presa inversa (palmi verso di te).'],
  [/\b(neutral[- ]grip|hammer|martello)\b/i, 'Presa neutra (palmi uno di fronte all\'altro).'],
  [/smith|multipower/i, 'Al multipower: il bilanciere scorre su guide fisse.'],
  [/\bband|elastic/i, 'Con elastico: la resistenza aumenta man mano che lo allunghi.'],
  [/\bpause/i, 'Fai una pausa di 1-2 secondi nel punto più difficile.'],
  [/deficit/i, 'In deficit: parti da un rialzo per aumentare l\'escursione.'],
  [/\bsumo\b/i, 'Gambe larghe e punte dei piedi verso l\'esterno (stile sumo).'],
  [/\bkneeling\b/i, 'Da posizione in ginocchio.'],
  [/\bisometric|\bhold\b/i, 'Mantieni la posizione per il tempo indicato.'],
  [/\bpartial|\bquarter\b/i, 'Esegui solo una parte dell\'escursione.'],
  [/\bstability ball|exercise ball|fitball/i, 'Su fitball: richiede più equilibrio e controllo.'],
  [/\bbosu/i, 'Su bosu: migliora equilibrio e stabilità.'],
];

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Spiegazione in italiano per un esercizio (usa la mossa già calcolata) */
const ALIAS_T = { flylying: 'fly' };

export function howTo(ex, key) {
  key = ALIAS_T[key] || key;
  const { opt } = parseMove(ex.move);
  const load = loadOf(ex);
  // nelle altre lingue: spiegazioni in inglese (js/howto-en.js)
  const src = HOWTO || { EQ, T, MODS };
  const e = { opt, load, eq: src.EQ[load] || '', muscle: ex.muscle };
  const base = (src.T[key] || src.T.squat)(e);
  const variants = src.MODS.filter(([re]) => re.test(ex.name)).map(([, m]) => m);
  return { steps: base.steps.map(cap), tips: base.tips, variants };
}
