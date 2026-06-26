// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Element References ---
    const stylesGrid = document.getElementById('styles-grid');
    const heroesList = document.getElementById('heroes-list');
    const clearSelectionBtn = document.getElementById('clear-selection-btn');
    const findHeroesBtn = document.getElementById('find-heroes-btn');
    const resultsContainer = document.getElementById('results-container');
    const resultsCloseBtn = document.getElementById('results-close-btn');
    const heroModal = document.getElementById('hero-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const heroDetailsContainer = document.getElementById('hero-details');

    // --- Application State ---
    let allHeroes = [];
    let selectedStyles = new Set();
    const CSV_PATH = 'heroes.csv';

    // --- Core Functions ---

    /**
     * Parses CSV text into an array of hero objects.
     * @param {string} csvText - The raw CSV string data.
     * @returns {Array<Object>} An array of hero objects.
     */
    const parseCSV = (csvText) => {
        const lines = csvText.trim().split('
');
        const headers = lines[0].split(',').map(h => h.trim());
        const heroes = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            const hero = {};
            headers.forEach((header, index) => {
                hero[header] = values[index];
            });
            return hero;
        });
        return heroes;
    };

    /**
     * Fetches hero data from the CSV file, parses it, and populates the UI.
     */
    const loadAndProcessData = async () => {
        try {
            const response = await fetch(CSV_PATH);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const csvText = await response.text();
            allHeroes = parseCSV(csvText);
            displayStyles(allHeroes);
        } catch (error) {
            console.error("Error loading or parsing hero data:", error);
            stylesGrid.innerHTML = "<p>Не удалось загрузить данные о героях. Проверьте, что файл heroes.csv существует и доступен.</p>";
        }
    };

    /**
     * Extracts all unique styles from the hero data and displays them as buttons.
     * @param {Array<Object>} heroes - The array of hero objects.
     */
    const displayStyles = (heroes) => {
        const styles = new Set();
        heroes.forEach(hero => {
            if (hero.MainStyle1) styles.add(hero.MainStyle1);
            if (hero.MainStyle2) styles.add(hero.MainStyle2);
            if (hero.ExtraStyle) styles.add(hero.ExtraStyle);
        });

        stylesGrid.innerHTML = ''; // Clear existing styles
        styles.forEach(style => {
            const btn = document.createElement('button');
            btn.className = 'style-btn';
            btn.textContent = style;
            btn.dataset.style = style;
            btn.addEventListener('click', () => toggleStyleSelection(btn));
            stylesGrid.appendChild(btn);
        });
    };

    /**
     * Toggles the selection state of a style button.
     * @param {HTMLElement} btn - The style button element that was clicked.
     */
    const toggleStyleSelection = (btn) => {
        const style = btn.dataset.style;
        if (selectedStyles.has(style)) {
            selectedStyles.delete(style);
            btn.classList.remove('selected');
        } else {
            selectedStyles.add(style);
            btn.classList.add('selected');
        }
    };

    /**
     * Clears all selected styles from the UI and state.
     */
    const clearSelection = () => {
        selectedStyles.clear();
        document.querySelectorAll('.style-btn.selected').forEach(btn => {
            btn.classList.remove('selected');
        });
        resultsContainer.classList.add('hidden');
    };

    /**
     * Calculates scores for heroes based on selected styles, then sorts and displays them.
     */
    const calculateAndDisplayHeroes = () => {
        if (selectedStyles.size === 0) {
            alert("Пожалуйста, выберите хотя бы один стиль.");
            return;
        }

        const scoredHeroes = allHeroes.map(hero => {
            let score = 0;
            let matchedStyles = [];

            if (selectedStyles.has(hero.MainStyle1)) {
                score += 4;
                matchedStyles.push(hero.MainStyle1);
            }
            if (selectedStyles.has(hero.MainStyle2)) {
                score += 3;
                matchedStyles.push(hero.MainStyle2);
            }
            if (selectedStyles.has(hero.ExtraStyle)) {
                score += 1;
                matchedStyles.push(hero.ExtraStyle);
            }

            // Only consider heroes that have at least one match
            if (score > 0) {
                const power = parseFloat(hero.Power) || 0;
                const finalRating = score + power;
                const matchPercentage = (matchedStyles.length / selectedStyles.size) * 100;
                
                return { ...hero, score, finalRating, matchedStyles, matchPercentage };
            }
            return null;
        }).filter(Boolean); // Remove null entries

        // Sort heroes by final rating (descending), then by power
        scoredHeroes.sort((a, b) => {
            if (b.finalRating !== a.finalRating) {
                return b.finalRating - a.finalRating;
            }
            return (parseFloat(b.Power) || 0) - (parseFloat(a.Power) || 0);
        });
        
        renderHeroCards(scoredHeroes);
    };

    /**
     * Renders the sorted list of hero cards to the page.
     * @param {Array<Object>} heroes - The sorted array of hero objects.
     */
    const renderHeroCards = (heroes) => {
        heroesList.innerHTML = '';
        if (heroes.length === 0) {
            heroesList.innerHTML = '<p>Не найдено героев, соответствующих выбранным стилям.</p>';
        } else {
            heroes.forEach(hero => {
                const card = document.createElement('div');
                card.className = 'hero-card';
                card.innerHTML = `
                    <h3>${hero.Hero}</h3>
                    <p><strong>Сила:</strong> <span class="power">${hero.Power}</span></p>
                    <p><strong>Совпавшие стили:</strong> ${hero.matchedStyles.join(', ')}</p>
                    <p><strong>Совпадение:</strong> ${hero.matchPercentage.toFixed(0)}%</p>
                    <p><strong>Итоговый рейтинг:</strong> <span class="final-rating">${hero.finalRating.toFixed(2)}</span></p>
                    <button class="open-build-btn">Открыть билд</button>
                `;
                card.querySelector('.open-build-btn').addEventListener('click', () => displayHeroDetails(hero));
                heroesList.appendChild(card);
            });
        }
        resultsContainer.classList.remove('hidden');
        resultsContainer.scrollIntoView({ behavior: 'smooth' });
    };

    /**
     * Displays the detailed build information for a hero in a modal.
     * @param {Object} hero - The hero object to display.
     */
    const displayHeroDetails = (hero) => {
        heroDetailsContainer.innerHTML = `
            <h2>${hero.Hero}</h2>
            <div class="detail-group">
                <h3>Таланты</h3>
                <p><strong>Уровень 5:</strong> ${hero.Talent5}</p>
                <p><strong>Уровень 10:</strong> ${hero.Talent10}</p>
                <p><strong>Уровень 15:</strong> ${hero.Talent15}</p>
            </div>
            <div class="detail-group">
                <h3>Стили</h3>
                <p><strong>Главный стиль:</strong> ${hero.MainStyle1}</p>
                <p><strong>Второй стиль:</strong> ${hero.MainStyle2}</p>
                <p><strong>Дополнительный стиль:</strong> ${hero.ExtraStyle}</p>
            </div>
            <div class="detail-group">
                <h3>Дополнительно</h3>
                <p><strong>Hero Shard:</strong> ${hero.HeroShard}</p>
                <p><strong>Важность крита:</strong> ${hero.CritImportance}</p>
            </div>
             <div class="detail-group">
                <h3><span class="power">Сила героя: ${hero.Power}</span></h3>
            </div>
        `;
        heroModal.classList.remove('hidden');
    };

    /**
     * Hides the hero detail modal.
     */
    const closeModal = () => {
        heroModal.classList.add('hidden');
    };

    // --- Event Listeners ---
    findHeroesBtn.addEventListener('click', calculateAndDisplayHeroes);
    clearSelectionBtn.addEventListener('click', clearSelection);
    modalCloseBtn.addEventListener('click', closeModal);
    // Close modal if user clicks on the overlay
    heroModal.addEventListener('click', (event) => {
        if (event.target === heroModal) {
            closeModal();
        }
    });
    // Close modal with Escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !heroModal.classList.contains('hidden')) {
            closeModal();
        }
    });


    // --- Initial Load ---
    loadAndProcessData();

});
