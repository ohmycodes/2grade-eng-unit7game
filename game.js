// --- 1. Configuración del Juego ---

// La lista de todos los objetos que necesitamos encontrar.
// ¡Importante! Los nombres deben ser EXACTOS a las 'id' del HTML.
const itemsToFind = [
    "map", 
    "water-bottle",
    "cap",
    "sun-cream",
    "notebook",
    "guide-book",
    "magnifying-glass",
    "coat",
    "mobile-phone",
    "backpack"
];

// Barajamos la lista para que el orden sea diferente cada vez que jugamos
itemsToFind.sort(() => Math.random() - 0.5);

// Para saber qué objeto estamos buscando
let currentItemIndex = 0;

// Referencias a los elementos HTML que necesitamos controlar
const instructionText = document.getElementById("instruction-text");
const allItems = document.querySelectorAll(".item");
const gameArea = document.getElementById("game-area");
const backpackTarget = document.getElementById("backpack-target");

// --- 2. Funciones del Juego ---

// Escalado responsivo del área de juego (Fase 1)
let GAME_BASE_WIDTH = 800;
let GAME_BASE_HEIGHT = 500;
let gameScale = 1;

function computeGameScale() {
    try {
        const wrapper = document.getElementById('game-wrapper');
        const vw = window.innerWidth || document.documentElement.clientWidth;
        const vh = window.innerHeight || document.documentElement.clientHeight;
        // Altura aproximada ocupada por títulos y textos en Fase 1
        const headerReserve = 220; // ajustable si fuera necesario
        const availableH = Math.max(320, vh - headerReserve);
        const scaleW = Math.min(1, (wrapper ? wrapper.clientWidth : vw) / GAME_BASE_WIDTH);
        const scaleH = Math.min(1, availableH / GAME_BASE_HEIGHT);
        const s = Math.min(scaleW, scaleH);
        const clamped = Math.max(0.8, s); // No reducir por debajo de 0.8 para mantener targets táctiles
        return isFinite(clamped) && clamped > 0 ? clamped : 1;
    } catch { return 1; }
}

function applyGameScale() {
    const area = document.getElementById('game-area');
    const wrapper = document.getElementById('game-wrapper');
    gameScale = computeGameScale();
    if (area) {
        area.style.transformOrigin = 'top center';
        area.style.transform = `scale(${gameScale})`;
    }
    if (wrapper) {
        // Ajusta la altura del wrapper para evitar solapamientos/scrolles raros
        wrapper.style.height = `${(GAME_BASE_HEIGHT * gameScale) + 6}px`; // + borde
    }
    // Exponer como variable CSS por si se quiere usar en estilos
    document.documentElement.style.setProperty('--game-scale', String(gameScale));
}

function setupResponsiveScaling() {
    applyGameScale();
    let resizeTimer;
    const onResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(applyGameScale, 100);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
}

// Overlay de transición entre fases
const transitionOverlay = document.getElementById('transition-overlay');
const transitionTitleEl = document.getElementById('transition-title');
const transitionCelebrationEl = document.getElementById('transition-celebration');

function showTransition(titleText, options = {}, callback) {
    const { showCelebration = true, duration = 1800 } = options;
    if (transitionOverlay && transitionTitleEl && transitionCelebrationEl) {
        transitionTitleEl.textContent = titleText || '';
        transitionCelebrationEl.style.display = showCelebration ? 'block' : 'none';
        transitionOverlay.classList.remove('hidden');
        setTimeout(() => {
            transitionOverlay.classList.add('hidden');
            if (typeof callback === 'function') callback();
        }, duration);
    } else {
        // Fallback en caso de que no exista el overlay
        setTimeout(() => { if (typeof callback === 'function') callback(); }, 800);
    }
}

/**
 * Mueve un item hasta el centro de la mochila y luego lo desvanece.
 * Al terminar, lo oculta y ejecuta el callback `done`.
 */
