/**
 * Scraper AB-730: Microsoft AI Business Professional
 * Fuente: https://examcademy.com/exams/microsoft/ab-730
 * 92 preguntas — 4 páginas de 25 + 1 de 17
 */
const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const LOGIN_URL  = 'https://auth.examcademy.com/u/login?state=hKFo2SBvVk9qUnZuRXAweG96cU8yclVzMkl5Q2JYSEVILXpNbqFur3VuaXZlcnNhbC1sb2dpbqN0aWTZIHR1SzJGcWNHOHJnVjYwVVluc3hpVnBqdmdEUHIxV1Vno2NpZNkgZU9vckF1VjVsZERxeGtuOVY0MGczdWVodW94b3RRSVA';
const BASE_URL   = 'https://examcademy.com/exams/microsoft/ab-730';
const OUT_FILE   = path.join(__dirname, 'public', 'data', 'exam_ab730.json');
const LINKS_FILE = path.join(__dirname, 'public', 'data', 'exam_ab730_links.json');
const IMGS_DIR   = path.join(__dirname, 'public', 'data', 'images', 'ab730');
const MAX_PAGES  = 4;

if (!fs.existsSync(IMGS_DIR)) fs.mkdirSync(IMGS_DIR, { recursive: true });

let examData = fs.existsSync(OUT_FILE)
  ? JSON.parse(fs.readFileSync(OUT_FILE, 'utf-8'))
  : { examTitle: 'AB-730: Microsoft AI Business Professional', totalQuestions: 0, scrapedAt: '', questions: [] };

const good = examData.questions.filter(q => {
  if (q.questionType === 'yes-no') {
    return q.statements && q.statements.some(s => s.answer === 'Yes' || s.answer === 'No');
  }
  if (q.questionType === 'multi-dropdown') {
    return q.statements && q.statements.some(s => s.answer && s.answer.length > 0);
  }
  if (q.questionType === 'hotspot') {
    return !!q.correctAnswer;
  }
  return q.correctAnswer && q.questionText && q.questionText.length > 20;
});
if (good.length < examData.questions.length) {
  console.log(`[LIMPIEZA] Descartando ${examData.questions.length - good.length} inválidas. Manteniendo ${good.length}.`);
  examData.questions = good;
}

const questions = examData.questions;
const doneNums  = new Set(questions.map(q => q.number));

function save() {
  examData.questions.sort((a, b) => parseInt(a.number) - parseInt(b.number));
  examData.totalQuestions = questions.length;
  examData.scrapedAt = new Date().toISOString();
  fs.writeFileSync(OUT_FILE, JSON.stringify(examData, null, 2));
}

const clean = (s) => (s || '').replace(/\r\n|\r|\n/g, ' ').replace(/\s{2,}/g, ' ').trim();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rand  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

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
  } catch (e) {}
  return false;
}

