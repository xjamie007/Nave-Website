/* ==================================================================
   NAVE – Script fir all Säiten
   Sproochen, Animatiounen, Menü, Formulairen a Modalen.
   ================================================================== */
(function () {
    'use strict';

    /* ------------------------------------------------------------------
       KONFIGURATIOUN
       CONTACT_EMAIL = d'Adress, op déi d'Ufroe vum Formulaire geschéckt ginn.
       Wann d'Adress geännert gëtt, muss de Formulaire eemol geschéckt ginn.
       FormSubmit schéckt dann eng Aktivéierungsmail op déi nei Adress.
       Dee Link muss ugeklickt ginn, soss kommen d'Ufroen net un.
       ------------------------------------------------------------------ */
    const CONTACT_EMAIL = 'nave.advisory@gmail.com';
    const SITE_URL = 'https://nave.lu/';

    // Standardsprooch, wann een d'Säit fir d'éischt opmécht.
    // De Lëtzebuerger Text steet direkt am HTML, déi aner Sproochen an i18n.js.
    const DEFAULT_LANG = 'lu';
    const LANGS = ['lu', 'de', 'fr', 'en'];
    const HTML_LANG = { lu: 'lb', de: 'de', fr: 'fr', en: 'en' };
    const NUMBER_LOCALE = { lu: 'de-LU', de: 'de-DE', fr: 'fr-LU', en: 'en-GB' };
    const OG_LOCALE = { lu: 'lb_LU', de: 'de_DE', fr: 'fr_FR', en: 'en_GB' };

    // Signal fir de Sécherheetsnetz am <head>: d'Script leeft
    window.NAVE_READY = true;

    const root = document.documentElement;
    const body = document.body;
    const I18N = window.NAVE_I18N || {};
    const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const FINE_POINTER = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const $ = (sel, ctx) => (ctx || document).querySelector(sel);
    const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

    const store = {
        get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
        set(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* privat Modus */ } }
    };

    /* ==================================================================
       1. SPROOCHEN
       data-i18n="key"        -> Text vum Element
       data-i18n-html="key"   -> HTML vum Element (fir <strong>, <a> …)
       data-i18n-attr="attribut:key; attribut2:key2"
       De Lëtzebuerger Text gëtt beim Lueden aus dem HTML gelies.
       ================================================================== */

    const LU = Object.assign({}, I18N.lu || {});
    let currentLang = DEFAULT_LANG;

    function normalise(text) {
        return text.replace(/\s+/g, ' ').trim();
    }

    function captureDefaults() {
        $$('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            if (!(key in LU)) LU[key] = normalise(el.textContent);
        });
        $$('[data-i18n-html]').forEach(el => {
            const key = el.dataset.i18nHtml;
            if (!(key in LU)) LU[key] = el.innerHTML.trim();
        });
        $$('[data-i18n-attr]').forEach(el => {
            parseAttrMap(el).forEach(([attr, key]) => {
                if (!(key in LU) && el.hasAttribute(attr)) LU[key] = el.getAttribute(attr);
            });
        });
    }

    function parseAttrMap(el) {
        return el.dataset.i18nAttr.split(';')
            .map(pair => pair.split(':').map(s => s.trim()))
            .filter(pair => pair.length === 2 && pair[0] && pair[1]);
    }

    function t(key, lang) {
        const l = lang || currentLang;
        const dict = l === DEFAULT_LANG ? LU : I18N[l];
        let value = dict && dict[key] != null ? dict[key] : LU[key];
        if (value == null) return key;
        return String(value)
            .replace(/\{email\}/g, CONTACT_EMAIL)
            .replace(/\{year\}/g, String(new Date().getFullYear()));
    }

    function applyLanguage(lang, save) {
        if (!LANGS.includes(lang)) lang = DEFAULT_LANG;
        currentLang = lang;
        root.lang = HTML_LANG[lang];

        $$('[data-i18n]').forEach(el => {
            el.textContent = t(el.dataset.i18n);
            if (el.hasAttribute('data-split')) splitWords(el);
        });
        $$('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
        $$('[data-i18n-attr]').forEach(el => {
            parseAttrMap(el).forEach(([attr, key]) => el.setAttribute(attr, t(key)));
        });

        $$('.lang-switch button').forEach(btn => {
            btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang));
        });

        updateInternalLinks();
        updateUrlAndCanonical();
        renderCounters();
        buildFaqSchema();
        if (save) store.set('selectedLang', lang);

        document.dispatchEvent(new CustomEvent('nave:lang', { detail: { lang } }));
    }

    // Intern Linken kréien ?lang=…, domat d'Sprooch beim Wiessele vun der Säit bleift
    // (och wann de Browser kee localStorage erlaabt) an Google all Versioun fënnt.
    function updateInternalLinks() {
        $$('a[href]').forEach(a => {
            const href = a.getAttribute('href');
            if (!href || /^(https?:|mailto:|tel:|#|javascript:)/i.test(href)) return;
            const match = href.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
            if (!match) return;
            const path = match[1];
            if (!(path === './' || path === '/' || /\.html$/.test(path))) return;
            const params = new URLSearchParams((match[2] || '').slice(1));
            if (currentLang === DEFAULT_LANG) params.delete('lang');
            else params.set('lang', currentLang);
            const query = params.toString();
            a.setAttribute('href', path + (query ? '?' + query : '') + (match[3] || ''));
        });
    }

    function updateUrlAndCanonical() {
        try {
            const url = new URL(window.location.href);
            if (currentLang === DEFAULT_LANG) url.searchParams.delete('lang');
            else url.searchParams.set('lang', currentLang);
            if (url.href !== window.location.href) history.replaceState(history.state, '', url.href);
        } catch (e) { /* z. B. bei file:// */ }

        const path = body.dataset.path;
        if (path == null) return; // 404-Säit: keng canonical
        let link = $('link[rel="canonical"]');
        if (!link) {
            link = document.createElement('link');
            link.rel = 'canonical';
            document.head.appendChild(link);
        }
        link.href = SITE_URL + path + (currentLang === DEFAULT_LANG ? '' : '?lang=' + currentLang);

        const ogUrl = $('meta[property="og:url"]');
        if (ogUrl) ogUrl.setAttribute('content', link.href);
        const ogLocale = $('meta[property="og:locale"]');
        if (ogLocale) ogLocale.setAttribute('content', OG_LOCALE[currentLang]);
    }

    function initLanguage() {
        captureDefaults();
        const fromUrl = new URLSearchParams(window.location.search).get('lang');
        const saved = store.get('selectedLang');
        const lang = LANGS.includes(fromUrl) ? fromUrl : (LANGS.includes(saved) ? saved : DEFAULT_LANG);
        applyLanguage(lang, LANGS.includes(fromUrl));

        $$('.lang-switch button').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.lang === currentLang) return;
                applyLanguage(btn.dataset.lang, true);
                replayTitles();
            });
        });
    }

    /* ---- Wierder an eenzel Spans opdeelen (Titel-Animatioun, Liichttext) ---- */
    function splitWords(el) {
        const words = el.textContent.trim().split(/\s+/);
        el.textContent = '';
        words.forEach((word, i) => {
            const outer = document.createElement('span');
            outer.className = 'w';
            outer.style.setProperty('--i', i);
            const inner = document.createElement('i');
            inner.textContent = word;
            outer.appendChild(inner);
            el.appendChild(outer);
            if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
        });
    }

    function replayTitles() {
        $$('.split-words.is-in').forEach(el => {
            el.classList.remove('is-in');
            void el.offsetWidth;
            requestAnimationFrame(() => el.classList.add('is-in'));
        });
        updateHighlights();
    }

    /* ==================================================================
       2. INTRO: beim éischte Besuch just d'Logo, dann hieft sech d'Säit
       ================================================================== */
    const INTRO_MIN_MS = 1900;
    const INTRO_MAX_MS = 5000;

    function runIntro(done) {
        const intro = $('#intro');
        const skip = !intro || root.classList.contains('intro-seen') || REDUCED;
        if (skip) {
            if (intro) intro.remove();
            done();
            return;
        }

        try { sessionStorage.setItem('naveIntro', '1'); } catch (e) { /* egal */ }
        body.classList.add('intro-open');

        let finished = false;
        const started = performance.now();

        function finish() {
            if (finished) return;
            finished = true;
            intro.classList.add('lift');
            body.classList.remove('intro-open');
            done();
            setTimeout(() => intro.remove(), 1200);
        }

        function ready() {
            setTimeout(finish, Math.max(0, INTRO_MIN_MS - (performance.now() - started)));
        }

        const logo = intro.querySelector('img');
        if (logo && !logo.complete) {
            logo.addEventListener('load', ready, { once: true });
            logo.addEventListener('error', ready, { once: true });
        } else {
            ready();
        }
        setTimeout(finish, INTRO_MAX_MS);
    }

    /* ==================================================================
       3. SCROLL-ANIMATIOUNEN
       .reveal spillt bei all Duerchgang nei of (rëm eraus = Klass ewech).
       ================================================================== */
    function initReveal() {
        const targets = $$('.reveal, .reveal-scale, .split-words');
        if (!('IntersectionObserver' in window) || REDUCED) {
            targets.forEach(el => el.classList.add('is-in'));
            return;
        }
        const io = new IntersectionObserver(entries => {
            entries.forEach(entry => entry.target.classList.toggle('is-in', entry.isIntersecting));
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
        targets.forEach(el => io.observe(el));
    }

    /* ---- Alles, wat direkt um Scroll hänkt, an engem eenzege Frame ---- */
    const scrollTasks = [];
    let ticking = false;

    function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            ticking = false;
            scrollTasks.forEach(task => task());
        });
    }

    function initScrollEffects() {
        const header = $('.site-header');
        scrollTasks.push(() => header && header.classList.toggle('is-scrolled', window.scrollY > 8));

        // Hero: Inhalt gëtt beim Scrollen méi kleng a blend aus
        const heroes = $$('[data-hero]');
        if (heroes.length && !REDUCED) {
            scrollTasks.push(() => {
                heroes.forEach(hero => {
                    const r = hero.getBoundingClientRect();
                    if (r.bottom < 0) return;
                    const p = clamp(-r.top / (r.height * 0.8), 0, 1);
                    hero.style.setProperty('--hp', p.toFixed(3));
                });
            });
        }

        // Gestapelt Kaarten: déi ënnescht gëtt kleng, wann déi nächst driwwer rutscht
        const stackCards = $$('.stack-card');
        if (stackCards.length && !REDUCED) {
            scrollTasks.push(() => {
                stackCards.forEach((card, i) => {
                    const next = stackCards[i + 1];
                    if (!next) return;
                    const gap = next.getBoundingClientRect().top - card.getBoundingClientRect().top;
                    const p = clamp(1 - gap / card.offsetHeight, 0, 1);
                    card.style.setProperty('--sp', p.toFixed(3));
                });
            });
        }

        // Zäitstrahl: Linn fëllt sech, Schrëtt ginn aktiv
        const timelines = $$('[data-timeline]');
        if (timelines.length) {
            scrollTasks.push(() => {
                const mark = window.innerHeight * 0.62;
                timelines.forEach(tl => {
                    const r = tl.getBoundingClientRect();
                    tl.style.setProperty('--tp', clamp((mark - r.top) / r.height, 0, 1).toFixed(3));
                    $$('.t-step', tl).forEach(step => {
                        const num = step.querySelector('.t-num');
                        const top = (num || step).getBoundingClientRect().top;
                        step.classList.toggle('is-active', top < mark);
                    });
                });
            });
        }

        scrollTasks.push(updateHighlights);
        initLocalNav();

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        onScroll();
    }

    // Grousse Saz: Wuert fir Wuert gëtt beim Scrollen hell
    function updateHighlights() {
        $$('[data-highlight]').forEach(el => {
            const words = $$('.w', el);
            if (!words.length) return;
            if (REDUCED) {
                words.forEach(w => w.classList.add('on'));
                return;
            }
            const r = el.getBoundingClientRect();
            const vh = window.innerHeight;
            const p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.35), 0, 1);
            const lit = Math.round(p * words.length);
            words.forEach((w, i) => w.classList.toggle('on', i < lit));
        });
    }

    // Lokal Navigatioun: weist, a wéi enger Sektioun een ass
    function initLocalNav() {
        const nav = $('.local-nav');
        if (!nav) return;
        const links = $$('a[href^="#"]', nav);
        const sections = links.map(a => $(a.getAttribute('href'))).filter(Boolean);
        const list = $('ul', nav);
        let active = null;

        scrollTasks.push(() => {
            const line = nav.getBoundingClientRect().bottom + 80;
            let current = null;
            sections.forEach(sec => { if (sec.getBoundingClientRect().top <= line) current = sec; });
            const link = current ? links[sections.indexOf(current)] : null;
            if (link === active) return;
            if (active) active.classList.remove('is-active');
            active = link;
            if (link) {
                link.classList.add('is-active');
                const target = link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2;
                list.scrollTo({ left: Math.max(0, target), behavior: REDUCED ? 'auto' : 'smooth' });
            }
        });
    }

    /* ==================================================================
       4. ZUELEN, DÉI EROPZIELEN
       data-count="70" data-format="percent|currency|number"
       ================================================================== */
    function formatNumber(value, format) {
        const locale = NUMBER_LOCALE[currentLang] || 'de-LU';
        if (format === 'percent') {
            return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(value / 100);
        }
        if (format === 'currency') {
            return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
        }
        return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
    }

    // data-num: Zuel just an der aktueller Sprooch formatéieren (ouni Animatioun)
    function renderCounters() {
        $$('[data-count], [data-num]').forEach(el => {
            const value = Number(el.dataset.count || el.dataset.num);
            el.textContent = formatNumber(value, el.dataset.format);
        });
    }

    function initCounters() {
        const counters = $$('[data-count]');
        if (!counters.length || REDUCED || !('IntersectionObserver' in window)) return;

        const io = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const el = entry.target;
                const target = Number(el.dataset.count);
                const from = Number(el.dataset.from || 0);
                const duration = 1400;
                const start = performance.now();
                function frame(now) {
                    const k = clamp((now - start) / duration, 0, 1);
                    const eased = 1 - Math.pow(1 - k, 3);
                    el.textContent = formatNumber(Math.round(from + (target - from) * eased), el.dataset.format);
                    if (k < 1) requestAnimationFrame(frame);
                }
                requestAnimationFrame(frame);
            });
        }, { threshold: 0.6 });
        counters.forEach(el => io.observe(el));
    }

    /* ==================================================================
       5. SME-RECHNER
       ================================================================== */
    function initCalculator() {
        const calc = $('[data-calc]');
        if (!calc) return;

        const MIN = 3000;
        const MAX = 25000;
        const RATE = 0.7;
        const range = $('input[type="range"]', calc);
        const input = $('input[type="number"]', calc);
        const hint = $('.calc-hint', calc);
        const out = name => $('[data-calc-out="' + name + '"]', calc);
        let amount = Number(range.value);

        // fromInput: de Benotzer tippt grad, d'Feld net iwwerschreiwen
        function render(value, fromInput) {
            const raw = Number(value);
            const valid = Number.isFinite(raw) && raw > 0;
            amount = valid ? clamp(Math.round(raw), MIN, MAX) : amount;

            if (!fromInput) input.value = amount;
            range.value = amount;
            range.style.setProperty('--fill', ((amount - MIN) / (MAX - MIN) * 100).toFixed(2) + '%');

            const aid = Math.round(amount * RATE);
            out('aid').textContent = formatNumber(aid, 'currency');
            out('own').textContent = formatNumber(amount - aid, 'currency');
            out('total').textContent = formatNumber(amount, 'currency');

            const outside = fromInput && valid && (raw < MIN || raw > MAX);
            hint.textContent = outside ? t('sme.calc.hint') : '';
        }

        range.addEventListener('input', () => render(range.value, false));
        input.addEventListener('input', () => render(input.value, true));
        input.addEventListener('blur', () => render(amount, false));
        document.addEventListener('nave:lang', () => render(amount, false));
        render(amount, false);
    }

    /* ==================================================================
       6. MENÜ (Handy an Tablet)
       ================================================================== */
    function initMenu() {
        const toggle = $('.menu-toggle');
        const menu = $('#mobileMenu');
        if (!toggle || !menu) return;

        function setMenu(open) {
            body.classList.toggle('menu-open', open);
            toggle.setAttribute('aria-expanded', String(open));
            menu.setAttribute('aria-hidden', String(!open));
            if ('inert' in menu) menu.inert = !open;
        }

        setMenu(false);
        toggle.addEventListener('click', () => setMenu(!body.classList.contains('menu-open')));
        menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && body.classList.contains('menu-open')) {
                setMenu(false);
                toggle.focus();
            }
        });
        window.addEventListener('resize', () => {
            if (window.innerWidth > 1140 && body.classList.contains('menu-open')) setMenu(false);
        });
        window.NAVE_closeMenu = () => setMenu(false);
    }

    /* ==================================================================
       7. MODALEN (Kontakt, Richtlinnen)
       ================================================================== */
    let lastFocus = null;

    function openModal(modal, opener) {
        if (!modal) return;
        lastFocus = opener || document.activeElement;
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        body.classList.add('modal-open');
        setTimeout(() => {
            const first = modal.querySelector('input:not([type="hidden"]):not(.hp-field), select, textarea, button');
            if (first) first.focus({ preventScroll: true });
        }, 80);
    }

    function closeModal(modal) {
        if (!modal || !modal.classList.contains('is-open')) return;
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        if (!$('.modal.is-open')) body.classList.remove('modal-open');
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }

    function initModals() {
        $$('.modal').forEach(modal => {
            modal.addEventListener('click', e => {
                if (e.target === modal || e.target.closest('[data-close]')) closeModal(modal);
            });
            // Fokus bleift am Modal, soulaang et op ass
            modal.addEventListener('keydown', e => {
                if (e.key !== 'Tab') return;
                const items = $$('a[href], button, input, select, textarea', modal)
                    .filter(el => !el.disabled && el.offsetParent !== null && !el.classList.contains('hp-field'));
                if (!items.length) return;
                const first = items[0];
                const last = items[items.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            });
        });

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') $$('.modal.is-open').forEach(closeModal);
        });

        // All Knäppercher mat data-open-contact
        document.addEventListener('click', e => {
            const opener = e.target.closest('[data-open-contact]');
            if (!opener) return;
            e.preventDefault();
            if (window.NAVE_closeMenu) window.NAVE_closeMenu();

            const topic = opener.dataset.topic;
            const inlineForm = $('#contactForm');

            // Op der Kontaktsäit gëtt et de Formulaire schonn op der Säit
            if (inlineForm) {
                if (topic) setTopic(inlineForm, topic);
                inlineForm.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
                setTimeout(() => {
                    const first = $('input:not(.hp-field)', inlineForm);
                    if (first) first.focus({ preventScroll: true });
                }, 500);
                return;
            }

            const modal = $('#contactModal');
            if (topic) setTopic($('form', modal), topic);
            setTimeout(() => openModal(modal, opener), body.classList.contains('menu-open') ? 220 : 0);
        });

        // Richtlinnen
        document.addEventListener('click', e => {
            const link = e.target.closest('[data-policy]');
            if (!link) return;
            e.preventDefault();
            const policy = POLICIES[link.dataset.policy];
            const modal = $('#policyModal');
            if (!policy || !modal) return;
            $('#policyTitle').textContent = policy.title;
            $('#policyContent').innerHTML = policy.content;
            openModal(modal, link);
        });
    }

    function setTopic(form, topic) {
        const select = form && form.querySelector('select[name="topic"]');
        if (select && $$('option', select).some(o => o.value === topic)) select.value = topic;
    }

    /* ==================================================================
       8. FORMULAIRE (FormSubmit)
       ================================================================== */
    function initForms() {
        $$('form[data-contact-form]').forEach(form => {
            const submit = $('.form-submit', form);
            const status = $('.form-status', form);

            function showStatus(type, message) {
                status.textContent = message;
                status.classList.remove('success', 'error');
                status.classList.add('visible', type);
            }

            form.addEventListener('submit', async e => {
                e.preventDefault();
                if (!form.checkValidity()) {
                    form.reportValidity();
                    return;
                }

                const label = submit.textContent;
                submit.disabled = true;
                submit.textContent = t('form.sending');
                status.classList.remove('visible', 'success', 'error');

                const data = Object.fromEntries(new FormData(form).entries());
                const topicSelect = form.querySelector('select[name="topic"]');
                if (topicSelect && topicSelect.selectedIndex > 0) {
                    data.topic = topicSelect.options[topicSelect.selectedIndex].text;
                }
                data.page = document.title;
                data.language = currentLang.toUpperCase();
                data._subject = 'Nei Ufro vun nave.lu (' + currentLang.toUpperCase() + ') - ' +
                    (data.firstName || '') + ' ' + (data.lastName || '') + (data.topic ? ' - ' + data.topic : '');
                data._template = 'table';
                data._captcha = 'false';

                try {
                    const res = await fetch('https://formsubmit.co/ajax/' + CONTACT_EMAIL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                        body: JSON.stringify(data)
                    });

                    // FormSubmit äntwert och bei engem Feeler mat HTTP 200 an
                    // {"success":"false"} am Body. Dofir muss de Body gelies ginn,
                    // soss weist d'Säit gréng "Merci", obwuel näischt ukomm ass.
                    let payload = null;
                    try { payload = await res.json(); } catch (err) { /* kee JSON */ }

                    if (!(res.ok && payload && String(payload.success) === 'true')) {
                        throw new Error((payload && payload.message) || 'HTTP ' + res.status);
                    }

                    form.reset();
                    showStatus('success', t('form.success'));
                } catch (err) {
                    console.error('Formulaire konnt net geschéckt ginn:', err);
                    showStatus('error', t('form.error'));
                } finally {
                    submit.disabled = false;
                    submit.textContent = label;
                }
            });
        });
    }

    /* ==================================================================
       9. COOKIE-BANNER
       ================================================================== */
    function initCookie() {
        const banner = $('.cookie');
        if (!banner) return;
        if (store.get('cookiesAccepted')) {
            banner.remove();
            return;
        }
        setTimeout(() => banner.classList.add('is-visible'), 1200);
        $('[data-cookie-accept]', banner).addEventListener('click', () => {
            store.set('cookiesAccepted', 'true');
            banner.classList.remove('is-visible');
            setTimeout(() => banner.remove(), 900);
        });
    }

    /* ==================================================================
       10. FAQ fir Google (strukturéiert Donnéeën an der aktueller Sprooch)
       ================================================================== */
    function buildFaqSchema() {
        const items = $$('[data-faq] details');
        if (!items.length) return;
        const data = {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            inLanguage: HTML_LANG[currentLang],
            mainEntity: items.map(item => ({
                '@type': 'Question',
                name: normalise($('summary', item).textContent),
                acceptedAnswer: { '@type': 'Answer', text: normalise($('.faq-a', item).textContent) }
            }))
        };
        let script = $('#faq-schema');
        if (!script) {
            script = document.createElement('script');
            script.type = 'application/ld+json';
            script.id = 'faq-schema';
            document.head.appendChild(script);
        }
        script.textContent = JSON.stringify(data);
    }

    /* ==================================================================
       11. MICRO-INTERAKTIOUNEN (just mat der Maus)
       ================================================================== */
    function initPointerEffects() {
        if (!FINE_POINTER || REDUCED) return;

        // Spotlight op de Kaarten
        $$('.spot').forEach(card => {
            card.addEventListener('pointermove', e => {
                const r = card.getBoundingClientRect();
                card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
                card.style.setProperty('--my', (e.clientY - r.top) + 'px');
            });
        });

        // Magnetesch Knäppercher
        $$('.btn-primary').forEach(btn => {
            btn.addEventListener('pointermove', e => {
                const r = btn.getBoundingClientRect();
                const dx = (e.clientX - (r.left + r.width / 2)) * 0.22;
                const dy = (e.clientY - (r.top + r.height / 2)) * 0.3;
                btn.style.translate = dx.toFixed(1) + 'px ' + (dy - 2).toFixed(1) + 'px';
            });
            btn.addEventListener('pointerleave', () => { btn.style.translate = ''; });
        });

        // Eegene Cursor
        const dot = $('.cursor-dot');
        if (!dot) return;
        window.addEventListener('pointermove', e => {
            dot.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)';
            if (e.pointerType === 'mouse') body.classList.add('cursor-on');
        }, { passive: true });
        const hoverSel = 'a, button, summary, label, .tile, input[type="range"]';
        document.addEventListener('pointerover', e => {
            if (e.target.closest(hoverSel)) body.classList.add('cursor-hover');
        });
        document.addEventListener('pointerout', e => {
            if (e.target.closest(hoverSel)) body.classList.remove('cursor-hover');
        });
        document.addEventListener('mouseleave', () => body.classList.remove('cursor-on'));
        document.addEventListener('mouseenter', () => body.classList.add('cursor-on'));
    }

    /* ==================================================================
       12. RICHTLINNEN (Text op Englesch, wéi bis elo)
       ================================================================== */
    const POLICIES = {
        cookies: {
            title: 'Cookie Policy',
            content: `
                <p><strong>Effective Date: October 21, 2025</strong></p>
                <h3>1. Introduction</h3>
                <p>This Cookies Policy explains how Nave ("we," "our," or "us") uses cookies and similar technologies to recognize you when you visit our website nave.lu ("Site"). It explains what these technologies are, why we use them, and your rights to control our use of them.</p>
                <h3>2. What Are Cookies?</h3>
                <p>Cookies are small data files that are placed on your device when you visit a website. Cookies allow the website to recognize your device and remember certain information about your visit, such as your preferences or login status.</p>
                <h3>3. How We Use Cookies</h3>
                <p>We use cookies for several reasons, including:</p>
                <p>Essential Cookies: These cookies are necessary for the website to function properly and enable basic features like navigation.</p>
                <p>Performance Cookies: These cookies collect information about how visitors use our Site to help us improve its performance.</p>
                <p>Functional Cookies: These cookies allow us to remember choices you make (like your language preference) to enhance your experience.</p>
                <p>Advertising and Tracking Cookies: We may use cookies to track your activities on our Site for targeted advertising purposes.</p>
                <h3>4. Third-Party Cookies</h3>
                <p>We may allow third-party service providers, such as advertising partners or analytics providers, to place cookies on your device. These third parties may use their cookies to collect information about your visits to our Site and other websites.</p>
                <h3>5. Managing Cookies</h3>
                <p>You have the right to accept or reject cookies. Most web browsers are set to accept cookies by default. However, you can change your browser settings to block or delete cookies if you prefer.</p>
                <p>Please note that blocking or deleting cookies may impact your experience on the Site, and some features may not work as intended.</p>
                <h3>6. Changes to This Cookies Policy</h3>
                <p>We may update this Cookies Policy from time to time. When we do, we will post the updated policy on this page, and the "Effective Date" will be revised accordingly. Please review this policy periodically to stay informed about our use of cookies.</p>
                <h3>7. Contact Us</h3>
                <p>If you have any questions about this Cookies Policy or how we use cookies, please contact us at:</p>
                <p>Nave</p>
                <p>Email: nave.advisory@gmail.com</p>
                <p>Website: nave.lu</p>`
        },
        terms: {
            title: 'Terms of Use',
            content: `
                <p><strong>Effective Date: October 21, 2025</strong></p>
                <h3>1. Acceptance of Terms</h3>
                <p>By accessing or using the website nave.lu ("Site"), operated by Nave ("we," "our," or "us"), you agree to comply with and be bound by these Terms of Use. If you do not agree to these terms, please do not use this Site.</p>
                <h3>2. Changes to Terms</h3>
                <p>Nave reserves the right to modify, update, or revise these Terms of Use at any time without prior notice. All changes will be posted on this page, and the "Effective Date" will be updated accordingly. It is your responsibility to review these Terms periodically.</p>
                <h3>3. Use of the Site</h3>
                <p>You agree to use the Site only for lawful purposes and in accordance with these Terms. You may not use the Site:</p>
                <p>In any way that violates any applicable local, national, or international law or regulation.</p>
                <p>To transmit any content that is harmful, threatening, abusive, defamatory, or otherwise objectionable.</p>
                <p>To interfere with or disrupt the functioning of the Site, servers, or networks.</p>
                <h3>4. User Account</h3>
                <p>To access certain features of the Site, you may be required to create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately if you suspect any unauthorized use of your account.</p>
                <h3>5. Intellectual Property</h3>
                <p>All content on the Site, including but not limited to text, graphics, logos, images, and software, is the property of Nave and is protected by copyright and other intellectual property laws. You may not use any content from the Site without prior written permission from Nave.</p>
                <h3>6. Limitation of Liability</h3>
                <p>To the fullest extent permitted by applicable law, Nave is not liable for any direct, indirect, incidental, special, or consequential damages arising from the use of or inability to use the Site, including any loss of data or profits.</p>
                <h3>7. Privacy</h3>
                <p>Your use of the Site is also governed by our Privacy Policy, which outlines how we collect, use, and protect your personal information.</p>
                <h3>8. Third-Party Links</h3>
                <p>The Site may contain links to third-party websites. Nave is not responsible for the content, privacy practices, or any other aspect of such websites. We encourage you to review the terms and privacy policies of any third-party sites you visit.</p>
                <h3>9. Termination</h3>
                <p>Nave reserves the right to suspend or terminate your access to the Site at any time, without notice, for conduct that violates these Terms of Use or is harmful to other users, the Site, or our operations.</p>
                <h3>10. Governing Law</h3>
                <p>These Terms of Use are governed by and construed in accordance with the laws of Luxembourg. Any disputes arising from or related to the Site will be subject to the exclusive jurisdiction of the courts of Luxembourg.</p>
                <h3>11. Contact Information</h3>
                <p>If you have any questions about these Terms of Use, please contact us at:</p>
                <p>Nave</p>
                <p>Email: nave.advisory@gmail.com</p>
                <p>Website: nave.lu</p>`
        },
        privacy: {
            title: 'Privacy Policy',
            content: `
                <p><strong>Effective Date: October 21, 2025</strong></p>
                <h3>1. Introduction</h3>
                <p>This Privacy Policy explains how Nave ("we," "our," or "us") collects, uses, and protects your personal information when you visit our website nave.lu ("Site"). By using our Site, you consent to the practices described in this policy.</p>
                <h3>2. Information We Collect</h3>
                <p>We collect personal information that you provide to us directly when you use the Site. This may include:</p>
                <p>Contact Information: Name, email address, and other communication details.</p>
                <p>Account Information: If you create an account, we may collect your username, password, and other account-related information.</p>
                <p>Usage Information: Information about how you use the Site, such as browsing activity, IP address, and device information.</p>
                <h3>3. How We Use Your Information</h3>
                <p>We use the information we collect for the following purposes:</p>
                <p>To provide and improve our services, including personalized experiences.</p>
                <p>To communicate with you, respond to your inquiries, and provide customer support.</p>
                <p>To send you promotional materials, updates, and other communications related to our services (with your consent, if required).</p>
                <p>To monitor and analyze usage trends to improve our Site's functionality.</p>
                <h3>4. How We Protect Your Information</h3>
                <p>We take reasonable measures to protect your personal information from unauthorized access, disclosure, or alteration. However, no method of transmission over the Internet or electronic storage is completely secure, and we cannot guarantee absolute security.</p>
                <h3>5. Sharing Your Information</h3>
                <p>We do not sell, rent, or trade your personal information to third parties. We may share your information in the following situations:</p>
                <p>Service Providers: We may share your information with third-party vendors or service providers who assist us in operating the Site and delivering services to you.</p>
                <p>Legal Requirements: We may disclose your information if required by law, such as to comply with a subpoena, legal process, or government request.</p>
                <p>Business Transfers: If we are involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.</p>
                <h3>6. Your Rights</h3>
                <p>Depending on your location, you may have certain rights regarding your personal information, including:</p>
                <p>The right to access and review the information we hold about you.</p>
                <p>The right to correct any inaccuracies in your information.</p>
                <p>The right to request the deletion of your information (subject to certain exceptions).</p>
                <p>The right to withdraw consent to any processing of your personal information, where applicable.</p>
                <p>If you would like to exercise any of these rights, please contact us using the information provided below.</p>
                <h3>7. Cookies</h3>
                <p>We use cookies and similar technologies to enhance your experience on the Site. For more details, please refer to our Cookies Policy.</p>
                <h3>8. Third-Party Links</h3>
                <p>The Site may contain links to third-party websites. We are not responsible for the privacy practices or the content of those websites. We encourage you to review the privacy policies of any third-party sites you visit.</p>
                <h3>9. Changes to This Privacy Policy</h3>
                <p>We may update this Privacy Policy from time to time. Any changes will be posted on this page, and the "Effective Date" will be revised accordingly. We recommend that you review this policy periodically to stay informed about how we are protecting your personal information.</p>
                <h3>10. Contact Us</h3>
                <p>If you have any questions or concerns about this Privacy Policy, please contact us at:</p>
                <p>Nave</p>
                <p>Email: nave.advisory@gmail.com</p>
                <p>Website: nave.lu</p>`
        }
    };

    /* ==================================================================
       START
       ================================================================== */
    function start() {
        try {
            $$('[data-year]').forEach(el => { el.textContent = String(new Date().getFullYear()); });
            initLanguage();
            initMenu();
            initModals();
            initForms();
            initCookie();
            initCalculator();
            initPointerEffects();

            runIntro(() => {
                body.classList.add('is-ready');
                initReveal();
                initCounters();
                initScrollEffects();
            });
        } catch (err) {
            // Wann eppes schifgeet, soll op d'mannst den Inhalt sichtbar sinn
            console.error(err);
            root.classList.remove('js');
            body.classList.add('is-ready');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