function moveItemToBackpackAndFade(item, done) {
    try {
        if (!gameArea || !backpackTarget) {
            // Fallback: ocultar directamente
            item.style.display = 'none';
            if (typeof done === 'function') done();
            return;
        }

        // Evitar dobles clics/animaciones
        if (item.classList.contains('moving')) {
            return;
        }

        const areaRect = gameArea.getBoundingClientRect();
        const targetRect = backpackTarget.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();

        // Cálculos en coordenadas de viewport; convertir a coordenadas no escaladas del game-area
        const scale = (typeof gameScale === 'number' && gameScale > 0) ? gameScale : 1;
        const areaLeft = areaRect.left;
        const areaTop = areaRect.top;
        const targetCenterX_vp = targetRect.left + (targetRect.width / 2);
        const targetCenterY_vp = targetRect.top + (targetRect.height / 2);

        // Nueva posición (top/left) en el sistema de coordenadas del #game-area sin escala
        const newLeft = ((targetCenterX_vp - areaLeft) - (itemRect.width / 2)) / scale;
        const newTop = ((targetCenterY_vp - areaTop) - (itemRect.height / 2)) / scale;

        // Subir z-index y desactivar puntero durante la animación
        item.classList.add('moving');

        // Aplicar movimiento suave (CSS tiene transition: all 0.8s)
        item.style.left = `${newLeft}px`;
        item.style.top = `${newTop}px`;

        // Tras terminar el movimiento, aplicar fade-out
        setTimeout(() => {
            item.classList.add('fade-out');

            // Tras el fade, ocultar y limpiar
            setTimeout(() => {
                item.style.display = 'none';
                item.classList.remove('moving');
                item.classList.remove('fade-out');
                if (typeof done === 'function') done();
            }, 850);
        }, 850);
    } catch (e) {
        console.error('Error animando item a la mochila:', e);
        // Fallback seguro
        item.style.display = 'none';
        if (typeof done === 'function') done();
    }
}

/**
 * Esta función actualiza el texto de las instrucciones
 * para pedir el siguiente objeto de la lista.
 */
function askForNextItem() {
    // Si ya encontramos todos los objetos (índice 10)
    if (currentItemIndex >= itemsToFind.length) {
        instructionText.textContent = "¡Genial! ¡Mochila lista!";
        
        // Transición clara a Fase 2
        showTransition('Siguiente: Fase 2 — Encontrar al dueño de cada objeto', { showCelebration: true, duration: 1800 }, startPhase2);
        return; 
    }
    
    // Obtenemos el nombre del objeto que toca buscar
    const itemToFind = itemsToFind[currentItemIndex];
    
    // Convertimos la 'id' (ej. "guide-book") en un nombre legible (ej. "guide book")
    const friendlyName = itemToFind.replace('-', ' ');
    
    // Actualizamos el texto en pantalla
    instructionText.textContent = `Let's get ready! Find the... ${friendlyName}.`;
}

/**
 * Esta función se llama CADA VEZ que el jugador hace clic en CUALQUIER objeto.
 */
function handleItemClick(event) {
    const clickedItem = event.target;
    const correctItemName = itemsToFind[currentItemIndex];

    if (clickedItem.id === correctItemName) {
        console.log("¡Correcto!");
        // Animamos el movimiento hacia la mochila y desvanecemos
        moveItemToBackpackAndFade(clickedItem, () => {
            // Al terminar, avanzamos al siguiente
            currentItemIndex++;
            askForNextItem();
        });
    } else {
        // Feedback de error
        clickedItem.classList.add("wrong");
        console.log("¡Incorrecto! Intenta de nuevo.");
        setTimeout(() => {
            clickedItem.classList.remove("wrong");
        }, 400);
    }
}

// --- 3. Iniciar el Juego ---

// Configura escalado responsivo para Fase 1
setupResponsiveScaling();

