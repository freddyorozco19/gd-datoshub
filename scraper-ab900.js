/**
 * Scraper AB-900: Microsoft 365 Copilot and Agent Administration Fundamentals
 * Fuente: https://examcademy.com/exams/microsoft/ab-900
 * 88 preguntas — 4 páginas de 25 + 1 de 13
 */
const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const LOGIN_URL  = 'https://auth.examcademy.com/u/login?state=hKFo2SBvVk9qUnZuRXAweG96cU8yclVzMkl5Q2JYSEVILXpNbqFur3VuaXZlcnNhbC1sb2dpbqN0aWTZIHR1SzJGcWNHOHJnVjYwVVluc3hpVnBqdmdEUHIxV1Vno2NpZNkgZU9vckF1VjVsZERxeGtuOVY0MGczdWVodW94b3RRSVA';
const BASE_URL   = 'https://examcademy.com/exams/microsoft/ab-900';
const OUT_FILE   = path.join(__dirname, 'public', 'data', 'exam_ab900.json');
const LINKS_FILE = path.join(__dirname, 'public', 'data', 'exam_ab900_links.json');
const IMGS_DIR   = path.join(__dirname, 'public', 'data', 'images', 'ab900');
const MAX_PAGES  = 4; // 88 preguntas / ~25 por página

if (!fs.existsSync(IMGS_DIR)) fs.mkdirSync(IMGS_DIR, { recursive: true });

