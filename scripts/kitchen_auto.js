/**
 * === СКРИПТ АВТОМАТИЗАЦИИ КУХНИ ===
 * Назначение:
 * - Автоматически включает вытяжку, если температура или влажность превышают заданные пороги.
 * - Автоматически включает подсветку фартука, если освещенность падает ниже порога.
 * - Управление автоматизацией через виртуальное устройство 'kitchen_auto'.
 * - Отображение текущих значений датчиков в интерфейсе.
 * - Использование конфигурации через переменные.
 */

// === КОНФИГУРАЦИЯ ===
var KITCHEN_DEVICES = {
    SENSOR: "wb-ms_134",
    FAN_OUTPUT: "wb-gpio/EXT1_ON4",
    BACKLIGHT: {
        CHANNEL: "wb-led_145/Channel 1",
        BRIGHTNESS: "wb-led_145/Channel 1 Brightness"
    },
    VIRTUAL_DEVICE: "kitchen_auto"
};

var KITCHEN_CONFIG = {
    DEFAULT_FAN_STATE: false,
    DEFAULT_BACKLIGHT_STATE: false,
    DEFAULT_ENABLED: true,
    DEFAULT_TEMP_THRESHOLD: 28,
    DEFAULT_HUMIDITY_THRESHOLD: 70,
    DEFAULT_LIGHT_THRESHOLD: 100,
    DEFAULT_LIGHT_BRIGHTNESS: 5
};

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
function updateFanState(temp, humidity, tempThresh, humidityThresh, enabled) {
    if (temp == null || humidity == null) {
        log("⚠️ Ошибка: Данные с датчика температуры/влажности недоступны. Вытяжка выключена.");
        dev[KITCHEN_DEVICES.FAN_OUTPUT] = KITCHEN_CONFIG.DEFAULT_FAN_STATE;
        return;
    }

    if (enabled) {
        if (temp > tempThresh || humidity > humidityThresh) {
            dev[KITCHEN_DEVICES.FAN_OUTPUT] = true;
            log("💨 Вытяжка включена: Темп. {:.2f}, Влаж. {:.2f}, пороги Т:{}, Вл:{}", temp, humidity, tempThresh, humidityThresh);
        } else {
            dev[KITCHEN_DEVICES.FAN_OUTPUT] = false;
            log("💨 Вытяжка выключена: Темп. {:.2f}, Влаж. {:.2f}, пороги Т:{}, Вл:{}", temp, humidity, tempThresh, humidityThresh);
        }
    } else {
        dev[KITCHEN_DEVICES.FAN_OUTPUT] = KITCHEN_CONFIG.DEFAULT_FAN_STATE;
        log("💨 Вытяжка выключена принудительно (автоматизация отключена)");
    }
}

function updateBacklightState(light, lightThresh, brightness, enabled) {
    if (light == null) {
        log("⚠️ Ошибка: Данные освещенности недоступны. Подсветка выключена.");
        dev[KITCHEN_DEVICES.BACKLIGHT.CHANNEL] = KITCHEN_CONFIG.DEFAULT_BACKLIGHT_STATE;
        return;
    }

    if (enabled) {
        if (light < lightThresh) {
            dev[KITCHEN_DEVICES.BACKLIGHT.CHANNEL] = true;
            dev[KITCHEN_DEVICES.BACKLIGHT.BRIGHTNESS] = brightness;
            log("💡 Подсветка фартука включена: Освещ. {:.2f}, порог {}, яркость {}", light, lightThresh, brightness);
        } else {
            dev[KITCHEN_DEVICES.BACKLIGHT.CHANNEL] = false;
            log("💡 Подсветка фартука выключена: Освещ. {:.2f}, порог {}", light, lightThresh);
        }
    } else {
        dev[KITCHEN_DEVICES.BACKLIGHT.CHANNEL] = KITCHEN_CONFIG.DEFAULT_BACKLIGHT_STATE;
        log("💡 Подсветка фартука выключена принудительно (автоматизация отключена)");
    }
}

// === ОСНОВНОЕ ВИРТУАЛЬНОЕ УСТРОЙСТВО ===
defineVirtualDevice('kitchen_auto', {
    title: 'Автоматизация кухни',
    cells: {
        Enabled: {
            title: 'Автоматизация вкл',
            type: 'switch',
            value: KITCHEN_CONFIG.DEFAULT_ENABLED,
            forceDefault: true
        },
        TempThreshold: {
            title: 'Порог температуры',
            type: 'range',
            value: KITCHEN_CONFIG.DEFAULT_TEMP_THRESHOLD,
            min: 10,
            max: 50,
            forceDefault: true
        },
        HumidityThreshold: {
            title: 'Порог влажности',
            type: 'range',
            value: KITCHEN_CONFIG.DEFAULT_HUMIDITY_THRESHOLD,
            min: 30,
            max: 95,
            forceDefault: true
        },
        LightThreshold: {
            title: 'Порог освещенности',
            type: 'range',
            value: KITCHEN_CONFIG.DEFAULT_LIGHT_THRESHOLD,
            min: 1,
            max: 200,
            forceDefault: true
        },
        LightBrightness: {
            title: 'Яркость подсветки',
            type: 'range',
            value: KITCHEN_CONFIG.DEFAULT_LIGHT_BRIGHTNESS,
            min: 0,
            max: 100,
            forceDefault: true
        },
        CurrentTemperature: {
            title: 'Текущая температура',
            type: 'text',
            value: '—'
        },
        CurrentHumidity: {
            title: 'Текущая влажность',
            type: 'text',
            value: '—'
        },
        CurrentIlluminance: {
            title: 'Текущая освещенность',
            type: 'text',
            value: '—'
        },
        Trigger: {
            title: 'Запуск логики',
            type: 'pushbutton'
        }
    }
});