// Añadimos un "detector de clics" a CADA objeto
allItems.forEach(item => {
    item.addEventListener("click", handleItemClick);
});

// Llamamos a la función por primera vez para empezar el juego
askForNextItem();

// ==================================================
// =================== FASE 2 =======================
// ==================================================

// --- 1. Datos y Configuración Fase 2 ---

// Definimos los 10 objetos, su dueño y su pista visual (clase CSS)
const backphase2Items = [
    { name: 'cap', owner: 'HIS', cue: 'cue-his' },
    { name: 'mobile phone', owner: 'HIS', cue: 'cue-his' },
    { name: 'magnifying glass', owner: 'HIS', cue: 'cue-his' },
    { name: 'coat', owner: 'HERS', cue: 'cue-hers' },
    { name: 'sun cream', owner: 'HERS', cue: 'cue-hers' },
    { name: 'guide book', owner: 'HERS', cue: 'cue-hers' },
    { name: 'notebook', owner: 'MINE', cue: 'cue-mine' },
    { name: 'water bottle', owner: 'MINE', cue: 'cue-mine' },
    { name: 'map', owner: 'THEIRS', cue: 'cue-theirs' },
    { name: 'backpack', owner: 'THEIRS', cue: 'cue-theirs' }
];

// Definimos los 10 objetos, su dueño y su pista visual (clase CSS)
const phase2Items = [
    { name: 'cap', owner: 'HIS', cue: 'cue-his' },
    { name: 'mobile-phone', owner: 'HIS', cue: 'cue-his' }, // <-- Con guion
    { name: 'magnifying-glass', owner: 'HIS', cue: 'cue-his' }, // <-- Con guion
    { name: 'coat', owner: 'HERS', cue: 'cue-hers' },
    { name: 'sun-cream', owner: 'HERS', cue: 'cue-hers' }, // <-- Con guion
    { name: 'guide-book', owner: 'HERS', cue: 'cue-hers' }, // <-- Con guion
    { name: 'notebook', owner: 'MINE', cue: 'cue-mine' },
    { name: 'water-bottle', owner: 'MINE', cue: 'cue-mine' }, // <-- Con guion
    { name: 'map', owner: 'THEIRS', cue: 'cue-theirs' },
    { name: 'backpack', owner: 'THEIRS', cue: 'cue-theirs' }
];

let phase2CurrentIndex = 0;
let displayedItemElement = null; // Guardará el objeto <div> que estamos mostrando

// Referencias a los elementos HTML de la Fase 2
const phase1Section = document.getElementById('phase-1');
const phase2Section = document.getElementById('phase-2');
const phase2Question = document.getElementById('phase-2-question');
const itemDisplayArea = document.getElementById('item-display-area');
const answerButtons = document.getElementById('answer-buttons');
const yoursButtons = document.getElementById('yours-buttons');

// --- 2. Funciones de Lógica Fase 2 ---

/**
 * Se llama cuando termina la Fase 1.
 * Oculta Fase 1, muestra Fase 2 y empieza la lógica.
 */
function startPhase2() {
    // Oculta Fase 1 y muestra Fase 2
    phase1Section.classList.add('hidden');
    phase2Section.classList.remove('hidden');

    // Barajamos los objetos de la Fase 2
    phase2Items.sort(() => Math.random() - 0.5);
    phase2CurrentIndex = 0;

    // Empezamos la primera pregunta
    askPhase2Question();
}

/**
 * Muestra el siguiente objeto y prepara la pregunta.
 * (VERSIÓN CORREGIDA: DIV + IMG)
 */
