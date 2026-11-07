import { I } from '../icons.js';
import { isNative } from '../native.js';
import { t, tn } from '../i18n.js';

// Guida all'uso (Altro › Guida): una sezione per argomento, si apre con un tocco.
// Le sezioni dell'app iPhone (Live Activity, Apple Watch, musica, Salute) compaiono solo lì.

const SECTIONS = [
  {
    title: 'Primi passi',
    steps: [
      'In <b>Allena</b> trovi le tue schede. Se non ne hai, tocca <b>Oppure aggiungi Push / Pull / Legs di esempio</b> per partire subito.',
      'Tocca <b>▶</b> accanto a una scheda per iniziare l\'allenamento, oppure <b>Allenamento libero</b> per aggiungere gli esercizi strada facendo.',
      'L\'anello in alto mostra quanti allenamenti hai fatto questa settimana rispetto all\'obiettivo (lo cambi in Altro › Impostazioni).',
    ],
  },
  {
    title: 'Creare e modificare una scheda',
    steps: [
      'In <b>Allena</b> tocca <b>Nuova</b>, dai un nome e aggiungi gli esercizi (puoi sceglierne più di uno insieme).',
      'Per ogni esercizio imposta numero di serie, ripetizioni (anche un intervallo, es. 8-12) e tempo di recupero.',
      'Per cambiare l\'ordine <b>trascina</b> l\'esercizio dalla maniglia <b>⠿</b> a sinistra (oppure tieni premuto il nome e sposta).',
      'Con <b>⋯</b> sull\'esercizio: superset con il successivo, sostituisci, rimuovi.',
      'Con <b>⋯</b> sulla scheda nella home: modifica, duplica, sposta o elimina.',
      'Nel selettore degli esercizi, in alto, le categorie <b>CrossFit</b>, <b>Riscaldamento</b>, <b>Mobilità</b>, Stretching e Cardio mostrano solo quegli esercizi.',
    ],
  },
  {
    title: 'Durante l\'allenamento',
    steps: [
      'Scrivi <b>kg</b> e <b>ripetizioni</b> e tocca <b>✓</b> per segnare la serie: parte il recupero.',
      'I numeri in grigio sono quelli <b>dell\'ultima volta</b>: se tocchi ✓ senza scrivere niente vengono usati quelli. Tocca la colonna <b>Prec.</b> per copiarli.',
      'Tocca il <b>numero della serie</b> per renderla riscaldamento, dropset o a cedimento, oppure per eliminarla. <b>+ Serie</b> ne aggiunge una.',
      'Trascina dalla maniglia <b>⠿</b> per cambiare l\'ordine degli esercizi. Con <b>⋯</b> sull\'esercizio: come si esegue, nota, recupero, superset, sostituisci, rimuovi. In fondo: <b>Aggiungi esercizio</b> e note dell\'allenamento.',
      'Puoi indicare la fatica di ogni serie (RPE o RIR, si sceglie in Altro › Impostazioni).',
      '<b>Progressione</b>: se l\'ultima volta hai fatto tutte le ripetizioni previste in ogni serie, il peso proposto (in colore) sale di 2,5 kg. L\'incremento si cambia in Altro › Impostazioni.',
      '<b>Serie di riscaldamento</b>: dal menu <b>⋯</b> dell\'esercizio Rep aggiunge le serie di avvicinamento (R) calcolate dal peso di lavoro.',
      'La freccia in alto a sinistra riduce l\'allenamento: continua in sottofondo e lo riapri dalla barra in basso. <b>Fine</b> lo salva, <b>Annulla allenamento</b> lo scarta.',
    ],
  },
  {
    title: 'Recupero',
    steps: [
      'Parte da solo quando segni una serie (nei superset dopo l\'ultimo esercizio del gruppo).',
      'Nella barra in basso: <b>−15</b> e <b>+15</b> secondi, <b>Salta</b>. Tocca il timer per ingrandirlo a tutto schermo.',
      'A fine recupero suona e vibra (si regola in Altro › Impostazioni) e la prossima serie si illumina.',
      'La durata predefinita si cambia in Altro › Impostazioni, quella di un esercizio dal suo menu <b>⋯</b>.',
    ],
  },
  {
    title: 'Storico e progressi',
    steps: [
      '<b>Storico</b>: calendario degli allenamenti. Tocca un allenamento per i dettagli, poi <b>Ripeti allenamento</b>, <b>Salva come scheda</b> o elimina.',
      '<b>Progressi</b>: volume per muscolo, record recenti e l\'elenco degli esercizi. Tocca un esercizio per il grafico (scegli cosa misurare e il periodo).',
      'I record (peso massimo, 1RM stimato, miglior serie, ripetizioni) vengono riconosciuti da soli a fine allenamento.',
      'La <b>mappa muscolare</b> in Progressi colora i muscoli in base alle serie della settimana: più acceso fino a 10–20 serie, arancione oltre.',
    ],
  },
  {
    title: 'Condividere con gli amici',
    steps: [
      'A fine allenamento tocca <b>Condividi</b> (o dallo Storico: <b>Condividi con un amico</b>): parte un\'immagine con durata, volume, record ed esercizi, più un link.',
      'Per mandare una scheda: <b>⋯</b> sulla scheda › <b>Condividi</b>, oppure il pulsante in fondo alla modifica della scheda.',
      'Chi apre il link vede l\'anteprima e può <b>salvarla nelle sue schede</b> o <b>allenarsi subito</b> con quegli esercizi. Funziona anche senza l\'app, dal browser.',
      'In Altro › Impostazioni scegli <b>il tuo nome</b>, che compare su quello che condividi.',
    ],
  },
  {
    title: 'Corpo',
    steps: [
      'Registra peso e percentuale di grasso: vedi l\'andamento nel tempo.',
      'Attiva <b>Misurazioni</b> per aggiungere le circonferenze (in cm).',
    ],
  },
  {
    title: 'Altro e impostazioni',
    steps: [
      '<b>Tema</b>: cambia il colore dell\'app (anche di orologio e Live Activity).',
      '<b>Timer a intervalli</b>: Tabata, EMOM o personalizzato, con conto alla rovescia, bip e vibrazione.',
      '<b>Settimana di scarico</b>: scegli ogni quante settimane; in quella settimana i pesi proposti sono al 60%.',
      '<b>Calcolatore dischi</b>: scrivi il peso totale e vedi quali dischi mettere per lato. In Impostazioni scegli bilanciere e dischi della tua palestra.',
      '<b>Impostazioni</b>: obiettivo settimanale, recupero predefinito, RPE/RIR, suono, vibrazione, schermo sempre acceso.',
      '<b>Esercizi personalizzati</b>: li crei dal selettore esercizi, qui puoi eliminarli.',
    ],
  },
  {
    title: 'Backup dei dati',
    steps: [
      'I dati restano solo sul telefono. Fai ogni tanto <b>Esporta backup</b> (file JSON) e tienilo al sicuro.',
      '<b>Importa backup</b> riporta tutto com\'era, anche su un altro telefono o dalla web app all\'app iPhone.',
      '<b>Esporta CSV</b> crea un file da aprire con Excel o Numbers.',
      'Nell\'app iPhone c\'è anche il <b>backup automatico</b> dopo ogni allenamento: app File › Sul mio iPhone › Rep › Backup (ultimi 14 giorni). Da lì puoi copiarlo in iCloud Drive; si ripristina da Altro.',
    ],
  },
];

