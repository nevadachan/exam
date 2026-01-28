let db = null;
let bgSnippets = [];
let currentTask = null;
let isHardcore = false;
let lives = 5;
let score = 0;
let hcTimer = null;
let timeLeft = 18000;
let isBlocked = false;

const SYMBOLS = ["🍒", "🍋", "🍇", "💎", "7️⃣", "🔔"];
const ICON_HEIGHT = 83.33; 
const DECRYPT_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*";
const ZALGO_MARKS = ['\u030d', '\u030e', '\u0304', '\u0305', '\u033f', '\u0311'];

const TITLE_LANGS = [
    { m: "ОСНОВНОЙ ГОСУДАРСТВЕННЫЙ ЭКЗАМЕН", s: "ПОДГОТОВКА" },
    { m: "BASIC STATE EXAMINATION", s: "PREPARATION" },
    { m: "EXAMEN D'ÉTAT DE BASE", s: "PRÉPARATION" },
    { m: "GRUNDLEGENDE STAATSPRÜFUNG", s: "VORBEREITUNG" },
    { m: "EXAMEN ESTATAL BÁSICO", s: "PREPARACIÓN" },
    { m: "ESAME DI STATO FONDAMENTALE", s: "PREPARAZIONE" },
    { m: "基本国家試験", s: "準備" },
    { m: "基础国家考试", s: "准备" },
    { m: "기본 국가 시험", s: "준비" },
    { m: "EXAME ESTADUAL BÁSICO", s: "PREPARAÇÃO" }
];

