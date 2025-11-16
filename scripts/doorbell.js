/**
 * === СКРИПТ УПРАВЛЕНИЯ ЗВОНКОМ ===
 * Назначение:
 * - Включает звонок при нажатии на физическую или виртуальную кнопку.
 * - Воспроизводит мелодию, которая зависит от времени суток.
 * - Переключает мелодию при нажатии на кнопку "Следующая мелодия".
 * - Сканирует директорию /home при нажатии на кнопку "Сканировать /home".
 */

// === КОНФИГУРАЦИЯ ===
var DOORBELL_MELODIES = [
    "/home/doorbell_2.wav",
    "/home/on.wav",
    "/home/off.wav"
];

var DOORBELL_CONFIG = {
    DEFAULT_VOLUME: 100,
    NIGHT_VOLUME: 10,
    EVENING_VOLUME: 50
};

// === Внутреннее состояние ===
var storage = new PersistentStorage("doorbell_cycle", { global: true });
var currentIndexKey = "current_melody_index";

if (storage[currentIndexKey] === undefined) {
    storage[currentIndexKey] = 0;
    log("Doorbell cycle: Initialized melody index to 0.");
}

// === Вспомогательные функции ===
function getCurrentTime() {
    var now = new Date();
    return {
        hour: now.getHours(),
        minute: now.getMinutes(),
        second: now.getSeconds()
    };
}

function getVolumeBasedOnTime() {
    var time = getCurrentTime();
    var hour = time.hour;
    if (hour >= 7 && hour < 21) {
        return DOORBELL_CONFIG.DEFAULT_VOLUME;
    } else if (hour >= 21 && hour < 24) {
        return DOORBELL_CONFIG.EVENING_VOLUME;
    } else if (hour >= 0 && hour < 7) {
        return DOORBELL_CONFIG.NIGHT_VOLUME;
    }
    return DOORBELL_CONFIG.NIGHT_VOLUME;
}

function getCurrentMelody() {
    var currentIndex = storage[currentIndexKey];
    if (currentIndex < 0 || currentIndex >= DOORBELL_MELODIES.length) {
        log("Doorbell cycle: Index {} is out of range. Resetting to 0.", currentIndex);
        storage[currentIndexKey] = 0;
        currentIndex = 0;
    }
    return DOORBELL_MELODIES[currentIndex];
}

// === Определение виртуального устройства ===
defineVirtualDevice("doorbell", {
    title: {
        en: "Doorbell",
        ru: "Звонок"
    },
    cells: {
        ring: {
            type: "pushbutton",
            value: false,
            title: {
                en: "Ring",
                ru: "Звонок"
            }
        },
        scan_home_dir: {
            type: "pushbutton",
            value: false,
            title: {
                en: "Scan /home",
                ru: "Сканировать /home"
            }
        },
        current_melody_index: {
            type: "text",
            value: "" + storage[currentIndexKey],
            title: {
                en: "Current Melody Index",
                ru: "Индекс текущей мелодии"
            },
            readonly: true
        },
        next_melody: {
            type: "pushbutton",
            value: false,
            title: {
                en: "Next Melody",
                ru: "Следующая мелодия"
            }
        }
    }
});

// === Определение правил ===
defineRule("PhysicalDoorbellTrigger", {
    whenChanged: "wb-led_196/Input 1",
    then: function (newValue, devName, cellName) {
        if (newValue == 1) {
            log("Doorbell triggered by physical button on {}/{}", devName, cellName);
            triggerDoorbell();
        }
    }
});

defineRule("VirtualDoorbellTrigger", {
    whenChanged: "doorbell/ring",
    then: function (newValue, devName, cellName) {
        if (newValue == 1) {
            log("Doorbell triggered by virtual button on {}/{}", devName, cellName);
            triggerDoorbell();
        }
    }
});

defineRule("ScanHomeDirTrigger", {
    whenChanged: "doorbell/scan_home_dir",
    then: function (newValue, devName, cellName) {
        if (newValue == 1) {
            log("Scan /home button pressed on {}/{}", devName, cellName);
            runShellCommand("ls -la /home", {
                captureOutput: true,
                exitCallback: function(exitCode, capturedOutput) {
                    if (exitCode === 0) {
                        log("Successfully scanned /home directory. Contents:");
                        log("{}", capturedOutput);
                    } else {
                        log("Error scanning /home directory. Exit code: {}, Output: {}", exitCode, capturedOutput);
                    }
                }
            });
        }
    }
});

defineRule("NextMelodyTrigger", {
    whenChanged: "doorbell/next_melody",
    then: function (newValue, devName, cellName) {
        if (newValue == 1) {
            log("Next melody button pressed on {}/{}", devName, cellName);
            var currentIndex = storage[currentIndexKey];
            var nextIndex = (currentIndex + 1) % DOORBELL_MELODIES.length;
            storage[currentIndexKey] = nextIndex;
            dev["doorbell/current_melody_index"] = "" + nextIndex;
            log("Doorbell cycle: Index changed to {}. Next melody will be: {}", nextIndex, DOORBELL_MELODIES[nextIndex]);
        }
    }
});

// === Общая функция для срабатывания звонка ===
function triggerDoorbell() {
    var volume = getVolumeBasedOnTime();
    log("Setting volume to {}% based on current time.", volume);
    var melodyFile = getCurrentMelody();
    log("Selected melody file (index {}): {}", storage[currentIndexKey], melodyFile);
    runShellCommand("/home/set_volume.sh " + volume, {
        exitCallback: function(exitCode, capturedOutput) {
            if (exitCode === 0) {
                log("Volume set successfully via script. Now playing sound: {}", melodyFile);
                runShellCommand("aplay '" + melodyFile + "'", {
                    exitCallback: function(soundExitCode, soundOutput) {
                        if (soundExitCode === 0) {
                            log("Doorbell sound played successfully.");
                        } else {
                            log("Error playing doorbell sound: {}. Exit code: {}, Output: {}", melodyFile, soundExitCode, soundOutput);
                        }
                    }
                });
            } else {
                log("Error setting volume via script. Exit code: {}, Output: {}", exitCode, capturedOutput);
            }
        }
    });
}