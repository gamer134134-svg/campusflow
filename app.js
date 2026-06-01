// app.js - University Timetable Management App Logic
 
 // --- App State ---
 let classes = [];
 let tasks = [];
 let syllabusList = [];
 let settings = {
     theme: 'dark',
     showSat: false,
     maxPeriods: 11
 };
 let profile = {
     name: '',
     univ: '',
     creditGoal: 124
 };
 
 let currentScreen = 'timetable';
 let timetableView = 'week'; // 'week' or 'day'
 let currentDailyTab = 1; // 1: Mon, 2: Tue, ... 6: Sat
 let activeClassDetailId = null;
 let currentSemesterFilter = '1年 1Q';
 
 // Period Time Presets
 const periodTimes = {
     1: { start: "09:00", end: "09:50" },
     2: { start: "09:50", end: "10:40" },
     3: { start: "10:50", end: "11:40" },
     4: { start: "11:40", end: "12:30" },
     5: { start: "13:20", end: "14:10" },
     6: { start: "14:10", end: "15:00" },
     7: { start: "15:10", end: "16:00" },
     8: { start: "16:00", end: "16:50" },
     9: { start: "17:00", end: "17:50" },
     10: { start: "17:50", end: "18:40" },
     11: { start: "18:50", end: "19:40" }
 };
 
 // Day Names Mapping
 const dayNamesShort = ["", "月", "火", "水", "木", "金", "土"];
 const dayNamesLong = ["", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
 
 // --- Default Data for "Wow" First Impression ---
const defaultClasses = [];
const defaultTasks = [];

 
 // --- Helper Functions ---
 function getFormatDateString(offsetDays) {
     const d = new Date();
     d.setDate(d.getDate() + offsetDays);
     const yyyy = d.getFullYear();
     const mm = String(d.getMonth() + 1).padStart(2, '0');
     const dd = String(d.getDate()).padStart(2, '0');
     return `${yyyy}-${mm}-${dd}`;
 }
 
 // Show toast notification
 function showToast(message) {
     const toast = document.getElementById('toast');
     toast.textContent = message;
     toast.classList.add('show');
     setTimeout(() => {
         toast.classList.remove('show');
     }, 2500);
 }
 
 // --- LocalStorage Database Management ---
 function initDatabase() {
     // Load Settings
     const storedSettings = localStorage.getItem('cf_settings');
     if (storedSettings) {
         settings = JSON.parse(storedSettings);
         if (settings.maxPeriods === 6) {
             settings.maxPeriods = 11;
             saveToLocalStorage('cf_settings', settings);
         }
     } else {
         localStorage.setItem('cf_settings', JSON.stringify(settings));
     }
 
     // Load Profile
     const storedProfile = localStorage.getItem('cf_profile');
     if (storedProfile) {
         profile = JSON.parse(storedProfile);
         if (!profile.semester || profile.semester.includes('春') || profile.semester.includes('秋')) {
             profile.semester = '1年 1Q';
         }
     } else {
         profile = { name: "キャンパス 太郎", univ: "未来大学", creditGoal: 124, semester: "1年 1Q" };
         localStorage.setItem('cf_profile', JSON.stringify(profile));
     }
     currentSemesterFilter = profile.semester;
 
     // Load Classes
     const storedClasses = localStorage.getItem('cf_classes');
     if (storedClasses) {
         classes = JSON.parse(storedClasses);
         // Migrate any old classes with '春' or '秋' semesters to new quarter format
         classes.forEach(c => {
             if (c.semester === '1年春') c.semester = '1年 1-2Q';
             else if (c.semester === '1年秋') c.semester = '1年 3-4Q';
             else if (c.semester === '2年春') c.semester = '2年 1-2Q';
             else if (c.semester === '2年秋') c.semester = '2年 3-4Q';
             else if (c.semester === '3年春') c.semester = '3年 1-2Q';
             else if (c.semester === '3年秋') c.semester = '3年 3-4Q';
             else if (c.semester === '4年春') c.semester = '4年 1-2Q';
             else if (c.semester === '4年秋') c.semester = '4年 3-4Q';
         });
     } else {
         classes = defaultClasses;
         localStorage.setItem('cf_classes', JSON.stringify(classes));
     }
 
     // Load Tasks
     const storedTasks = localStorage.getItem('cf_tasks');
     if (storedTasks) {
         tasks = JSON.parse(storedTasks);
     } else {
         // Set dynamic date relative to today for default tasks if they exist
         if (defaultTasks.length >= 3) {
             defaultTasks[0].dueDate = getFormatDateString(2); // In 2 days
             defaultTasks[1].dueDate = getFormatDateString(5); // In 5 days
             defaultTasks[2].dueDate = getFormatDateString(-1); // Yesterday
         }
         tasks = defaultTasks;
         localStorage.setItem('cf_tasks', JSON.stringify(tasks));
     }
     // Initial sync on load
     syncDataToServer();
}

function saveToLocalStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
    
    // Auto-sync to data.json for daily notifications
    if (key === 'cf_classes' || key === 'cf_tasks' || key === 'cf_profile' || key === 'cf_settings') {
        syncDataToServer();
        scheduleAndroidNotifications();
    }
}

function syncDataToServer() {
    const data = {
        classes,
        tasks,
        profile,
        settings
    };
    fetch('/api/sync', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(res => {
        console.log("Data synced to local disk successfully:", res);
    })
    .catch(err => {
        console.warn("Local disk sync failed (running on static or offline server):", err);
    });
}

// --- UI Actions & Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    // Register PWA Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => {
                console.log("Service Worker registered successfully:", reg);
                // Schedule notifications once Service Worker is ready
                scheduleAndroidNotifications();
            })
            .catch(err => {
                console.error("Service Worker registration failed:", err);
            });
    }

    initDatabase();
    applyTheme(settings.theme);
    syncSettingsUI();
    updateClock();
    setInterval(updateClock, 30000); // Update clock every 30s
    
    // Initialize color picker options in class form
    renderColorPicker();
    updatePeriodSelector();

    // Render initial timetable
    renderSemesterTabs();
    renderTimetable();
    
    // Navigation handlers
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            navItems.forEach(nav => nav.classList.remove('active'));
            const clickedItem = e.currentTarget;
            clickedItem.classList.add('active');
        });
    });

    // Load syllabus JSON data
    fetch('syllabus.json')
        .then(res => res.json())
        .then(data => {
            syllabusList = data;
            console.log(`Syllabus loaded: ${syllabusList.length} courses`);
        })
        .catch(err => {
            console.warn("Syllabus JSON could not be loaded. Syllabus search feature will be disabled.", err);
        });

    // Close search dropdown on clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            const results = document.getElementById('class-search-results');
            if (results) results.style.display = 'none';
        }
    });

    // Show daily summary if not shown yet today and classes are registered
    const lastShownDate = localStorage.getItem('cf_last_summary_date');
    const todayStr = getFormatDateString(0);
    if (lastShownDate !== todayStr && classes.length > 0) {
        setTimeout(() => {
            showDailySummaryModal();
            localStorage.setItem('cf_last_summary_date', todayStr);
        }, 1000);
    }
});

// Update status bar clock and timetable header date
function updateClock() {
    const now = new Date();


    // Timetable header date: e.g., "6月1日 (月)"
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const dayIndex = now.getDay(); // 0 is Sun, 1 is Mon...
    const dayName = ["日", "月", "火", "水", "木", "金", "土"][dayIndex];
    document.getElementById('timetable-header-date').textContent = `時間割 (${month}/${date}・${dayName})`;

    // Check and send system push notifications at 8:00 AM
    checkAndSendDailyNotification();
}

// Apply Selected Theme to Body
function applyTheme(themeName) {
    document.body.className = `theme-${themeName}`;
    settings.theme = themeName;
    saveToLocalStorage('cf_settings', settings);

    // Update active theme bubble in settings
    const bubbles = document.querySelectorAll('.theme-option');
    bubbles.forEach(bubble => {
        bubble.classList.remove('active');
        if (bubble.classList.contains(`theme-opt-${themeName}`)) {
            bubble.classList.add('active');
        }
    });
}

function setTheme(themeName) {
    applyTheme(themeName);
    showToast(`テーマを切り替えました`);
}

function syncSettingsUI() {
    document.getElementById('profile-name').value = profile.name;
    document.getElementById('profile-univ').value = profile.univ;
    document.getElementById('profile-credit-goal').value = profile.creditGoal;
    document.getElementById('profile-semester').value = profile.semester || '1年春';
    document.getElementById('setting-show-sat').checked = settings.showSat;
    document.getElementById('setting-max-periods').value = settings.maxPeriods;

    // Toggle Saturday option for dropdown day selector in Add Class
    const satOpt = document.getElementById('class-day-sat-opt');
    if (settings.showSat) {
        satOpt.style.display = 'block';
        document.getElementById('sat-day-tab').style.display = 'block';
    } else {
        satOpt.style.display = 'none';
        document.getElementById('sat-day-tab').style.display = 'none';
        if (currentDailyTab === 6) selectDailyTab(1);
    }
}