// === DOCS DATA ===
const docsDB = [
    {
        id: "arch_overview",
        title: "00. Архитектура",
        desc: "Сайт работает как SPA (Single Page Application) без фреймворков. Вся логика содержится в одном файле script.js, который управляет состоянием (lives, score, mode), рендерингом DOM и отрисовкой Canvas.",
        code: `// Глобальное состояние приложения
let db = null;           // База данных заданий (из JSON)
let currentTask = null;  // Текущая активная задача
let isHardcore = false;  // Режим: Тренировка / Хардкор
let lives = 5;           // Количество жизней
let score = 0;           // Текущий счет
let hcTimer = null;      // ID интервала таймера

window.onload = async () => {
    await loadData();      // 1. Загрузка JSON
    initTitleSystem();     // 2. Запуск эффектов заголовка
    initUltimateSystem();  // 3. Запуск графического движка (Canvas)
};`
    },
    {
        id: "html_layout",
        title: "01. HTML: Структура",
        desc: "Разметка разделена на слои. Z-index управляет перекрытием: Canvas (фон) < Контент < Интерфейс (HUD) < Модальные окна (Lock Screen, Terminal).",
        code: `<body>
    <!-- 1. Фоновый слой (Canvas) -->
    <canvas id="rainCanvas"></canvas> <!-- Матрица -->
    <canvas id="objCanvas"></canvas>  <!-- 3D объекты -->
    
    <!-- 2. Слой HUD (Интерфейс поверх всего) -->
    <div class="hud-overlay">
        <div class="scanlines"></div> <!-- Эффект старого монитора -->
        <div class="hud-text">...</div>
    </div>

    <!-- 3. Слой Блокировки (Наказание) -->
    <div id="lock-screen" class="hidden">...</div>

    <!-- 4. Основной макет (Flexbox) -->
    <div class="layout">
        <aside class="sidebar">...</aside> <!-- Меню навигации -->
        <main class="content">...</main>   <!-- Область контента -->
    </div>
</body>`
    },
    {
        id: "css_visuals",
        title: "02. CSS: Визуал",
        desc: "Использование CSS-переменных для темизации и эффекты CRT-монитора через `scanlines`.",
        code: `:root {
    --primary: #00ff9d;   /* Основной неоновый цвет */
    --bg: #050508;        /* Глубокий черный */
    --font-ui: 'Share Tech Mono'; /* Шрифт интерфейса */
}

/* Эффект старого монитора */
.scanlines {
    background: repeating-linear-gradient(
        to bottom,
        transparent,
        transparent 2px,
        rgba(0, 0, 0, 0.3) 3px
    );
    pointer-events: none; /* Пропускает клики сквозь себя */
    z-index: 50;
}

/* Анимация тряски экрана при уроне */
.shake {
    animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
}`
    },
    {
        id: "js_bg_engine",
        title: "03. JS: Графика",
        desc: "Функция `initUltimateSystem` запускает цикл `requestAnimationFrame`. В нем каждый кадр очищается Canvas и перерисовываются все объекты.",
        code: `function initUltimateSystem() {
    // Инициализация контекстов 2D
    const ctxRain = rainCanvas.getContext('2d');
    const ctxObj = objCanvas.getContext('2d');

    // Главный цикл рендеринга (60 FPS)
    function loop() {
        ctxRain.clearRect(0, 0, w, h);
        ctxObj.clearRect(0, 0, w, h);

        // Обновление и отрисовка компонентов
        rainItems.forEach(r => { r.update(); r.draw(); }); // Матричный дождь
        floaters.forEach(f => { f.update(); f.draw(); });  // Парящий код
        
        renderLorenz();      // Математический аттрактор
        renderDigitalWave(); // Волновая сетка

        requestAnimationFrame(loop);
    }
    loop();
}`
    },
    {
        id: "js_matrix",
        title: "04. JS: Матричный Дождь",
        desc: "Класс `RainDrop`. Каждый 'падающий' элемент имеет свою скорость, координаты и тип (простой текст или меняющаяся матрица).",
        code: `class RainDrop {
    update() {
        this.y += this.speed; // Движение вниз
        // Если улетел за экран - сброс наверх
        if (this.y > h + 100) this.reset();
        
        // Эффект перебора матрицы: смена символов
        if (this.type === 'MATRIX' && Math.random() > 0.9) {
            this.changeRandomChar(); 
        }
    }

    draw() {
        ctxRain.fillStyle = "#00ff9d";
        // Отрисовка столбца цифр
        for (let r = 0; r < this.dim; r++) {
            ctxRain.fillText(this.mData[r], this.x, this.y + r*14);
        }
    }
}`
    },
    {
        id: "js_lorenz",
        title: "05. JS: Математика (Лоренц)",
        desc: "Визуализация Аттрактора Лоренца — системы дифференциальных уравнений. Точки рисуются в реальном времени.",
        code: `// Константы хаоса
const sigma = 10, rho = 28, beta = 8/3, dt = 0.01;

function renderLorenz() {
    // Вычисление следующей точки по формулам Лоренца
    let dx = (sigma * (ly - lx)) * dt;
    let dy = (lx * (rho - lz) - ly) * dt;
    let dz = (lx * ly - beta * lz) * dt;
    
    lx += dx; ly += dy; lz += dz;

    // Вращение 3D координат для проекции на 2D экран
    let rx = p.x * Math.cos(angle) - p.z * Math.sin(angle);
    ctxObj.fillText(".", centerX + rx * scale, centerY - p.y * scale);
}`
    },
    {
        id: "js_hardcore",
        title: "06. JS: Хардкор режим",
        desc: "Логика 'рулетки' заданий. Выбирает случайное задание, запускает таймер. При ошибке блокирует интерфейс.",
        code: `function startRoulette() {
    isHardcore = true;
    lives = 5;
    
    // Эффект быстрой смены названий перед выбором
    const interval = setInterval(() => {
        const rnd = allTasks[Math.floor(Math.random() * allTasks.length)];
        document.getElementById('task-header').innerText = rnd.title;
        // ...
    }, 80);
    
    // После выбора - загрузка задачи и старт таймера
    loadTask(selectedTask, true);
    startTimer();
}`
    },
    {
        id: "js_timer",
        title: "07. JS: Таймер обратного отсчета",
        desc: "Работает на `setInterval` с шагом 10мс для отображения миллисекунд. При достижении 0 вызывает Game Over.",
        code: `function startTimer() {
    timeLeft = 18000; // 3 минуты в сотых долях секунды
    
    hcTimer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay(); // Форматирует MM:SS.ms
        
        if (timeLeft <= 0) {
            clearInterval(hcTimer);
            triggerMiniGame("ВРЕМЯ ВЫШЛО"); // Наказание
        }
    }, 10);
}`
    },
    {
        id: "js_punish",
        title: "08. JS: Система наказаний",
        desc: "При ошибке вызывается `triggerMiniGame`. Показывает оверлей 'Lock Screen' и инициализирует слот-машину.",
        code: `function triggerMiniGame(reason) {
    isBlocked = true; // Блокировка ввода ответов
    const screen = document.getElementById('lock-screen');
    screen.classList.remove('hidden'); // Показ красного экрана
    
    // Генерация DOM для слотов
    initSlots(document.getElementById('mini-game-container'));
}

function takeDamage() {
    lives--; // Снятие жизни
    document.body.classList.add('shake'); // Тряска экрана
    
    if (lives <= 0) {
        // Логика полного проигрыша
        stopHardcore();
    }
}`
    },
    {
        id: "js_slots",
        title: "09. JS: Слот-машина",
        desc: "Эмуляция казино. Результат предопределен математически до начала вращения анимации.",
        code: `window.spinSlots = () => {
    // 1. Определение результата (RNG)
    const r = Math.random();
    let result = [];
    
    if (r < 0.40) { 
        // 40% шанс на победу (спасение жизни)
        result = [sym, sym, sym]; 
    } else {
        // 60% шанс на проигрыш (урон)
        result = [sym1, sym2, sym3]; 
    }

    // 2. Анимация барабанов через CSS Transform
    // Мы создаем длинную ленту символов и сдвигаем её
    reel.style.transform = "translateY(0px)"; 
    // transition обеспечивает плавность остановки
};`
    },
    {
        id: "js_terminal",
        title: "10. JS: Терминал",
        desc: "Фейковый CLI интерфейс. Использует рекурсивную функцию `print` для эффекта печатания текста построчно.",
        code: `function openTerminal(mod) {
    const lines = [\`root@oge:~$ \${mod.cmd}\`, \`> Loading...\`, \`> Done.\`];
    let i = 0;

    function print() {
        if (i < lines.length) {
            // Добавление строки в DOM
            logs.appendChild(createLine(lines[i]));
            i++;
            setTimeout(print, 100); // Задержка между строками
        } else {
            // Когда все напечатано - показать меню выбора задач
            showTaskSelection(mod);
        }
    }
    print();
}`
    },
    {
        id: "js_decrypt",
        title: "11. JS: Эффект дешифровки",
        desc: "Визуальный эффект подбора символов для заголовков.",
        code: `function decryptEffect(element, text) {
    const chars = "ABC...123...@#$";
    let i = 0;
    
    const interval = setInterval(() => {
        // Первые i символов - верные, остальные - случайный шум
        element.innerText = text.split("").map((char, index) => {
            if (index < i) return char;
            return chars[Math.floor(Math.random() * chars.length)];
        }).join("");
        
        if (i >= text.length) clearInterval(interval);
        i++;
    }, 30);
}`
    }
];