// === ПРАВИЛА ===
// Правило 1: Управление вытяжкой
defineRule("kitchen_fan_control", {
    whenChanged: [
        KITCHEN_DEVICES.SENSOR + "/Temperature",
        KITCHEN_DEVICES.SENSOR + "/Humidity",
        KITCHEN_DEVICES.VIRTUAL_DEVICE + "/Enabled",
        KITCHEN_DEVICES.VIRTUAL_DEVICE + "/TempThreshold",
        KITCHEN_DEVICES.VIRTUAL_DEVICE + "/HumidityThreshold"
    ],
    then: function (newValue, devName, cellName) {
        var currentTemp = dev[KITCHEN_DEVICES.SENSOR + "/Temperature"];
        var currentHumidity = dev[KITCHEN_DEVICES.SENSOR + "/Humidity"];
        var autoEnabled = dev[KITCHEN_DEVICES.VIRTUAL_DEVICE + "/Enabled"];
        var tempThreshold = dev[KITCHEN_DEVICES.VIRTUAL_DEVICE + "/TempThreshold"];
        var humidityThreshold = dev[KITCHEN_DEVICES.VIRTUAL_DEVICE + "/HumidityThreshold"];
        updateFanState(currentTemp, currentHumidity, tempThreshold, humidityThreshold, autoEnabled);
    }
});

// Правило 2: Управление подсветкой фартука
defineRule("kitchen_backlight_control", {
    whenChanged: [
        KITCHEN_DEVICES.SENSOR + "/Illuminance",
        KITCHEN_DEVICES.VIRTUAL_DEVICE + "/Enabled",
        KITCHEN_DEVICES.VIRTUAL_DEVICE + "/LightThreshold",
        KITCHEN_DEVICES.VIRTUAL_DEVICE + "/LightBrightness"
    ],
    then: function (newValue, devName, cellName) {
        var currentLight = dev[KITCHEN_DEVICES.SENSOR + "/Illuminance"];
        var autoEnabled = dev[KITCHEN_DEVICES.VIRTUAL_DEVICE + "/Enabled"];
        var lightThreshold = dev[KITCHEN_DEVICES.VIRTUAL_DEVICE + "/LightThreshold"];
        var lightBrightness = dev[KITCHEN_DEVICES.VIRTUAL_DEVICE + "/LightBrightness"];
        updateBacklightState(currentLight, lightThreshold, lightBrightness, autoEnabled);
    }
});

// Правило 3 (Опционально): Ручной запуск логики по кнопке Trigger
defineRule("kitchen_manual_trigger", {
    whenChanged: KITCHEN_DEVICES.VIRTUAL_DEVICE + "/Trigger",
    then: function (newValue, devName, cellName) {
        var currentTemp = dev[KITCHEN_DEVICES.SENSOR + "/Temperature"];
        var currentHumidity = dev[KITCHEN_DEVICES.SENSOR + "/Humidity"];
        var currentLight = dev[KITCHEN_DEVICES.SENSOR + "/Illuminance"];
        var autoEnabled = dev[KITCHEN_DEVICES.VIRTUAL_DEVICE + "/Enabled"];
        var tempThreshold = dev[KITCHEN_DEVICES.VIRTUAL_DEVICE + "/TempThreshold"];
        var humidityThreshold = dev[KITCHEN_DEVICES.VIRTUAL_DEVICE + "/HumidityThreshold"];
        var lightThreshold = dev[KITCHEN_DEVICES.VIRTUAL_DEVICE + "/LightThreshold"];
        var lightBrightness = dev[KITCHEN_DEVICES.VIRTUAL_DEVICE + "/LightBrightness"];
        log("🔄 Ручной запуск логики. Текущие значения: Темп. {:.2f}, Влаж. {:.2f}, Осв. {:.2f}", currentTemp, currentHumidity, currentLight);
        updateFanState(currentTemp, currentHumidity, tempThreshold, humidityThreshold, autoEnabled);
        updateBacklightState(currentLight, lightThreshold, lightBrightness, autoEnabled);
    }
});

// === ПРАВИЛА ДЛЯ ОБНОВЛЕНИЯ ТЕКУЩИХ ЗНАЧЕНИЙ ===
defineRule("update_current_temp", {
    whenChanged: KITCHEN_DEVICES.SENSOR + "/Temperature",
    then: function (newValue) {
        var temp = dev[KITCHEN_DEVICES.SENSOR + "/Temperature"];
        if (temp != null) {
            dev["kitchen_auto/CurrentTemperature"] = temp.toFixed(1) + " °C";
        } else {
            dev["kitchen_auto/CurrentTemperature"] = "—";
        }
    }
});

defineRule("update_current_humidity", {
    whenChanged: KITCHEN_DEVICES.SENSOR + "/Humidity",
    then: function (newValue) {
        var humidity = dev[KITCHEN_DEVICES.SENSOR + "/Humidity"];
        if (humidity != null) {
            dev["kitchen_auto/CurrentHumidity"] = humidity.toFixed(1) + " %";
        } else {
            dev["kitchen_auto/CurrentHumidity"] = "—";
        }
    }
});

defineRule("update_current_illuminance", {
    whenChanged: KITCHEN_DEVICES.SENSOR + "/Illuminance",
    then: function (newValue) {
        var illuminance = dev[KITCHEN_DEVICES.SENSOR + "/Illuminance"];
        if (illuminance != null) {
            dev["kitchen_auto/CurrentIlluminance"] = illuminance.toFixed(0) + " lx";
        } else {
            dev["kitchen_auto/CurrentIlluminance"] = "—";
        }
    }
});