let examData = fs.existsSync(OUT_FILE)
  ? JSON.parse(fs.readFileSync(OUT_FILE, 'utf-8'))
  : { examTitle: 'AB-900: Microsoft 365 Copilot and Agent Administration Fundamentals', totalQuestions: 0, scrapedAt: '', questions: [] };

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
  // MC/dropdown: necesita respuesta y texto
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
  console.log(`=== Scraper AB-900: Microsoft 365 Copilot & Agent Admin Fundamentals ===`);
  console.log(`Preguntas ya guardadas: ${questions.length}\n`);

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--start-maximized'],
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

  if (allQuestionUrls.length < 85) {
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
        await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await sleep(rand(2000, 3000));

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
            // Abrir el select trigger — puede ser span.select.inline o button.select-trigger.boxed
            const trigger = page.locator('span.select.inline, button.select-trigger.boxed, button.select-trigger, span.select-trigger').first();
            if (await trigger.count() > 0) {
              await trigger.click({ timeout: 3000 });
              await sleep(1000);
            }
            // Capturar opciones del menú desplegado
            dropdownOptions = await page.evaluate(() => {
              const letters = ['A', 'B', 'C', 'D', 'E'];
              // ExamCademy usa un portal div.select-menu en body (sin li, texto por líneas)
              const menu = document.querySelector('div.select-menu');
              if (menu) {
                const lines = (menu.innerText || '').trim().split('\n')
                  .map(l => l.trim()).filter(l => l.length > 0);
                if (lines.length >= 2) {
                  return lines.slice(0, 5).map((l, i) => `${letters[i]}. ${l}`);
                }
              }
              // Fallback: buscar items con clase select-option
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
          // Para multi-dropdown: abrir el primer SELECT... boxed para capturar la lista de opciones
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

        // ── Descartar cookie consent (bloquea el click si es la 1ª pregunta) ───
        try {
          const cookieDialog = page.locator('div.cookie-consent, [role="dialog"][class*="cookie"]');
          if (await cookieDialog.count() > 0) {
            // Intentar botón de rechazo/aceptar; si falla, forzar ocultamiento via JS
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
        }

        const q = await page.evaluate(({ preDropdownOpts, wasMultiDropdown, mdOpts }) => {
          // ── Formato A: opciones tipo botón mc-option ───────────────────────
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

          // ── Formato D: multi-dropdown — ANTES de Format B para capturar todas las filas ─
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

          // ── Formato B: dropdown fill-in-the-blank (ExamCademy custom) ──────
          // Corre si hay dropdown, NO es multi-dropdown, y aún no hay respuesta
          if (!wasMultiDropdown && dropdownQ && !correctAnswer) {
            // Opciones: solo usar preDropdownOpts si Format A no encontró nada
            if (options.length === 0 && preDropdownOpts && preDropdownOpts.length > 0) {
              options.push(...preDropdownOpts);
            }
            // Respuesta correcta: span.dropdown-correct-answer → "→ Microsoft Defender XDR"
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
              // Si no encontramos match, guardar la respuesta literal para referencia
              if (!correctAnswer) correctAnswer = rawAns;
            }
          }

          // ── Formato C: Yes or No (tabla con statements) ───────────────────
          const bodyFull = document.body.innerText;
          // Detectar por tabla específica de ExamCademy
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
                // Texto del statement: td.statements-statement span, o primer td
                const stmtEl = row.querySelector('td.statements-statement span, td.statements-statement, td:first-child');
                const stmtText = (stmtEl?.innerText || '').trim();
                if (!stmtText || stmtText.length < 5) continue;

                // Respuesta correcta: la celda cuya label tiene clase "statements-opt-missed"
                // ExamCademy usa "opted-missed" para marcar la opción correcta (la que no deberías perder)
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

          // ── Texto de la pregunta ──────────────────────────────────────────
          let questionText = '';
          const bodyText = bodyFull;

          // Para formato Yes/No: extraer instrucción
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

          // Para formato dropdown: construir desde div.dropdown-prose o innerText del bloque
          // (excluir multi-dropdown — su texto viene de bodyText, no de dropdownQ.innerText)
          if (dropdownQ && !wasMultiDropdown) {
            const instruction = (dropdownQ.querySelector('p.dropdown-instruction')?.innerText || '').trim();
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
                } else if (node.classList?.contains('dropdown-field')) {
                  parts.push('[___]');
                }
              });
              questionText = (instruction ? instruction + ' ' : '') + parts.join(' ').replace(/\s{2,}/g, ' ').trim();
            }
            // Fallback: usar el texto visible del bloque dropdown excluyendo elementos de UI
            if (!questionText || questionText.length < 20) {
              try {
                const dqClone = dropdownQ.cloneNode(true);
                dqClone.querySelectorAll('span.select, .select-menu, span.dropdown-correct-answer, .btn-lead, button').forEach(el => el.remove());
                const dqText = (dqClone.innerText || '').replace(/\s+/g, ' ').trim();
                if (dqText && dqText.length > 10 && !/EXAM\s*CADEMY/i.test(dqText)) {
                  questionText = (instruction ? instruction + ' ' : '') + dqText;
                }
              } catch (_) {}
            }
          }

          // Para multi-dropdown: texto antes del primer "Select" label del dropdown
          if ((questionType === 'multi-dropdown' || wasMultiDropdown) && (!questionText || questionText.length < 20)) {
            const m = bodyText.match(/Question\n+\d+\n+[^\n]+\n+([\s\S]+?)\n+Select\b/);
            if (m) questionText = m[1].replace(/\n/g, ' ').trim();
          }

          // Para formato mc: extraer desde body text o el bloque de opciones
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

          // ── Explicación ────────────────────────────────────────────────────
          let explanation = '';
          const explMatch = bodyText.match(/EXPLANATION\n+([\s\S]+?)(?:\nLEARN MORE|\nCommunity Discussion|\n\d+\s*Community)/);
          if (explMatch) explanation = explMatch[1].replace(/\n/g, ' ').trim();

          // ── Learn More links ───────────────────────────────────────────────
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

          // ── Imágenes (excluir nav/UI) ──────────────────────────────────────
          const imageInfos = [];
          const skipSelectors = 'nav, header, footer, [class*="navbar"], [class*="sidebar"], [class*="logo"], [class*="icon"], [class*="avatar"]';
          for (const img of Array.from(document.querySelectorAll('img'))) {
            if (img.closest(skipSelectors)) continue;
            const src = img.src || '';
            if (!src || src.startsWith('data:image/svg') || src.includes('favicon')) continue;
            const rect = img.getBoundingClientRect();
            if (rect.width > 0 && rect.width < 40 && rect.height > 0 && rect.height < 40) continue;
            const inOption    = !!img.closest('button.mc-option');
            const optBtn      = img.closest('button.mc-option');
            const optionLetter = optBtn ? (optBtn.querySelector('.btn-lead')?.innerText || '').trim() : null;
            imageInfos.push({ src, alt: img.alt || '', inOption, optionLetter });
          }

          // ── Formato E: hotspot/imagen — respuesta en texto de explicación ──
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
        }, { preDropdownOpts: dropdownOptions, wasMultiDropdown: isMultiDropdown, mdOpts: mdDropdownOptions });

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
              path: `/data/images/ab900/${filename}`,
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
        await sleep(rand(4000, 8000));
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