(async () => {
  console.log(`=== Scraper AB-730: Microsoft AI Business Professional ===`);
  console.log(`Preguntas ya guardadas: ${questions.length}\n`);

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--no-sandbox', '--disable-blink-features=AutomationControlled', '--start-maximized',
      '--disable-gpu', '--disable-dev-shm-usage', '--disable-extensions',
      '--disable-audio-output', '--renderer-process-limit=1',
      '--js-flags=--max-old-space-size=256',
    ],
    slowMo: 30,
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
    timezoneId: 'America/Bogota',
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    window.chrome = { runtime: {} };
  });
  const page = await context.newPage();

  console.log('========================================');
  console.log('  Abriendo formulario de login...');
  console.log('  Ingresa usuario y contraseña manualmente.');
  console.log('  NO CIERRES LA VENTANA.');
  console.log('========================================\n');

  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForURL(/^https:\/\/examcademy\.com/, { timeout: 600000 });
  await page.waitForLoadState('domcontentloaded');
  console.log('[OK] Login detectado:', page.url(), '\n');
  await sleep(rand(3000, 5000));

  // ── PASO 1: recolectar enlaces ────────────────────────────────────────────
  const allQuestionUrls = [];
  let cachedLinkCount = 0;

  if (fs.existsSync(LINKS_FILE)) {
    const cached = JSON.parse(fs.readFileSync(LINKS_FILE, 'utf-8'));
    allQuestionUrls.push(...cached);
    cachedLinkCount = cached.length;
    console.log(`[PASO 1] Cargados ${cachedLinkCount} enlaces desde caché`);
  }

  const pagesAlreadyDone = Math.floor(cachedLinkCount / 25);

  if (allQuestionUrls.length < 90) {
    const startPage = pagesAlreadyDone + 1;
    console.log(`[PASO 1] Recolectando desde página ${startPage}/${MAX_PAGES}...`);

    for (let p = startPage; p <= MAX_PAGES; p++) {
      let rateLimitRetries = 3;
      while (rateLimitRetries-- > 0) {
        await page.goto(`${BASE_URL}/${p}`, { waitUntil: 'load', timeout: 60000 });
        await sleep(rand(5000, 8000));

        let bodySnippet = '';
        try { bodySnippet = await page.evaluate(() => document.body.innerText.slice(0, 300)); } catch (_) {}

        if (/too many requests/i.test(bodySnippet)) {
          const waitSec = rand(45, 75);
          console.log(`  [RATE LIMIT] Página ${p} — esperando ${waitSec}s...`);
          await sleep(waitSec * 1000);
          continue;
        }

        const links = await page.evaluate(() =>
          Array.from(document.querySelectorAll('.qa-question-heading__link, a[href*="/q/"]'))
            .map(a => ({ href: a.href }))
            .filter(l => l.href.includes('/q/'))
        );

        if (links.length === 0) {
          console.log(`  [WARN] Página ${p}: 0 enlaces, reintentando...`);
          await sleep(rand(10000, 15000));
          continue;
        }

        console.log(`  Página ${p}/${MAX_PAGES}: ${links.length} enlaces`);
        allQuestionUrls.push(...links);
        fs.writeFileSync(LINKS_FILE, JSON.stringify(allQuestionUrls, null, 2));
        break;
      }

      if (p < MAX_PAGES) await sleep(rand(12000, 20000));
    }

    console.log(`\n[OK] Total enlaces recolectados: ${allQuestionUrls.length}\n`);
  } else {
    console.log(`[PASO 1] Caché completa — omitiendo recolección\n`);
  }

  // ── PASO 2: visitar cada pregunta ────────────────────────────────────────
  console.log('[PASO 2] Extrayendo preguntas...\n');

  for (let i = 0; i < allQuestionUrls.length; i++) {
    const { href } = allQuestionUrls[i];
    const numMatch = href.match(/\/q\/(\d+)-/);
    const num = numMatch ? numMatch[1] : String(i + 1);

    if (doneNums.has(num)) {
      process.stdout.write(`  [SKIP] Q${num}\r`);
      continue;
    }

    let retries = 2;
    while (retries-- > 0) {
      try {
        // Interceptar peticiones CDN antes de navegar
        const cdnNetworkUrls = [];
        const onReq = req => {
          const u = req.url();
          if (u.includes('cdn.examcademy.com/images/questions')) cdnNetworkUrls.push(u);
        };
        page.on('request', onReq);

        await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await sleep(rand(2000, 3000));
        // Scroll para activar lazy load de imágenes
        await page.evaluate(() => window.scrollBy(0, 400));
        await sleep(600);
        await page.evaluate(() => window.scrollTo(0, 0));
        await sleep(400);
        page.off('request', onReq);

        // ── Detectar formato ANTES de SHOW ANSWER ────────────────────────────
        let dropdownOptions = [];
        const { isDropdown, isYesNo, isMultiDropdown } = await page.evaluate(() => ({
          isDropdown: !!document.querySelector('div.dropdown-question'),
          isMultiDropdown: document.querySelectorAll('div.dropdown-question div.dropdown-row').length > 1,
          isYesNo: !!document.querySelector('table.statements-table') ||
                   /for each statement.*select yes/i.test(document.body.innerText.slice(0, 3000)),
        }));
        let mdDropdownOptions = [];
        if (isDropdown && !isMultiDropdown) {
          try {
            const trigger = page.locator('span.select.inline, button.select-trigger.boxed, button.select-trigger, span.select-trigger').first();
            if (await trigger.count() > 0) {
              await trigger.click({ timeout: 3000 });
              await sleep(1000);
            }
            dropdownOptions = await page.evaluate(() => {
              const letters = ['A', 'B', 'C', 'D', 'E'];
              const menu = document.querySelector('div.select-menu');
              if (menu) {
                const lines = (menu.innerText || '').trim().split('\n')
                  .map(l => l.trim()).filter(l => l.length > 0);
                if (lines.length >= 2) {
                  return lines.slice(0, 5).map((l, i) => `${letters[i]}. ${l}`);
                }
              }
              const items = Array.from(document.querySelectorAll(
                '[class*="select-option"], [class*="selectOption"]'
              )).filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.width > 40 && rect.height > 5;
              });
              return items.slice(0, 5).map((el, i) => `${letters[i]}. ${(el.innerText || '').trim()}`);
            });
            await page.keyboard.press('Escape');
            await sleep(400);
          } catch (_) {}
        }

        if (isMultiDropdown) {
          try {
            const firstTrigger = page.locator('button.select-trigger.boxed').first();
            if (await firstTrigger.count() > 0) {
              await firstTrigger.click({ force: true, timeout: 3000 });
              await sleep(1000);
              mdDropdownOptions = await page.evaluate(() => {
                const menu = document.querySelector('div.select-menu');
                if (menu) {
                  const lines = (menu.innerText || '').trim().split('\n')
                    .map(l => l.trim()).filter(l => l.length > 0);
                  if (lines.length >= 2) return lines;
                }
                const items = Array.from(document.querySelectorAll('[class*="select-option"], [class*="selectOption"]'))
                  .filter(el => { const r = el.getBoundingClientRect(); return r.width > 40 && r.height > 5; });
                return items.map(el => (el.innerText || '').trim()).filter(t => t.length > 0);
              });
              await page.keyboard.press('Escape');
              await sleep(400);
            }
          } catch (_) {}
        }

        // ── Descartar cookie consent ──────────────────────────────────────────
        try {
          const cookieDialog = page.locator('div.cookie-consent, [role="dialog"][class*="cookie"]');
          if (await cookieDialog.count() > 0) {
            const cookieBtn = page.locator('div.cookie-consent button, [role="dialog"][class*="cookie"] button').first();
            if (await cookieBtn.count() > 0) {
              await cookieBtn.click({ force: true, timeout: 2000 });
            } else {
              await page.evaluate(() => {
                const d = document.querySelector('div.cookie-consent, [role="dialog"][class*="cookie"]');
                if (d) d.style.display = 'none';
              });
            }
            await sleep(500);
          }
        } catch (_) {}

        // ── Clic SHOW ANSWER ──────────────────────────────────────────────────
        let clicked = false;
        try {
          await page.locator('button', { hasText: /show answer/i }).first().click({ force: true, timeout: 5000 });
          clicked = true;
        } catch (_) {
          try {
            await page.locator('text=/show answer/i').first().click({ force: true, timeout: 3000 });
            clicked = true;
          } catch (_2) {}
        }

        if (clicked) {
          try {
            await page.waitForFunction(
              () => !!(document.body && /hide answer/i.test(document.body.innerText)),
              null, { timeout: 5000 }
            );
          } catch (_) {}
          await sleep(rand(1500, 2500));
          await page.evaluate(() => window.scrollBy(0, 600));
          await sleep(600);
          await page.evaluate(() => window.scrollTo(0, 0));
          await sleep(400);
        }

        const q = await page.evaluate(({ preDropdownOpts, wasMultiDropdown, mdOpts, networkCdnUrls }) => {
          const optBtns = Array.from(document.querySelectorAll('button.mc-option'));
          const options = [];
          let correctAnswer = '';
          let questionType = 'mc';
          let ynStatements = [];
          for (const btn of optBtns) {
            const letter = (btn.querySelector('.btn-lead')?.innerText || '').trim();
            const text   = (btn.querySelector('.mc-option__body')?.innerText || '').trim();
            if (letter && /^[A-E]$/.test(letter)) {
              options.push(`${letter}. ${text || '[imagen]'}`);
              if (btn.classList.contains('warning')) correctAnswer += letter;
            }
          }

          const dropdownQ = document.querySelector('div.dropdown-question');

          if (wasMultiDropdown) {
            questionType = 'multi-dropdown';
            const dropdownList = document.querySelector('div.dropdown-question div.dropdown-list');
            if (dropdownList) {
              const rows = Array.from(dropdownList.querySelectorAll('div.dropdown-row'));
              for (const row of rows) {
                const stmtText = (row.querySelector('.dropdown-label span, .dropdown-label')?.innerText || '').trim();
                const ansEl = row.querySelector('span.dropdown-correct-answer');
                const ansText = (ansEl?.innerText || '').replace(/^[→>]\s*/, '').trim();
                ynStatements.push({ text: stmtText, answer: ansText });
              }
              if (ynStatements.some(s => s.answer)) {
                correctAnswer = ynStatements.map(s => s.answer).join(', ');
              }
            }
          }

          if (!wasMultiDropdown && dropdownQ && !correctAnswer) {
            if (options.length === 0 && preDropdownOpts && preDropdownOpts.length > 0) {
              options.push(...preDropdownOpts);
            }
            const correctEl = dropdownQ.querySelector('span.dropdown-correct-answer');
            if (correctEl) {
              const rawAns = (correctEl.innerText || '').replace(/^[→>]\s*/, '').trim();
              const letters = ['A', 'B', 'C', 'D', 'E'];
              for (let i = 0; i < options.length; i++) {
                const optText = options[i].replace(/^[A-E]\.\s*/, '').trim();
                if (optText.toLowerCase() === rawAns.toLowerCase() ||
                    optText.toLowerCase().includes(rawAns.toLowerCase()) ||
                    rawAns.toLowerCase().includes(optText.toLowerCase())) {
                  correctAnswer = letters[i];
                  break;
                }
              }
              if (!correctAnswer) correctAnswer = rawAns;
            }
          }

          const bodyFull = document.body.innerText;
          const stmtsTable = document.querySelector('table.statements-table');
          const isYNFmt = options.length === 0 && ynStatements.length === 0 && (
            !!stmtsTable ||
            /for each statement.*select yes/i.test(bodyFull.slice(0, 4000)) ||
            /yes\s*or\s*no/i.test(bodyFull.slice(0, 2000))
          );
          if (isYNFmt) {
            questionType = 'yes-no';
            const table = stmtsTable || document.querySelector('table');
            if (table) {
              const rows = Array.from(table.querySelectorAll('tr.statements-row, tbody tr')).filter(r => !r.closest('thead'));
              for (const row of rows) {
                const stmtEl = row.querySelector('td.statements-statement span, td.statements-statement, td:first-child');
                const stmtText = (stmtEl?.innerText || '').trim();
                if (!stmtText || stmtText.length < 5) continue;
                const optCells = Array.from(row.querySelectorAll('td.statements-opt, td:not(:first-child)'));
                let answer = '';
                if (optCells[0]?.querySelector('label.statements-opt-missed')) answer = 'Yes';
                else if (optCells[1]?.querySelector('label.statements-opt-missed')) answer = 'No';
                ynStatements.push({ text: stmtText, answer });
              }
            }
            if (ynStatements.length > 0) {
              correctAnswer = ynStatements.map(s => s.answer).join(', ');
            }
          }

          let questionText = '';
          const bodyText = bodyFull;

          const examContent = document.querySelector('div.exam-content, div.question-content, [class*="exam-content"]');
          if (examContent && !wasMultiDropdown && questionType !== 'yes-no' && !dropdownQ) {
            const contentText = (examContent.innerText || '').trim();
            const afterQ = contentText.replace(/^[\s\S]*?(?=\bQuestion\s*\n)/i, '');
            const m = afterQ.match(/Question\s*\n+\d+\s*\n+[^\n]+\n+([\s\S]+?)\n+[A-E](?:\n|\.\s)/);
            if (m) {
              const candidate = m[1].replace(/\n/g, ' ').trim();
              if (candidate.length > 15 && !/EXAM\s*CADEMY/i.test(candidate)) {
                questionText = candidate;
              }
            }
          }

          if (questionType === 'yes-no') {
            const instrEl = document.querySelector(
              'p.question-instruction, .question-instruction, .yn-instruction, [class*="question-text"]'
            );
            if (instrEl) {
              questionText = (instrEl.innerText || '').trim();
            } else {
              const m = bodyText.match(/for each statement[\s\S]{0,200}?select (yes|no)/i);
              if (m) questionText = m[0].replace(/\n/g, ' ').trim();
            }
            if (!questionText) questionText = 'For each statement, select Yes when it is true. Otherwise, select No.';
          }

          if (dropdownQ && !wasMultiDropdown) {
            const instruction = (dropdownQ.querySelector('p.dropdown-instruction, .dropdown-instruction')?.innerText || '').trim();
            const prose = dropdownQ.querySelector('div.dropdown-prose');
            if (prose) {
              const parts = [];
              prose.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) {
                  const t = node.textContent.trim();
                  if (t) parts.push(t);
                } else if (node.classList?.contains('dropdown-prose-text')) {
                  const t = (node.innerText || '').trim();
                  if (t) parts.push(t);
                } else if (node.classList?.contains('dropdown-field') ||
                           node.querySelector?.('[class*="dropdown-field"]')) {
                  parts.push('[___]');
                } else {
                  const t = (node.innerText || '').trim();
                  if (t && t !== 'Select' && t !== 'Select...') parts.push(t);
                }
              });
              questionText = (instruction ? instruction + ' ' : '') + parts.join(' ').replace(/\s{2,}/g, ' ').trim();
            }
            if (!questionText || questionText.length < 20) {
              try {
                const dqClone = dropdownQ.cloneNode(true);
                // Reemplazar dropdown-field con [___] antes de limpiar
                dqClone.querySelectorAll('[class*="dropdown-field"], [class*="dropdownField"], div.dropdown-select').forEach(el => {
                  el.textContent = '[___]';
                });
                dqClone.querySelectorAll('span.select, .select-menu, span.dropdown-correct-answer, .btn-lead, button').forEach(el => el.remove());
                let dqText = (dqClone.innerText || '').replace(/Explanation[\s\S]*$/, '').replace(/\s+/g, ' ').trim();
                // Eliminar prefijo "Select" si sobrevivió
                dqText = dqText.replace(/^\s*Select\s+/i, '').replace(/^\s*Selectin\s+/i, 'in ').trim();
                if (dqText && dqText.length > 10 && !/EXAM\s*CADEMY/i.test(dqText)) {
                  questionText = (instruction ? instruction + ' ' : '') + dqText;
                }
              } catch (_) {}
            }
          }

          if ((questionType === 'multi-dropdown' || wasMultiDropdown) && (!questionText || questionText.length < 20)) {
            const m = bodyText.match(/Question\n+\d+\n+[^\n]+\n+([\s\S]+?)\n+Select\b/);
            if (m) questionText = m[1].replace(/\n/g, ' ').trim();
          }

          if (!questionText || questionText.length < 20) {
            const qMatch = bodyText.match(/Question\n+\d+\n+[^\n]+\n+([\s\S]+?)\n+[A-E]\n/);
            if (qMatch) questionText = qMatch[1].replace(/\n/g, ' ').trim();
          }
          if (!questionText || questionText.length < 20 || /EXAM\s*CADEMY/i.test(questionText)) {
            if (optBtns[0]) {
              const qBlock = optBtns[0].closest('main, [role="main"]');
              if (qBlock) {
                const m = (qBlock.innerText || '').match(/\n([\s\S]+?)\n+[A-E]\./);
                if (m) questionText = m[1].replace(/\n/g, ' ').trim();
              }
            }
          }
          // Si sigue con breadcrumb (EXAM CADEMY), extraer desde el breadcrumb mismo
          if (/EXAM\s*CADEMY/i.test(questionText)) {
            const m = bodyText.match(/Question\s+\d+\s*\n+[^\n]+\n+([\s\S]+?)\n+[A-E]\./);
            if (m) {
              const candidate = m[1].replace(/\n/g, ' ').trim();
              if (!(/EXAM\s*CADEMY/i.test(candidate)) && candidate.length > 15) {
                questionText = candidate;
              }
            }
            if (/EXAM\s*CADEMY/i.test(questionText)) {
              // Último intento: extraer del patrón en el breadcrumb
              const m2 = bodyText.match(/\/\s*(.{20,300}?)\s*\n+Question\s+\d+/);
              if (m2 && !(/EXAM\s*CADEMY/i.test(m2[1]))) questionText = m2[1].trim();
            }
          }

          let explanation = '';
          const explMatch = bodyText.match(/EXPLANATION\n+([\s\S]+?)(?:\nLEARN MORE|\nCommunity Discussion|\n\d+\s*Community)/);
          if (explMatch) explanation = explMatch[1].replace(/\n/g, ' ').trim();

          const learnMore = [];
          const lmSection = document.querySelector('[class*="learn-more"], [class*="learnMore"], [class*="learn_more"]');
          if (lmSection) {
            lmSection.querySelectorAll('a').forEach(a => {
              const txt = (a.innerText || '').trim();
              if (txt) learnMore.push({ text: txt, url: a.href || '' });
            });
          }
          if (learnMore.length === 0) {
            const lmMatch = bodyText.match(/LEARN MORE\n+([\s\S]+?)(?:\nCommunity Discussion|\n\d+\s*Community|\nHelp us)/);
            if (lmMatch) {
              lmMatch[1].split('\n').map(l => l.trim()).filter(l => l.length > 3).forEach(l => learnMore.push(l));
            }
          }

          // Limpiar questionText: quitar prefijos residuales de dropdown
          if (questionText) {
            questionText = questionText
              .replace(/^Select\s+/i, '')
              .replace(/^Selectin\s+/i, 'in ')
              .replace(/\s*Explanation\s*[\s\S]*$/, '')
              .replace(/\s{2,}/g, ' ')
              .trim();
          }

          // Imágenes: network interception (CDN) + DOM fallback
          const CDN_PATTERN = 'cdn.examcademy.com/images/questions';
          const imageInfos = [];
          const seen = new Set();

          // 1) URLs capturadas por network interception (más fiable que el DOM)
          for (const src of (networkCdnUrls || [])) {
            if (seen.has(src)) continue;
            seen.add(src);
            imageInfos.push({ src, alt: '', inOption: false, optionLetter: null });
          }

          // 2) <img src="...cdn..."> (por si network interception no la captó)
          const cdnImgs = Array.from(document.querySelectorAll('img'))
            .filter(i => i.src && i.src.includes(CDN_PATTERN));
          for (const img of cdnImgs) {
            if (seen.has(img.src)) continue;
            seen.add(img.src);
            const inOption = !!img.closest('button.mc-option');
            const optBtn = img.closest('button.mc-option');
            const optionLetter = optBtn ? (optBtn.querySelector('.btn-lead')?.innerText || '').trim() : null;
            imageInfos.push({ src: img.src, alt: img.alt || '', inOption, optionLetter });
          }

          // 3) background-image CSS
          const skipBg = 'nav, header, footer, [class*="navbar"], [class*="sidebar"], [class*="logo"], [class*="avatar"]';
          for (const el of Array.from(document.querySelectorAll('*'))) {
            if (el.closest(skipBg)) continue;
            const bg = window.getComputedStyle(el).backgroundImage || '';
            const m = bg.match(/url\(["']?(https?:\/\/[^"')]+cdn\.examcademy\.com\/images\/questions[^"')]+)["']?\)/i);
            if (m && !seen.has(m[1])) {
              seen.add(m[1]);
              imageInfos.push({ src: m[1], alt: el.getAttribute('aria-label') || '', inOption: false, optionLetter: null });
            }
          }

          if (imageInfos.length === 0) {
            const skipSelectors = 'nav, header, footer, [class*="navbar"], [class*="sidebar"], [class*="logo"], [class*="avatar"], [class*="user-avatar"]';
            for (const img of Array.from(document.querySelectorAll('img'))) {
              if (img.closest(skipSelectors)) continue;
              const src = img.src || '';
              if (!src || src.startsWith('data:image/svg') || src.includes('favicon')) continue;
              const rect = img.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0 && rect.width < 60 && rect.height < 60) continue;
              const inOption = !!img.closest('button.mc-option');
              const optBtn = img.closest('button.mc-option');
              const optionLetter = optBtn ? (optBtn.querySelector('.btn-lead')?.innerText || '').trim() : null;
              imageInfos.push({ src, alt: img.alt || '', inOption, optionLetter });
            }
          }

          if (!correctAnswer && options.length === 0 && ynStatements.length === 0 && explanation) {
            const m = explanation.match(/\bSelect\s+([^.]{3,60})\./i)
                   || explanation.match(/\bChoose\s+([^.]{3,60})\./i)
                   || explanation.match(/\bClick\s+([^.]{3,60})\./i)
                   || explanation.match(/\bUse\s+([A-Z][^.]{2,59})\./i)
                   || explanation.match(/\bSet\s+.{0,30}?\bto\s+([A-Z][a-zA-Z\s]+?)(?:\s+and\b|\s*\.)/i)
                   || explanation.match(/^([A-Z][a-zA-Z\s]{5,59}?)\s+(?:can\b|is\b|are\b|will\b|allows?\b)/);
            if (m) {
              correctAnswer = m[1].trim();
              questionType = 'hotspot';
            }
          }

          return { options, correctAnswer, questionText, explanation, learnMore, imageInfos, questionType, ynStatements, dropdownOpts: mdOpts };
        }, { preDropdownOpts: dropdownOptions, wasMultiDropdown: isMultiDropdown, mdOpts: mdDropdownOptions, networkCdnUrls: cdnNetworkUrls });

        // Patch hardcodeado para preguntas cuya extracción falló en batches anteriores
        const KNOWN_TEXT = {
          '21': 'You open Microsoft 365 Copilot, as illustrated in the following exhibit. What can be inferred about the Standings conversation?',
          '25': 'You use Microsoft 365 Copilot. You discover that one of your conversations used a knowledge source containing confidential information. You need to delete that conversation\'s data without administrative approval. If possible, you must keep your other conversations. What should you use?',
        };
        if (KNOWN_TEXT[num] && (!q.questionText || /EXAM\s*CADEMY/i.test(q.questionText) || q.questionText.length < 20)) {
          q.questionText = KNOWN_TEXT[num];
          console.log(`    [PATCH] questionText de Q${num} aplicado desde lista conocida`);
        }

        // ── Descargar imágenes ─────────────────────────────────────────────
        const images = [];
        for (const [idx, imgInfo] of q.imageInfos.entries()) {
          const urlPath = imgInfo.src.split('?')[0];
          const rawExt  = urlPath.split('.').pop().toLowerCase();
          const validExts = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
          const ext = validExts.includes(rawExt) ? rawExt : 'png';
          const filename = `q${num}_img${idx}.${ext}`;
          const ok = await downloadImage(page, imgInfo.src, filename);
          if (ok) {
            images.push({
              path: `/data/images/ab730/${filename}`,
              alt: imgInfo.alt,
              inOption: imgInfo.inOption,
              optionLetter: imgInfo.optionLetter || null,
            });
            console.log(`    [IMG] ${filename} (${imgInfo.inOption ? `opción ${imgInfo.optionLetter}` : 'pregunta'})`);
          }
        }

        const entry = {
          number:        num,
          questionType:  q.questionType || 'mc',
          questionText:  clean(q.questionText),
          translation:   '',
          options:       q.options.map(o => clean(o)),
          correctAnswer: clean(q.correctAnswer),
          ...(q.ynStatements && q.ynStatements.length > 0 ? { statements: q.ynStatements } : {}),
          ...(q.dropdownOpts && q.dropdownOpts.length > 0 ? { dropdownOptions: q.dropdownOpts } : {}),
          explanation:   clean(q.explanation),
          learnMore:     q.learnMore,
          images,
        };

        questions.push(entry);
        doneNums.add(num);

        const ansLabel = entry.correctAnswer ? `→ ${entry.correctAnswer}` : '(sin resp)';
        const typeTag  = { 'yes-no':'[YN]', 'multi-dropdown':'[MD]', 'hotspot':'[HS]', 'mc':'[MC]' }[entry.questionType] || '[?]';
        console.log(`  Q${num} [${i+1}/${allQuestionUrls.length}] ${typeTag}: ${entry.questionText.slice(0, 50)}… ${ansLabel}`);
        console.log(`    Opciones: ${entry.options.length} | Statements: ${entry.statements?.length || 0} | Imágenes: ${images.length}`);

        if (questions.length % 5 === 0) save();
        // Limpiar DOM entre preguntas para reducir memoria
        try { await page.goto('about:blank', { timeout: 3000 }); } catch (_) {}
        await sleep(rand(3000, 6000));
        break;

      } catch (err) {
        console.log(`  [ERROR] Q${num}: ${err.message.slice(0, 100)}`);
        await sleep(3000);
      }
    }
  }

  const withAns = questions.filter(q => q.correctAnswer).length;
  console.log(`\n=== COMPLETADO ===`);
  console.log(`Total: ${questions.length} | Con respuesta: ${withAns} | Imágenes: ${fs.readdirSync(IMGS_DIR).length}`);
  save();
  await browser.close();
})();