function saveProfile() {
    profile.name = document.getElementById('profile-name').value;
    profile.univ = document.getElementById('profile-univ').value;
    profile.creditGoal = parseInt(document.getElementById('profile-credit-goal').value) || 124;
    profile.semester = document.getElementById('profile-semester').value;
    saveToLocalStorage('cf_profile', profile);
    
    // Switch semester filter to match current profile semester
    currentSemesterFilter = profile.semester;
    renderSemesterTabs();
    renderTimetable();
    
    // Refresh GPA screen stats if currently active
    if (currentScreen === 'gpa') {
        renderGPAScreen();
    }
}

function toggleSaturdayView() {
    settings.showSat = document.getElementById('setting-show-sat').checked;
    saveToLocalStorage('cf_settings', settings);
    syncSettingsUI();
    renderTimetable();
    showToast(settings.showSat ? "土曜日を表示しました" : "土曜日を非表示にしました");
}

function changeMaxPeriods() {
    settings.maxPeriods = parseInt(document.getElementById('setting-max-periods').value);
    saveToLocalStorage('cf_settings', settings);
    updatePeriodSelector();
    renderTimetable();
    showToast(`最大時限数を ${settings.maxPeriods}時限 に変更しました`);
}

function updatePeriodSelector() {
    const select = document.getElementById('class-period');
    select.innerHTML = '';
    for (let i = 1; i <= settings.maxPeriods; i++) {
        const time = periodTimes[i] ? ` (${periodTimes[i].start}-${periodTimes[i].end})` : '';
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${i}時限${time}`;
        select.appendChild(opt);
    }
}

function renderColorPicker() {
    const container = document.getElementById('class-color-picker');
    container.innerHTML = '';
    for (let i = 1; i <= 8; i++) {
        const opt = document.createElement('div');
        opt.className = `color-picker-opt sub-color-${i}`;
        opt.dataset.index = i;
        opt.onclick = (e) => {
            document.querySelectorAll('.color-picker-opt').forEach(el => el.classList.remove('active'));
            e.currentTarget.classList.add('active');
            document.getElementById('class-color-idx').value = i;
        };
        if (i === 1) opt.classList.add('active');
        container.appendChild(opt);
    }
}

// --- Screen Navigation ---
function switchScreen(screenName) {
    currentScreen = screenName;
    
    // Hide all screens
    const screens = document.querySelectorAll('.app-screen');
    screens.forEach(screen => screen.classList.remove('active'));
    
    // Show active screen
    const activeScreen = document.getElementById(`screen-${screenName}`);
    activeScreen.classList.add('active');
    
    // Perform screen-specific rendering
    if (screenName === 'timetable') {
        renderTimetable();
    } else if (screenName === 'tasks') {
        renderTasksScreen();
    } else if (screenName === 'gpa') {
        renderGPAScreen();
    } else if (screenName === 'settings') {
        syncSettingsUI();
    }
}

// --- TIMETABLE SCREEN LOGIC ---
function setTimetableView(view) {
    timetableView = view;
    document.getElementById('toggle-week').classList.toggle('active', view === 'week');
    document.getElementById('toggle-day').classList.toggle('active', view === 'day');
    
    document.getElementById('weekly-grid-container').style.display = view === 'week' ? 'block' : 'none';
    document.getElementById('day-selector-container').style.display = view === 'day' ? 'flex' : 'none';
    document.getElementById('daily-list-container').style.display = view === 'day' ? 'flex' : 'none';
    
    renderTimetable();
}

function selectDailyTab(dayIdx) {
    currentDailyTab = dayIdx;
    document.querySelectorAll('.day-tab').forEach(tab => {
        tab.classList.toggle('active', parseInt(tab.dataset.day) === dayIdx);
    });
    renderDailyList();
}

function isClassInActiveSemester(c, activeSemester) {
    if (c.semester === activeSemester) return true;
    
    // Check multi-quarter spans
    if (activeSemester.endsWith(" 1Q") || activeSemester.endsWith(" 2Q")) {
        const yearPrefix = activeSemester.split(" ")[0]; // e.g. "1年"
        if (c.semester === `${yearPrefix} 1-2Q`) return true;
    }
    if (activeSemester.endsWith(" 3Q") || activeSemester.endsWith(" 4Q")) {
        const yearPrefix = activeSemester.split(" ")[0]; // e.g. "1年"
        if (c.semester === `${yearPrefix} 3-4Q`) return true;
    }
    return false;
}

function classesOverlapSemester(semA, semB) {
    if (semA === semB) return true;
    const partsA = semA.split(" ");
    const partsB = semB.split(" ");
    if (partsA.length !== 2 || partsB.length !== 2) return false;
    
    const yearA = partsA[0];
    const yearB = partsB[0];
    if (yearA !== yearB) return false;
    
    const termA = partsA[1];
    const termB = partsB[1];
    
    if (termA === "1-2Q" && (termB === "1Q" || termB === "2Q")) return true;
    if (termB === "1-2Q" && (termA === "1Q" || termA === "2Q")) return true;
    
    if (termA === "3-4Q" && (termB === "3Q" || termB === "4Q")) return true;
    if (termB === "3-4Q" && (termA === "3Q" || termA === "4Q")) return true;
    
    return false;
}

function renderSemesterTabs() {
    const container = document.getElementById('timetable-semester-tabs');
    if (!container) return;
    container.innerHTML = '';
    
    // Generate 16 quarters: 1年 1Q to 4年 4Q
    const semesters = [];
    for (let y = 1; y <= 4; y++) {
        for (let q = 1; q <= 4; q++) {
            semesters.push(`${y}年 ${q}Q`);
        }
    }
    
    semesters.forEach(sem => {
        const tab = document.createElement('button');
        tab.className = `day-tab ${currentSemesterFilter === sem ? 'active' : ''}`;
        tab.textContent = sem;
        tab.style.padding = '6px 10px';
        tab.style.fontSize = '0.7rem';
        tab.style.borderRadius = '8px';
        tab.onclick = () => {
            currentSemesterFilter = sem;
            renderSemesterTabs();
            renderTimetable();
        };
        container.appendChild(tab);
    });
}

function renderTimetable() {
    if (timetableView === 'week') {
        renderWeeklyGrid();
    } else {
        renderDailyList();
    }
    renderIntensiveClasses();
}

// Render the entire weekly grid (Mon-Fri/Sat, 1 to MaxPeriods)
function renderWeeklyGrid() {
    const grid = document.getElementById('weekly-grid');
    grid.innerHTML = '';
    
    const daysCount = settings.showSat ? 6 : 5;
    grid.className = `grid-wrapper ${settings.showSat ? 'show-sat' : ''}`;
    
    // 1. Render Header row (Top-left corner + days headers)
    const cornerCell = document.createElement('div');
    cornerCell.className = 'grid-header-cell';
    cornerCell.textContent = '';
    cornerCell.style.gridRow = "1";
    cornerCell.style.gridColumn = "1";
    grid.appendChild(cornerCell);
    
    for (let day = 1; day <= daysCount; day++) {
        const header = document.createElement('div');
        header.className = `grid-header-cell ${day === 6 ? 'sat' : ''}`;
        header.textContent = dayNamesShort[day];
        header.style.gridRow = "1";
        header.style.gridColumn = (day + 1).toString();
        grid.appendChild(header);
    }
    
    // 2. Render Period headers
    for (let period = 1; period <= settings.maxPeriods; period++) {
        const periodHeader = document.createElement('div');
        periodHeader.className = 'grid-period-cell';
        const start = periodTimes[period] ? periodTimes[period].start.split(':')[0] : '';
        periodHeader.innerHTML = `${period}<span>${start}時</span>`;
        periodHeader.style.gridRow = (period + 1).toString();
        periodHeader.style.gridColumn = "1";
        grid.appendChild(periodHeader);
    }

    // Get all regular classes in the current semester
    const semesterClasses = classes.filter(c => isClassInActiveSemester(c, currentSemesterFilter) && !c.isIntensive);

    // Track slots that are already rendered by spanned cells
    const spannedSlots = new Set();
    
    // 3. Render Grid cells row by row (explicit position to support spanned cells)
    for (let day = 1; day <= daysCount; day++) {
        for (let period = 1; period <= settings.maxPeriods; period++) {
            if (spannedSlots.has(`${day}-${period}`)) {
                continue;
            }

            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.day = day;
            cell.dataset.period = period;
            
            // Search for class in this slot
            const matchedClass = semesterClasses.find(c => c.day === day && c.period === period);
            if (matchedClass) {
                // Find consecutive periods with the same class name
                let span = 1;
                while (period + span <= settings.maxPeriods) {
                    const nextC = semesterClasses.find(x => x.day === day && x.period === period + span);
                    if (nextC && nextC.name === matchedClass.name) {
                        span++;
                    } else {
                        break;
                    }
                }

                // If span > 1, adjust aspect ratio and height
                if (span > 1) {
                    cell.classList.add('spanned');
                    cell.style.aspectRatio = "auto";
                    cell.style.height = "100%";
                }

                // Mark subsequent periods as spanned
                for (let s = 1; s < span; s++) {
                    spannedSlots.add(`${day}-${period + s}`);
                }

                // Position cell
                cell.style.gridRow = `${period + 1} / span ${span}`;
                cell.style.gridColumn = (day + 1).toString();

                // Find tasks linked to any slot of the same course name in this semester
                const sameNameClassIds = classes.filter(x => x.name === matchedClass.name && x.semester === matchedClass.semester).map(x => x.id);
                const classTasksCount = tasks.filter(t => sameNameClassIds.includes(t.classId) && !t.completed).length;
                
                const card = document.createElement('div');
                card.className = `grid-class-card sub-color-${matchedClass.colorIdx}`;
                card.innerHTML = `
                    <div class="grid-class-name">${matchedClass.name}</div>
                    <div class="grid-class-room">${matchedClass.room || ''}</div>
                `;
                
                if (classTasksCount > 0) {
                    const badge = document.createElement('div');
                    badge.className = 'grid-class-badge';
                    card.appendChild(badge);
                }
                
                card.onclick = (e) => {
                    e.stopPropagation();
                    openClassDetailModal(matchedClass.id);
                };
                
                cell.appendChild(card);
            } else {
                // Empty cell
                cell.style.gridRow = (period + 1).toString();
                cell.style.gridColumn = (day + 1).toString();
                cell.onclick = () => {
                    openAddClassModal(day, period);
                };
            }
            grid.appendChild(cell);
        }
    }
}

// Render daily schedule list view
function renderDailyList() {
    const listContainer = document.getElementById('daily-list-container');
    listContainer.innerHTML = '';
    
    // Filter classes for currentDailyTab and currentSemesterFilter
    const dayClasses = classes.filter(c => c.day === currentDailyTab && isClassInActiveSemester(c, currentSemesterFilter) && !c.isIntensive);
    
    // Sort classes by period
    dayClasses.sort((a, b) => a.period - b.period);
    
    if (dayClasses.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-mug-hot"></i>
                <p>この曜日に登録された講義はありません。<br>時間割をタップして講義を追加しましょう！</p>
                <button class="btn-primary" onclick="openAddClassModal(${currentDailyTab})">講義を追加</button>
            </div>
        `;
        return;
    }
    
    dayClasses.forEach(c => {
        const time = periodTimes[c.period] ? `${periodTimes[c.period].start} - ${periodTimes[c.period].end}` : '';
        const classTasksCount = tasks.filter(t => t.classId === c.id && !t.completed).length;
        const totalAbsent = c.attendance ? c.attendance.absent : 0;
        
        const row = document.createElement('div');
        row.className = 'daily-card';
        row.innerHTML = `
            <div class="daily-time-col">
                <span class="period">${c.period}</span>
                <span class="time">${periodTimes[c.period] ? periodTimes[c.period].start : ''}</span>
            </div>
            <div class="daily-class-card sub-color-${c.colorIdx}" onclick="openClassDetailModal('${c.id}')">
                <div class="info">
                    <span class="daily-class-title">${c.name}</span>
                    <div class="daily-class-meta">
                        <span><i class="fa-solid fa-location-dot"></i>${c.room || '未指定'}</span>
                        <span><i class="fa-solid fa-user"></i>${c.teacher || '未指定'}</span>
                    </div>
                </div>
                <div class="daily-card-badge-container">
                    ${classTasksCount > 0 ? `<span class="task-count-badge">課題 ${classTasksCount}</span>` : ''}
                    ${totalAbsent >= 4 ? `<span class="attendance-warning-badge"><i class="fa-solid fa-triangle-exclamation"></i> 警告</span>` : ''}
                </div>
            </div>
        `;
        listContainer.appendChild(row);
    });
}