function askPhase2Question() {
    // Si ya pasamos por todos los objetos
    if (phase2CurrentIndex >= phase2Items.length) {
        phase2Question.textContent = "¡Fantástico! ¡Todo está en orden!";
        itemDisplayArea.innerHTML = "";
        answerButtons.classList.add('hidden');
        yoursButtons.classList.add('hidden');
        // Transición clara a Fase 3
        showTransition('Siguiente: Fase 3 — ¡Hora del picnic!', { showCelebration: true, duration: 1800 }, startPhase3);
        return;
    }

    // Obtenemos el objeto actual
    const item = phase2Items[phase2CurrentIndex];
    const friendlyName = item.name.replace('-', ' ');
    
    // --- Lógica de la variante "YOURS" ---
    if (item.owner === 'MINE' && Math.random() > 0.5) {
        phase2Question.textContent = `Is this ${friendlyName} YOURS?`;
        answerButtons.classList.add('hidden');
        yoursButtons.classList.remove('hidden');
    } else {
        phase2Question.textContent = `Whose is this ${friendlyName}?`;
        answerButtons.classList.remove('hidden');
        yoursButtons.classList.add('hidden');
    }
    
    // --- ¡ESTA ES LA LÓGICA CORREGIDA! ---
    
    itemDisplayArea.innerHTML = ""; // Limpiamos el área
    
    // 1. Creamos el <div> "marco"
    displayedItemElement = document.createElement('div'); 
    displayedItemElement.className = 'item-p2';
    displayedItemElement.classList.add(item.cue); // Añadimos la pista visual al marco
    
    // 2. Creamos la <img> "foto"
    const imgElement = document.createElement('img');
    imgElement.src = `images/${item.name}.png`; 
    imgElement.alt = friendlyName; 
    
    // 3. Ponemos la "foto" (img) DENTRO del "marco" (div)
    displayedItemElement.appendChild(imgElement);
    
    // 4. Ponemos el "marco" (div) en la pantalla
    itemDisplayArea.appendChild(displayedItemElement);
}

/**
 * Muestra el siguiente objeto y prepara la pregunta.
 */
function oldAskPhase2Question() {
    // Si ya pasamos por todos los objetos
    // Si ya pasamos por todos los objetos
    if (phase2CurrentIndex >= phase2Items.length) {
        phase2Question.textContent = "¡Fantástico! ¡Todo está en orden!";
        itemDisplayArea.innerHTML = "🎉";
        answerButtons.classList.add('hidden');
        yoursButtons.classList.add('hidden');
        
        // ¡Transición a la Fase 3!
        setTimeout(startPhase3, 2000); // Espera 2 segundos
        return;
    }

    // Obtenemos el objeto actual
    const item = phase2Items[phase2CurrentIndex];

    // --- Lógica de la variante "YOURS" ---
    // Si el objeto es "MINE" y sale un 50% de probabilidad
    if (item.owner === 'MINE' && Math.random() > 0.5) {
        // Hacemos la pregunta "Is this YOURS?"
        phase2Question.textContent = `Is this ${item.name} YOURS?`;
        
        // Mostramos los botones "Yes/No" y ocultamos los otros
        answerButtons.classList.add('hidden');
        yoursButtons.classList.remove('hidden');
    } else {
        // Hacemos la pregunta normal "Whose is this...?"
        phase2Question.textContent = `Whose is this ${item.name}?`;
        
        // Mostramos los botones "MINE/HIS/HERS/THEIRS"
        answerButtons.classList.remove('hidden');
        yoursButtons.classList.add('hidden');
    }
    
    // Creamos el elemento visual para el objeto
    itemDisplayArea.innerHTML = ""; // Limpiamos el área
    displayedItemElement = document.createElement('div');
    displayedItemElement.className = 'item-p2';
    displayedItemElement.classList.add(item.cue); // ¡Añadimos la pista visual!
    displayedItemElement.textContent = item.name;
    itemDisplayArea.appendChild(displayedItemElement);
}

/**
 * Comprueba la respuesta del jugador.
 * @param {string} clickedAnswer - La respuesta (ej. "MINE", "HIS", "HERS", "THEIRS")
 */
