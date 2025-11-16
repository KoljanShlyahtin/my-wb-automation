/**
 * === СКРИПТ УПРАВЛЕНИЯ ГЛАВНЫМ СВЕТОМ (НОЧНОЙ РЕЖИМ) ===
 * Назначение:
 * - Включает "ночной режим" при долгом нажатии на кнопку в коридоре:
 *   - Выключает весь свет в квартире, кроме минимальной подсветки в туалете.
 *   - Сохраняет текущее состояние света.
 * - Восстанавливает свет при следующем долгом нажатии.
 * - Если после включения "ночного режима" кто-то включает свет вручную, автоматически восстанавливает состояние.
 * - Если свет в коридоре был выключен, при включении "ночного режима" включает свет в коридоре на 30 секунд, а затем выключает.
 * - Включает/выключает бра на стене коридора при одиночном нажатии.
 * - Использует звуковые подсказки (on.wav, off.wav).
 */

// === КОНФИГУРАЦИЯ ===
var ALL_LIGHTS = [
    "wb-led_56/CCT1",
    "wb-led_56/CCT2",
    "wb-mr6cv3_235/K2",
    "wb-mr6cv3_235/K3",
    "wb-mr6cv3_235/K4",
    "wb-mr6cv3_235/K5",
    "wb-mr6cv3_235/K6",
    "wb-led_145/Channel 1",
    "wb-mr6c_38/K1",
    "wb-mr6c_38/K2",
    "wb-mr6c_38/K3",
    "wb-led_145/Channel 3",
    "wb-led_145/Channel 4",
    "wb-mr6c_117/K1",
    "wb-mr6c_117/K4",
    "wb-led_145/Channel 2",
    "wb-mr6c_117/K2",
    "wb-mr6c_38/K5",
    "wb-mr6c_38/K6",
    "wb-mr6c_117/K5",
    "wb-mr6c_117/K6",
    "wb-led_53/Channel 3",
    "wb-led_53/Channel 4"
];

var MASTER_NIGHT_BACKLIGHTS = {
    "wb-led_145/Channel 2": "wb-led_145/Channel 2 Brightness"
};

var CCT_CHANNELS = [
    "wb-led_56/CCT1 Brightness",
    "wb-led_56/CCT1 Temperature",
    "wb-led_56/CCT2 Brightness",
    "wb-led_56/CCT2 Temperature"
];

var CORRIDOR_LIGHTS = [
    "wb-led_56/CCT1",
    "wb-led_56/CCT2"
];

var NIGHT_MODE_CONFIG = {
    CORRIDOR_LIGHTS_DURATION: 30, // Секунд
    TURNOFF_DELAY: 30, // Минут
    DEFAULT_BRIGHTNESS: 2
};

// === Постоянное хранилище ===
var ps = new PersistentStorage("master_light_state", { global: true });
var isProcessing = false;

// === Воспроизведение звука через aplay ===
function playSound(soundFile) {
    var command = "aplay -q \"" + soundFile + "\"";
    log("▶️ Воспроизведение: {}", soundFile);
    runShellCommand(command, {
        captureOutput: true,
        exitCallback: function(exitCode, output) {
            if (exitCode !== 0) {
                log("❌ Ошибка aplay (код {}): {}", exitCode, output.trim());
            }
        }
    });
}
function soundOff() { playSound("/home/off.wav"); }
function soundOn()  { playSound("/home/on.wav");  }

// === Функция для проверки и сброса ночного режима при включении света ===
function checkAndResetNightMode(changedDeviceId) {
    if (ps["savedState"] && typeof ps["savedState"] === "object") {
        if (!MASTER_NIGHT_BACKLIGHTS[changedDeviceId] && dev[changedDeviceId]) {
            log("💡 Свет '{}' включён вручную. Сбрасываю ночной режим.", changedDeviceId);
            restoreLights();
        }
    }
}