// --- MODAL UTILITIES ---
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function closeModalOnOverlay(event, modalId) {
    if (event.target.id === modalId) {
        closeModal(modalId);
    }
}

// --- ADD / EDIT CLASS SUBMISSIONS ---
function openAddClassModal(day = null, period = null) {
    // Reset form fields
    document.getElementById('class-edit-id').value = '';
    document.getElementById('class-name').value = '';
    document.getElementById('class-room').value = '';
    document.getElementById('class-teacher').value = '';
    document.getElementById('class-credits').value = '2';
    document.getElementById('class-semester').value = currentSemesterFilter;
    document.getElementById('class-notes').value = '';
    
    // Reset intensive checkbox
    const isIntensiveCheckbox = document.getElementById('class-is-intensive');
    if (isIntensiveCheckbox) {
        isIntensiveCheckbox.checked = false;
    }
    toggleIntensiveFormFields(false);
    
    // Reset syllabus search inputs
    const searchInput = document.getElementById('class-syllabus-search');
    if (searchInput) searchInput.value = '';
    const searchResults = document.getElementById('class-search-results');
    if (searchResults) {
        searchResults.innerHTML = '';
        searchResults.style.display = 'none';
    }

    // Reset color picker
    document.getElementById('class-color-idx').value = '1';
    document.querySelectorAll('.color-picker-opt').forEach(el => {
        el.classList.remove('active');
        if (el.dataset.index === '1') el.classList.add('active');
    });

    // Populate dropdown day/period
    if (day !== null) {
        document.getElementById('class-day').value = day;
    } else {
        document.getElementById('class-day').value = "1";
    }

    if (period !== null) {
        document.getElementById('class-period').value = period;
    } else {
        document.getElementById('class-period').value = "1";
    }

    document.getElementById('class-modal-title').textContent = "講義の登録";
    document.getElementById('class-submit-btn').textContent = "登録する";
    
    openModal('modal-add-class');
}

// Syllabus Search Logic
function handleSyllabusSearch(query) {
    const resultsContainer = document.getElementById('class-search-results');
    if (!resultsContainer) return;

    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) {
        resultsContainer.innerHTML = '';
        resultsContainer.style.display = 'none';
        return;
    }

    // Filter syllabus list by name, code or category
    const filtered = syllabusList.filter(item => {
        const nameMatch = item.name.toLowerCase().includes(trimmedQuery);
        const codeMatch = item.code.toLowerCase().includes(trimmedQuery);
        const categoryMatch = item.category.toLowerCase().includes(trimmedQuery);
        return nameMatch || codeMatch || categoryMatch;
    });

    // Limit to 5 results
    const limited = filtered.slice(0, 5);

    if (limited.length === 0) {
        resultsContainer.innerHTML = '<div style="padding: 10px 14px; font-size: 0.75rem; color: var(--text-muted);">一致する科目がありません</div>';
        resultsContainer.style.display = 'block';
        return;
    }

    resultsContainer.innerHTML = '';
    limited.forEach(item => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `
            <span class="title">${item.code ? `[${item.code}] ` : ''}${item.name}</span>
            <span class="meta">${item.category} &gt; ${item.subcategory} (${item.credits}単位)</span>
        `;
        div.onclick = () => selectSyllabusCourse(item);
        resultsContainer.appendChild(div);
    });
    
    resultsContainer.style.display = 'block';
}

function selectSyllabusCourse(course) {
    // Fill class name
    document.getElementById('class-name').value = course.name;
    
    // Fill credits
    document.getElementById('class-credits').value = course.credits.toString();

    // Auto-select category based theme color index
    // 1: Purple (default 専門), 2: Blue (外国語), 3: Teal, 4: Orange, 5: Pink, 6: Coral (教養), 7: Plum, 8: Slate
    let colorIdx = 8;
    if (course.category.includes("教養")) {
        colorIdx = 6; // Coral
    } else if (course.category.includes("外国語")) {
        colorIdx = 2; // Blue
    } else if (course.category.includes("専門")) {
        colorIdx = 1; // Purple
    }

    document.getElementById('class-color-idx').value = colorIdx.toString();
    document.querySelectorAll('.color-picker-opt').forEach(el => {
        el.classList.remove('active');
        if (parseInt(el.dataset.index) === colorIdx) {
            el.classList.add('active');
        }
    });

    // Hide search results and clear search field
    const resultsContainer = document.getElementById('class-search-results');
    if (resultsContainer) {
        resultsContainer.innerHTML = '';
        resultsContainer.style.display = 'none';
    }
    const searchInput = document.getElementById('class-syllabus-search');
    if (searchInput) {
        searchInput.value = '';
    }

    showToast(`「${course.name}」を入力しました`);
}