function checkPhase2Answer(clickedAnswer) {
    const correctOwner = phase2Items[phase2CurrentIndex].owner;

    // --- Respuesta Correcta ---
    if (clickedAnswer === correctOwner) {
        console.log("¡Correcto!");
        // (Aquí pondrías el sonido "¡Sí! It's...")

        // Añadimos la clase de animación para que "vuele"
        let animationClass = '';
        if (correctOwner === 'MINE') animationClass = 'fly-to-player';
        if (correctOwner === 'HIS') animationClass = 'fly-to-tom';
        if (correctOwner === 'HERS') animationClass = 'fly-to-sarah';
        if (correctOwner === 'THEIRS') animationClass = 'fly-to-theirs';
        
        displayedItemElement.classList.add(animationClass);

        // Avanzamos al siguiente objeto
        phase2CurrentIndex++;

        // Esperamos que termine la animación (1 seg) y hacemos la siguiente pregunta
        setTimeout(askPhase2Question, 1000);

    } else {
        // --- Respuesta Incorrecta ---
        console.log("Incorrecto, intenta de nuevo.");
        // (Aquí pondrías el sonido "boop")

        // Hacemos que el botón incorrecto tiemble
        // (En una implementación más compleja, buscaríamos el botón específico)
        // Por ahora, solo lo indicamos en la consola.
    }
}

// --- 3. Conectar Botones (Event Listeners) ---

// Conectamos los 4 botones principales
document.getElementById('btn-mine').addEventListener('click', () => checkPhase2Answer('MINE'));
document.getElementById('btn-his').addEventListener('click', () => checkPhase2Answer('HIS'));
document.getElementById('btn-hers').addEventListener('click', () => checkPhase2Answer('HERS'));
document.getElementById('btn-theirs').addEventListener('click', () => checkPhase2Answer('THEIRS'));

// Conectamos los 2 botones de la variante "YOURS"
// Nota: "Yes" es una respuesta correcta (MINE), "No" es una respuesta incorrecta.
document.getElementById('btn-yes-mine').addEventListener('click', () => checkPhase2Answer('MINE'));
document.getElementById('btn-no-not-mine').addEventListener('click', () => checkPhase2Answer('HERS')); // Simula una respuesta incorrecta

// ==================================================
// =================== FASE 3 =======================
// ==================================================

// --- 1. Datos y Configuración Fase 3 ---
const phase3Food = ["grapes", "biscuit", "orange", "drink", "cherries", "crisps"];
let foodToOfferByTom = ["grapes", "biscuit", "orange"]; // Tom ofrecerá 3
let foodToOfferByPlayer = ["grapes", "biscuit", "orange", "drink", "cherries", "crisps"];
let selectedFood = null;
let awaitingFriendResponse = false;
let currentFriendAwaiting = null;
let responseEnableAt = 0;

// Respuestas preprogramadas de los amigos
const friendResponses = {
    "tom": ["Yes, please!", "No, thank you.", "Yes, please! I love those!"],
    "sarah": ["No, thank you.", "Yes, please!", "Oh, yummy! Yes!"]
};

// Referencias a los elementos HTML de la Fase 3
const phase2SectionForHiding = document.getElementById('phase-2'); // Renombramos para evitar conflicto
const phase3Section = document.getElementById('phase-3');
const speechBubble = document.getElementById('speech-bubble');
const speechText = document.getElementById('speech-text');
const picnicTom = document.getElementById('picnic-tom');
const picnicSarah = document.getElementById('picnic-sarah');
const foodTray = document.getElementById('food-tray');
const yesNoButtons = document.getElementById('yes-no-buttons');
const endControls = document.getElementById('end-controls');
const restartBtn = document.getElementById('btn-restart');

// --- 2. Funciones de Lógica Fase 3 ---