const NATIVE_SECTIONS = [
  {
    title: 'Account e iCloud',
    steps: [
      'Al primo avvio tocca <b>Accedi con Apple</b>: niente password, usa il tuo ID Apple (puoi anche nascondere l\'email).',
      'Da quel momento schede, allenamenti, misure e impostazioni si salvano <b>da soli</b> nel tuo iCloud privato, qualche secondo dopo ogni modifica.',
      'Su un nuovo iPhone o iPad: installa Rep, accedi con lo stesso account e ritrovi tutto. Se usi due dispositivi, i dati si uniscono.',
      'In <b>Altro › Account</b> vedi l\'ultima sincronizzazione, puoi forzarla con <b>Sincronizza ora</b> o uscire (i dati restano sul telefono).',
      'Se hai scelto <b>Continua senza account</b>, puoi accedere quando vuoi da Altro › Account.',
    ],
  },
  {
    title: 'Live Activity (schermata di blocco)',
    steps: [
      'Durante l\'allenamento compare sulla schermata di blocco (e nella Dynamic Island): funziona <b>senza sbloccare</b> il telefono.',
      'Nella serie: <b>− / +</b> per kg e ripetizioni, <b>✓</b> per segnarla. Nel recupero: <b>+15 s</b> e <b>Salta</b>.',
      'A fine recupero i colori si invertono e compare <b>START</b>: toccalo per passare alla serie successiva.',
      'Se non la vedi: Impostazioni dell\'iPhone › Rep › attiva <b>Attività in tempo reale</b>.',
    ],
  },
  {
    title: 'Apple Watch',
    steps: [
      'Sull\'orologio apri Rep e tocca <b>Inizia</b>, poi scegli la scheda o allenamento libero. Parte anche sull\'iPhone.',
      'Nella serie gira la <b>corona</b> per cambiare il peso; tocca le ripetizioni per cambiare quelle. <b>Fatto</b> (o il doppio tap con due dita) segna la serie.',
      'Il bordo dello schermo mostra le serie fatte; nel recupero si svuota e negli ultimi 3 secondi senti un tocco al polso. A fine recupero l\'orologio vibra forte, i colori si invertono e compare <b>START</b>: toccalo (o doppio tap con due dita) per passare alla serie.',
      'Scorri a sinistra per recupero, scheda del giorno, musica e riepilogo con battito e calorie. Dal riepilogo: <b>Termina</b> (salva o annulla).',
      'L\'allenamento viene salvato in Salute con battito e calorie. Se l\'app non c\'è sull\'orologio: app Watch dell\'iPhone › Disponibili › Rep › Installa.',
    ],
  },
  {
    title: 'Siri e widget',
    steps: [
      'Di\' <b>«Ehi Siri, inizia allenamento con Rep»</b> oppure <b>«Inizia Giorno 1 con Rep»</b> (con il nome della scheda). L\'azione c\'è anche nell\'app Comandi.',
      'Widget per la schermata Home e di blocco: tieni premuto lo sfondo › <b>Modifica › Aggiungi widget › Rep</b>. Mostra la settimana, le settimane di fila e la prossima scheda.',
    ],
  },
  {
    title: 'Musica',
    steps: [
      'Durante l\'allenamento la barra in alto mostra il brano di <b>Apple Music</b> con play/pausa e avanti/indietro.',
      'Per Spotify e le altre app usa il Centro di Controllo o la pagina Musica dell\'Apple Watch.',
      'I suoni di Rep si sovrappongono alla musica senza fermarla.',
    ],
  },
  {
    title: 'Salute e notifiche',
    steps: [
      'In Altro › Salute e Apple Watch tocca <b>Collega</b> e consenti la lettura del battito.',
      'Il battito arriva da qualsiasi dispositivo collegato a Salute: Apple Watch, fasce cardio o bracciali di altre marche. Durante l\'allenamento compare in alto accanto a kg e serie.',
      'A fine allenamento Rep mostra media, massimo, minimo, grafico e tempo in ogni zona (la frequenza massima si calcola dall\'età in Altro › Impostazioni).',
      'Con il telefono bloccato una <b>notifica</b> ti avvisa quando finisce il recupero.',
      'Senza Apple Watch, a fine allenamento l\'iPhone lo salva in Salute (durata e calorie); con l\'orologio lo salva lui.',
    ],
  },
];

export function render() {
  const sections = isNative ? [...SECTIONS, ...NATIVE_SECTIONS] : SECTIONS;
  return `
  <header class="page-head with-back">
    <button class="icon-btn" data-action="go" data-to="#/tools" aria-label="${t('Indietro')}">${I.back}</button>
    <h1>${t('Guida')}</h1>
    <span></span>
  </header>
  <p class="muted small">${t('Tocca un argomento per aprirlo.')}</p>
  <div class="help stagger">
    ${sections.map((s, n) => `
    <details class="card help-item">
      <summary><span class="help-n">${String(n + 1).padStart(2, '0')}</span><span class="help-t">${t(s.title)}</span></summary>
      <ol class="guide-list help-steps">${s.steps.map((x) => `<li>${t(x)}</li>`).join('')}</ol>
    </details>`).join('')}
  </div>`;
}