function saveClass(event) {
    event.preventDefault();

    const editId = document.getElementById('class-edit-id').value;
    const name = document.getElementById('class-name').value.trim();
    const room = document.getElementById('class-room').value.trim();
    const teacher = document.getElementById('class-teacher').value.trim();
    const credits = parseInt(document.getElementById('class-credits').value);
    const semester = document.getElementById('class-semester').value;
    const isIntensive = document.getElementById('class-is-intensive') ? document.getElementById('class-is-intensive').checked : false;
    let day = parseInt(document.getElementById('class-day').value);
    let period = parseInt(document.getElementById('class-period').value);
    const colorIdx = parseInt(document.getElementById('class-color-idx').value);
    const notes = document.getElementById('class-notes').value.trim();

    if (!name) {
        showToast("講義名を入力してください");
        return;
    }

    if (isIntensive) {
        day = 0;
        period = 0;
    } else {
        // Check duplicate slot within the same semester (exclude current editing class) for regular classes only
        const duplicate = classes.find(c => c.day === day && c.period === period && classesOverlapSemester(c.semester, semester) && c.id !== editId && !c.isIntensive);
        if (duplicate) {
            showToast(`すでに【${duplicate.name}】が登録されている時限です`);
            return;
        }
    }

    if (editId) {
        // Edit mode
        const clsIndex = classes.findIndex(c => c.id === editId);
        if (clsIndex !== -1) {
            classes[clsIndex] = {
                ...classes[clsIndex],
                name, room, teacher, credits, semester, day, period, colorIdx, notes, isIntensive
            };
            showToast("講義情報を更新しました");
        }
    } else {
        // Create mode
        const newClass = {
            id: 'c_' + Date.now(),
            name, room, teacher, credits, semester, day, period, colorIdx, notes, isIntensive,
            attendance: { attend: 0, absent: 0, late: 0 },
            grade: 'none'
        };
        classes.push(newClass);
        showToast("講義を新しく登録しました");
    }

    saveToLocalStorage('cf_classes', classes);
    closeModal('modal-add-class');
    renderTimetable();
}

// --- CLASS DETAIL SCREEN LOGIC ---
function openClassDetailModal(classId) {
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;

    activeClassDetailId = classId;

    document.getElementById('detail-class-name').textContent = cls.name;
    document.getElementById('detail-class-day-period').textContent = cls.isIntensive ? '集中講義' : `${dayNamesLong[cls.day]} ${cls.period}時限`;
    document.getElementById('detail-class-room').innerHTML = `<i class="fa-solid fa-location-dot"></i> ${cls.room || '未指定'}`;
    document.getElementById('detail-class-teacher').innerHTML = `<i class="fa-solid fa-user"></i> ${cls.teacher || '教員未指定'}`;
    document.getElementById('detail-class-credits').textContent = `${cls.credits}単位`;
    document.getElementById('detail-class-semester').textContent = cls.semester;
    document.getElementById('detail-class-notes').textContent = cls.notes || "メモはありません";

    // Setup attendance count UI
    document.getElementById('detail-attend-count').textContent = cls.attendance.attend;
    document.getElementById('detail-absent-count').textContent = cls.attendance.absent;
    document.getElementById('detail-late-count').textContent = cls.attendance.late;

    // Warning alert toggle
    const warning = document.getElementById('attendance-rate-warning');
    if (cls.attendance.absent >= 4) {
        warning.style.display = 'flex';
    } else {
        warning.style.display = 'none';
    }

    // Grades Select sync
    document.getElementById('detail-grade-select').value = cls.grade || 'none';

    // Linked tasks lists
    renderClassDetailTasks(classId);

    // Syllabus link resolution
    const syllabusUrl = getSyllabusUrlForClass(cls);
    const syllabusRow = document.getElementById('detail-class-syllabus-row');
    const syllabusLink = document.getElementById('detail-class-syllabus-link');
    if (syllabusRow && syllabusLink) {
        if (syllabusUrl) {
            syllabusLink.href = syllabusUrl;
            syllabusRow.style.display = 'block';
        } else {
            syllabusRow.style.display = 'none';
        }
    }

    // Intensive schedule grid
    const intensiveContainer = document.getElementById('detail-intensive-schedule-container');
    if (intensiveContainer) {
        if (cls.isIntensive && cls.slots && cls.slots.length > 0) {
            intensiveContainer.style.display = 'block';
            renderMiniScheduleGrid(cls);
        } else {
            intensiveContainer.style.display = 'none';
        }
    }

    openModal('modal-class-detail');
}

function getSyllabusUrlForClass(cls) {
    if (cls.syllabusUrl) return cls.syllabusUrl;

    let code = "";
    let name = cls.name;
    const match = cls.name.match(/^([A-Z0-9\-]+)\s+(.+)$/);
    if (match) {
        code = match[1];
        name = match[2];
    }

    let course = null;
    if (code) {
        course = syllabusList.find(x => x.code === code);
    }
    if (!course) {
        course = syllabusList.find(x => x.name === name || x.name === cls.name);
    }

    if (course && course.url) {
        return `https://www.u-aizu.ac.jp/official/curriculum/syllabus/${course.url}`;
    }

    return null;
}

function renderMiniScheduleGrid(cls) {
    const grid = document.getElementById('detail-intensive-schedule-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const activeColor = `hsl(var(--subject-${cls.colorIdx || 8}))`;
    grid.style.setProperty('--active-color', activeColor);

    // Header corner
    const cornerCell = document.createElement('div');
    cornerCell.className = 'mini-grid-header-cell';
    cornerCell.textContent = '';
    grid.appendChild(cornerCell);

    const daysShort = ["月", "火", "水", "木", "金", "土"];
    daysShort.forEach(dayName => {
        const header = document.createElement('div');
        header.className = 'mini-grid-header-cell';
        header.textContent = dayName;
        grid.appendChild(header);
    });

    const activeSlots = new Set(cls.slots);

    for (let period = 1; period <= 11; period++) {
        // Period header
        const periodHeader = document.createElement('div');
        periodHeader.className = 'mini-grid-period-cell';
        periodHeader.textContent = period;
        grid.appendChild(periodHeader);

        // Day cells (Mon=1 to Sat=6)
        for (let day = 1; day <= 6; day++) {
            const cell = document.createElement('div');
            cell.className = 'mini-grid-cell';
            if (activeSlots.has(`${day}-${period}`)) {
                cell.classList.add('active');
            }
            grid.appendChild(cell);
        }
    }
}

function adjustAttendance(type, amount) {
    if (!activeClassDetailId) return;
    const clsIndex = classes.findIndex(c => c.id === activeClassDetailId);
    if (clsIndex === -1) return;

    const cls = classes[clsIndex];
    if (!cls.attendance) cls.attendance = { attend: 0, absent: 0, late: 0 };

    cls.attendance[type] = Math.max(0, cls.attendance[type] + amount);
    
    // Save
    classes[clsIndex] = cls;
    saveToLocalStorage('cf_classes', classes);

    // Refresh Modal details
    document.getElementById(`detail-${type}-count`).textContent = cls.attendance[type];

    // Toggle Warning bar
    const warning = document.getElementById('attendance-rate-warning');
    if (cls.attendance.absent >= 4) {
        warning.style.display = 'flex';
    } else {
        warning.style.display = 'none';
    }

    // Re-render schedule lists in background
    renderTimetable();
}

function updateClassGrade() {
    if (!activeClassDetailId) return;
    const cls = classes.find(c => c.id === activeClassDetailId);
    if (!cls) return;

    const newGrade = document.getElementById('detail-grade-select').value;
    
    // Update grade for all classes with the same name in the same semester
    classes.forEach(c => {
        if (c.name === cls.name && c.semester === cls.semester) {
            c.grade = newGrade;
        }
    });
    
    saveToLocalStorage('cf_classes', classes);
    showToast("成績評定を更新しました");
}

function deleteClassConfirm() {
    if (!activeClassDetailId) return;
    const cls = classes.find(c => c.id === activeClassDetailId);
    if (!cls) return;

    if (confirm(`講義「${cls.name}」を削除してもよろしいですか？\n※関連する課題は「一般」として維持されます。`)) {
        // Find all class slots with the same name and semester
        const sameNameClasses = classes.filter(c => c.name === cls.name && c.semester === cls.semester);
        const sameNameIds = sameNameClasses.map(c => c.id);

        // Disassociate related tasks
        tasks.forEach(t => {
            if (sameNameIds.includes(t.classId)) {
                t.classId = 'general';
            }
        });
        saveToLocalStorage('cf_tasks', tasks);

        // Delete all matching class slots
        classes = classes.filter(c => !(c.name === cls.name && c.semester === cls.semester));
        saveToLocalStorage('cf_classes', classes);

        showToast("講義を削除しました");
        closeModal('modal-class-detail');
        renderTimetable();
    }
}

function editClassFromDetail() {
    if (!activeClassDetailId) return;
    const cls = classes.find(c => c.id === activeClassDetailId);
    if (!cls) return;

    // Fill form fields with existing data
    document.getElementById('class-edit-id').value = cls.id;
    document.getElementById('class-name').value = cls.name;
    document.getElementById('class-room').value = cls.room;
    document.getElementById('class-teacher').value = cls.teacher;
    document.getElementById('class-credits').value = cls.credits;
    document.getElementById('class-semester').value = cls.semester;
    
    // Set intensive checkbox value
    const isIntensiveCheckbox = document.getElementById('class-is-intensive');
    if (isIntensiveCheckbox) {
        isIntensiveCheckbox.checked = !!cls.isIntensive;
    }
    toggleIntensiveFormFields(!!cls.isIntensive);

    document.getElementById('class-day').value = cls.isIntensive ? 1 : cls.day;
    document.getElementById('class-period').value = cls.isIntensive ? 1 : cls.period;
    document.getElementById('class-notes').value = cls.notes;

    // Select color picker index
    document.getElementById('class-color-idx').value = cls.colorIdx;
    document.querySelectorAll('.color-picker-opt').forEach(el => {
        el.classList.remove('active');
        if (parseInt(el.dataset.index) === cls.colorIdx) el.classList.add('active');
    });

    document.getElementById('class-modal-title').textContent = "講義の編集";
    document.getElementById('class-submit-btn').textContent = "更新する";

    closeModal('modal-class-detail');
    openModal('modal-add-class');
}

// Render associated tasks in class detail modal
function renderClassDetailTasks(classId) {
    const list = document.getElementById('detail-class-tasks-list');
    list.innerHTML = '';

    const cls = classes.find(c => c.id === classId);
    if (!cls) return;
    const sameNameClassIds = classes.filter(x => x.name === cls.name && x.semester === cls.semester).map(x => x.id);

    const classTasks = tasks.filter(t => sameNameClassIds.includes(t.classId));
    if (classTasks.length === 0) {
        list.innerHTML = '<p style="font-size: 0.7rem; color: var(--text-muted); text-align: center; padding: 12px 0;">期限付きの課題はありません</p>';
        return;
    }

    classTasks.forEach(t => {
        const card = document.createElement('div');
        card.style.display = 'flex';
        card.style.justifyContent = 'space-between';
        card.style.alignItems = 'center';
        card.style.background = 'rgba(0,0,0,0.1)';
        card.style.border = '1px solid var(--border-color)';
        card.style.borderRadius = '8px';
        card.style.padding = '6px 10px';
        card.style.marginBottom = '4px';
        card.style.fontSize = '0.75rem';

        const label = document.createElement('span');
        label.textContent = t.title;
        if (t.completed) {
            label.style.textDecoration = 'line-through';
            label.style.opacity = '0.5';
        }

        const date = document.createElement('span');
        date.textContent = `${t.dueDate.split('-')[1]}/${t.dueDate.split('-')[2]}`;
        date.style.color = t.completed ? 'var(--text-muted)' : 'var(--primary)';
        date.style.fontWeight = '700';

        card.appendChild(label);
        card.appendChild(date);
        list.appendChild(card);
    });
}

function quickAddTaskFromDetail() {
    if (!activeClassDetailId) return;
    closeModal('modal-class-detail');
    openAddTaskModal(activeClassDetailId);
}

// --- TASKS SCREEN LOGIC ---
function openAddTaskModal(classId = null) {
    // Reset Form
    document.getElementById('task-title').value = '';
    document.getElementById('task-due-date').value = getFormatDateString(1); // Tomorrow by default
    document.getElementById('task-priority').value = 'medium';
    document.getElementById('task-memo').value = '';

    // Populate subjects select dropdown
    const select = document.getElementById('task-class-select');
    select.innerHTML = '<option value="general">一般 / その他</option>';
    
    classes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        select.appendChild(opt);
    });

    if (classId) {
        select.value = classId;
    } else {
        select.value = 'general';
    }

    openModal('modal-add-task');
}