// Helper: setea el contenido del globo con texto e imagen opcional y orienta el globo según el emisor
function setSpeech(speaker, message, foodKey = null, altText = null) {
    // Orientación del globo
    speechBubble.classList.remove('from-tom', 'from-sarah', 'from-player');
    if (speaker === 'tom') speechBubble.classList.add('from-tom');
    else if (speaker === 'sarah') speechBubble.classList.add('from-sarah');
    else if (speaker === 'player') speechBubble.classList.add('from-player');

    // Construimos el HTML con posible imagen
    const imgHtml = foodKey ? `<img class="speech-food" src="images/${foodKey}.png" alt="${altText || foodKey}">` : '';
    speechText.innerHTML = `<span class="speech-content">${message} ${imgHtml}</span>`;
}

/**
 * Se llama cuando termina la Fase 2.
 */
function startPhase3() {
    phase2SectionForHiding.classList.add('hidden');
    phase3Section.classList.remove('hidden');
    
    // Barajamos la comida que ofrece Tom
    foodToOfferByTom.sort(() => Math.random() - 0.5);
    
    // Empezamos la Parte A
    runPartA();
}

// --- PARTE A (Receptiva) ---

/**
 * Inicia la Parte A: Tom ofrece comida al jugador.
 */
function runPartA() {
    setSpeech('tom', "It's picnic time!", null);
    
    // Esperamos 2 segundos y empezamos la primera oferta
    setTimeout(offerFoodToPlayer, 2000);
}

/**
 * Tom ofrece el siguiente alimento de su lista.
 */
function offerFoodToPlayer() {
    // Si Tom ya ofreció toda su comida, pasamos a la Parte B
    if (foodToOfferByTom.length === 0) {
        startPartB();
        return;
    }

    // Tomamos el siguiente alimento
    const food = foodToOfferByTom.pop(); // Saca el último alimento de la lista

    // Ocultamos botones primero para dar tiempo de lectura
    yesNoButtons.classList.add('hidden');

    // Tom "habla" con imagen del alimento
    const altText = food.charAt(0).toUpperCase() + food.slice(1);
    setSpeech('tom', `(Tom) Would you like some ${food}?`, food, altText);

    // Mostramos los botones de Sí/No tras una pequeña pausa
    setTimeout(() => {
        yesNoButtons.classList.remove('hidden');
    }, 900);
}

/**
 * Maneja la respuesta del jugador (Yes/No).
 */
function handlePlayerResponse(response) {
    // Ocultamos los botones de Sí/No
    yesNoButtons.classList.add('hidden');
    
    if (response === 'yes') {
        speechText.textContent = "¡Genial!";
        // (Aquí podrías poner una animación de la comida volando al jugador)
    } else {
        speechText.textContent = "OK!";
    }

    // Esperamos 1.5 segundos y hacemos la siguiente oferta
    setTimeout(offerFoodToPlayer, 1500);
}

// --- PARTE B (Activa) ---

/**
 * Inicia la Parte B: El jugador ofrece comida a sus amigos.
 */
function startPartB() {
    speechText.textContent = "Your turn! Offer a snack to your friends!";
    
    // Ocultamos botones Sí/No, mostramos la bandeja de comida
    yesNoButtons.classList.add('hidden');
    foodTray.classList.remove('hidden');
    
    // Hacemos que los amigos sean "clicables"
    picnicTom.classList.add('clickable');
    picnicSarah.classList.add('clickable');

    // Preparamos los "listeners" para la Parte B
    setupPartBListeners();
}

/**
 * Configura todos los clics para la Parte B.
 */
function setupPartBListeners() {
    // Clics en la comida
    document.querySelectorAll('.food-item').forEach(item => {
        item.addEventListener('click', () => {
            // Si la comida ya se usó, no hacemos nada
            if (item.classList.contains('used')) return;

            // Quitamos la selección de otros
            document.querySelectorAll('.food-item').forEach(f => f.classList.remove('selected'));
            
            // Seleccionamos esta comida
            item.classList.add('selected');
            selectedFood = item.dataset.food;
            const foodAltText = item.alt; // Obtenemos el texto "Grapes" o "Biscuit"
            // Mostrar la pregunta centrada hacia el jugador
            setSpeech('player', `Would you like some ${selectedFood}? (Click Tom or Sarah)`, selectedFood, foodAltText);
        });
    });

    // Clics en los amigos
    picnicTom.addEventListener('click', () => handleFriendClick('tom'));
    picnicSarah.addEventListener('click', () => handleFriendClick('sarah'));
}