// === Сохранить состояние и включить ночной режим (только туалет) ===
function saveLightsState() {
    if (isProcessing) return;
    isProcessing = true;

    var state = {};
    for (var i = 0; i < ALL_LIGHTS.length; i++) {
        var id = ALL_LIGHTS[i];
        state[id] = dev[id];
    }
    for (var i = 0; i < CCT_CHANNELS.length; i++) {
        var ch = CCT_CHANNELS[i];
        if (dev[ch] !== undefined) state[ch] = dev[ch];
    }
    for (var ch in MASTER_NIGHT_BACKLIGHTS) {
        var br = MASTER_NIGHT_BACKLIGHTS[ch];
        if (dev[br] !== undefined) state[br] = dev[br];
    }

    ps["savedState"] = new StorableObject(state);

    var wereCorridorLightsOff = true;
    for (var i = 0; i < CORRIDOR_LIGHTS.length; i++) {
        if (dev[CORRIDOR_LIGHTS[i]]) {
            wereCorridorLightsOff = false;
            break;
        }
    }

    var totalLights = ALL_LIGHTS.length;
    var lightsOff = 0;
    var lightsKeptOn = 0;

    for (var i = 0; i < ALL_LIGHTS.length; i++) {
        var id = ALL_LIGHTS[i];
        if (MASTER_NIGHT_BACKLIGHTS[id]) {
            dev[id] = true;
            dev[MASTER_NIGHT_BACKLIGHTS[id]] = NIGHT_MODE_CONFIG.DEFAULT_BRIGHTNESS;
            lightsKeptOn++;
        } else {
            dev[id] = false;
            lightsOff++;
        }
    }

    soundOff();
    log("🌙 Ночной режим: выключено {} светильников, оставлено {} включённых (туалет 2%)", lightsOff, lightsKeptOn);

    if (wereCorridorLightsOff) {
        log("💡 Свет в коридоре был выключен. Включаю на 30 секунд для освещения.");
        for (var i = 0; i < CORRIDOR_LIGHTS.length; i++) {
            dev[CORRIDOR_LIGHTS[i]] = true;
        }
        setTimeout(function() {
            if (ps["savedState"] && typeof ps["savedState"] === "object" && !isProcessing) {
                log("⏰ Таймер 30 секунд истёк. Выключаю временный свет в коридоре.");
                for (var i = 0; i < CORRIDOR_LIGHTS.length; i++) {
                    dev[CORRIDOR_LIGHTS[i]] = false;
                }
            } else {
                log("⏰ Таймер 30 секунд истёк. Но ночной режим отменён или идёт обработка - свет не выключаю.");
            }
        }, NIGHT_MODE_CONFIG.CORRIDOR_LIGHTS_DURATION * 1000);
    }

    setTimeout(function() {
        isProcessing = false;
    }, 100);
}

// === Восстановить сохранённое состояние света ===
function restoreLights() {
    if (isProcessing) return;
    isProcessing = true;

    if (dev["corridor/circadian_mode"]) {
        dev["corridor/circadian_mode"] = false;
        log("🌙 Циркадный режим отключён");
    }

    var saved = ps["savedState"];
    if (saved && typeof saved === "object") {
        for (var id in saved) {
            if (dev[id] !== undefined) {
                dev[id] = saved[id];
            }
        }
        log("💡 Состояние света полностью восстановлено");
    } else {
        for (var i = 0; i < ALL_LIGHTS.length; i++) {
            dev[ALL_LIGHTS[i]] = true;
        }
        log("💡 Включён весь свет (нет сохранённого состояния)");
    }

    ps["savedState"] = undefined;
    soundOn();

    setTimeout(function() {
        isProcessing = false;
    }, 100);
}

// === Управление кнопкой в коридоре ===
defineRule({
    whenChanged: "wb-mr6cv3_235/Input 2 Single Press Counter",
    then: function() {
        dev["wb-mr6cv3_235/K2"] = !dev["wb-mr6cv3_235/K2"];
        log("💡 Бра на стене: {}", dev["wb-mr6cv3_235/K2"] ? "ВКЛ" : "ВЫКЛ");
    }
});

defineRule({
    whenChanged: "wb-mr6cv3_235/Input 2 Long Press Counter",
    then: function() {
        if (ps["savedState"] && typeof ps["savedState"] === "object") {
            restoreLights();
        } else {
            saveLightsState();
        }
    }
});

// === Правила для отслеживания включения света вручную ===
for (var i = 0; i < ALL_LIGHTS.length; i++) {
    var lightId = ALL_LIGHTS[i];
    (function(id) {
        defineRule("CheckNightMode_" + id.replace(/\//g, '_'), {
            whenChanged: id,
            then: function (newValue, devName, cellName) {
                checkAndResetNightMode(id);
            }
        });
    })(lightId);
}