function saveTask(event) {
    event.preventDefault();

    const title = document.getElementById('task-title').value.trim();
    const classId = document.getElementById('task-class-select').value;
    const dueDate = document.getElementById('task-due-date').value;
    const priority = document.getElementById('task-priority').value;
    const memo = document.getElementById('task-memo').value.trim();

    if (!title || !dueDate) {
        showToast("必須項目を入力してください");
        return;
    }

    const newTask = {
        id: 't_' + Date.now(),
        title, classId, dueDate, priority, memo,
        completed: false
    };

    tasks.push(newTask);
    saveToLocalStorage('cf_tasks', tasks);
    showToast("課題を追加しました");
    closeModal('modal-add-task');

    if (currentScreen === 'tasks') {
        renderTasksScreen();
    } else {
        renderTimetable();
    }
}

function toggleTaskStatus(taskId) {
    const tIndex = tasks.findIndex(t => t.id === taskId);
    if (tIndex === -1) return;

    tasks[tIndex].completed = !tasks[tIndex].completed;
    saveToLocalStorage('cf_tasks', tasks);
    
    showToast(tasks[tIndex].completed ? "課題を完了にしました！🎉" : "課題を未完了に戻しました");
    
    renderTasksScreen();
}

function deleteTask(taskId) {
    if (confirm("この課題を削除してもよろしいですか？")) {
        tasks = tasks.filter(t => t.id !== taskId);
        saveToLocalStorage('cf_tasks', tasks);
        showToast("課題を削除しました");
        renderTasksScreen();
    }
}

function renderTasksScreen() {
    const activeList = document.getElementById('active-tasks-list');
    const completedList = document.getElementById('completed-tasks-list');
    activeList.innerHTML = '';
    completedList.innerHTML = '';

    // Calculate dates countdowns
    const todayStr = getFormatDateString(0);
    const today = new Date(todayStr);

    let activeCount = 0;
    let urgentCount = 0;

    // Sort tasks: Active sorted by closest due date, Completed sorted by furthest due date
    const activeTasks = tasks.filter(t => !t.completed).sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
    const completedTasks = tasks.filter(t => t.completed).sort((a,b) => new Date(b.dueDate) - new Date(a.dueDate));

    activeTasks.forEach(t => {
        activeCount++;

        // Calculate diff in days
        const due = new Date(t.dueDate);
        const diffTime = due - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let dueLabel = "";
        let isDanger = false;
        
        if (diffDays < 0) {
            dueLabel = "期限切れ";
            isDanger = true;
        } else if (diffDays === 0) {
            dueLabel = "今日締め切り";
            isDanger = true;
            urgentCount++;
        } else if (diffDays === 1) {
            dueLabel = "明日締め切り";
            isDanger = true;
            urgentCount++;
        } else if (diffDays <= 3) {
            dueLabel = `残り ${diffDays} 日`;
            isDanger = true;
            urgentCount++;
        } else {
            dueLabel = `期限: ${t.dueDate.replace(/-/g, '/')}`;
        }

        const matchedClass = classes.find(c => c.id === t.classId);
        const subjectName = matchedClass ? matchedClass.name : '一般/その他';

        const row = document.createElement('div');
        row.className = `task-item priority-${t.priority}`;
        row.innerHTML = `
            <div class="task-checkbox-container">
                <input type="checkbox" class="task-checkbox" onchange="toggleTaskStatus('${t.id}')">
            </div>
            <div class="task-body">
                <span class="task-title">${t.title}</span>
                <div class="task-details">
                    <span class="task-subject">${subjectName}</span>
                    <span class="task-due ${isDanger ? 'danger' : ''}">
                        <i class="fa-regular fa-clock"></i> ${dueLabel}
                    </span>
                </div>
            </div>
            <button class="task-delete-btn" onclick="deleteTask('${t.id}')"><i class="fa-solid fa-trash"></i></button>
        `;
        activeList.appendChild(row);
    });

    completedTasks.forEach(t => {
        const matchedClass = classes.find(c => c.id === t.classId);
        const subjectName = matchedClass ? matchedClass.name : '一般/その他';

        const row = document.createElement('div');
        row.className = `task-item completed`;
        row.innerHTML = `
            <div class="task-checkbox-container">
                <input type="checkbox" class="task-checkbox" checked onchange="toggleTaskStatus('${t.id}')">
            </div>
            <div class="task-body">
                <span class="task-title">${t.title}</span>
                <div class="task-details">
                    <span class="task-subject">${subjectName}</span>
                    <span class="task-due">
                        <i class="fa-solid fa-circle-check" style="color: var(--primary);"></i> 完了 (${t.dueDate.replace(/-/g, '/')})
                    </span>
                </div>
            </div>
            <button class="task-delete-btn" onclick="deleteTask('${t.id}')"><i class="fa-solid fa-trash"></i></button>
        `;
        completedList.appendChild(row);
    });

    // Stats updates
    document.getElementById('task-stat-active').textContent = activeCount;
    document.getElementById('task-stat-urgent').textContent = urgentCount;

    if (activeCount === 0) {
        activeList.innerHTML = `
            <div class="empty-state" style="padding: 20px 0;">
                <i class="fa-solid fa-clipboard-check"></i>
                <p>現在、進行中の課題はありません！<br>素晴らしいですね。</p>
            </div>
        `;
    }

    if (completedTasks.length === 0) {
        completedList.innerHTML = `
            <p style="text-align: center; color: var(--text-muted); font-size: 0.75rem; padding: 10px 0;">完了した課題はここに表示されます</p>
        `;
    }
}

// --- GPA & GRADE SCREEN LOGIC ---
const gradeGPMap = {
    'S': 4.0,
    'A': 3.0,
    'B': 2.0,
    'C': 1.0,
    'F': 0.0
};

