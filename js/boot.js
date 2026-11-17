// Avvio: prima il dizionario della lingua, poi l'app (così ogni testo è già tradotto quando i moduli partono).
import { loadLang } from './i18n.js';

await loadLang();
await import('./app.js');