/**
 * Maneja el clic en un amigo (Tom o Sarah).
 */
function handleFriendClick(friendName) {
    const now = Date.now();

    // Si estamos esperando la respuesta y se hace clic en el MISMO amigo
    if (awaitingFriendResponse && currentFriendAwaiting === friendName) {
        // Evitamos que se responda demasiado rápido para permitir lectura
        if (now < responseEnableAt) return;

        // Determinar respuesta del amigo
        let response = "";
        if (friendName === 'tom') {
            response = friendResponses.tom[Math.floor(Math.random() * friendResponses.tom.length)];
        } else {
            response = friendResponses.sarah[Math.floor(Math.random() * friendResponses.sarah.length)];
        }

        // Mostrar respuesta desde el lado del amigo
        setSpeech(friendName, `(${friendName.charAt(0).toUpperCase() + friendName.slice(1)}) ${response}`);

        // Consumir la comida seleccionada ahora
        const foodElement = document.querySelector(`.food-item[data-food="${selectedFood}"]`);
        if (foodElement) {
            foodElement.classList.add('used');
            foodElement.classList.remove('selected');
        }
        // Quitar de la lista de pendientes
        foodToOfferByPlayer = foodToOfferByPlayer.filter(f => f !== selectedFood);

        // Limpiar estados
        selectedFood = null;
        awaitingFriendResponse = false;
        picnicTom.classList.remove('awaiting-response');
        picnicSarah.classList.remove('awaiting-response');
        currentFriendAwaiting = null;

        // Si ya no queda comida, finalizar tras una pausa
        if (foodToOfferByPlayer.length === 0) {
            setTimeout(endGame, 2000);
        }
        return;
    }

    // Si aún no hay comida seleccionada, recordamos al jugador
    if (!selectedFood) {
        setSpeech(null, "Click on a food first!");
        return;
    }

    // Primer clic en un amigo tras seleccionar comida: NO reposicionar el globo aún.
    // Mantener la pregunta centrada (desde el jugador) y solo marcar a quién se la diriges.
    // Si ya estábamos esperando respuesta de otro amigo, cambiamos el resaltado y reiniciamos el delay de lectura.
    awaitingFriendResponse = true;
    currentFriendAwaiting = friendName;
    responseEnableAt = now + 900; // 0.9s para permitir lectura antes de responder

    // Actualizamos resaltados de amigos
    picnicTom.classList.remove('awaiting-response');
    picnicSarah.classList.remove('awaiting-response');
    (friendName === 'tom' ? picnicTom : picnicSarah).classList.add('awaiting-response');
}

/**
 * Termina el juego.
 */
function endGame() {
    speechText.textContent = "¡Misión de Exploradores Completada! ¡Gran trabajo!";
    foodTray.classList.add('hidden');
    picnicTom.classList.remove('clickable');
    picnicSarah.classList.remove('clickable');

    // Celebración visible y opción de reiniciar
    showTransition('¡Misión completada! 🎉', { showCelebration: true, duration: 2000 }, () => {
        if (endControls) endControls.classList.remove('hidden');
    });
}

// --- 3. Conectar Botones Fase 3 ---

document.getElementById('btn-yes-please').addEventListener('click', () => handlePlayerResponse('yes'));
document.getElementById('btn-no-thanks').addEventListener('click', () => handlePlayerResponse('no'));
if (restartBtn) {
    restartBtn.addEventListener('click', () => {
        // Reiniciar juego de forma simple
        window.location.reload();
    });
}
