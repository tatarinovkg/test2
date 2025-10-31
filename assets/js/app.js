const tg = window.Telegram ? window.Telegram.WebApp : null;
    const apiBaseUrl = 'https://tatarinovkg.cloudpub.ru/api/';

    function initTelegramApp(){
        if (!tg) return;
        try{
            tg.ready(); tg.expand();
            applyTelegramTheme();
            tg.onEvent('themeChanged', applyTelegramTheme);
        }catch(e){ console.warn('TG init error', e); }
    }

    function applyTelegramTheme(){
        if (!tg) return;
        const override = localStorage.getItem('themeOverride');
        if (override !== 'user') {
            const isDark = tg.colorScheme === 'dark';
            document.documentElement.classList.toggle('dark', isDark);
        }
        const tp = tg.themeParams || {}; const css = document.documentElement.style;
        if (tp.bg_color) css.setProperty('--app-bg', tp.bg_color);
        if (tp.text_color) css.setProperty('--app-fg', tp.text_color);
        if (tp.secondary_bg_color) css.setProperty('--dd-bg', tp.secondary_bg_color);
        updateThemeIcon();
    }
    function haptic(type='impact', style='light'){
        try{ if(!tg?.HapticFeedback) return; if(type==='impact') tg.HapticFeedback.impactOccurred(style); if(type==='success') tg.HapticFeedback.notificationOccurred('success'); if(type==='error') tg.HapticFeedback.notificationOccurred('error'); }catch{}
    }

    let groupsCache=null, groupsLoading=null; // грузим только при входе на root
    const servicesCache=new Map(); // per group
    const serviceDetailsCache=new Map();
    const feedbacksCache=new Map();
    const groupNameCache = new Map(); // groupId -> name

    document.addEventListener('DOMContentLoaded', () => {
        fastThemeBoot(); initTelegramApp();
        bindHeader();
        initTitleMarquee();
        window.addEventListener('hashchange', routeFromHash);
        routeFromEntry();
    });
    function fastThemeBoot(){
        try{
            const override = localStorage.getItem('themeOverride'); // 'user' | null
            const saved = localStorage.getItem('theme');            // 'dark' | 'light' | null
            if (override === 'user' && saved) {
                document.documentElement.classList.toggle('dark', saved === 'dark');
            } else {
                const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                document.documentElement.classList.toggle('dark', isDark);
            }
            updateThemeIcon();
        }catch{}
    }
    function bindHeader(){
        document.getElementById('openSearch').onclick = ()=> { updateHash({ view: 'search', q: '' }); };
        document.getElementById('themeToggle').onclick = ()=> { toggleTheme(); haptic('impact'); };
        const backBtn = document.getElementById('navBack');
        if (backBtn) backBtn.onclick = ()=> goBackSafe();
    }

    function updateThemeIcon(){
        const isDark=document.documentElement.classList.contains('dark');
        document.getElementById('themeIcon').textContent = isDark? '☀️':'🌙';
    }
    function toggleTheme(){
        const isDark = !document.documentElement.classList.contains('dark');
        document.documentElement.classList.toggle('dark', isDark);
        try{
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            localStorage.setItem('themeOverride', 'user');
        }catch{}
        updateThemeIcon();
    }

    function routeFromEntry() {
        const sp = new URLSearchParams(location.search);
        const path = location.pathname.toLowerCase();
    
        // ✅ Поддержка /open_service?id=123, ?path=open_service&id=123 и ?open_service&id=123
        const isOpenService =
            path.includes('/open_service') ||
            sp.get('path') === 'open_service' ||
            sp.has('open_service');
    
        if (isOpenService) {
            const sid = sp.get('id');
            if (sid && /^\d+$/.test(sid)) {
                // показать загрузочный экран и скрыть обычную кнопку "Назад"
                screen().innerHTML = pageLoading('Загружаем услугу...');
                setHeaderActionsForRoot(false);
                setBackVisible(false);
    
                showServiceScreen(Number(sid)).then(() => {
                    const header = document.querySelector('header .flex.items-center.gap-3');
                    if (!header) return;
    
                    // если старая кнопка "Главное меню" осталась — убрать
                    const existing = document.getElementById('mainMenuBtn');
                    if (existing) existing.remove();
    
                    // создать кнопку "Главное меню"
                    const mainMenuBtn = document.createElement('button');
                    mainMenuBtn.id = 'mainMenuBtn';
                    mainMenuBtn.textContent = 'Главное меню';
                    mainMenuBtn.className =
                        'inline-flex px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800';
                    mainMenuBtn.onclick = () => {
                        mainMenuBtn.remove();
                        // перейти на корень сайта без query и hash
                        const base =
                            location.origin +
                            (location.pathname.endsWith('index.html')
                                ? location.pathname.replace(/index\.html$/, '')
                                : location.pathname.replace(/open_service.*$/, ''));
                        location.href = base;
                    };
    
                    header.prepend(mainMenuBtn);
                });
    
                return;
            }
        }
    
        // 🔹 остальная логика не тронута
        const sid = sp.get('serviceId');
        if (sid && /^\d+$/.test(sid)) {
            setHeaderActionsForRoot(false);
            setBackVisible(true);
            showServiceScreen(Number(sid));
            return;
        }
    
        try {
            const startParam = tg?.initDataUnsafe?.start_param;
            const m = startParam?.match(/(\d{2,})/);
            if (m) {
                setHeaderActionsForRoot(false);
                setBackVisible(true);
                showServiceScreen(Number(m[1]));
                return;
            }
        } catch {}
    
        routeFromHash();
    }
    
    function routeFromHash(){
        const p = new URLSearchParams(location.hash.replace(/^#/, ''));
        const view = p.get('view') || 'groups';
        const groupId = p.get('group') || null;
        const serviceId = p.get('service') || null;
        const q = p.get('q') || '';

        const isRoot = (view === 'groups' && !groupId && !serviceId && !q);

        setHeaderActionsForRoot(isRoot);

        setBackVisible(!isRoot);

        if (view === 'search') { showSearchScreen(q); return; }
        if (serviceId)         { showServiceScreen(serviceId); return; }
        if (groupId)           { showGroupScreen(groupId); return; }
        showGroupsScreen();
    }

    function isRootFromHash(){
        const p = new URLSearchParams(location.hash.replace(/^#/, ''));
        const view = p.get('view') || 'groups';
        const group = p.get('group');
        const service = p.get('service');
        const q = p.get('q');
        return (view === 'groups' && !group && !service && !q);
    }
    
    function updateNavForRoute(){
        const root = isRootFromHash();
        setBackVisible(!root);

        if (!tg) return;
        try {
            if (root) {
                tg.MainButton.setParams({ text: 'Закрыть приложение', is_visible: true });
                tg.MainButton.onClick(() => tg.close());
                tg.MainButton.show();
            } else {
                tg.MainButton.hide();
            }
        } catch(e){ console.warn('MainButton error', e); }
    }

    function updateHash(partial, replace=false){
        const p=new URLSearchParams(location.hash.replace(/^#/,''));
        Object.entries(partial).forEach(([k,v])=>{ if(v===undefined||v===null||v==='') p.delete(k); else p.set(k,v); });
        const next='#'+p.toString(); if(replace) { if(location.hash!==next) history.replaceState(null,'',next); } else { if(location.hash!==next) location.hash=next; }
    }

    const screen = () => document.getElementById('screen');
    function setTitle(text){
        const wrap = document.getElementById('appTitleWrap');
        const h1   = document.getElementById('appTitle');
        const span = document.getElementById('appTitleText');
        if (!wrap || !h1 || !span) return;

        const finalText = text || 'Услуги';
        span.textContent = finalText;
        h1.setAttribute('title', finalText);


        refreshTitleMarquee();
    }

    const TITLE_SPEED = 40;       // пикселей в секунду
    const TITLE_PAUSE = 1;        // секунда паузы на краях

    function refreshTitleMarquee(){
        const wrap = document.getElementById('appTitleWrap');
        const span = document.getElementById('appTitleText');
        const h1   = document.getElementById('appTitle');
        if (!wrap || !span || !h1) return;

        wrap.classList.remove('scrolling');

        if (span.scrollWidth <= wrap.clientWidth + 4) return; // помещается, не крутим

        const shift = wrap.clientWidth - span.scrollWidth - 8; // расстояние с зазором
        const distance = Math.abs(shift);

        const travelTime = distance / TITLE_SPEED;       // чистое время движения
        const totalTime = travelTime + TITLE_PAUSE * 2;  // + пауза на старте и конце

        h1.style.setProperty('--marquee-shift', shift + 'px');
        h1.style.setProperty('--marquee-duration', totalTime + 's');

        void wrap.offsetWidth; // перезапуск анимации
        wrap.classList.add('scrolling');
    }

    function initTitleMarquee(){
        const ro = new ResizeObserver(() => refreshTitleMarquee());
        const wrap = document.getElementById('appTitleWrap');
        const span = document.getElementById('appTitleText');
        if (wrap) ro.observe(wrap);
        if (span) ro.observe(span);
        window.addEventListener('orientationchange', refreshTitleMarquee);
        window.addEventListener('resize', refreshTitleMarquee);
    }

    function setBackVisible(v){
        const btn = document.getElementById('navBack');
        if (!btn) return;
        if (v) {
            btn.classList.remove('hidden');
            btn.style.display = 'inline-flex';
        } else {
            btn.classList.add('hidden');
            btn.style.display = 'none';
        }
    }

    function setHeaderActionsForRoot(isRoot) {
        const searchBtn = document.getElementById('openSearch');
        const themeBtn  = document.getElementById('themeToggle');

        [searchBtn, themeBtn].forEach(el => {
            if (!el) return;
            if (isRoot) {
                el.classList.remove('hidden');
                el.style.display = 'inline-flex';
                el.setAttribute('aria-hidden', 'false');
                el.tabIndex = 0;
            } else {
                el.classList.add('hidden');
                el.style.display = 'none';
                el.setAttribute('aria-hidden', 'true');
                el.tabIndex = -1;
            }
        });
    }


    function goBackSafe(){
        const before = location.href;
        history.back();
        setTimeout(() => {
            if (location.href === before) {
                history.replaceState(null, '', location.pathname + location.search);
                showGroupsScreen();
                routeFromHash();
            }
        }, 120);
    }



    async function showGroupsScreen(){
        setTitle('Услуги');                 // updateNavForRoute уже вызван роутером
        if(!groupsCache){
            screen().innerHTML = pageLoading('Загрузка групп...');
            await fetchGroups();
        }
        renderGroups(groupsCache||[]);
    }

    async function fetchGroups(){
        if(groupsCache || groupsLoading) { await groupsLoading; return groupsCache; }
        groupsLoading = (async()=>{
            try{
                const r = await fetch(apiBaseUrl + 'groups', { method:'POST', headers:{'Content-Type':'application/json'} });
                if(!r.ok) throw new Error('Bad response'); groupsCache = await r.json();
            }catch(e){ screen().innerHTML = pageError('Не удалось загрузить группы.'); console.error(e); }
            finally{ groupsLoading=null; }
        })();
        await groupsLoading; return groupsCache;
    }
    function renderGroups(groups){
        if(!groups?.length){
            screen().innerHTML = emptyState('Группы не найдены','Попробуйте позже.');
            return;
        }
        const wrapper = document.createElement('div');
        wrapper.className = 'grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

        groups.forEach(g => {
            const gid  = getGroupId(g);
            const raw  = getGroupName(g) || '';
            if (gid && raw) groupNameCache.set(String(gid), String(raw));

            const { label, emoji } = extractGroupLabelAndEmoji ? extractGroupLabelAndEmoji(raw) : { label: raw, emoji: '' };

            const card = document.createElement('button');
            card.type = 'button';
            card.className = [
                'svc-card grp-watermark group w-full text-left',
                'rounded-2xl border border-slate-200 dark:border-slate-800',
                'bg-white/95 dark:bg-slate-900/95',
                'px-4 py-4 md:px-4 md:py-4',
                'transition duration-150 ease-out',
                'focus:outline-none focus:ring-2 focus:ring-brand'
            ].join(' ');
            card.setAttribute('data-emoji', emoji || '');

            card.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="min-w-0 flex-1">
          <div class="text-base md:text-[1.05rem] font-semibold leading-snug text-brand break-anywhere">
            ${escapeHTML(label)}
          </div>
        </div>
        <div class="row-chevron svc-chevron shrink-0 opacity-60 transition-transform">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               class="text-slate-400 dark:text-slate-400">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      </div>
    `;

            card.onclick = () => { updateHash({ view:'group', group: gid }); haptic('impact'); };
            wrapper.appendChild(card);
        });

        screen().innerHTML = '';
        screen().appendChild(wrapper);
    }

    function extractGroupLabelAndEmoji(input){
        const s = String(input || '').trim();

        const EMOJI_COMPONENT = '(?:[\\u{1F3FB}-\\u{1F3FF}])?';        // модификаторы кожи
        const VS16 = '\\uFE0F?';                                       // вариационный селектор
        const ZWJ = '\\u200D';                                         // zero-width joiner
        const EMOJI_CORE =
            '(?:' +
            '[\\u{1F1E6}-\\u{1F1FF}]{2}' +                // флаги (две регион. буквы)
            '|' +
            '[\\u{1F600}-\\u{1F64F}]' +                   // смайлики
            '|' +
            '[\\u{1F300}-\\u{1F5FF}]' +                   // символы и пиктограммы
            '|' +
            '[\\u{1F680}-\\u{1F6FF}]' +                   // транспорт/карты
            '|' +
            '[\\u{2600}-\\u{26FF}]' +                     // разное
            '|' +
            '[\\u{2700}-\\u{27BF}]' +                     // дингбаты
            '|' +
            '[\\u{1F900}-\\u{1F9FF}]' +                   // расширенные эмодзи
            '|' +
            '[\\u{1FA70}-\\u{1FAFF}]' +                   // доп. эмодзи
            ')';

        const EMOJI_SEQ = `${EMOJI_CORE}${VS16}${EMOJI_COMPONENT}(?:${ZWJ}${EMOJI_CORE}${VS16}${EMOJI_COMPONENT})*`;

        const endRe = new RegExp(`^(.*?)(?:\\s*(${EMOJI_SEQ}(?:\\s*${EMOJI_SEQ})*))\\s*$`, 'u');
        const mEnd = s.match(endRe);
        if (mEnd && mEnd[2]) {
            const base = (mEnd[1] || '').trim().replace(/[,\s]+$/, '');
            const emo  = (mEnd[2] || '').trim();
            return { label: base || s, emoji: emo };
        }

        const anyRe = new RegExp(`${EMOJI_SEQ}`, 'gu');
        let lastEmoji = '';
        let match;
        while ((match = anyRe.exec(s)) !== null) lastEmoji = match[0];

        if (lastEmoji) {
            const cleaned = s.replace(new RegExp(`${lastEmoji}\\s*$`, 'u'), '').trim().replace(/[,\s]+$/,'');
            return { label: cleaned || s, emoji: lastEmoji };
        }

        return { label: s, emoji: '' };
    }

    async function showGroupScreen(groupId){
        const cached = groupNameCache.get(String(groupId));
        if (cached) {
            setTitleInstant(cached);
        } else {
            setTitleLoadingPlaceholder();
        }

        screen().innerHTML = pageLoading('Загрузка услуг.');

        resolveGroupName(groupId).then(name => {
            if (name && name !== cached) setTitleInstant(name);
        });

        const services = await fetchServices(groupId);
        renderServices(services, groupId);

        ensureHeaderVisible && ensureHeaderVisible();
    }


    async function fetchServices(groupId){
        if(servicesCache.has(groupId)) return servicesCache.get(groupId);
        try{
            const r = await fetch(`${apiBaseUrl}services/${groupId}`, { method:'POST', headers:{'Content-Type':'application/json'} });
            if(!r.ok) throw new Error('Ошибка при загрузке услуг');
            const data = await r.json(); servicesCache.set(groupId, data); return data;
        }catch(e){ screen().innerHTML = pageError('Ошибка при загрузке услуг.'); console.error(e); return []; }
    }

    function renderServices(services, groupId){
        const items = Array.isArray(services) ? services : (services?.items || []);
        if (!items.length) { screen().innerHTML = emptyState('В этой группе нет услуг','Попробуйте другую группу.'); return; }

        const grid = document.createElement('div');
        grid.className = 'grid gap-3 grid-cols-1 md:grid-cols-2 md:gap-4 lg:grid-cols-3';

        items.forEach((s) => {
            const sid = getServiceId(s);
            const title = getServiceTitle(s);
            const prov = getProviderName(s);
            const mark = (title || 'U').trim().charAt(0).toUpperCase();

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = [
                'svc-card svc-watermark group w-full text-left',
                'rounded-2xl border border-slate-200 dark:border-slate-800',
                'bg-white/95 dark:bg-slate-900/95',
                'px-4 py-4 md:px-4 md:py-4',
                'transition duration-150 ease-out',
                'focus:outline-none focus:ring-2 focus:ring-brand'
            ].join(' ');
            btn.setAttribute('data-mark', mark);

            btn.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="min-w-0 flex-1">
          <div class="text-base md:text-[1.05rem] font-semibold leading-snug text-brand break-anywhere">
            ${escapeHTML(title)}
          </div>
          ${prov ? `<div class="mt-0.5 text-[13.5px] md:text-sm svc-subtle break-anywhere">${escapeHTML(prov)}</div>` : ''}
        </div>
        <div class="svc-chevron shrink-0 opacity-60 transition-transform">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               class="text-slate-400 dark:text-slate-400">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      </div>
    `;

            btn.onclick = () => { updateHash({ view:'service', service:sid, group:groupId }); haptic('impact'); };
            grid.appendChild(btn);
        });

        screen().innerHTML = ''; screen().appendChild(grid);
    }

    async function showServiceScreen(serviceId){
        setTitleInstant('Услуга');   // мгновенно, с лёгким кроссфейдом

        const backBtn = document.getElementById('navBack');
        if (backBtn) backBtn.onclick = () => history.back();

        screen().innerHTML = pageLoading('Загрузка услуги.');
        ensureHeaderVisible && ensureHeaderVisible();

        let service = serviceDetailsCache.get(serviceId);
        if(!service){
            try{
                const r = await fetch(`${apiBaseUrl}service_details/${serviceId}`, { method:'POST', headers:{'Content-Type':'application/json'} });
                if(!r.ok) throw new Error('Ошибка сервера');
                service = await r.json();
                serviceDetailsCache.set(serviceId, service);
            } catch(e){
                screen().innerHTML = pageError('Не удалось загрузить данные услуги.');
                console.error(e);
                ensureHeaderVisible && ensureHeaderVisible();
                return;
            }
        }
        renderServiceDetails(service);
        ensureHeaderVisible && ensureHeaderVisible();
        fetchFeedbacks(serviceId);
    }

    function renderServiceDetails(service){
        const parts=[]; const title=getServiceTitle(service);
        parts.push(`<h2 class="text-2xl font-bold text-brand mb-2 break-anywhere">${escapeHTML(title)}</h2>`);
        if (service.shortDescription) {
            const sd = String(service.shortDescription).trim();
            const title = getServiceTitle(service).trim();
            if (sd && sd.toLowerCase() !== title.toLowerCase()) {
                parts.push(
                    `<div class="rounded-lg bg-gradient-to-r from-[var(--sd-from)] to-[var(--sd-to)] text-[var(--sd-fg)] px-4 py-3 mb-4">
        ${escapeHTML(sd)}
      </div>`
                );
            }
        }

        if(service.service){ parts.push(`<div class="mb-4"><p class="font-medium mb-1">🎲 Описание:</p><div class="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap break-anywhere">${linkify(service.service)}</div></div>`); }
        parts.push(`<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div><p class="font-medium">👤 Контактное лицо</p><div class="text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-anywhere">${escapeHTML(service.contactPerson||'Не указано')}</div></div>
      <div><p class="font-medium">📞 Контакты</p><div class="text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-anywhere">${formatPhoneNumbers((service.contacts||'').replace(/\n/g,'\n'))}</div></div>
    </div>`);
        if(service.links || service.url){ const block=[service.links,service.url].filter(Boolean).join('\n'); parts.push(`<div class="mt-3"><p class="font-medium">🔗 Ссылки</p><div class="text-sm text-brand-700 dark:text-brand-400 whitespace-pre-wrap break-anywhere">${linkify(block)}</div></div>`); }
        
        // === GALLERY (под описанием, до отзывов) ===
        (function(){
            let raw = service.photos;
            let arr = [];
            try{
                if (typeof raw === 'string') {
                    let s = raw.trim();
                    if (s.startsWith('[')) { arr = JSON.parse(s); } // JSON-строка
                    else { arr = s.split(','); }                     // CSV
                } else if (Array.isArray(raw)) {
                    arr = raw;
                }
            }catch(e){ console.warn('[gallery] parse error', e, raw); arr = []; }

            const normalized = (arr || [])
                .map(p => (typeof p === 'string' ? p : (p && p.url ? p.url : '')))
                .map(s => s.trim())
                .filter(Boolean);

            if (normalized.length){
                const safe = JSON.stringify(normalized).replace(/'/g,'&apos;').replace(/"/g,'&quot;');
                parts.push(`<div class="smart-gallery mt-4" data-photos='${safe}'></div>`);
            }
        })();
        // === /GALLERY ===
parts.push(`<div id="feedbacks-container" class="mt-6"></div>`);
        screen().innerHTML = `<div class="space-y-2 animate-in">${parts.join('')}</div>`;
    }
    async function fetchFeedbacks(serviceId){
        const container=document.getElementById('feedbacks-container'); if(!container) return; container.innerHTML = inlineSpinner('Загружаем отзывы...');
        let feedbacks;
        try{
            if(feedbacksCache.has(serviceId)) feedbacks=feedbacksCache.get(serviceId);
            else { const r=await fetch(apiBaseUrl+'getFeedbacks/'+encodeURIComponent(serviceId), { method:'POST', headers:{'Content-Type':'application/json'} }); if(!r.ok) throw new Error('Bad response'); feedbacks=await r.json(); feedbacksCache.set(serviceId, feedbacks); }
            if(feedbacks.message){ container.innerHTML = `<div class="rounded-lg border border-slate-200 dark:border-slate-800 p-4 text-sm">${escapeHTML(feedbacks.message)}</div>`; }
            else{
                const avg = calculateAverageRating(feedbacks);
                const list=document.createElement('div'); list.className='space-y-3';
                const header=`<div class=\"mb-2 text-sm\"><span class=\"font-medium\">Средняя оценка: ${avg}⭐️</span></div>`;
                feedbacks.forEach(f=>{
                    const item=document.createElement('div'); item.className='rounded-lg border border-slate-200 dark:border-slate-800 p-3 animate-in';
                    item.innerHTML=`<div class="flex items-center justify-between text-sm"><strong>${escapeHTML(f.usersName||'Аноним')}</strong><span class="text-slate-500">Оценка: ${escapeHTML(String(f.feedbackRating||'—'))}</span></div>
                           <p class="mt-2 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-anywhere">${escapeHTML(f.feedbackText||'')}</p>`;
                    list.appendChild(item);
                });
                container.innerHTML = header; container.appendChild(list);
            }
        }catch(e){ container.innerHTML = pageError('Не удалось загрузить отзывы.'); console.error(e); }
    }

    function setTitleInstant(text){
        const h1 = document.getElementById('appTitle');
        const span = document.getElementById('appTitleText');
        if (!h1 || !span) return;
        h1.classList.remove('loading');
        span.textContent = text || 'Услуги';
        h1.classList.add('fade-swap');
        requestAnimationFrame(()=> h1.classList.remove('fade-swap'));
    }

    function setTitleLoadingPlaceholder(){
        const h1 = document.getElementById('appTitle');
        const span = document.getElementById('appTitleText');
        if(!h1 || !span) return;
        span.textContent = '';         // скрываем текст
        h1.classList.add('loading');   // рисуем "скелетон"
    }

    async function resolveGroupName(groupId){
        const key = String(groupId);
        if (groupNameCache.has(key)) return groupNameCache.get(key);
        const name = await fetchGroupName(groupId); // твоя функция
        if (name) groupNameCache.set(key, name);
        return name || 'Группа';
    }

    function showSearchScreen(q){
        setTitle('Поиск');

        const view = document.createElement('div');
        view.className = 'space-y-3';
        view.innerHTML = `
    <div class="sticky top-14 pt-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur z-10">
      <div class="relative">
        <input id="searchInput" type="text" inputmode="search" autocomplete="off" spellcheck="false"
               placeholder="Найти услугу..."
               class="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-800 pl-11 pr-14 py-3
                      focus:outline-none focus:ring-2 focus:ring-brand text-base shadow transition" />
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 select-none">🔎</span>

        <!-- круглый хитбокс 36x36, крестик — SVG по центру -->
        <button id="clearSearchBtn" class="search-clear is-empty" aria-label="Очистить" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
    <div id="searchState" class="text-center text-slate-500 py-6">Введите запрос для поиска</div>
    <div id="results" class="space-y-2"></div>
  `;
        screen().innerHTML = '';
        screen().appendChild(view);

        ensureHeaderVisible()

        const input   = view.querySelector('#searchInput');
        const clear   = view.querySelector('#clearSearchBtn');
        const state   = view.querySelector('#searchState');
        const results = view.querySelector('#results');

        input.value = q || '';
        updateClearVisibility(); // показать крестик сразу, если q был

        input.addEventListener('input', () => {
            updateClearVisibility();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        });

        input.addEventListener('input', debounce(() => {
            const v = input.value.trim();
            const p = new URLSearchParams(location.hash.slice(1));
            p.set('view','search');
            if (v) p.set('q', v); else p.delete('q');
            history.replaceState(null, '', '#'+p.toString());
            doSearch(v, state, results);
        }, 220));

        clear.onclick = () => {
            input.value = '';
            updateClearVisibility();
            updateHash({ q: '' }, true);
            results.innerHTML = '';
            state.textContent = 'Введите запрос для поиска';
            input.focus();
        };

        if (q) doSearch(q, state, results); else input.focus();

        function isDesktopPointer(){
            return window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        }
        function updateClearVisibility(){
            if (!isDesktopPointer()) {
                clear.classList.add('is-empty');
                return;
            }
            const empty = input.value.trim().length === 0;
            clear.classList.toggle('is-empty', empty);
        }
    }

    function openSearchScreen(){
        const p = new URLSearchParams(location.hash.slice(1));
        p.set('view','search');
        p.delete('q');                 // чистый старт поиска
        location.hash = '#'+p.toString(); // <-- одна запись в истории
    }

    let searchAbort=null;
    function doSearch(query, stateEl, listEl){
        if(!query){ listEl.innerHTML=''; stateEl.textContent='Введите запрос для поиска'; return; }
        stateEl.innerHTML = inlineSpinner('Ищем...'); listEl.innerHTML='';
        if(searchAbort) searchAbort.abort(); searchAbort = new AbortController();
        stateEl.classList.remove('hidden');
        stateEl.innerHTML = inlineSpinner('Ищем...');
        listEl.innerHTML = '';
        fetch(`${apiBaseUrl}search_services?query=${encodeURIComponent(query)}`, { signal: searchAbort.signal })
            .then(r=>r.json())
            .then(items=> renderSearchResults(items||[], stateEl, listEl))
            .catch(()=> { stateEl.textContent='Ошибка запроса'; });
    }

    function renderSearchResults(results, stateEl, listEl) {
        const items = Array.isArray(results) ? results : [];

        if (!items.length) {
            stateEl.classList.remove('hidden');
            stateEl.textContent = 'Ничего не найдено';
            listEl.innerHTML = '';
            return;
        }

        stateEl.classList.add('hidden');
        listEl.innerHTML = '';

        const frag = document.createDocumentFragment();

        items.forEach((item) => {
            const sid   = item.servicesID ?? item.serviceId ?? item.id;
            const gid   = item.groupId   ?? item.groupID   ?? item.GroupID;
            const title = item.text || item.serviceName || 'Услуга';
            const prov  = item.providerName || '';
            const gnameRaw = item.groupName || '';

            const { label: gnameClean, emoji: groupEmoji } = extractGroupLabelAndEmoji(gnameRaw);

            const row = document.createElement('button');
            row.type = 'button';
            row.className = [
                'row-hover sr-watermark w-full text-left',
                'rounded-xl border border-slate-200 dark:border-slate-800',
                'p-3 bg-white dark:bg-slate-900',
                'transition'
            ].join(' ');
            row.setAttribute('data-emoji', groupEmoji || '');

            row.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="min-w-0 flex-1">
          <div class="font-semibold text-brand text-base leading-tight break-anywhere">
            ${escapeHTML(title)}
          </div>
          ${prov ? `<div class="text-slate-600 dark:text-slate-400 text-sm mt-0.5 break-anywhere">${escapeHTML(prov)}</div>` : ''}
          ${gnameClean ? `<div class="text-slate-400 text-xs mt-0.5 break-anywhere">${escapeHTML(gnameClean)}</div>` : ''}
        </div>
        <div class="row-chevron shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               class="text-slate-400 dark:text-slate-400">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      </div>
    `;

            row.onclick = () => {
                const p = new URLSearchParams(location.hash.slice(1));
                p.set('view', 'service');
                if (sid != null) p.set('service', sid);
                if (gid != null) p.set('group', gid);
                p.delete('q');
                location.hash = '#' + p.toString();
                haptic('impact');
            };

            frag.appendChild(row);
        });

        listEl.appendChild(frag);
    }

    function debounce(fn, ms=200){
        let t; return function(...args){
            clearTimeout(t);
            t = setTimeout(()=>fn.apply(this,args), ms);
        };
    }

    async function fetchGroupName(groupId) {
        try {
            const r = await fetch(`${apiBaseUrl}group/${groupId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!r.ok) throw new Error('Bad response');
            const data = await r.json();
            const name = data.name || 'Группа';
            groupNameCache.set(String(groupId), name);
            return name;
        } catch (e) {
            console.error(e);
            return groupNameCache.get(String(groupId)) || 'Группа';
        }
    }


    function ensureHeaderVisible() {
        try {
            const sc = document.scrollingElement || document.documentElement;
            if (sc) sc.scrollTop = 0;
        } catch {}

        const hdr = document.querySelector('header');
        if (hdr) {
            hdr.offsetHeight;
            hdr.classList.add('repaint');
            requestAnimationFrame(() => hdr.classList.remove('repaint'));
        }

        try { refreshTitleMarquee(); } catch {}
    }


    function pageLoading(msg){ return `<div class="flex flex-col items-center justify-center py-16 gap-3"><div class="w-10 h-10 border-2 border-slate-300 dark:border-slate-700 border-t-brand rounded-full animate-spin"></div><p class="text-sm text-slate-500">${escapeHTML(msg)}</p></div>`; }
    function pageError(msg){ return `<div class="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200 p-4">${escapeHTML(msg)}</div>`; }
    function emptyState(title, sub){ return `<div class="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center"><div class="text-3xl mb-2">🙂</div><div class="font-medium mb-1">${escapeHTML(title)}</div><div class="text-sm text-slate-500">${escapeHTML(sub||'')}</div></div>`; }
    function inlineSpinner(msg){ return `<div class="flex items-center justify-center gap-2 text-sm text-slate-500 py-2"><div class="w-5 h-5 border-2 border-slate-300 dark:border-slate-700 border-t-brand rounded-full animate-spin"></div><span>${escapeHTML(msg)}</span></div>`; }

    function escapeHTML(str){ return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;'); }
    function getGroupId(g){ return g.groupId ?? g.GroupID ?? g.id ?? g.ID ?? g.groupID ?? String(g.name || g.title || Math.random().toString(36).slice(2)); }
    function getGroupName(g){ return g.groupName ?? g.GroupName ?? g.name ?? g.title ?? 'Группа'; }
    function getServiceId(s){ return s.servicesID ?? s.serviceId ?? s.id ?? s.ID ?? s.ServiceID ?? s.ServicesID ?? Math.random().toString(36).slice(2); }
    function getServiceTitle(s){ return s.shortDescription ?? s.serviceName ?? s.title ?? 'Услуга'; }
    function getProviderName(s){ return s.providerName ?? s.provider ?? s.ownerName ?? s.contactPerson ?? ''; }
    function formatPhoneNumbers(text){ const lines=String(text||'').split('\n'); return lines.map(l=>{ const t=l.trim(); const num=t.replace(/[^\d+]/g,''); if(num.length>=7){ return `<a class=\"underline underline-offset-2\" href=\"tel:${escapeHTML(num)}\">${escapeHTML(t)}</a>`;} return escapeHTML(t); }).join('<br>'); }
    function linkify(text){ const esc=escapeHTML(String(text||'')); const urlRe=/\b((?:https?:\/\/|ftp:\/\/)[^\s<>"']+|www\.[^\s<>"']+)/gi; return esc.replace(urlRe,(m)=>{ const href=m.startsWith('http')||m.startsWith('ftp')? m : ('https://'+m); return `<a class=\"underline underline-offset-2 break-anywhere\" href=\"${href}\" target=\"_blank\" rel=\"noopener noreferrer\">${m}</a>`; }); }
    function calculateAverageRating(list){ if(!Array.isArray(list)||list.length===0) return 0; const nums=list.map(x=>Number(x.feedbackRating)).filter(n=>Number.isFinite(n)); if(nums.length===0) return 0; const avg=nums.reduce((a,b)=>a+b,0)/nums.length; return Math.round(avg*10)/10; }
