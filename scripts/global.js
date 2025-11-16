/**
 * === ГЛОБАЛЬНЫЙ СКРИПТ ===
 * Назначение:
 * - Хранит общие функции и переменные для всех скриптов.
 * - Управляет глобальными флагами.
 */

// === ГЛОБАЛЬНЫЕ ФЛАГИ ===
global.__GLOBAL_AUTOMATION_ENABLED = true; // Общий флаг, указывающий, активна ли автоматизация во всей квартире.
global.__GLOBAL_NIGHT_MODE_ACTIVE = false; // Флаг, указывающий, что ночной режим активен.

// === ОБЩИЕ ФУНКЦИИ ===
function logGlobal(message) {
    log("🌐 " + message);
}

function playSound(soundFile) {
    var command = "aplay -q \"" + soundFile + "\"";
    logGlobal("▶️ Воспроизведение: {}", soundFile);
    runShellCommand(command, {
        captureOutput: true,
        exitCallback: function(exitCode, output) {
            if (exitCode !== 0) {
                logGlobal("❌ Ошибка aplay (код {}): {}", exitCode, output.trim());
            }
        }
    });
}

function setBrightnessChannels(value) {
    for (var i = 0; i < ALL_LIGHTS.length; i++) {
        var channel = ALL_LIGHTS[i];
        if (dev[channel] !== undefined) {
            var metaType = dev[channel + "#type"];
            if (metaType === "range" || metaType === "value") {
                dev[channel] = value;
                logGlobal("✅ Установлена яркость {} для {}", value, channel);
            } else {
                logGlobal("⚠️ Канал {} не является range/value, пропускаем: тип {}", channel, metaType);
            }
        } else {
            logGlobal("❌ Канал {} не найден в dev, проверьте имя.", channel);
        }
    }
}

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