window.onload = async () => {
    await loadData();
    initTitleSystem();
    initUltimateSystem();
};

async function loadData() {
    try {
        const [dataRes, snippetsRes] = await Promise.all([
            fetch('data.json'),
            fetch('background_data.json')
        ]);
        db = await dataRes.json();
        const snippetsData = await snippetsRes.json();
        bgSnippets = snippetsData.snippets;
        renderMenu();
        renderWidgets();
    } catch (e) {
        document.getElementById('menu-container').innerHTML = "ERR_DATA_LOAD";
    }
}

function startRoulette() {
    isHardcore = true;
    lives = 5;
    score = 0;
    updateHUD();
    updateMenuLockState();

    document.getElementById('btn-start-hc').classList.add('hidden');
    document.getElementById('btn-stop-hc').classList.remove('hidden');
    
    spinNextTask();
}

function spinNextTask() {
    const allTasks = [];
    db.modules.forEach(m => m.tasks.forEach(t => allTasks.push(t)));

    document.getElementById('welcome-block').classList.add('hidden');
    document.getElementById('task-block').classList.remove('hidden');

    let count = 0;
    const interval = setInterval(() => {
        const rnd = allTasks[Math.floor(Math.random() * allTasks.length)];
        document.getElementById('task-header').innerText = rnd.title;
        document.getElementById('task-header').style.color = Math.random() > 0.5 ? '#ff0055' : '#00ff9d';
        count++;
        if (count > 20) {
            clearInterval(interval);
            document.getElementById('task-header').style.color = "";
            loadTask(rnd, true);
            startTimer();
        }
    }, 80);
}

function stopHardcore() {
    isHardcore = false;
    clearInterval(hcTimer);
    updateMenuLockState();
    document.getElementById('btn-start-hc').classList.remove('hidden');
    document.getElementById('btn-stop-hc').classList.add('hidden');
    
    document.getElementById('hardcore-timer').classList.add('hidden');
    document.getElementById('roulette-badge').classList.add('hidden');
    document.getElementById('lives-display').innerText = "---";
    document.getElementById('score-display').innerText = "---";
    goHome();
}

function updateHUD() {
    if (!isHardcore) return;
    document.getElementById('lives-display').innerText = lives;
    document.getElementById('score-display').innerText = score;
}

function updateMenuLockState() {
    const headers = document.querySelectorAll('.mod-header');
    headers.forEach(h => {
        if (isHardcore) h.classList.add('disabled');
        else h.classList.remove('disabled');
    });
}

