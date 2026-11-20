// Robot de Remates SAE al Día — Vibras Positivas HM
// Trae noticias reales cada 30 min (GitHub Actions) y las guarda en data/noticias.json
import { writeFile, readFile } from 'node:fs/promises';

const CONSULTAS = [
  'SAE inmuebles venta',
  'SAE FNA remate inmuebles',
  'Sociedad de Activos Especiales subasta',
  'Fondo Nacional del Ahorro crédito vivienda usada',
  'SAE estafa falsos funcionarios',
  'SAE bienes extinción de dominio venta',
  'SAE Antioquia inmuebles',
  'FNA vivienda tasas'
];

const UA = 'Mozilla/5.0 (compatible; RematesSaeAlDia/1.0)';
const limpiar = s => (s || '')
  .replace(/<!\[CDATA\[|\]\]>/g, '')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const tag = (xml, t) => { const m = xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, 'i')); return m ? m[1] : ''; };

async function traer(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(r.status + ' ' + url);
  return r.text();
}

function parsear(xml, consulta, origen) {
  return xml.split(/<item>/i).slice(1).map(b => {
    const it = b.split(/<\/item>/i)[0];
    let link = limpiar(tag(it, 'link'));
    const real = link.match(/[?&]url=([^&]+)/);
    if (real) link = decodeURIComponent(real[1]);
    const img = limpiar(tag(it, 'News:Image')) || (it.match(/<media:content[^>]+url="([^"]+)"/i) || [])[1] || '';
    return {
      titulo: limpiar(tag(it, 'title')),
      resumen: limpiar(tag(it, 'description')).slice(0, 260),
      link,
      medio: limpiar(tag(it, 'News:Source')) || limpiar(tag(it, 'source')) || origen,
      fecha: new Date(limpiar(tag(it, 'pubDate')) || Date.now()).toISOString(),
      imagen: img ? img.replace(/&amp;/g, '&') : '',
      tema: consulta
    };
  }).filter(n => n.titulo && n.link);
}

async function main() {
  let todas = [];
  for (const q of CONSULTAS) {
    const e = encodeURIComponent(q);
    try { todas.push(...parsear(await traer(`https://www.bing.com/news/search?q=${e}&format=rss&setlang=es-CO&cc=CO`), q, 'Bing')); }
    catch (err) { console.log('Bing falló:', q, err.message); }
    try { todas.push(...parsear(await traer(`https://news.google.com/rss/search?q=${e}&hl=es-419&gl=CO&ceid=CO:es-419`), q, 'Google News')); }
    catch (err) { console.log('Google falló:', q, err.message); }
  }

  let previas = [];
  try { previas = JSON.parse(await readFile('data/noticias.json', 'utf8')).noticias || []; } catch {}
  const vistos = new Set();
  const TEMA = /\bSAE\b|Activos Especiales|Fondo Nacional del Ahorro|\bFNA\b|remate|subasta|extinci[oó]n de dominio/i;
  const unicas = [...todas, ...previas].filter(n => TEMA.test(n.titulo + ' ' + n.resumen)).filter(n => {
    const k = n.titulo.toLowerCase().replace(/[^a-záéíóúñ0-9]/g, '').slice(0, 70);
    if (vistos.has(k)) return false; vistos.add(k); return true;
  }).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 80);

  await writeFile('data/noticias.json', JSON.stringify({ actualizado: new Date().toISOString(), total: unicas.length, noticias: unicas }, null, 2));
  console.log('Noticias guardadas:', unicas.length);


}
main();
