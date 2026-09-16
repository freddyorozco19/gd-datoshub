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

const good = examData.questions.filter(q =>
  // MC/dropdown con respuesta y texto
  (q.correctAnswer && q.questionText && q.questionText.length > 20) ||
  // Yes/No con al menos un statement capturado
  (q.questionType === 'yes-no' && q.statements && q.statements.length > 0)
);
if (good.length < examData.questions.length) {
  console.log(`[LIMPIEZA] Descartando ${examData.questions.length - good.length} inválidas. Manteniendo ${good.length}.`);
  examData.questions = good;
}

const questions = examData.questions;
const doneNums  = new Set(questions.map(q => q.number));

function save() {
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
        const { isDropdown, isYesNo } = await page.evaluate(() => ({
          isDropdown: !!document.querySelector('div.dropdown-question'),
          isYesNo: /for each statement.*select yes/i.test(document.body.innerText.slice(0, 3000)) ||
                   /yes\s*or\s*no/i.test(document.body.innerText.slice(0, 1500)),
        }));
        if (isDropdown) {
          try {
            // Abrir el inline select trigger (span.select.inline)
            const trigger = page.locator('span.select.inline, span.select-trigger').first();
            if (await trigger.count() > 0) {
              await trigger.click({ timeout: 3000 });
              await sleep(1000);
            }
            // Capturar opciones del menú desplegado
            dropdownOptions = await page.evaluate(() => {
              const letters = ['A', 'B', 'C', 'D', 'E'];
              // Buscar items del menú flotante
              const items = Array.from(document.querySelectorAll(
                '[class*="select-option"], [class*="selectOption"], ' +
                '[class*="option-row"], [class*="optionRow"], ' +
                'ul.select-options li, ul.options li, ' +
                '[class*="select-list"] li, [class*="dropdown"] li, ' +
                '[class*="select-menu"] li, [class*="selectMenu"] li, ' +
                '[class*="menu-list"] li, [class*="menuList"] li'
              )).filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.width > 40 && rect.height > 5 && !el.closest('nav,header,footer');
              });
              return items.slice(0, 5).map((el, i) => `${letters[i]}. ${(el.innerText || '').trim()}`);
            });
            await page.keyboard.press('Escape');
            await sleep(400);
          } catch (_) {}
        }

        // ── Clic SHOW ANSWER ──────────────────────────────────────────────────
        let clicked = false;
        try {
          await page.locator('button', { hasText: /show answer/i }).first().click({ timeout: 5000 });
          clicked = true;
        } catch (_) {
          try {
            await page.locator('text=/show answer/i').first().click({ timeout: 3000 });
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

        const q = await page.evaluate((preDropdownOpts) => {
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

          // ── Formato B: dropdown fill-in-the-blank (ExamCademy custom) ──────
          const dropdownQ = document.querySelector('div.dropdown-question');
          if (options.length === 0 && dropdownQ) {
            // Opciones: usar las capturadas antes de SHOW ANSWER
            if (preDropdownOpts && preDropdownOpts.length > 0) {
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
          const isYNFmt = options.length === 0 && (
            /for each statement.*select yes/i.test(bodyFull.slice(0, 4000)) ||
            /yes\s*or\s*no/i.test(bodyFull.slice(0, 2000))
          );
          if (isYNFmt) {
            questionType = 'yes-no';
            // Encontrar la tabla con statements
            const tables = Array.from(document.querySelectorAll('table'));
            for (const table of tables) {
              const headerText = (table.querySelector('thead, tr:first-child')?.innerText || '').toLowerCase();
              // Confirmar que es tabla de Yes/No
              if (!headerText.includes('yes') && !headerText.includes('statement') && !headerText.includes('no')) continue;

              const dataRows = Array.from(table.querySelectorAll('tbody tr, tr')).filter(r => {
                const t = (r.innerText || '').trim().toLowerCase();
                // Saltar fila de header
                return t.length > 5 && !/^statements?\s*(yes)?\s*(no)?$/.test(t) && !r.closest('thead');
              });

              for (const row of dataRows) {
                const cells = Array.from(row.querySelectorAll('td'));
                if (cells.length < 3) continue;
                const stmtText = (cells[0]?.innerText || '').trim();
                if (!stmtText || stmtText.length < 5) continue;

                let answer = '';
                // Intento 1: inputs radio checked
                const radios = Array.from(row.querySelectorAll('input[type="radio"], [role="radio"]'));
                for (const radio of radios) {
                  const chk = radio.checked ||
                    radio.getAttribute('aria-checked') === 'true' ||
                    radio.classList.contains('selected') ||
                    radio.classList.contains('is-selected') ||
                    radio.classList.contains('correct') ||
                    radio.classList.contains('is-correct');
                  if (chk) {
                    const val = (radio.getAttribute('value') || radio.getAttribute('aria-label') || '').toLowerCase();
                    answer = /yes/i.test(val) ? 'Yes' : /no/i.test(val) ? 'No' : '';
                    if (!answer) {
                      // Por posición: celda index 1 = Yes, index 2 = No
                      const cellIdx = cells.indexOf(radio.closest('td'));
                      if (cellIdx === 1) answer = 'Yes';
                      else if (cellIdx === 2) answer = 'No';
                    }
                    break;
                  }
                }
                // Intento 2: clase en la celda Yes/No
                if (!answer) {
                  const yesCell = cells[1];
                  const noCell  = cells[2];
                  const classNames = ['selected', 'correct', 'is-correct', 'checked', 'is-checked', 'active', 'is-active', 'answered', 'highlight'];
                  const hasClass = (el, cls) => cls.some(c => el.classList.contains(c) || el.querySelector('.' + c));
                  if (hasClass(yesCell, classNames)) answer = 'Yes';
                  else if (hasClass(noCell, classNames)) answer = 'No';
                }
                // Intento 3: detectar por color inline o data-* atributos
                if (!answer) {
                  const yesCell = cells[1];
                  const noCell  = cells[2];
                  if (yesCell.getAttribute('data-answer') === 'true' || yesCell.getAttribute('data-correct') === 'true') answer = 'Yes';
                  else if (noCell.getAttribute('data-answer') === 'true' || noCell.getAttribute('data-correct') === 'true') answer = 'No';
                }
                ynStatements.push({ text: stmtText, answer });
              }
              if (ynStatements.length > 0) break;
            }

            // Fallback: si no encontramos tabla, intentar con divs/listas que tengan Yes/No
            if (ynStatements.length === 0) {
              // Buscar cualquier elemento que contenga "Yes" y "No" como botones/radios cerca de texto
              const stmtEls = Array.from(document.querySelectorAll(
                '[class*="statement"], [class*="yn-row"], [class*="row-item"]'
              )).filter(el => {
                const t = (el.innerText || '').trim();
                return t.length > 10 && !el.closest('nav,header,footer,thead');
              });
              for (const el of stmtEls) {
                const text = (el.innerText || '').split(/yes|no/i)[0].trim();
                const hasYes = /yes/i.test(el.innerHTML);
                const hasNo  = /no/i.test(el.innerHTML);
                const selectedYes = el.querySelector('[class*="selected"][class*="yes"], [data-value="yes"][class*="select"], [aria-selected="true"]:first-child');
                const selectedNo  = el.querySelector('[class*="selected"][class*="no"],  [data-value="no"][class*="select"]');
                const answer = selectedYes ? 'Yes' : selectedNo ? 'No' : '';
                if (text && hasYes && hasNo) ynStatements.push({ text, answer });
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

          // Para formato dropdown: construir desde span.dropdown-prose-text + campo blank
          if (dropdownQ && options.length > 0) {
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

          return { options, correctAnswer, questionText, explanation, learnMore, imageInfos, questionType, ynStatements };
        }, dropdownOptions);

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
          explanation:   clean(q.explanation),
          learnMore:     q.learnMore,
          images,
        };

        questions.push(entry);
        doneNums.add(num);

        const ansLabel = entry.correctAnswer ? `→ ${entry.correctAnswer}` : '(sin resp)';
        const typeTag  = entry.questionType === 'yes-no' ? '[YN]' : entry.questionType === 'mc' ? '[MC]' : '[?]';
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
