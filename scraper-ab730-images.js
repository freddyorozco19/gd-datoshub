/**
 * Mini-scraper: captura imágenes de Q21 y Q76 en AB-730
 * Busca TODAS las imágenes (sin filtro CDN) y las descarga
 */
const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const LOGIN_URL = 'https://auth.examcademy.com/u/login?state=hKFo2SBvVk9qUnZuRXAweG96cU8yclVzMkl5Q2JYSEVILXpNbqFur3VuaXZlcnNhbC1sb2dpbqN0aWTZIHR1SzJGcWNHOHJnVjYwVVluc3hpVnBqdmdEUHIxV1Vno2NpZNkgZU9vckF1VjVsZERxeGtuOVY0MGczdWVodW94b3RRSVA';
const OUT_FILE  = path.join(__dirname, 'public', 'data', 'exam_ab730.json');
const IMGS_DIR  = path.join(__dirname, 'public', 'data', 'images', 'ab730');

const TARGETS = [
  { num: '21', url: 'https://examcademy.com/exams/microsoft/ab-730/q/21-manage-prompts-and-conversations-by-using-ai' },
  { num: '76', url: 'https://examcademy.com/exams/microsoft/ab-730/q/76-manage-prompts-and-conversations-by-using-ai' },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function downloadImage(page, src, filename) {
  try {
    const bytes = await page.evaluate(async (imgSrc) => {
      try {
        const resp = await fetch(imgSrc, { credentials: 'include' });
        if (!resp.ok) return null;
        const buf = await resp.arrayBuffer();
        return Array.from(new Uint8Array(buf));
      } catch (e) { return null; }
    }, src);
    if (bytes && bytes.length > 500) {
      fs.writeFileSync(path.join(IMGS_DIR, filename), Buffer.from(bytes));
      return true;
    }
  } catch (_) {}
  return false;
}

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--start-maximized'],
    slowMo: 30,
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  console.log('Abriendo login... ingresa credenciales y espera.');
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForURL(/^https:\/\/examcademy\.com/, { timeout: 600000 });
  console.log('[OK] Login\n');
  await sleep(3000);

  const examData = JSON.parse(fs.readFileSync(OUT_FILE, 'utf-8'));

  for (const { num, url } of TARGETS) {
    console.log(`\n=== Q${num} ===`);

    // Interceptar peticiones de red para capturar URLs CDN
    const cdnRequests = [];
    const onRequest = req => {
      const u = req.url();
      if (u.includes('cdn.examcademy.com/images/questions')) cdnRequests.push(u);
    };
    page.on('request', onRequest);

    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await sleep(3000);

    // Scroll para activar lazy load
    await page.evaluate(() => window.scrollBy(0, 600));
    await sleep(2000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(1000);

    page.off('request', onRequest);
    console.log(`URLs CDN interceptadas: ${cdnRequests.length}`);
    cdnRequests.forEach(u => console.log(' ', u));

    // Descargar todas las URLs CDN interceptadas como imágenes del exhibit
    if (cdnRequests.length > 0) {
      const images = [];
      for (const [idx, src] of cdnRequests.entries()) {
        const ext = src.split('?')[0].split('.').pop().toLowerCase();
        const filename = `q${num}_img${idx}.${['png','jpg','jpeg','gif','webp'].includes(ext) ? ext : 'png'}`;
        const ok = await downloadImage(page, src, filename);
        if (ok) {
          images.push({ path: `/data/images/ab730/${filename}`, alt: '', inOption: false });
          console.log(`  [DESCARGADA] ${filename}`);
        }
      }
      if (images.length > 0) {
        const q = examData.questions.find(q => q.number === num);
        if (q) { q.images = images; console.log(`  [JSON] Q${num} → ${images.length} imagen(es)`); }
      }
      continue; // si encontramos CDN, no hace falta el fallback DOM
    }

    // Fallback: buscar en DOM (<img> y background-image)
    const allImgs = await page.evaluate(() => {
      const skip = 'nav, header, footer, [class*="navbar"], [class*="sidebar"], [class*="logo"], [class*="avatar"]';
      const CDN = 'cdn.examcademy.com/images/questions';
      const seen = new Set();
      const results = [];

      // <img> tags
      for (const img of document.querySelectorAll('img')) {
        if (img.closest(skip)) continue;
        const src = img.src || '';
        if (!src || src.startsWith('data:image/svg') || src.includes('favicon')) continue;
        if (seen.has(src)) continue;
        seen.add(src);
        results.push({ src, alt: img.alt, w: img.naturalWidth, h: img.naturalHeight, isCDN: src.includes(CDN), inOption: !!img.closest('button.mc-option') });
      }

      // background-image CSS
      for (const el of document.querySelectorAll('*')) {
        if (el.closest(skip)) continue;
        const bg = window.getComputedStyle(el).backgroundImage || '';
        const m = bg.match(/url\(["']?(https?:\/\/[^"')]+)["']?\)/i);
        if (m && !seen.has(m[1])) {
          seen.add(m[1]);
          results.push({ src: m[1], alt: '', w: el.offsetWidth, h: el.offsetHeight, isCDN: m[1].includes(CDN), inOption: false });
        }
      }

      return results;
    });

    const cdnImgs = allImgs.filter(i => i.isCDN);
    console.log(`Imágenes totales: ${allImgs.length} | CDN: ${cdnImgs.length}`);
    allImgs.forEach(img => console.log(`  ${img.isCDN ? '[CDN]':'[other]'} [${img.w}x${img.h}] ${img.src.substring(0, 100)}`));

    // Candidatas: CDN primero, sino todas las que no sean iconos
    const candidates = cdnImgs.length > 0
      ? cdnImgs.filter(i => !i.inOption)
      : allImgs.filter(i => !i.inOption && (i.w > 100 || i.h > 100) && !i.src.includes('favicon') && !i.src.includes('logo'));

    console.log(`\nCandidatas a exhibit: ${candidates.length}`);

    const images = [];
    for (const [idx, img] of candidates.entries()) {
      const ext = img.src.split('?')[0].split('.').pop().toLowerCase();
      const validExts = ['png','jpg','jpeg','gif','webp'];
      const fileExt = validExts.includes(ext) ? ext : 'png';
      const filename = `q${num}_img${idx}.${fileExt}`;
      const ok = await downloadImage(page, img.src, filename);
      if (ok) {
        images.push({ path: `/data/images/ab730/${filename}`, alt: img.alt || '', inOption: false });
        console.log(`  [DESCARGADA] ${filename} (${img.w}x${img.h})`);
      } else {
        console.log(`  [FALLO] ${img.src.substring(0, 80)}`);
      }
    }

    if (images.length > 0) {
      const q = examData.questions.find(q => q.number === num);
      if (q) {
        q.images = images;
        console.log(`  [JSON] Q${num} actualizada con ${images.length} imagen(es)`);
      }
    }
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(examData, null, 2));
  console.log('\n=== LISTO ===');
  await browser.close();
})();