function startTimer() {
    clearInterval(hcTimer);
    timeLeft = 18000;
    updateTimerDisplay();
    document.getElementById('hardcore-timer').classList.remove('hidden');

    hcTimer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) {
            clearInterval(hcTimer);
            triggerMiniGame("ВРЕМЯ ВЫШЛО");
        }
    }, 10);
}

function updateTimerDisplay() {
    const el = document.getElementById('hardcore-timer');
    let secs = Math.floor(timeLeft / 100);
    let ms = timeLeft % 100;
    let mins = Math.floor(secs / 60);
    secs = secs % 60;
    el.innerText = `${pad(mins)}:${pad(secs)}.${pad(ms)}`;
}

function pad(n) {
    return n < 10 ? '0' + n : n;
}

function triggerMiniGame(reason) {
    isBlocked = true;
    clearInterval(hcTimer);
    const screen = document.getElementById('lock-screen');
    const container = document.getElementById('mini-game-container');
    const msg = document.getElementById('lock-reason');

    screen.classList.remove('hidden');
    msg.innerText = `${reason}. ИСПЫТАЙТЕ УДАЧУ.`;
    container.innerHTML = "";

    initSlots(container);
}

function initSlots(container) {
    container.innerHTML = `
        <div class="slot-machine">
            <div class="slot-screen">
                <div class="reel-container" id="reel1"><div class="reel-strip"></div></div>
                <div class="reel-container" id="reel2"><div class="reel-strip"></div></div>
                <div class="reel-container" id="reel3"><div class="reel-strip"></div></div>
                <div class="payline"></div>
                <div class="slot-shadow-top"></div>
                <div class="slot-shadow-bottom"></div>
                <div id="result-overlay" class="result-overlay hidden">
                    <div id="result-content">
                        <div id="result-text" class="result-text"></div>
                        <div id="result-subtext" class="result-subtext" style="text-align:center; margin-top:10px; font-size:1.2rem; color:#fff;"></div>
                    </div>
                </div>
            </div>
            <div class="slot-controls">
                <div class="slot-info"></div>
                <button id="btn-spin" class="btn-slot-spin" onclick="spinSlots()">SPIN</button>
            </div>
        </div>
    `;

    [1, 2, 3].forEach(id => {
        const strip = document.querySelector(`#reel${id} .reel-strip`);
        let html = "";
        for (let i = 0; i < 3; i++) {
            html += `<div class="slot-icon">${getRandomSymbol()}</div>`;
        }
        strip.innerHTML = html;
    });
}