function renderGPAScreen() {
    let totalCredits = 0;
    let gradedCredits = 0;
    let completedCredits = 0;
    let sumGPPoints = 0;

    // Group unique courses by semester
    const semGroups = {};
    const seenCourses = new Set();

    classes.forEach(c => {
        const key = `${c.semester}::${c.name}`;
        if (seenCourses.has(key)) return;
        seenCourses.add(key);

        const grade = c.grade || 'none';
        totalCredits += c.credits;

        if (grade !== 'none') {
            gradedCredits += c.credits;
            
            // S, A, B, C are completed/obtained credits
            if (['S', 'A', 'B', 'C'].includes(grade)) {
                completedCredits += c.credits;
            }

            sumGPPoints += (gradeGPMap[grade] * c.credits);
        }

        // Grouping
        const sem = c.semester || 'その他';
        if (!semGroups[sem]) semGroups[sem] = [];
        semGroups[sem].push(c);
    });

    // Calculate GPA
    const gpa = gradedCredits > 0 ? (sumGPPoints / gradedCredits) : 0.0;
    document.getElementById('gpa-total-value').textContent = gpa.toFixed(2);
    document.getElementById('gpa-credits-earned').textContent = completedCredits;
    document.getElementById('gpa-credits-registered').textContent = totalCredits;

    // Progress circle (target graduation credit goal ratio)
    const goal = profile.creditGoal || 124;
    const progressPercent = Math.min(100, Math.round((completedCredits / goal) * 100));
    document.getElementById('gpa-percent-val').textContent = `${progressPercent}%`;

    // Circular SVG Stroke calculation
    const progressCircle = document.getElementById('gpa-progress-circle');
    const strokeOffset = 201 - (201 * progressPercent) / 100;
    progressCircle.style.strokeDashoffset = strokeOffset;

    // Render list by semester
    const container = document.getElementById('grades-semester-container');
    container.innerHTML = '';

    const semesters = Object.keys(semGroups).sort((a, b) => {
        const aParts = a.split(" ");
        const bParts = b.split(" ");
        if (aParts.length !== 2 || bParts.length !== 2) {
            return a.localeCompare(b, 'ja');
        }
        
        const yearA = parseInt(aParts[0]) || 0;
        const yearB = parseInt(bParts[0]) || 0;
        if (yearA !== yearB) return yearA - yearB;
        
        const qOrder = {
            "1Q": 1,
            "2Q": 2,
            "1-2Q": 3,
            "3Q": 4,
            "4Q": 5,
            "3-4Q": 6
        };
        
        const weightA = qOrder[aParts[1]] || 99;
        const weightB = qOrder[bParts[1]] || 99;
        return weightA - weightB;
    });

    if (semesters.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-graduation-cap"></i>
                <p>登録された講義がありません。<br>「時間割」から講義を追加してください。</p>
            </div>
        `;
        return;
    }

    semesters.forEach(sem => {
        const semClasses = semGroups[sem];
        
        // Calculate GPA for this semester only
        let semGradedCredits = 0;
        let semGPPoints = 0;

        semClasses.forEach(c => {
            const grade = c.grade || 'none';
            if (grade !== 'none') {
                semGradedCredits += c.credits;
                semGPPoints += (gradeGPMap[grade] * c.credits);
            }
        });

        const semGPA = semGradedCredits > 0 ? (semGPPoints / semGradedCredits) : null;
        const semGPADisplay = semGPA !== null ? `学期 GPA: ${semGPA.toFixed(2)}` : 'GPA算出対象外';

        const groupDiv = document.createElement('div');
        groupDiv.className = 'grade-semester-group';
        
        let rowsHtml = '';
        semClasses.forEach(c => {
            const gradeText = c.grade === 'none' ? '未' : c.grade;
            const evalClass = c.grade === 'F' ? 'eval-f' : '';
            rowsHtml += `
                <div class="grade-class-row" onclick="openClassDetailModal('${c.id}')">
                    <span class="name-col">${c.name}</span>
                    <span class="credit-col">${c.credits}単位</span>
                    <span class="eval-badge ${evalClass}">${gradeText}</span>
                </div>
            `;
        });

        groupDiv.innerHTML = `
            <div class="grade-semester-header">
                <h4>${sem}</h4>
                <span class="grade-semester-gpa">${semGPADisplay}</span>
            </div>
            ${rowsHtml}
        `;
        container.appendChild(groupDiv);
    });
}

// --- DATA BACKUP & RESTORE ---
function exportData() {
    const data = {
        classes,
        tasks,
        settings,
        profile
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `campusflow_backup_${getFormatDateString(0)}.json`);
    dlAnchorElem.click();
    showToast("バックアップデータをダウンロードしました");
}

function triggerImport() {
    document.getElementById('import-file-input').click();
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsedData = JSON.parse(e.target.result);
            
            // Validation
            if (parsedData.classes && Array.isArray(parsedData.classes)) {
                classes = parsedData.classes;
                saveToLocalStorage('cf_classes', classes);
            }
            if (parsedData.tasks && Array.isArray(parsedData.tasks)) {
                tasks = parsedData.tasks;
                saveToLocalStorage('cf_tasks', tasks);
            }
            if (parsedData.settings) {
                settings = { ...settings, ...parsedData.settings };
                saveToLocalStorage('cf_settings', settings);
            }
            if (parsedData.profile) {
                profile = { ...profile, ...parsedData.profile };
                saveToLocalStorage('cf_profile', profile);
            }

            showToast("データを正常に復元しました！");
            
            // Reload UI
            applyTheme(settings.theme);
            syncSettingsUI();
            renderTimetable();
            if (currentScreen === 'gpa') renderGPAScreen();
            if (currentScreen === 'tasks') renderTasksScreen();

        } catch (err) {
            alert("ファイルの読み込みに失敗しました。正しいJSON形式のバックアップファイルを選択してください。");
        }
    };
    reader.readAsText(file);
}

function resetAppData() {
    if (confirm("本当にすべてのデータを削除して初期化しますか？\nこの操作は取り消せません。")) {
        localStorage.clear();
        classes = [];
        tasks = [];
        settings = { theme: 'dark', showSat: false, maxPeriods: 11 };
        profile = { name: "キャンパス 太郎", univ: "未来大学", creditGoal: 124 };
        
        initDatabase();
        applyTheme(settings.theme);
        syncSettingsUI();
        renderTimetable();
        
        showToast("データを初期化しました");
        switchScreen('timetable');
    }
}

// --- ICS CALENDAR IMPORT LOGIC ---
function triggerIcsImport() {
    document.getElementById('ics-file-input').click();
}

function importIcsFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            const parsed = parseIcsText(text);

            if (parsed.length === 0) {
                alert("ICSファイルから有効な講義データを検出できませんでした。ファイル形式を確認してください。");
                return;
            }

            if (confirm(`現在選択中の学期（${currentSemesterFilter}）に ${parsed.length} 個の講義コマをインポートします。\n※この学期に登録されている既存の講義は削除されます。よろしいですか？`)) {
                
                // Clear existing classes in the current semester
                classes = classes.filter(c => c.semester !== currentSemesterFilter);
                
                // Add the newly parsed classes
                classes = [...classes, ...parsed];
                
                // Save to localStorage
                saveToLocalStorage('cf_classes', classes);
                
                showToast(`${currentSemesterFilter}の時間割をインポートしました！🎉`);
                
                // Refresh UI
                renderTimetable();
                if (currentScreen === 'gpa') renderGPAScreen();
            }
        } catch (err) {
            console.error(err);
            alert("ICSファイルの解析中にエラーが発生しました。");
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
}

function parseIcsText(text) {
    const lines = text.split(/\r?\n/);
    const events = [];
    let currentEvent = null;

    for (let line of lines) {
        line = line.trim();
        if (line.startsWith("BEGIN:VEVENT")) {
            currentEvent = {};
        } else if (line.startsWith("END:VEVENT")) {
            if (currentEvent) events.push(currentEvent);
            currentEvent = null;
        } else if (currentEvent) {
            if (line.startsWith("SUMMARY:")) {
                currentEvent.summary = line.substring(8).trim();
            } else if (line.startsWith("LOCATION:")) {
                currentEvent.location = line.substring(9).trim();
            } else if (line.startsWith("DTSTART")) {
                const parts = line.split(":");
                currentEvent.start = parts[parts.length - 1].trim();
            } else if (line.startsWith("DTEND")) {
                const parts = line.split(":");
                currentEvent.end = parts[parts.length - 1].trim();
            }
        }
    }

    const periodTimesMap = {
        "09:00": 1, "09:50": 2, "10:50": 3, "11:40": 4,
        "13:20": 5, "14:10": 6, "15:10": 7, "16:00": 8,
        "17:00": 9, "17:50": 10, "18:50": 11
    };

    // Grouping by summary
    const subjectsData = {};

    for (let ev of events) {
        if (!ev.summary || !ev.start || ev.start.length < 15) continue;
        
        // Exclude exams and academic events
        const isExam = /^[\[〚【](試|試験)[\]〛】]/.test(ev.summary) || ev.summary.includes("試験");
        const isAcademicEvent = /健康診断|オリエンテーション|Guidance|入学式|Entrance|卒業式|学位記授与式|Graduation|授業開始|classes begin|履修|Withdrawal|合格発表|Announce|休講|検診|検査|停電|Electricity|学園祭|Festival|PC甲子園|TOEIC|予備日|Extra Day/i.test(ev.summary);
        if (isExam || isAcademicEvent) continue;
        
        try {
            const start = ev.start;
            const yyyy = parseInt(start.substring(0, 4));
            const mm = parseInt(start.substring(4, 6));
            const dd = parseInt(start.substring(6, 8));
            const hh = start.substring(9, 11);
            const min = start.substring(11, 13);
            
            const dt = new Date(yyyy, mm - 1, dd, parseInt(hh), parseInt(min));
            let day = dt.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
            if (day === 0) day = 7; // Convert Sun to 7

            const timeStr = `${hh}:${min}`;
            const period = periodTimesMap[timeStr];

            const summary = ev.summary;
            if (!subjectsData[summary]) {
                subjectsData[summary] = {
                    location: ev.location || '',
                    slots: [],
                    dates: []
                };
            }
            if (period !== undefined) {
                subjectsData[summary].slots.push(`${day}-${period}`);
            }
            subjectsData[summary].dates.push(dt);
        } catch (e) {
            console.error("Error parsing event", e);
        }
    }

    const colorMap = {
        "HS": 6,  // 教養 (Coral)
        "SS": 5,  // スポーツ (Pink)
        "EN": 2,  // 外国語 (Blue)
        "MA": 1,  // 数学 (Purple)
        "NS": 1,  // 理科 (Purple)
        "LI": 3,  // コンピュータ (Teal)
        "PL": 3   // プログラミング (Teal)
    };

    const parsedClasses = [];
    let cid = Date.now();

    for (let [summary, info] of Object.entries(subjectsData)) {
        if (info.dates.length === 0) continue;

        // Calculate date range
        const sortedDates = info.dates.sort((a, b) => a - b);
        const minDate = sortedDates[0];
        const maxDate = sortedDates[sortedDates.length - 1];
        const diffMs = maxDate - minDate;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        // Check if any event date falls into summer vacation (Aug 7 - Sep 30) or spring vacation (Feb 12 - Mar 31)
        const hasVacationDate = info.dates.some(d => {
            const m = d.getMonth() + 1;
            const day = d.getDate();
            return (m === 8 && day >= 7) || m === 9 || (m === 2 && day >= 12) || m === 3;
        });

        // Determine if it is intensive (date range <= 7 days OR held during long vacations)
        const isIntensive = diffDays <= 7 || hasVacationDate;

        // Parse code and name
        let code = "OTHER";
        let name = summary;
        const codeMatch = summary.match(/^([A-Z0-9\-]+)\s+(.+)$/);
        if (codeMatch) {
            code = codeMatch[1];
            name = codeMatch[2];
        }
        name = name.replace(/\[.*?\]/g, '').trim();

        // Guesstimate credits
        let credits = 2;
        if (name.includes("実習") || name.includes("演習") || name.includes("Gateway") || name.includes("体育")) {
            credits = 1;
        } else if (name.includes("プロジェクト") || name.includes("特別研究")) {
            credits = 4;
        }

        // Determine color index
        const prefix = code.substring(0, 2);
        const colorIdx = colorMap[prefix] || 8;

        // Determine Quarter dynamically from event dates based on official academic calendar boundaries
        const yearPrefix = currentSemesterFilter.split(" ")[0]; // e.g. "1年"
        let quarters = new Set();
        for (let d of info.dates) {
            const m = d.getMonth() + 1; // 1-12
            const day = d.getDate();
            
            if (m === 4 || m === 5 || (m === 6 && day <= 9)) {
                quarters.add("1Q");
            } else if ((m === 6 && day >= 10) || m === 7 || (m === 8 && day <= 6)) {
                quarters.add("2Q");
            } else if ((m === 8 && day >= 7) || m === 9) {
                quarters.add("2Q"); // Map summer vacation to 2Q
            } else if (m === 10 || m === 11 || (m === 12 && day <= 3)) {
                quarters.add("3Q");
            } else if ((m === 12 && day >= 4) || m === 1 || (m === 2 && day <= 11)) {
                quarters.add("4Q");
            } else if ((m === 2 && day >= 12) || m === 3) {
                quarters.add("4Q"); // Map spring vacation to 4Q
            }
        }

        let qSuffix = "1-2Q"; // default Spring semester
        if (quarters.size === 1) {
            qSuffix = Array.from(quarters)[0];
        } else if (quarters.has("1Q") && quarters.has("2Q")) {
            qSuffix = "1-2Q";
        } else if (quarters.has("3Q") && quarters.has("4Q")) {
            qSuffix = "3-4Q";
        } else if (quarters.has("3Q")) {
            qSuffix = "3Q";
        } else if (quarters.has("4Q")) {
            qSuffix = "4Q";
        }

        const months = info.dates.map(d => d.getMonth() + 1);
        const isSummerIntensive = months.some(m => m === 8 || m === 9);
        const isSpringIntensive = months.some(m => m === 2 || m === 3);
        if (isIntensive) {
            if (isSummerIntensive) qSuffix = "2Q";
            else if (isSpringIntensive) qSuffix = "4Q";
        }

        const classSemester = `${yearPrefix} ${qSuffix}`;

        if (isIntensive) {
            // Intensive class: exactly one record
            const dateRangeStr = `集中講義: ${minDate.getMonth() + 1}/${minDate.getDate()} 〜 ${maxDate.getMonth() + 1}/${maxDate.getDate()}`;
            cid++;
            parsedClasses.push({
                id: `ics_${cid}`,
                name: `${code} ${name}`,
                room: info.location,
                teacher: "シラバス参照",
                credits: credits,
                semester: classSemester,
                day: 0,
                period: 0,
                colorIdx: colorIdx,
                notes: dateRangeStr + "\nICSファイルから自動インポートされました",
                attendance: { attend: 0, absent: 0, late: 0 },
                grade: "none",
                isIntensive: true,
                slots: Array.from(new Set(info.slots))
            });
        } else {
            // Regular class recurring slots
            const slotCounts = {};
            for (let slot of info.slots) {
                slotCounts[slot] = (slotCounts[slot] || 0) + 1;
            }

            let regularSlots = [];
            for (let [slot, count] of Object.entries(slotCounts)) {
                if (count >= 3) {
                    regularSlots.push(slot);
                }
            }

            if (regularSlots.length === 0) {
                regularSlots = Object.keys(slotCounts);
            }

            for (let slot of regularSlots) {
                const [dayStr, periodStr] = slot.split('-');
                const day = parseInt(dayStr);
                const period = parseInt(periodStr);

                cid++;
                parsedClasses.push({
                    id: `ics_${cid}`,
                    name: `${code} ${name}`,
                    room: info.location,
                    teacher: "シラバス参照",
                    credits: credits,
                    semester: classSemester,
                    day: day,
                    period: period,
                    colorIdx: colorIdx,
                    notes: "ICSファイルから自動インポートされました",
                    attendance: { attend: 0, absent: 0, late: 0 },
                    grade: "none",
                    isIntensive: false
                });
            }
        }
    }

    return parsedClasses;
}

// Render intensive classes list at the bottom of timetable
function renderIntensiveClasses() {
    const container = document.getElementById('intensive-classes-container');
    const list = document.getElementById('intensive-classes-list');
    if (!container || !list) return;

    // Filter classes for currentSemesterFilter and where isIntensive is true
    const intensiveClasses = classes.filter(c => isClassInActiveSemester(c, currentSemesterFilter) && c.isIntensive);

    if (intensiveClasses.length === 0) {
        container.style.display = 'none';
        list.innerHTML = '';
        return;
    }

    container.style.display = 'block';
    list.innerHTML = '';

    intensiveClasses.forEach(c => {
        const row = document.createElement('div');
        row.className = 'intensive-class-row';
        row.setAttribute('style', `border-left: 4px solid hsl(var(--subject-${c.colorIdx || 8}));`);
        row.onclick = () => openClassDetailModal(c.id);

        row.innerHTML = `
            <span class="badge-intensive" style="background: hsl(var(--subject-${c.colorIdx || 8}));">集中</span>
            <div class="info">
                <div class="title">${c.name}</div>
                <div class="meta">
                    <span><i class="fa-solid fa-location-dot"></i> ${c.room || '未指定'}</span>
                    <span><i class="fa-solid fa-user"></i> ${c.teacher || '未指定'}</span>
                    <span><i class="fa-solid fa-graduation-cap"></i> ${c.credits}単位</span>
                </div>
            </div>
        `;
        list.appendChild(row);
    });
}

// Toggle form schedule fields for manual intensive lectures
function toggleIntensiveFormFields(enabled) {
    const group = document.getElementById('class-schedule-fields-group');
    if (group) {
        group.style.display = enabled ? 'none' : 'block';
    }
}

// --- DAILY SUMMARY & NOTIFICATIONS SYSTEM ---

function showDailySummaryModal() {
    const welcome = document.getElementById('daily-summary-welcome');
    if (welcome) {
        welcome.textContent = `こんにちは、${profile.name || '学生'}さん！`;
    }

    const dateEl = document.getElementById('daily-summary-date');
    if (dateEl) {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = now.getMonth() + 1;
        const dd = now.getDate();
        const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
        const dayName = dayNames[now.getDay()];
        dateEl.textContent = `${yyyy}年${mm}月${dd}日 (${dayName})`;
    }

    // Sync notification switch state
    const notifToggle = document.getElementById('daily-summary-notif-toggle');
    if (notifToggle) {
        notifToggle.checked = localStorage.getItem('cf_notifications_enabled') === 'true' && Notification.permission === 'granted';
    }

    // Render today's classes
    const classesContainer = document.getElementById('daily-summary-classes');
    if (classesContainer) {
        classesContainer.innerHTML = '';
        
        let dayOfWeek = new Date().getDay();
        if (dayOfWeek === 0) dayOfWeek = 7;

        // Get classes for today in the active semester
        const todayClasses = classes.filter(c => c.day === dayOfWeek && isClassInActiveSemester(c, currentSemesterFilter) && !c.isIntensive);
        todayClasses.sort((a, b) => a.period - b.period);

        if (todayClasses.length === 0) {
            classesContainer.innerHTML = '<p style="font-size: 0.75rem; text-align: center; color: var(--text-muted); padding: 8px 0;">今日の時間割はありません</p>';
        } else {
            todayClasses.forEach(c => {
                const div = document.createElement('div');
                div.style.cssText = 'background: rgba(255,255,255,0.03); border-radius: 8px; padding: 8px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border-color); cursor: pointer;';
                div.onclick = () => {
                    closeModal('modal-daily-summary');
                    openClassDetailModal(c.id);
                };
                div.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 2px; max-width: 80%;">
                        <span style="font-size: 0.8rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.name}</span>
                        <span style="font-size: 0.65rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            <i class="fa-solid fa-location-dot"></i> ${c.room || '未指定'} | <i class="fa-solid fa-user"></i> ${c.teacher || '未指定'}
                        </span>
                    </div>
                    <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary);">${c.period}限</span>
                `;
                classesContainer.appendChild(div);
            });
        }
    }

    // Render today's tasks
    const tasksContainer = document.getElementById('daily-summary-tasks');
    if (tasksContainer) {
        tasksContainer.innerHTML = '';
        const todayStr = getFormatDateString(0);
        const todayTasks = tasks.filter(t => t.dueDate === todayStr && !t.completed);

        if (todayTasks.length === 0) {
            tasksContainer.innerHTML = '<p style="font-size: 0.75rem; text-align: center; color: var(--text-muted); padding: 8px 0;">今日締め切りの課題はありません</p>';
        } else {
            todayTasks.forEach(t => {
                const div = document.createElement('div');
                div.style.cssText = 'background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; padding: 8px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;';
                div.innerHTML = `
                    <span style="font-size: 0.8rem; font-weight: 600; color: #fca3a3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80%;">${t.title}</span>
                    <span style="font-size: 0.65rem; font-weight: 700; background: #ef4444; color: #fff; padding: 2px 6px; border-radius: 6px;">本日締切</span>
                `;
                tasksContainer.appendChild(div);
            });
        }
    }

    openModal('modal-daily-summary');
}

