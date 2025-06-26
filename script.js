document.addEventListener('DOMContentLoaded', () => {

    const config = {
      apiKey: typeof API_KEY !== 'undefined' ? API_KEY : '', // Loaded from config.js
      apiBaseUrl: 'https://api.weatherapi.com/v1',
      maxHistory: 5,
      forecastDays: 3,
      refreshIntervalMinutes: 15, // Auto-refresh interval
      storageKeys: {
        theme: 'weatherapp-theme',
        tempUnit: 'weatherapp-tempUnit',
        lastCity: 'weatherapp-lastSearchedCity',
        favorites: 'weatherapp-favoriteCities',
        searchHistory: 'weatherapp-searchHistory',
      }
    };

    // === DOM Elements (MOVED TO THE TOP) ===
    const cityInput = document.getElementById('cityInput');
    const searchBtn = document.getElementById('searchBtn');
    const locationBtn = document.getElementById('locationBtn');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const unitToggleBtn = document.getElementById('unitToggleBtn');
    const errorDisplay = document.getElementById('errorDisplay');
    const skeletonLoader = document.getElementById('skeletonLoader');
    const currentWeatherCard = document.getElementById('currentWeatherCard');
    const forecastContainer = document.getElementById('forecastContainer');
    const cityNameEl = document.getElementById('cityName');
    const currentDateEl = document.getElementById('currentDate');
    const currentWeatherIconEl = document.getElementById('currentWeatherIcon');
    const currentTempEl = document.getElementById('currentTemp');
    const tempUnitDisplayEl = document.getElementById('tempUnitDisplay');
    const detailTempUnitDisplayEls = document.querySelectorAll('.detailTempUnitDisplay');
    const currentConditionEl = document.getElementById('currentCondition');
    const currentHumidityEl = document.getElementById('currentHumidity');
    const currentWindEl = document.getElementById('currentWind');
    const currentFeelsLikeEl = document.getElementById('currentFeelsLike');
    const currentPressureEl = document.getElementById('currentPressure');
    const sunriseTimeEl = document.getElementById('sunriseTime');
    const sunsetTimeEl = document.getElementById('sunsetTime');
    const currentAQIEl = document.getElementById('currentAQI');
    const forecastSliderWrapper = document.getElementById('forecastSlider');
    const autocompleteList = document.getElementById('autocomplete-list');
    const toggleFavoriteBtn = document.getElementById('toggleFavoriteBtn');
    const favoritesBtn = document.getElementById('favoritesBtn');
    const favoritesListEl = document.getElementById('favoritesList');
    const noFavoritesMsg = document.getElementById('noFavoritesMsg');
    const alertsContainer = document.getElementById('alertsContainer');
    const hourlyDetailsEl = document.getElementById('hourlyDetails');
    const hourlyChartCanvas = document.getElementById('hourlyChart');
    const hourlyScrollLeftBtn = document.getElementById('hourlyScrollLeftBtn');
    const hourlyScrollRightBtn = document.getElementById('hourlyScrollRightBtn');
    const searchHistoryList = document.getElementById('searchHistoryList');
    const openDetailsDrawerBtn = document.getElementById('openDetailsDrawerBtn');
    const closeDetailsDrawerBtn = document.getElementById('closeDetailsDrawerBtn');
    const detailsDrawer = document.getElementById('detailsDrawer');
    const detailsDrawerOverlay = document.getElementById('detailsDrawerOverlay');
    const additionalDetailsContentEl = document.getElementById('additionalDetailsContent');
    const forecastModal = document.getElementById('forecastModal');
    const modalBody = document.getElementById('modalBody');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');

    // === State Variables ===
    let currentWeatherData = null;
    let refreshIntervalId; 
    let currentTempUnit = localStorage.getItem(config.storageKeys.tempUnit) || 'c';
    let hourlyChart = null;
    let draggedFavorite = null;

    // --- UI State Management (Loading, Errors) ---
    // These functions can now be defined here because their required variables exist.
    function showLoadingState() {
        skeletonLoader.classList.remove('hidden');
        errorDisplay.classList.add('hidden');
        currentWeatherCard.classList.add('hidden');
        forecastContainer.classList.add('hidden');
        alertsContainer.classList.add('hidden');
    }
    function hideLoadingState() {
        skeletonLoader.classList.add('hidden');
    }
    function showError(message) {
        hideLoadingState();
        errorDisplay.textContent = `⚠️ ${message}`;
        errorDisplay.classList.remove('hidden');
        currentWeatherCard.classList.add('hidden');
        forecastContainer.classList.add('hidden');
        alertsContainer.classList.add('hidden');
    }
    function hideError() { errorDisplay.classList.add('hidden'); }    

    // Check for API Key AFTER element variables and helper functions are defined
    if (!config.apiKey || config.apiKey === 'YOUR_API_KEY_HERE') {
        console.error("API Key not found or is a placeholder. Please create config.js, add your API key, and link it in index.html before script.js.");
        showError("Application is not configured correctly. API key is missing.");
        // Stop further execution if the key is missing.
        return; 
    }
  
    // --- Initial Setup & Toggles ---
    function setInitialTheme() {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const savedTheme = localStorage.getItem(config.storageKeys.theme);
        const body = document.body;
        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            body.classList.add('dark-mode');
            themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            body.classList.remove('dark-mode');
            themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
        }
    }
  
    function updateUnitDisplay() {
        unitToggleBtn.textContent = currentTempUnit === 'c' ? '°C' : '°F';
        tempUnitDisplayEl.textContent = currentTempUnit === 'c' ? '°C' : '°F';
        detailTempUnitDisplayEls.forEach(el => el.textContent = currentTempUnit === 'c' ? '°C' : '°F');
        if (currentWeatherData) {
            displayCurrentWeather(currentWeatherData);
            displayForecast(currentWeatherData);
            displayHourlyForecast(currentWeatherData);
        }
    }
    
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        themeToggleBtn.innerHTML = isDarkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        localStorage.setItem(config.storageKeys.theme, isDarkMode ? 'dark' : 'light');
        if (hourlyChart) {
            updateHourlyChartTheme();
        }
    });
  
    unitToggleBtn.addEventListener('click', () => {
        currentTempUnit = currentTempUnit === 'c' ? 'f' : 'c';
        localStorage.setItem(config.storageKeys.tempUnit, currentTempUnit);
        updateUnitDisplay();
    });
  
    // --- API Calls & Data Handling ---
    function fetchWeatherData(query) {
        showLoadingState();
        const apiUrl = `${config.apiBaseUrl}/forecast.json?key=${config.apiKey}&q=${query}&days=${config.forecastDays}&aqi=yes&alerts=yes`;
        
        fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    if (response.status === 400) throw new Error(`Location not found. Please check the city name.`);
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    showError(data.error.message);
                    return;
                }
                currentWeatherData = data; 
                hideError();
                
                displayAllData(data);
                
                addSearchTerm(data.location.name);
                localStorage.setItem(config.storageKeys.lastCity, data.location.name);
                
                startAutoRefresh(data.location.name);
            })
            .catch(error => {
                console.error("Fetch error:", error);
                showError(error.message.includes('Location not found') ? error.message : `Failed to fetch weather data. Check connection.`);
            })
            .finally(() => {
                hideLoadingState();
            });
    }

    function displayAllData(data) {
        displayCurrentWeather(data);
        displayForecast(data);
        displayAlerts(data);
        displayHourlyForecast(data);
        updateFavoriteButtonState(data.location.name);
        
        currentWeatherCard.classList.remove('hidden');
        forecastContainer.classList.remove('hidden');
        alertsContainer.classList.toggle('hidden', !(data.alerts && data.alerts.alert.length > 0));
    }
  
    // --- Auto-Refresh Logic ---
    function startAutoRefresh(cityQuery) {
        stopAutoRefresh();
        if (cityQuery && config.refreshIntervalMinutes > 0) {
            refreshIntervalId = setInterval(() => {
                console.log(`Auto-refreshing weather for ${cityQuery}...`);
                fetchWeatherData(cityQuery);
            }, config.refreshIntervalMinutes * 60 * 1000);
        }
    }
    function stopAutoRefresh() {
        if (refreshIntervalId) {
            clearInterval(refreshIntervalId);
            refreshIntervalId = null;
        }
    }
  
    // --- Display Functions ---
    function getTemp(temp_c, temp_f) { return Math.round(currentTempUnit === 'c' ? temp_c : temp_f); }
  
    function displayCurrentWeather(data) {
        const { location, current, forecast } = data;
        cityNameEl.textContent = `${location.name}, ${location.country}`;
        currentDateEl.textContent = new Date(location.localtime).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        currentWeatherIconEl.src = `https:${current.condition.icon}`;
        currentWeatherIconEl.alt = current.condition.text;
        
        currentTempEl.textContent = getTemp(current.temp_c, current.temp_f);
        currentFeelsLikeEl.textContent = getTemp(current.feelslike_c, current.feelslike_f);
  
        currentConditionEl.textContent = current.condition.text;
        currentHumidityEl.textContent = `${current.humidity}%`;
        currentWindEl.textContent = `${current.wind_kph} kph`;
        currentPressureEl.textContent = `${current.pressure_mb} mb`;
  
        const todayForecast = forecast.forecastday[0];
        sunriseTimeEl.textContent = todayForecast?.astro?.sunrise || '--';
        sunsetTimeEl.textContent = todayForecast?.astro?.sunset || '--';
  
        const aqiValue = current.air_quality?.["us-epa-index"];
        currentAQIEl.textContent = aqiValue ? aqiValue : 'N/A';
        currentAQIEl.className = aqiValue ? `aqi-value ${getAqiClass(aqiValue)}` : 'aqi-value';
        
        additionalDetailsContentEl.innerHTML = `
            <div class="detail-card"><i class="fas fa-sun"></i><h4>UV Index</h4><p>${current.uv}</p></div>
            <div class="detail-card"><i class="fas fa-eye"></i><h4>Visibility</h4><p>${current.vis_km} km</p></div>
            <div class="detail-card"><i class="fas fa-cloud-showers-heavy"></i><h4>Precipitation</h4><p>${current.precip_mm} mm</p></div>
            <div class="detail-card"><i class="fas fa-cloud"></i><h4>Cloud Cover</h4><p>${current.cloud}%</p></div>
            <div class="detail-card"><i class="fas fa-compass"></i><h4>Wind Direction</h4><p>${current.wind_dir}</p></div>
            <div class="detail-card"><i class="fas fa-wind"></i><h4>Gust Speed</h4><p>${current.gust_kph} kph</p></div>
            <div class="detail-card"><i class="fas fa-clock"></i><h4>Last Updated</h4><p>${new Date(current.last_updated_epoch * 1000).toLocaleTimeString()}</p></div>
        `;
    }
  
    function getAqiClass(value) {
        if (value <= 50) return 'good';
        if (value <= 100) return 'moderate';
        if (value <= 150) return 'unhealthy-sensitive';
        if (value <= 200) return 'unhealthy';
        if (value <= 300) return 'very-unhealthy';
        return 'hazardous';
    }
  
    function displayForecast(data) {
        forecastSliderWrapper.innerHTML = '';
        data.forecast.forecastday.forEach(day => {
            const date = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const card = document.createElement('div');
            const tempUnitLabel = `°${currentTempUnit.toUpperCase()}`;
            
            card.innerHTML = `
                <h3>${date}</h3>
                <img src="https:${day.day.condition.icon}" alt="${day.day.condition.text}">
                <p class="forecast-temp"><strong>${getTemp(day.day.maxtemp_c, day.day.maxtemp_f)}${tempUnitLabel}</strong> / ${getTemp(day.day.mintemp_c, day.day.mintemp_f)}${tempUnitLabel}</p>
                <p class="forecast-condition">${day.day.condition.text}</p>
                <div class="forecast-details">
                    <div class="forecast-detail-item" title="Chance of Rain"><i class="fas fa-tint"></i><span>${day.day.daily_chance_of_rain}%</span></div>
                    <div class="forecast-detail-item" title="Max Wind Speed"><i class="fas fa-wind"></i><span>${day.day.maxwind_kph} kph</span></div>
                    <div class="forecast-detail-item" title="UV Index"><i class="fas fa-sun"></i><span>${day.day.uv}</span></div>
                </div>
                <button class="control-button details-btn" data-date="${day.date}">More Details</button>
            `;
            forecastSliderWrapper.appendChild(card);
        });
    }
  
    function displayAlerts(data) {
        alertsContainer.innerHTML = '';
        if (data.alerts && data.alerts.alert.length > 0) {
            data.alerts.alert.forEach(alert => {
                const severityClass = `severity-${alert.severity.toLowerCase().replace(' ', '-')}`;
                const alertDiv = document.createElement('div');
                alertDiv.className = `weather-alert ${severityClass}`;
                alertDiv.innerHTML = `<h4><i class="fas fa-exclamation-triangle"></i> ${alert.headline}</h4><p>${alert.desc}</p>`;
                alertsContainer.appendChild(alertDiv);
            });
        }
    }
  
    function displayHourlyForecast(data) {
        hourlyDetailsEl.innerHTML = '';
        const allHours = data.forecast.forecastday.flatMap(day => day.hour);
        const now = new Date();
        const futureHours = allHours.filter(h => new Date(h.time_epoch * 1000) >= now);
        const next48Hours = futureHours.slice(0, 48);
    
        next48Hours.forEach(hour => {
            const hourDiv = document.createElement('div');
            hourDiv.className = 'hourly-item';
            const tempUnitLabel = `°${currentTempUnit.toUpperCase()}`;
            hourDiv.innerHTML = `
                <div class="hour-time">${new Date(hour.time_epoch * 1000).toLocaleTimeString([], { hour: 'numeric', hour12: true })}</div>
                <img src="https:${hour.condition.icon}" alt="${hour.condition.text}">
                <div class="hour-temp">${getTemp(hour.temp_c, hour.temp_f)}${tempUnitLabel}</div>
                <div class="hour-precip"><i class="fas fa-tint"></i>${hour.chance_of_rain}%</div>
            `;
            hourlyDetailsEl.appendChild(hourDiv);
        });
    
        if (hourlyChart) hourlyChart.destroy();
        createHourlyChart(next48Hours);
    }

    function updateHourlyChartTheme() {
        if (!hourlyChart) return;
        const isDarkMode = document.body.classList.contains('dark-mode');
        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const textColor = isDarkMode ? '#f0f0f5' : '#2c3e50';

        hourlyChart.options.plugins.legend.labels.color = textColor;
        hourlyChart.options.scales.x.ticks.color = textColor;
        hourlyChart.options.scales.x.grid.color = gridColor;
        hourlyChart.options.scales.y.ticks.color = textColor;
        hourlyChart.options.scales.y.grid.color = gridColor;
        hourlyChart.options.scales.y1.ticks.color = textColor;
        hourlyChart.update();
    }
  
    function createHourlyChart(next48Hours) {
        const labels = next48Hours.map(h => new Date(h.time_epoch * 1000).toLocaleTimeString([], { hour: 'numeric' }));
        const tempData = next48Hours.map(h => currentTempUnit === 'c' ? h.temp_c : h.temp_f);
        const precipData = next48Hours.map(h => h.chance_of_rain);
        
        const isDarkMode = document.body.classList.contains('dark-mode');
        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const textColor = isDarkMode ? '#f0f0f5' : '#2c3e50';
  
        hourlyChart = new Chart(hourlyChartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `Temperature (°${currentTempUnit.toUpperCase()})`, data: tempData, borderColor: 'rgba(255, 132, 66, 1)', backgroundColor: 'rgba(255, 132, 66, 0.2)', yAxisID: 'y', tension: 0.2, fill: true, pointRadius: 2, pointHoverRadius: 5
                }, {
                    label: 'Chance of Rain (%)', data: precipData, borderColor: 'rgba(99, 164, 255, 1)', backgroundColor: 'rgba(99, 164, 255, 0.2)', yAxisID: 'y1', stepped: true, fill: true, pointRadius: 0
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, stacked: false,
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const dataIndex = elements[0].index;
                        const hourlyItems = hourlyDetailsEl.querySelectorAll('.hourly-item');
                        const targetItem = hourlyItems[dataIndex];
                        if (targetItem) {
                            targetItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                            hourlyItems.forEach(item => item.classList.remove('highlighted'));
                            targetItem.classList.add('highlighted');
                            setTimeout(() => targetItem.classList.remove('highlighted'), 2000);
                        }
                    }
                },
                plugins: {
                    legend: { labels: { color: textColor } },
                    tooltip: {
                        callbacks: {
                            footer: (tooltipItems) => {
                                const hourData = next48Hours[tooltipItems[0].dataIndex];
                                return hourData ? `Condition: ${hourData.condition.text}\nWind: ${hourData.wind_kph} kph` : '';
                            }
                        }
                    }
                },
                scales: {
                    x: { ticks: { color: textColor }, grid: { color: gridColor } },
                    y: { type: 'linear', display: true, position: 'left', ticks: { color: textColor, callback: (v) => `${v}°` }, grid: { color: gridColor } },
                    y1: { type: 'linear', display: true, position: 'right', min: 0, max: 100, ticks: { color: textColor, callback: (v) => `${v}%` }, grid: { drawOnChartArea: false } },
                },
            }
        });
    }
  
    // --- Event Listeners ---
    searchBtn.addEventListener('click', () => {
        const city = cityInput.value.trim();
        if (city) {
            stopAutoRefresh();
            fetchWeatherData(city);
            autocompleteList.style.display = 'none';
            searchHistoryList.classList.add('hidden');
        } else {
            showError('Please enter a city name.');
        }
    });
  
    cityInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchBtn.click(); });
  
    locationBtn.addEventListener('click', () => {
        if (navigator.geolocation) {
            stopAutoRefresh();
            navigator.geolocation.getCurrentPosition(
                position => fetchWeatherData(`${position.coords.latitude},${position.coords.longitude}`),
                () => showError("Unable to retrieve your location. Please allow location access.")
            );
        } else {
            showError("Geolocation is not supported by your browser.");
        }
    });
  
    // --- Autocomplete & Search History ---
    let autocompleteTimeout;
    cityInput.addEventListener('input', () => {
        clearTimeout(autocompleteTimeout);
        const query = cityInput.value.trim();
        searchHistoryList.style.display = 'none'; 
        if (query.length < 3) { autocompleteList.style.display = 'none'; return; }
        autocompleteTimeout = setTimeout(() => {
            fetch(`${config.apiBaseUrl}/search.json?key=${config.apiKey}&q=${query}`)
                .then(res => res.json()).then(data => {
                    autocompleteList.innerHTML = '';
                    if (data.length > 0) {
                        data.forEach(location => {
                            const item = document.createElement('div');
                            item.textContent = `${location.name}, ${location.region}, ${location.country}`;
                            item.addEventListener('click', () => {
                                cityInput.value = location.name;
                                stopAutoRefresh();
                                autocompleteList.style.display = 'none';
                                searchBtn.click();
                            });
                            autocompleteList.appendChild(item);
                        });
                        autocompleteList.style.display = 'block';
                    } else { autocompleteList.style.display = 'none'; }
                }).catch(() => autocompleteList.style.display = 'none');
        }, 300);
    });
  
    const getSearchHistory = () => JSON.parse(localStorage.getItem(config.storageKeys.searchHistory)) || [];
    const saveSearchHistory = (history) => { localStorage.setItem(config.storageKeys.searchHistory, JSON.stringify(history)); renderSearchHistory(); };
    const addSearchTerm = (term) => { 
        let history = getSearchHistory().filter(item => item.toLowerCase() !== term.toLowerCase()); 
        history.unshift(term); 
        saveSearchHistory(history.slice(0, config.maxHistory)); 
    };
    const removeSearchTerm = (term) => saveSearchHistory(getSearchHistory().filter(item => item !== term));
    function renderSearchHistory() {
        searchHistoryList.innerHTML = '';
        getSearchHistory().forEach(term => {
            const item = document.createElement('div');
            item.innerHTML = `<span class="history-icon"><i class="fas fa-history"></i></span> ${term} <span class="remove-history" data-term="${term}">×</span>`;
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('remove-history')) {
                    e.stopPropagation();
                    removeSearchTerm(e.target.dataset.term);
                } else {
                    cityInput.value = term;
                    stopAutoRefresh();
                    fetchWeatherData(term);
                    searchHistoryList.classList.add('hidden');
                }
            });
            searchHistoryList.appendChild(item);
        });
    }
    cityInput.addEventListener('focus', () => {
        if (cityInput.value.trim() === '' && getSearchHistory().length > 0) {
            renderSearchHistory();
            searchHistoryList.classList.remove('hidden');
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!cityInput.contains(e.target)) {
            autocompleteList.style.display = 'none';
            searchHistoryList.classList.add('hidden');
        }
        if (!favoritesBtn.contains(e.target) && !favoritesListEl.contains(e.target)) {
            favoritesListEl.classList.remove('show');
        }
    });
  
    // --- Tabs, Drawer, and Modal Logic ---
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(button.dataset.tab).classList.add('active');
        });
    });
  
    forecastSliderWrapper.addEventListener('click', (e) => {
        const detailsButton = e.target.closest('.details-btn');
        if (detailsButton) {
            const dayData = currentWeatherData.forecast.forecastday.find(day => day.date === detailsButton.dataset.date);
            if (dayData) openForecastModal(dayData);
        }
    });
  
    const toggleDrawer = (show) => {
        detailsDrawer.classList.toggle('show', show);
        detailsDrawerOverlay.classList.toggle('show', show);
        openDetailsDrawerBtn.classList.toggle('active', show);
        openDetailsDrawerBtn.querySelector('span').textContent = show ? 'Hide Details' : 'View All Details';
        if (show) {
            additionalDetailsContentEl.querySelectorAll('.detail-card').forEach((card, index) => {
                card.style.animationDelay = `${index * 50}ms`;
            });
        }
    };
    openDetailsDrawerBtn.addEventListener('click', () => toggleDrawer(!detailsDrawer.classList.contains('show')));
    closeDetailsDrawerBtn.addEventListener('click', () => toggleDrawer(false));
    detailsDrawerOverlay.addEventListener('click', () => toggleDrawer(false));
  
    const toggleModal = (show) => forecastModal.classList.toggle('show', show);
  
    function openForecastModal(dayData) {
        const tempUnitLabel = `°${currentTempUnit.toUpperCase()}`;
        modalBody.innerHTML = `
            <h2>${new Date(dayData.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
            <img src="https:${dayData.day.condition.icon}" alt="${dayData.day.condition.text}" style="width:80px; display:block; margin: 0 auto 1rem;">
            <p><strong>Condition:</strong> ${dayData.day.condition.text}</p>
            <p><strong>Avg/Max/Min Temp:</strong> ${getTemp(dayData.day.avgtemp_c, dayData.day.avgtemp_f)}${tempUnitLabel} / ${getTemp(dayData.day.maxtemp_c, dayData.day.maxtemp_f)}${tempUnitLabel} / ${getTemp(dayData.day.mintemp_c, dayData.day.mintemp_f)}${tempUnitLabel}</p>
            <p><strong>Wind/Precip/UV:</strong> ${dayData.day.maxwind_kph} kph / ${dayData.day.totalprecip_mm} mm / ${dayData.day.uv}</p>
            <p><strong>Rain/Snow Chance:</strong> ${dayData.day.daily_chance_of_rain}% / ${dayData.day.daily_chance_of_snow}%</p>
            <hr style="margin: 1rem 0; border-color: var(--card-border);">
            <h4>Hourly Sample:</h4>
            ${dayData.hour.filter((h,i) => i % 6 === 0).slice(0,4).map(h => `<p style="font-size:0.9em;">${new Date(h.time_epoch*1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}: ${getTemp(h.temp_c,h.temp_f)}${tempUnitLabel}, ${h.condition.text}</p>`).join('')}
        `;
        toggleModal(true);
    }
    modalCloseBtn.addEventListener('click', () => toggleModal(false));
    forecastModal.addEventListener('click', (e) => { if (e.target === forecastModal) toggleModal(false); });
    
    // --- Favorites Logic ---
    const getFavorites = () => JSON.parse(localStorage.getItem(config.storageKeys.favorites)) || [];
    const saveFavorites = (favorites) => { localStorage.setItem(config.storageKeys.favorites, JSON.stringify(favorites)); renderFavoritesList(); };
    const addFavorite = (city) => { if (!isFavorite(city)) saveFavorites([...getFavorites(), city]); updateFavoriteButtonState(city); };
    const removeFavorite = (city) => { saveFavorites(getFavorites().filter(c => c !== city)); updateFavoriteButtonState(city); };
    const isFavorite = (city) => getFavorites().includes(city);
    function updateFavoriteButtonState(city) {
        const isFav = isFavorite(city);
        toggleFavoriteBtn.innerHTML = `<i class="${isFav ? 'fas' : 'far'} fa-star"></i>`;
        toggleFavoriteBtn.classList.toggle('is-favorite', isFav);
        toggleFavoriteBtn.setAttribute('aria-label', `${isFav ? 'Remove from' : 'Add to'} favorites`);
    }
    toggleFavoriteBtn.addEventListener('click', () => { 
        const cityName = currentWeatherData?.location?.name;
        if (cityName) isFavorite(cityName) ? removeFavorite(cityName) : addFavorite(cityName);
    });
    favoritesBtn.addEventListener('click', (e) => { e.stopPropagation(); favoritesListEl.classList.toggle('show'); });
    function renderFavoritesList() { 
        const favorites = getFavorites();
        favoritesListEl.querySelectorAll('li[data-city]').forEach(li => li.remove());
        noFavoritesMsg.style.display = favorites.length === 0 ? 'block' : 'none';
        favorites.forEach(city => { 
            const li = document.createElement('li'); 
            li.dataset.city = city;
            li.draggable = true;
            li.innerHTML = `<span>${city}</span><span class="remove-fav" aria-label="Remove ${city}"><i class="fas fa-times-circle"></i></span>`;
            
            li.addEventListener('click', (e) => { 
                if (e.target.closest('.remove-fav')) { e.stopPropagation(); removeFavorite(city); }
                else { stopAutoRefresh(); fetchWeatherData(city); cityInput.value = city; favoritesListEl.classList.remove('show'); }
            }); 
            ['dragstart', 'dragover', 'dragleave', 'drop', 'dragend'].forEach(event => li.addEventListener(event, handleDragDrop));
            favoritesListEl.insertBefore(li, noFavoritesMsg);
        }); 
    }
    
    function handleDragDrop(e) {
        e.preventDefault();
        const target = e.currentTarget;
        if (e.type === 'dragstart') {
            draggedFavorite = target;
            setTimeout(() => target.classList.add('dragging'), 0);
        } else if (e.type === 'dragend') {
            draggedFavorite.classList.remove('dragging');
            draggedFavorite = null;
            favoritesListEl.querySelectorAll('li').forEach(item => item.classList.remove('drag-over'));
        } else if (e.type === 'dragover') {
            if (target !== draggedFavorite) target.classList.add('drag-over');
        } else if (e.type === 'dragleave') {
            target.classList.remove('drag-over');
        } else if (e.type === 'drop') {
            target.classList.remove('drag-over');
            if (draggedFavorite && draggedFavorite !== target) {
                let favorites = getFavorites();
                const oldIndex = favorites.indexOf(draggedFavorite.dataset.city);
                const newIndex = favorites.indexOf(target.dataset.city);
                const [item] = favorites.splice(oldIndex, 1);
                favorites.splice(newIndex, 0, item);
                saveFavorites(favorites);
            }
        }
    }

    // --- Contact Form & Scroll Logic ---
    const contactForm = document.getElementById('contactForm');
    const captchaQEl = document.getElementById('captchaQ'), captchaAEl = document.getElementById('captchaA'), refreshCaptchaBtn = document.getElementById('refreshCaptcha'), formMsgEl = document.getElementById('formMsg');
    let captchaAns;
    const generateCaptcha = () => { const n1=Math.ceil(Math.random()*10), n2=Math.ceil(Math.random()*10); captchaQEl.textContent = `${n1} + ${n2}`; captchaAns = n1 + n2; };
    refreshCaptchaBtn.addEventListener('click', generateCaptcha);
    contactForm.addEventListener('submit', e => {
      e.preventDefault();
      formMsgEl.textContent = '';
      if (parseInt(captchaAEl.value) !== captchaAns) { formMsgEl.textContent = 'Incorrect CAPTCHA.'; formMsgEl.style.color = '#ff6b6b'; }
      else { formMsgEl.textContent = 'Message sent! (Demo)'; formMsgEl.style.color = 'var(--accent-color)'; contactForm.reset(); }
      generateCaptcha();
      setTimeout(() => formMsgEl.textContent = '', 5000);
    });
  
    if (hourlyScrollLeftBtn && hourlyScrollRightBtn && hourlyDetailsEl) {
        const scroll = (amount) => hourlyDetailsEl.scrollBy({ left: amount, behavior: 'smooth' });
        hourlyScrollLeftBtn.addEventListener('click', () => scroll(-hourlyDetailsEl.clientWidth * 0.8));
        hourlyScrollRightBtn.addEventListener('click', () => scroll(hourlyDetailsEl.clientWidth * 0.8));
    }

    window.addEventListener('scroll', () => scrollToTopBtn.classList.toggle('show', window.scrollY > 300));
    scrollToTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    // --- Initial Load & PWA ---
    function initialLoad() {
        setInitialTheme();
        updateUnitDisplay();
        renderFavoritesList();
        renderSearchHistory();
        generateCaptcha();
  
        const lastCity = localStorage.getItem(config.storageKeys.lastCity);
        const favorites = getFavorites();
        const initialCity = lastCity || favorites[0] || "New York";

        fetchWeatherData(initialCity);
        cityInput.value = initialCity;
    }
  
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js').catch(err => console.log('ServiceWorker registration failed: ', err));
        });
    }
  
    initialLoad();
});