function getRandomSymbol() {
    return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

window.spinSlots = () => {
    const btn = document.getElementById('btn-spin');
    if (btn.disabled) return;
    btn.disabled = true;
    btn.innerText = "...";

    const r = Math.random();
    let isWin = false;
    let isJackpot = false;
    let result = [];

    if (r < 0.02) {
        isWin = true;
        isJackpot = true;
        result = ["7️⃣", "7️⃣", "7️⃣"];
    } else if (r < 0.40) {
        isWin = true;
        isJackpot = false;
        const simpleSymbols = ["🍒", "🍋", "🍇", "💎", "🔔"];
        const winSym = simpleSymbols[Math.floor(Math.random() * simpleSymbols.length)];
        result = [winSym, winSym, winSym];
    } else {
        isWin = false;
        isJackpot = false;
        do {
            result = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
        } while (result[0] === result[1] && result[1] === result[2]);
    }

    [1, 2, 3].forEach((id, index) => {
        const reel = document.querySelector(`#reel${id} .reel-strip`);
        const spinCount = 20 + (index * 10);
        const finalSet = [getRandomSymbol(), result[index], getRandomSymbol()];

        let reversedHtml = "";
        reversedHtml += `<div class="slot-icon">${finalSet[0]}</div>`;
        reversedHtml += `<div class="slot-icon target">${finalSet[1]}</div>`;
        reversedHtml += `<div class="slot-icon">${finalSet[2]}</div>`;
        for (let i = 0; i < spinCount; i++) {
            reversedHtml += `<div class="slot-icon blur">${getRandomSymbol()}</div>`;
        }

        reel.innerHTML = reversedHtml;

        const startY = -(spinCount) * ICON_HEIGHT;
        reel.style.transition = "none";
        reel.style.transform = `translateY(${startY}px)`;

        reel.offsetHeight;

        const duration = 2 + (index * 0.5);
        reel.style.transition = `transform ${duration}s cubic-bezier(0.25, 1, 0.5, 1)`;
        reel.style.transform = "translateY(0px)";
    });

    setTimeout(() => {
        showResultOverlay(isWin, isJackpot);
    }, 3500);
};

function showResultOverlay(isWin, isJackpot) {
    const overlay = document.getElementById('result-overlay');
    const text = document.getElementById('result-text');
    const subtext = document.getElementById('result-subtext');

    overlay.classList.remove('hidden');
    void overlay.offsetWidth;

    if (isWin) {
        if (isJackpot) {
            overlay.className = "result-overlay win visible";
            text.innerText = "JACKPOT";
            text.style.color = "#ffb700";
            text.style.textShadow = "0 0 20px #ffb700";
            subtext.innerText = "+2 ЖИЗНИ";
        } else {
            overlay.className = "result-overlay win visible";
            text.innerText = "ВЫИГРЫШ";
            text.style.color = "#00ff9d";
            text.style.textShadow = "0 0 20px #00ff9d";
            subtext.innerText = "ЖИЗНЬ СОХРАНЕНА";
        }
    } else {
        overlay.className = "result-overlay lose visible";
        text.innerText = "ПРОИГРЫШ";
        text.style.color = "#ff0055";
        text.style.textShadow = "0 0 20px #ff0055";
        subtext.innerText = "-1 ЖИЗНЬ";
    }

    setTimeout(() => {
        finishGame(isWin, isJackpot);
    }, 2500);
}

function finishGame(win, jackpot) {
    const screen = document.getElementById('lock-screen');
    const overlay = document.getElementById('result-overlay');
    overlay.className = "result-overlay hidden";
    screen.classList.add('hidden');

    if (win) {
        if (jackpot) {
            lives += 2;
        }
    } else {
        takeDamage();
    }

    isBlocked = false;
    startTimer();
    updateHUD();
}

function takeDamage() {
    const fx = document.getElementById('damage-fx');
    document.body.classList.add('shake');
    fx.style.animation = 'flashRed 0.5s ease-out';

    setTimeout(() => {
        document.body.classList.remove('shake');
        fx.style.animation = '';
    }, 500);

    lives--;
    updateHUD();

    if (lives <= 0) {
        setTimeout(() => {
            const screen = document.getElementById('lock-screen');
            screen.classList.remove('hidden');
            screen.innerHTML = `<h1 style="color:red; font-size: 3rem;">СИСТЕМА УНИЧТОЖЕНА</h1>`;
            setTimeout(() => stopHardcore(), 2000);
        }, 600);
    }
}

function renderMenu() {
    const cont = document.getElementById('menu-container');
    cont.innerHTML = '';

    const part1Title = document.createElement('div');
    part1Title.className = 'menu-section-title';
    part1Title.innerText = "ЧАСТЬ 1 (ТЕСТ)";
    cont.appendChild(part1Title);

    let p2Started = false;

    db.modules.forEach((mod, idx) => {
        if (!p2Started && (mod.title.includes("13") || mod.title.includes("14") || mod.title.includes("15"))) {
            const part2Title = document.createElement('div');
            part2Title.className = 'menu-section-title';
            part2Title.innerText = "ЧАСТЬ 2 (ПК)";
            part2Title.style.marginTop = "20px";
            part2Title.style.borderTop = "1px solid #333";
            part2Title.style.paddingTop = "10px";
            cont.appendChild(part2Title);
            p2Started = true;
        }

        const btn = document.createElement('div');
        btn.className = 'mod-header';
        btn.innerText = `> ${mod.title}`;
        btn.onclick = () => {
            if (!isHardcore) openTerminal(mod);
        };
        cont.appendChild(btn);
    });
}

function openTerminal(mod) {
    const overlay = document.getElementById('terminal-overlay');
    const logs = document.getElementById('term-logs');
    const menu = document.getElementById('term-menu');
    overlay.classList.remove('hidden');
    logs.classList.remove('hidden');
    menu.classList.add('hidden');
    logs.innerHTML = '';
    const lines = [`user@oge:~$ ${mod.cmd}`, `> Loading...`, `> Done.`];
    let i = 0;

    function print() {
        if (i < lines.length) {
            const d = document.createElement('div');
            d.innerText = lines[i];
            logs.appendChild(d);
            i++;
            setTimeout(print, 100);
        } else {
            setTimeout(() => {
                logs.classList.add('hidden');
                showTaskSelection(mod);
            }, 300);
        }
    }
    print();
}

function showTaskSelection(mod) {
    const menu = document.getElementById('term-menu');
    const list = document.getElementById('term-tasks-list');
    menu.classList.remove('hidden');
    list.innerHTML = '';
    mod.tasks.forEach(task => {
        const link = document.createElement('div');
        link.className = 'term-task-link';
        link.innerText = `[OPEN] ${task.title}`;
        link.onclick = () => {
            closeTerminal();
            loadTask(task, false);
        };
        list.appendChild(link);
    });
}

function closeTerminal() {
    document.getElementById('terminal-overlay').classList.add('hidden');
}

function loadTask(task, isHC) {
    currentTask = task;
    document.getElementById('welcome-block').classList.add('hidden');
    document.getElementById('task-block').classList.remove('hidden');
    const h = document.getElementById('task-header');
    h.innerText = task.title;
    decryptEffect(h, task.title);

    document.getElementById('content-theory').innerHTML = task.theory;
    document.getElementById('question-text').innerHTML = task.question;
    document.getElementById('inp-answer').value = '';
    document.getElementById('res-msg').innerText = '';
    document.getElementById('res-msg').className = '';

    if (isHC) document.getElementById('roulette-badge').classList.remove('hidden');
    else document.getElementById('roulette-badge').classList.add('hidden');
    setTab('theory');
}

function setTab(t) {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-body').forEach(b => b.classList.remove('active'));
    const bs = document.querySelectorAll('.tab');
    if (t === 'theory') bs[0].classList.add('active');
    else bs[1].classList.add('active');
    document.getElementById(`content-${t}`).classList.add('active');
}

function verifyAnswer() {
    if (!currentTask || isBlocked) return;
    const userAnswer = document.getElementById('inp-answer').value.trim().toLowerCase();
    const correctAnswer = currentTask.answer.toLowerCase();
    const resultMsg = document.getElementById('res-msg');

    if (userAnswer === correctAnswer) {
        resultMsg.innerText = ">> ВЕРНО.";
        resultMsg.className = "success";
        if (isHardcore) {
            clearInterval(hcTimer);
            let points = 1;
            if (currentTask.title.includes("13") || currentTask.title.includes("14") || currentTask.title.includes("15")) {
                points = 2;
            }
            score += points;
            updateHUD();
            setTimeout(spinNextTask, 1000);
        }
    } else {
        resultMsg.innerText = ">> ОШИБКА.";
        resultMsg.className = "fail";
        if (isHardcore) {
            triggerMiniGame("ОШИБКА");
        }
    }
}

function goHome() {
    if (isHardcore) return;
    document.getElementById('welcome-block').classList.remove('hidden');
    document.getElementById('task-block').classList.add('hidden');
}

function toggleWidgets() {
    document.getElementById('widgets-panel').classList.toggle('show');
}

function renderWidgets() {
    const p = document.getElementById('widgets-panel');
    p.innerHTML = '';
    db.cheatsheets.forEach(w => {
        const d = document.createElement('div');
        d.className = 'w-card';
        d.innerHTML = `<h4>${w.title}</h4><div>${w.content}</div>`;
        p.appendChild(d);
    });
}

function decryptEffect(el, txt) {
    let i = 0;
    const interval = setInterval(() => {
        el.innerText = txt.split("").map((c, x) =>
            x < i ? c : DECRYPT_CHARS[Math.floor(Math.random() * DECRYPT_CHARS.length)]
        ).join("");
        if (i >= txt.length) clearInterval(interval);
        i += 1;
    }, 30);
}

function toZalgo(t) {
    let r = '';
    for (let c of t) {
        r += c;
        if (Math.random() > 0.8) r += ZALGO_MARKS[Math.floor(Math.random() * ZALGO_MARKS.length)];
    }
    return r;
}

function initTitleSystem() {
    const m = document.getElementById('title-main');
    const s = document.getElementById('title-sub');
    
    cycleTitle(m, s);

    setInterval(() => {
        cycleTitle(m, s);
    }, 6000); 
}

function cycleTitle(mElement, sElement) {
    const lang = TITLE_LANGS[Math.floor(Math.random() * TITLE_LANGS.length)];
    decryptEffect(mElement, lang.m);
    setTimeout(() => decryptEffect(sElement, lang.s), 200);
}

function initUltimateSystem() {
    const rainCvs = document.getElementById('rainCanvas');
    const objCvs = document.getElementById('objCanvas');
    const ctxRain = rainCvs.getContext('2d');
    const ctxObj = objCvs.getContext('2d');
    let w, h;

    function resize() {
        w = rainCvs.width = objCvs.width = window.innerWidth;
        h = rainCvs.height = objCvs.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    let mouse = { x: -1000, y: -1000 };
    window.addEventListener('mousemove', e => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });
    let ghostMouse = { x: w / 2, y: h / 2, angle: 0 };

    class RainDrop {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.floor(Math.random() * (w / 15)) * 15;
            this.y = Math.random() * -1000;
            this.speed = Math.random() * 2 + 1.5;
            this.type = Math.random() > 0.85 ? 'MATRIX' : 'TEXT';
            const src = bgSnippets.length ? bgSnippets : ["loading"];
            this.text = src[Math.floor(Math.random() * src.length)];
            this.dim = Math.floor(Math.random() * 9) + 2;
            this.mData = Array(this.dim * this.dim).fill(0).map(() => Math.floor(Math.random() * 10));
            this.size = Math.random() * 2 + 10;
            this.opacity = Math.random() * 0.4 + 0.2;
        }

        update() {
            this.y += this.speed;
            if (this.y > h + 100) this.reset();
            if (this.type === 'MATRIX' && Math.random() > 0.9) {
                this.mData[Math.floor(Math.random() * this.mData.length)] = Math.floor(Math.random() * 10);
            }
        }

        draw() {
            ctxRain.fillStyle = "#00ff9d";
            ctxRain.globalAlpha = this.opacity;
            ctxRain.font = `${this.size}px 'Fira Code', monospace`;
            if (this.type === 'MATRIX') {
                let offY = 0;
                ctxRain.fillText("[", this.x, this.y);
                for (let r = 0; r < this.dim; r++) {
                    let str = "";
                    for (let c = 0; c < this.dim; c++) str += this.mData[r * this.dim + c] + " ";
                    ctxRain.fillText(str, this.x + 10, this.y + offY);
                    offY += 14;
                }
                ctxRain.fillText("]", this.x + (this.dim * 12), this.y + offY - 14);
            } else {
                ctxRain.fillText(this.text, this.x, this.y);
            }
        }
    }

    const rainItems = [];
    setTimeout(() => {
        for (let i = 0; i < 50; i++) rainItems.push(new RainDrop());
    }, 500);

    class FloatObj {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * w;
            this.y = Math.random() * h;
            const src = bgSnippets.length ? bgSnippets : ["..."];
            this.raw = src[Math.floor(Math.random() * src.length)];
            this.lines = this.raw.split('\n');
            this.vx = (Math.random() - 0.5) * 0.4;
            this.vy = (Math.random() - 0.5) * 0.4;
            this.color = Math.random() > 0.8 ? '#00ff9d' : '#445566';
            this.baseColor = this.color;
            this.opacity = Math.random() * 0.5 + 0.3;
            this.isHashed = false;
            this.isGlitch = false;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < -200) this.x = w + 200;
            if (this.x > w + 200) this.x = -200;
            if (this.y < -100) this.y = h + 100;
            if (this.y > h + 100) this.y = -100;
            const dx = this.x - mouse.x;
            const dy = this.y - mouse.y;
            if (Math.sqrt(dx * dx + dy * dy) < 150) {
                if (!this.isHashed) {
                    this.lines = this.lines.map(() => "0x" + Math.random().toString(16).substr(2, 6));
                    this.color = "#fff";
                    this.opacity = 1.0;
                    this.isHashed = true;
                }
                this.x += dx * 0.01;
                this.y += dy * 0.01;
            } else {
                if (this.isHashed) {
                    this.lines = this.raw.split('\n');
                    this.color = this.baseColor;
                    this.opacity = Math.random() * 0.5 + 0.3;
                    this.isHashed = false;
                }
                if (Math.random() < 0.005) {
                    this.isGlitch = true;
                    setTimeout(() => this.isGlitch = false, 800);
                }
            }
        }

        draw() {
            ctxObj.font = `bold 12px 'Fira Code', monospace`;
            ctxObj.fillStyle = this.isGlitch ? '#ff0055' : this.color;
            ctxObj.globalAlpha = this.opacity;
            this.lines.forEach((l, i) => {
                const t = (this.isGlitch && !this.isHashed) ? toZalgo(l) : l;
                ctxObj.fillText(t, this.x, this.y + i * 16);
            });
        }
    }

    const floaters = [];
    setTimeout(() => {
        for (let i = 0; i < 15; i++) floaters.push(new FloatObj());
    }, 500);

    let lx = 0.1, ly = 0, lz = 0;
    const lPoints = [];
    const sigma = 10, rho = 28, beta = 8 / 3, dt = 0.01;
    let lAngle = 0;

    function renderLorenz() {
        for (let i = 0; i < 5; i++) {
            let dx = (sigma * (ly - lx)) * dt;
            let dy = (lx * (rho - lz) - ly) * dt;
            let dz = (lx * ly - beta * lz) * dt;
            lx += dx;
            ly += dy;
            lz += dz;
            lPoints.push({ x: lx, y: ly, z: lz });
            if (lPoints.length > 800) lPoints.shift();
        }
        lAngle += 0.005;
        const cx = w * 0.85;
        const cy = h * 0.85;
        const scale = 5;
        ctxObj.fillStyle = "#00ff9d";
        ctxObj.globalAlpha = 1.0;
        ctxObj.font = "10px monospace";
        lPoints.forEach(p => {
            let rx = p.x * Math.cos(lAngle) - p.z * Math.sin(lAngle);
            let px = cx + rx * scale;
            let py = cy - p.y * scale;
            ctxObj.fillText(".", px, py);
        });
    }

    let waveAngle = 0;

    function renderDigitalWave() {
        const startX = w - 300;
        const startY = 150;
        const cols = 15;
        const rows = 15;
        const spacing = 15;
        ctxObj.font = "10px monospace";
        waveAngle += 0.05;
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const dist = Math.sqrt((x - cols / 2) ** 2 + (y - rows / 2) ** 2);
                const z = Math.sin(dist * 0.5 + waveAngle) * 10;
                const alpha = (z + 10) / 20;
                ctxObj.fillStyle = `rgba(0, 184, 255, ${alpha + 0.2})`;
                const screenX = startX + (x - y) * spacing * 0.8;
                const screenY = startY + (x + y) * spacing * 0.4 - z * 2;
                ctxObj.fillText(Math.random() > 0.5 ? "1" : "0", screenX, screenY);
            }
        }
    }

    function loop() {
        ctxRain.clearRect(0, 0, w, h);
        ctxObj.clearRect(0, 0, w, h);
        ctxRain.fillStyle = "#00ff9d";
        rainItems.forEach(r => {
            r.update();
            r.draw();
        });

        ghostMouse.angle += 0.02;
        ghostMouse.x = w / 2 + Math.sin(ghostMouse.angle) * (w / 3);
        ghostMouse.y = h / 2 + Math.cos(ghostMouse.angle * 1.3) * (h / 3);
        ctxObj.lineWidth = 1;

        floaters.forEach((f, i) => {
            f.update();
            f.draw();
            const dx = f.x - mouse.x;
            const dy = f.y - mouse.y;
            if (Math.sqrt(dx * dx + dy * dy) < 200) {
                ctxObj.strokeStyle = "rgba(0, 255, 157, 0.4)";
                ctxObj.beginPath();
                ctxObj.moveTo(f.x, f.y);
                ctxObj.lineTo(mouse.x, mouse.y);
                ctxObj.stroke();
            }
            const gdx = f.x - ghostMouse.x;
            const gdy = f.y - ghostMouse.y;
            if (Math.sqrt(gdx * gdx + gdy * gdy) < 150) {
                ctxObj.strokeStyle = "rgba(0, 184, 255, 0.15)";
                ctxObj.beginPath();
                ctxObj.moveTo(f.x, f.y);
                ctxObj.lineTo(ghostMouse.x, ghostMouse.y);
                ctxObj.stroke();
            }

            for (let j = i + 1; j < floaters.length; j++) {
                const f2 = floaters[j];
                const dist = Math.sqrt((f.x - f2.x) ** 2 + (f.y - f2.y) ** 2);
                if (dist < 350 && Math.random() > 0.4) {
                    ctxObj.strokeStyle = `rgba(0, 255, 157, ${(1 - dist / 350) * 0.5})`;
                    ctxObj.beginPath();
                    ctxObj.moveTo(f.x, f.y);
                    ctxObj.lineTo(f2.x, f2.y);
                    ctxObj.stroke();
                }
            }
        });

        renderLorenz();
        renderDigitalWave();
        requestAnimationFrame(loop);
    }

    loop();
}

// === DOCS FUNCTIONS ===
function openDocs() {
    document.getElementById('doc-overlay').classList.remove('hidden');
    renderDocsNav();
}

function closeDocs() {
    document.getElementById('doc-overlay').classList.add('hidden');
}

function renderDocsNav() {
    const nav = document.getElementById('doc-nav');
    nav.innerHTML = '';
    docsDB.forEach(item => {
        const div = document.createElement('div');
        div.className = 'doc-nav-item';
        div.innerText = item.title;
        div.onclick = () => showDocItem(item, div);
        nav.appendChild(div);
    });
}

function showDocItem(item, el) {
    document.querySelectorAll('.doc-nav-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    
    const viewer = document.getElementById('doc-viewer');
    viewer.innerHTML = `
        <div class="doc-block">
            <h3>${item.title}</h3>
            <div class="doc-desc">${item.desc}</div>
            <pre class="doc-code">${item.code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
        </div>
    `;
}