function toggleSystemNotifications(checked) {
    if (checked) {
        if (!("Notification" in window)) {
            alert("このブラウザはシステム通知に対応していません。");
            document.getElementById('daily-summary-notif-toggle').checked = false;
            return;
        }

        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                localStorage.setItem('cf_notifications_enabled', 'true');
                showToast("システム通知を有効にしました");
                new Notification("CampusFlow", {
                    body: "毎朝8時に時間割と課題の通知をお届けします！",
                    icon: "app_icon.png"
                });
                // Schedule local triggers immediately
                scheduleAndroidNotifications();
            } else {
                localStorage.setItem('cf_notifications_enabled', 'false');
                document.getElementById('daily-summary-notif-toggle').checked = false;
                showToast("通知権限が拒否されました");
            }
        });
    } else {
        localStorage.setItem('cf_notifications_enabled', 'false');
        showToast("システム通知を無効にしました");
        // Clear scheduled local notifications
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                if (registration.getNotifications) {
                    registration.getNotifications().then(notifications => {
                        notifications.forEach(n => {
                            if (n.tag === 'cf-daily-trigger') n.close();
                        });
                    });
                }
            });
        }
    }
}

function checkAndSendDailyNotification() {
    if (localStorage.getItem('cf_notifications_enabled') !== 'true') return;
    if (Notification.permission !== 'granted') return;

    const now = new Date();
    const hrs = now.getHours();
    const mins = now.getMinutes();

    // Check at 8:00 AM
    if (hrs === 8 && mins === 0) {
        const todayStr = getFormatDateString(0);
        const lastNotifDate = localStorage.getItem('cf_last_notif_date');

        if (lastNotifDate !== todayStr) {
            localStorage.setItem('cf_last_notif_date', todayStr);
            sendDailyNotification();
        }
    }
}

