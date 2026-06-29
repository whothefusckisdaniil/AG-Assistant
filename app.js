const DEMO_CSV = `Hero,Talent5,Talent10,Talent15,MainStyle1,MainStyle2,ExtraStyle,HeroShard,CritImportance,Power
Alchemist,1,"1 (2 optional)","2 (1 optional)",Health,Dice,Survival,"No need","4 - Not important, may need a Manablast",4.5
Phantom Assassin,2,1,"2 (1 optional)",Attack,Crit,Evade,"Must have","1 - Critical!",4.8
Axe,1,2,1,Health,Shield,Chaos,"Good to have","3 - Average",4.2
Venomancer,2,2,2,Poison,Magic,Survival,"No need","4 - Not important",3.9
Crystal Maiden,1,1,1,Magic,Frost,Regen,"Must have","4 - Not important",3.5
Juggernaut,2,"1 (2 optional)",1,Attack,Crit,Regen,"Good to have","2 - Important",4.6
Earth Spirit,1,2,2,Spirits,Health,Chaos,"Must have","3 - Average",4.0
Enigma,2,2,2,Ult,Magic,Survival,"Good to have","4 - Not important",4.9`;

        const translations = {
            ru: {
                subtitle: "Метавые билды в Auto Gladiators",
                selectStyles: "Выберите выпавшие стили",
                clearBtn: "Очистить выбор",
                findBtn: "Анализ",
                resultsTitle: "Рекомендуемые герои",
                searchPlaceholder: "Поиск героя...",
                matchText: "Совпадение:",
                ratingText: "Рейтинг:",
                matchedText: "Совпало:",
                openBuildBtn: "Открыть билд",
                noResults: "Подходящих героев не найдено. Попробуйте выбрать другие стили.",
                toastNeed8: "Выбрано {count} из 8. Пожалуйста, выберите ровно 8 стилей!",
                toastMax8: "Можно выбрать максимум 8 стилей!",
                toastDemo: "Загружена демо-база. Для своей базы положите heroes.csv рядом с index.html."
            },
            en: {
                subtitle: "Best Heroes Helper for Auto Gladiators",
                selectStyles: "Select rolled styles",
                clearBtn: "Clear Selection",
                findBtn: "Analyze",
                resultsTitle: "Recommended Heroes",
                searchPlaceholder: "Search hero...",
                matchText: "Match:",
                ratingText: "Rating:",
                matchedText: "Matched:",
                openBuildBtn: "Open Build",
                noResults: "No matching heroes found. Try selecting other styles.",
                toastNeed8: "Selected {count} out of 8. Please select exactly 8 styles!",
                toastMax8: "You can select a maximum of 8 styles!",
                toastDemo: "Demo base loaded. Place heroes.csv next to index.html to use yours."
            }
        };

        const app = {
            heroesData: [],
            selectedStyles: new Set(),
            allAvailableStyles: new Set(),
            currentResults: [],
            currentLang: 'ru',
            
            // Свойства для оптимизации (Ленивая загрузка)
            currentRenderedCount: 0,
            chunkSize: 12,
            resultsToRender: [],
            observer: null,
            searchTimeout: null,
            
            async init() {
                let csvText = '';
                try {
                    const response = await fetch('heroes.csv');
                    if (!response.ok) throw new Error('File not found');
                    csvText = await response.text();
                } catch (error) {
                    console.warn("Файл heroes.csv не найден. Используем демо-базу.");
                    this.showToast(translations[this.currentLang].toastDemo);
                    csvText = DEMO_CSV;
                }
                
                this.parseData(csvText);
                this.renderStylesGrid();
                this.updateCounter();
                this.applyTranslations();
                this.setupScrollObserver();
            },

            toggleLang() {
                this.currentLang = this.currentLang === 'ru' ? 'en' : 'ru';
                document.getElementById('lang-ru').className = this.currentLang === 'ru' ? 'active' : '';
                document.getElementById('lang-en').className = this.currentLang === 'en' ? 'active' : '';
                
                this.applyTranslations();
                if (this.currentResults.length > 0) {
                    // Принудительно рендерим снова, чтобы обновить языки на карточках
                    this.renderResults(this.resultsToRender, false); 
                }
            },

            applyTranslations() {
                const t = translations[this.currentLang];
                document.querySelectorAll('[data-i18n]').forEach(el => {
                    const key = el.getAttribute('data-i18n');
                    if (t[key]) el.textContent = t[key];
                });
                document.querySelectorAll('[data-i18n-ph]').forEach(el => {
                    const key = el.getAttribute('data-i18n-ph');
                    if (t[key]) el.placeholder = t[key];
                });
            },

            parseCSVContent(str) {
                const result = [];
                let row = [], col = '', inQuotes = false;
                for (let i = 0; i < str.length; i++) {
                    let char = str[i], nextChar = str[i + 1];
                    if (char === '"') {
                        if (inQuotes && nextChar === '"') { col += '"'; i++; }
                        else inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        row.push(col.trim()); col = '';
                    } else if ((char === '\n' || char === '\r') && !inQuotes) {
                        if (char === '\r' && nextChar === '\n') i++;
                        row.push(col.trim());
                        if (row.some(c => c !== '')) result.push(row);
                        row = []; col = '';
                    } else {
                        col += char;
                    }
                }
                if (col || row.length > 0) {
                    row.push(col.trim());
                    if (row.some(c => c !== '')) result.push(row);
                }
                return result;
            },

            parseData(csvText) {
                const rows = this.parseCSVContent(csvText);
                if (rows.length < 2) return;

                const headers = rows[0];
                this.heroesData = [];
                
                const baseStyles = ["Attack", "Chaos", "Crit", "Spirits", "Fury", "Regen", "Frost", "Ult", "Poison", "Shield", "Health", "Evade", "Injure"];
                baseStyles.forEach(s => this.allAvailableStyles.add(s));

                const bannedStyles = new Set(["procs", "dice", "survival"]);

                for (let i = 1; i < rows.length; i++) {
                    const obj = {};
                    headers.forEach((header, index) => { obj[header] = rows[i][index] || ''; });
                    this.heroesData.push(obj);

                    ['MainStyle1', 'MainStyle2', 'ExtraStyle'].forEach(key => {
                        if (obj[key]) {
                            obj[key].split('/').forEach(style => {
                                const cleanStyle = style.trim();
                                if (cleanStyle && cleanStyle.toLowerCase() !== 'none' && !bannedStyles.has(cleanStyle.toLowerCase())) {
                                    this.allAvailableStyles.add(cleanStyle);
                                }
                            });
                        }
                    });
                }
            },

            renderStylesGrid() {
                const grid = document.getElementById('styles-grid');
                grid.innerHTML = '';
                
                const sortedStyles = Array.from(this.allAvailableStyles).sort();

                sortedStyles.forEach(style => {
                    const btn = document.createElement('div');
                    btn.className = 'style-btn';
                    btn.title = style;
                    btn.onclick = () => this.toggleStyle(style, btn);
                    
                    btn.innerHTML = `
                        <img src="styles/${style}.png" alt="${style}" class="style-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <span class="style-fallback-text" style="display:none;">${style}</span>
                    `;
                    grid.appendChild(btn);
                });
            },

            updateCounter() {
                const counterElement = document.getElementById('style-counter');
                const count = this.selectedStyles.size;
                counterElement.textContent = `(${count}/8)`;
                counterElement.style.color = count === 8 ? '#34c759' : 'var(--text-main)';
                counterElement.style.background = count === 8 ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255, 255, 255, 0.1)';
            },

            toggleStyle(style, btnElement) {
                if (this.selectedStyles.has(style)) {
                    this.selectedStyles.delete(style);
                    btnElement.classList.remove('active');
                } else {
                    if (this.selectedStyles.size >= 8) {
                        this.showToast(translations[this.currentLang].toastMax8);
                        return; 
                    }
                    this.selectedStyles.add(style);
                    btnElement.classList.add('active');
                }
                this.updateCounter();
            },

            clearStyles() {
                this.selectedStyles.clear();
                document.querySelectorAll('.style-btn').forEach(btn => btn.classList.remove('active'));
                document.getElementById('results-grid').innerHTML = '';
                document.getElementById('results-section').style.display = 'none';
                document.getElementById('search-input').value = '';
                this.currentResults = [];
                this.resultsToRender = [];
                this.updateCounter();
            },

            findBestHeroes() {
                if (this.selectedStyles.size !== 8) {
                    let msg = translations[this.currentLang].toastNeed8.replace('{count}', this.selectedStyles.size);
                    this.showToast(msg);
                    return;
                }

                let results = this.heroesData.map((hero, index) => {
                    let score = 0, matchedList = [];
                    const checkMatch = (heroStyleField, points) => {
                        if (!heroStyleField) return;
                        heroStyleField.split('/').map(s => s.trim()).forEach(s => {
                            if (this.selectedStyles.has(s)) { score += points; matchedList.push(s); }
                        });
                    };

                    checkMatch(hero.MainStyle1, 4);
                    checkMatch(hero.MainStyle2, 3);
                    checkMatch(hero.ExtraStyle, 1);

                    const uniqueMatches = [...new Set(matchedList)];
                    const power = parseFloat(hero.Power) || 0;
                    
                    return { 
                        heroIndex: index, heroData: hero, score, 
                        finalRating: (score * 10) + (power * 5), 
                        matchPercent: Math.min((score / 8) * 100, 100),
                        uniqueMatches, power 
                    };
                });

                results = results.filter(r => r.score > 0);
                results.sort((a, b) => b.finalRating - a.finalRating || b.matchPercent - a.matchPercent);

                this.currentResults = results;
                document.getElementById('results-section').style.display = 'block';
                document.getElementById('search-input').value = '';
                
                this.renderResults(results, true);
            },

            // Оптимизация поиска: Debounce (ожидание 300мс перед началом поиска)
            filterResults() {
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    const query = document.getElementById('search-input').value.toLowerCase();
                    if (!this.currentResults) return;
                    
                    const filtered = this.currentResults.filter(res => 
                        res.heroData.Hero.toLowerCase().includes(query)
                    );
                    this.renderResults(filtered, false);
                }, 300);
            },

            // Инициализация Observer'а для бесконечного скролла
            setupScrollObserver() {
                const sentinel = document.getElementById('scroll-sentinel');
                if (!sentinel) return;
                
                this.observer = new IntersectionObserver((entries) => {
                    if (entries[0].isIntersecting) {
                        this.renderNextChunk();
                    }
                }, { rootMargin: '200px' });
                
                this.observer.observe(sentinel);
            },

            // Подготовка результатов к ленивой загрузке
            renderResults(results, scroll = false) {
                this.resultsToRender = results;
                this.currentRenderedCount = 0;
                
                const grid = document.getElementById('results-grid');
                grid.innerHTML = ''; // Очищаем старые
                const t = translations[this.currentLang];

                if (results.length === 0) {
                    grid.innerHTML = `<div class="no-results">${t.noResults}</div>`;
                    return;
                }

                // Рендерим первую порцию
                this.renderNextChunk();

                if (scroll) {
                    document.getElementById('results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            },

            // Отрисовка следующей "пачки" героев (Оптимизация производительности)
            renderNextChunk() {
                if (this.currentRenderedCount >= this.resultsToRender.length) return;

                const grid = document.getElementById('results-grid');
                const fragment = document.createDocumentFragment(); // Используем фрагмент для скорости DOM
                const t = translations[this.currentLang];
                const fallbackSrc = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22%3E%3Crect width=%2260%22 height=%2260%22 fill=%22%23333%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 fill=%22%23a0a0a0%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 font-size=%2224%22%3E?%3C/text%3E%3C/svg%3E";

                const end = Math.min(this.currentRenderedCount + this.chunkSize, this.resultsToRender.length);

                for (let i = this.currentRenderedCount; i < end; i++) {
                    const res = this.resultsToRender[i];
                    const card = document.createElement('div');
                    card.className = 'glass hero-card';
                    
                    const heroImgSrc = `heroes/${res.heroData.Hero}.png`;
                    const matchedIconsHtml = res.uniqueMatches.map(style => 
                        `<img src="styles/${style}.png" alt="${style}" title="${style}" class="card-matched-icon" onerror="this.style.display='none';">`
                    ).join('');

                    card.innerHTML = `
                        <div class="hero-header">
                            <div class="hero-header-left">
                                <img src="${heroImgSrc}" alt="${res.heroData.Hero}" class="hero-avatar" onerror="this.src='${fallbackSrc}'">
                                <div class="hero-name">${res.heroData.Hero}</div>
                            </div>
                            <div class="hero-power">★ ${res.power.toFixed(1)}</div>
                        </div>
                        <div class="hero-stats">
                            <div class="stat-row">
                                <span class="stat-label">${t.matchText}</span>
                                <span class="stat-value">${Math.round(res.matchPercent)}%</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">${t.ratingText}</span>
                                <span class="stat-value" style="color: var(--accent-gold);">${res.finalRating.toFixed(1)}</span>
                            </div>
                            <div class="matched-styles">
                                <span>${t.matchedText}</span>
                                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                    ${matchedIconsHtml}
                                </div>
                            </div>
                        </div>
                        <button class="btn-card" onclick="app.openPanel(${res.heroIndex})">${t.openBuildBtn}</button>
                    `;
                    fragment.appendChild(card);
                }

                grid.appendChild(fragment);
                this.currentRenderedCount = end;
            },

            renderPanelStyleImages(elementId, styleStr, forceDiceFallback = false) {
                const el = document.getElementById(elementId);
                let styles = [];

                if (styleStr && styleStr !== '-' && styleStr.toLowerCase() !== 'none') {
                    styles = styleStr.split('/')
                                     .map(s => s.trim())
                                     .filter(s => s && this.selectedStyles.has(s));
                }
                
                if (styles.length === 0 && forceDiceFallback) {
                    styles = ['Dice'];
                }

                if (styles.length === 0) { 
                    el.innerHTML = '<strong>-</strong>'; 
                    return; 
                }

                let html = '<div class="modal-styles-wrap">';
                styles.forEach(style => {
                    html += `
                        <div class="modal-style-icon" title="${style}">
                            <img src="styles/${style}.png" alt="${style}" onerror="this.style.display='none';">
                            <span>${style}</span>
                        </div>
                    `;
                });
                html += '</div>';
                el.innerHTML = html;
            },

            openPanel(heroIndex) {
                const hero = this.heroesData[heroIndex];
                if (!hero) return;

                const fallbackSrc = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23333%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 fill=%22%23a0a0a0%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 font-size=%2240%22%3E?%3C/text%3E%3C/svg%3E";
                
                const imgSrc = `heroes/${hero.Hero}.png`;
                
                // Аватарка
                const imgElement = document.getElementById('panel-hero-img');
                imgElement.src = imgSrc;
                imgElement.onerror = function() { this.src = fallbackSrc; };

                // Размытый фон
                const bgElement = document.getElementById('side-panel-bg');
                bgElement.style.backgroundImage = `url('${imgSrc}')`;

                document.getElementById('panel-hero-name').textContent = hero.Hero;
                document.getElementById('panel-hero-power').textContent = `★ ${hero.Power}`;
                
                document.getElementById('panel-t5').textContent = hero.Talent5 || '-';
                document.getElementById('panel-t10').textContent = hero.Talent10 || '-';
                document.getElementById('panel-t15').textContent = hero.Talent15 || '-';
                
                this.renderPanelStyleImages('panel-ms1', hero.MainStyle1, false);
                this.renderPanelStyleImages('panel-ms2', hero.MainStyle2, false);
                this.renderPanelStyleImages('panel-es', hero.ExtraStyle, true);
                
                // Настройка Shard (с восстановлением показа картинки, если она была скрыта)
                document.getElementById('panel-shard').textContent = hero.HeroShard || '-';
                const shardImg = document.getElementById('panel-shard-img');
                shardImg.style.display = 'block'; // Возвращаем дисплей на случай, если прошлая была сломана
                shardImg.src = 'styles/Shard.png'; // Запускаем загрузку картинки Shard
                
                document.getElementById('panel-crit').textContent = hero.CritImportance || '-';

                document.getElementById('side-panel-overlay').classList.add('active');
                document.getElementById('side-panel').classList.add('active');
                document.body.style.overflow = 'hidden'; 
            },

            closePanel(event, force = false) {
                if (force || event.target.id === 'side-panel-overlay') {
                    document.getElementById('side-panel-overlay').classList.remove('active');
                    document.body.style.overflow = 'auto'; 
                    document.getElementById('side-panel').classList.remove('active');
                }
            },

            showToast(message) {
                const toast = document.getElementById('toast');
                toast.textContent = message;
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 4000);
            }
        };

        window.addEventListener('DOMContentLoaded', () => app.init());