function sendDailyNotification() {
    let dayOfWeek = new Date().getDay();
    if (dayOfWeek === 0) dayOfWeek = 7;

    const todayClasses = classes.filter(c => c.day === dayOfWeek && isClassInActiveSemester(c, currentSemesterFilter) && !c.isIntensive);
    const todayStr = getFormatDateString(0);
    const todayTasks = tasks.filter(t => t.dueDate === todayStr && !t.completed);

    let bodyText = "";
    if (todayClasses.length > 0) {
        bodyText += `今日の授業 (${todayClasses.length}コマ): ` + todayClasses.map(c => `${c.period}限:${c.name}`).join(", ");
    } else {
        bodyText += "今日の授業はありません。";
    }

    if (todayTasks.length > 0) {
        bodyText += `\n本日締切の課題 (${todayTasks.length}件): ` + todayTasks.map(t => t.title).join(", ");
    }

    try {
        const notification = new Notification("今日の予定 - CampusFlow", {
            body: bodyText,
            icon: "app_icon.png"
        });
        notification.onclick = function() {
            window.focus();
            showDailySummaryModal();
        };
    } catch (e) {
        console.error("Failed to send notification", e);
    }
}

function scheduleAndroidNotifications() {
    if (localStorage.getItem('cf_notifications_enabled') !== 'true') return;
    if (!('serviceWorker' in navigator) || !('Notification' in window) || Notification.permission !== 'granted') return;

    navigator.serviceWorker.ready.then(registration => {
        // Try to clear old notifications scheduled by this app
        if (registration.getNotifications) {
            registration.getNotifications().then(notifications => {
                notifications.forEach(notification => {
                    if (notification.tag === 'cf-daily-trigger') {
                        notification.close();
                    }
                });
            });
        }

        // Check if TimestampTrigger is supported
        if (typeof TimestampTrigger === 'undefined') {
            console.log("TimestampTrigger is not supported on this browser/OS, local offline triggers will not fire.");
            return;
        }

        // Schedule notifications for the next 30 days at 8:00 AM
        const now = new Date();
        
        for (let i = 0; i < 30; i++) {
            const targetDate = new Date();
            targetDate.setDate(now.getDate() + i);
            targetDate.setHours(8, 0, 0, 0);

            // Skip if the target time has already passed today
            if (targetDate <= now) continue;

            const dayOfWeek = targetDate.getDay() === 0 ? 7 : targetDate.getDay();
            const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

            // Parse classes for that day
            const dayClasses = classes.filter(c => c.day === dayOfWeek && isClassInActiveSemester(c, currentSemesterFilter) && !c.isIntensive);
            const dayTasks = tasks.filter(t => t.dueDate === dateStr && !t.completed);

            let bodyText = "";
            if (dayClasses.length > 0) {
                bodyText += `授業 (${dayClasses.length}コマ): ` + dayClasses.map(c => `${c.period}限:${c.name}`).join(", ");
            } else {
                bodyText += "授業はありません。";
            }

            if (dayTasks.length > 0) {
                bodyText += `\n締切課題 (${dayTasks.length}件): ` + dayTasks.map(t => t.title).join(", ");
            }

            // Schedule via showNotification with TimestampTrigger
            try {
                registration.showNotification("今日の予定 - CampusFlow", {
                    body: bodyText,
                    icon: "app_icon.png",
                    tag: 'cf-daily-trigger',
                    showTrigger: new TimestampTrigger(targetDate.getTime())
                });
                console.log(`Scheduled PWA trigger for ${targetDate.toLocaleString()}`);
            } catch (err) {
                console.error("Failed to schedule trigger notification:", err);
            }
        }
    });
}

// --- PWA Installation Logic ---
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI to notify the user they can install the PWA
    const installTitle = document.getElementById('pwa-install-title');
    const installRow = document.getElementById('pwa-install-row');
    if (installTitle && installRow) {
        installTitle.style.display = 'block';
        installRow.style.display = 'flex';
    }
    console.log("PWA is installable. Capture beforeinstallprompt event.");
});

function installPwaApp() {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
        }
        deferredPrompt = null;
        // Hide the UI item
        const installTitle = document.getElementById('pwa-install-title');
        const installRow = document.getElementById('pwa-install-row');
        if (installTitle && installRow) {
            installTitle.style.display = 'none';
            installRow.style.display = 'none';
        }
    });
}

window.addEventListener('appinstalled', (evt) => {
    console.log('CampusFlow was installed.');
    showToast("アプリがホーム画面に追加されました！");
    // Hide UI
    const installTitle = document.getElementById('pwa-install-title');
    const installRow = document.getElementById('pwa-install-row');
    if (installTitle && installRow) {
        installTitle.style.display = 'none';
        installRow.style.display = 'none';
    }
});

