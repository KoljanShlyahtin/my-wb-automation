// === НАЧАЛО: Интеграция с уличной влажностью и температурой для сушилки обуви ===

// 1. Виртуальное устройство для автоматического режима сушки обуви в коридоре
defineVirtualDevice('shoe_dryer_corridor', {
  title: 'Сушилка обуви коридор',
  cells: {
    'auto_mode': { 
      type: 'switch',
      value: false,
      readonly: false,
      title: 'Автоматический режим' 
    },
    'comfort_mode': { 
      type: 'switch',
      value: false,
      readonly: false,
      title: 'Комфортный режим' 
    },
    'high_setpoint': { 
      type: 'range',
      value: 37,
      min: 25,
      max: 38,
      readonly: false,
      title: 'Температура при сушке' 
    },
    'comfort_setpoint': { 
      type: 'range',
      value: 25,
      min: 20,
      max: 30,
      readonly: false,
      title: 'Температура в комфорте' 
    },
    'low_setpoint': { 
      type: 'range',
      value: 25,
      min: 20,
      max: 30,
      readonly: false,
      title: 'Минимальная температура' 
    },
    'humidity_threshold_high': { 
      type: 'range',
      value: 76,
      min: 60,
      max: 100,
      readonly: false,
      title: 'Влажно — включать сушку' // 👈 Понятно: если влажность выше этого — сушка может включиться
    },
    'humidity_threshold_low': { 
      type: 'range',
      value: 70,
      min: 50,
      max: 90,
      readonly: false,
      title: 'Сухо — выключать сушку' // 👈 Понятно: если влажность ниже этого — сушка выключится
    },
    'temp_threshold_cold': { 
      type: 'range',
      value: -19,
      min: -20,
      max: 15,
      readonly: false,
      title: 'Холодно — разрешить сушку' // 👈 КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Это НЕ температура пола, а УЛИЧНАЯ температура. Если на улице холоднее этого — сушка разрешена.
    },
    'temp_threshold_warm': { 
      type: 'range',
      value: 10,
      min: 5,
      max: 25,
      readonly: false,
      title: 'Тепло — запретить сушку' // 👈 КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Это НЕ температура пола, а УЛИЧНАЯ температура. Если на улице теплее этого — сушка запрещена.
    },
    // --- ТЕКУЩИЕ ЗНАЧЕНИЯ (только для чтения) ---
    'current_humidity': { 
      type: 'value',
      value: 0,
      readonly: true,
      title: 'Текущая влажность (%)' 
    },
    'current_temperature': { 
      type: 'value',
      value: 0,
      readonly: true,
      title: 'Текущая уличная температура (°C)' // 👈 Уточнили: это с улицы!
    },
    'current_state': { 
      type: 'switch',
      value: false,
      readonly: true,
      title: 'Состояние теплого пола' 
    },
    'current_floor_temperature': { 
      type: 'value',
      value: 0,
      readonly: true,
      title: 'Температура пола (°C)' 
    }
  }
});

// 2. Постоянное хранилище для комфортной уставки
var comfortStorage = new PersistentStorage("corridor_comfort_setpoint", {global: true});
if (comfortStorage["setpoint"] === undefined) {
    comfortStorage["setpoint"] = 25;
    log("Инициализация: комфортная уставка сохранена как " + comfortStorage["setpoint"]);
}

// 3. Главное правило: реагирует на влажность, уличную температуру и температуру пола
defineRule({
  name: 'weather_and_floor_temp_trigger',
  whenChanged: [
    "weather_tymen/humidity",
    "weather_tymen/temperature",
    "wb-m1w2_20/External Sensor 1"
  ],
  then: function (newValue, devName, cellName) {
    var autoModeEnabled = dev["shoe_dryer_corridor/auto_mode"];
    var comfortModeEnabled = dev["shoe_dryer_corridor/comfort_mode"];

    // Получаем текущие значения
    var currentHumidity = parseFloat(dev["weather_tymen/humidity"]);
    var currentTemp = parseFloat(dev["weather_tymen/temperature"]);
    var currentFloorTemp = parseFloat(dev["wb-m1w2_20/External Sensor 1"]);

    // Получаем пороги из виртуального устройства
    var highThreshold = dev["shoe_dryer_corridor/humidity_threshold_high"];
    var lowThreshold = dev["shoe_dryer_corridor/humidity_threshold_low"];
    var coldThreshold = dev["shoe_dryer_corridor/temp_threshold_cold"]; // 👈 Уличная температура, ниже которой сушка РАЗРЕШЕНА
    var warmThreshold = dev["shoe_dryer_corridor/temp_threshold_warm"]; // 👈 Уличная температура, выше которой сушка ЗАПРЕЩЕНА

    var setpoint; // Здесь будет храниться, до какой температуры греть пол
    var mode = "off"; // Для логов — какой режим сейчас активен

    // --- ЛОГИКА РЕЖИМОВ ---
    if (autoModeEnabled) {
        // Условие для ВКЛЮЧЕНИЯ сушки: ВЛАЖНО И ХОЛОДНО (на улице)
        if (currentHumidity > highThreshold && currentTemp < coldThreshold) {
            setpoint = dev["shoe_dryer_corridor/high_setpoint"];
            mode = "сушка";
        }
        // Условие для ВЫКЛЮЧЕНИЯ сушки: СУХО ИЛИ ТЕПЛО (на улице)
        else if (currentHumidity < lowThreshold || currentTemp > warmThreshold) {
            dev["wb-gpio/EXT1_ON1"] = false;
            log("Уличная влажность (" + currentHumidity + "%) < " + lowThreshold + "% ИЛИ температура (" + currentTemp + "°C) > " + warmThreshold + "°C. Сушка выключена.");
            dev["shoe_dryer_corridor/current_humidity"] = currentHumidity;
            dev["shoe_dryer_corridor/current_temperature"] = currentTemp;
            if (!isNaN(currentFloorTemp)) {
                dev["shoe_dryer_corridor/current_floor_temperature"] = currentFloorTemp;
            }
            return; // Выходим — сушка не нужна
        }
        else {
            // В остальных случаях (например, влажно, но не холодно) — проверяем, включён ли комфортный режим
            log("Условия для сушки не выполнены (влажно, но не холодно). Проверяем комфортный режим.");
            if (comfortModeEnabled) {
                setpoint = dev["shoe_dryer_corridor/comfort_setpoint"];
                mode = "комфорт (авто)";
                log("Комфортный режим включён. Будем греть пол до " + setpoint + "°C.");
            } else {
                // Если комфортный режим выключен — выключаем пол
                dev["wb-gpio/EXT1_ON1"] = false;
                log("Условия для сушки не выполнены и комфортный режим выключен. Теплый пол выключен.");
                dev["shoe_dryer_corridor/current_humidity"] = currentHumidity;
                dev["shoe_dryer_corridor/current_temperature"] = currentTemp;
                if (!isNaN(currentFloorTemp)) {
                    dev["shoe_dryer_corridor/current_floor_temperature"] = currentFloorTemp;
                }
                return; // Выходим — пол не греется
            }
        }
    } else if (comfortModeEnabled) {
        // Комфортный режим работает, когда автоматический режим выключен
        setpoint = dev["shoe_dryer_corridor/comfort_setpoint"];
        mode = "комфорт";
    } else {
        // Оба режима выключены — пол выключен
        dev["wb-gpio/EXT1_ON1"] = false;
        log("Оба режима (авто и комфорт) отключены. Теплый пол выключен.");
        dev["shoe_dryer_corridor/current_humidity"] = currentHumidity;
        dev["shoe_dryer_corridor/current_temperature"] = currentTemp;
        if (!isNaN(currentFloorTemp)) {
            dev["shoe_dryer_corridor/current_floor_temperature"] = currentFloorTemp;
        }
        return;
    }

    // Проверка на числа
    if (isNaN(setpoint) || isNaN(currentFloorTemp)) {
        log("Ошибка: уставка или температура пола не число. Режим: " + mode);
        return;
    }

    // Гистерезис — чтобы пол не включался/выключался слишком часто
    var hysteresis = 0.2;

    // Основная логика термостата: включаем, если пол холоднее уставки, выключаем, если теплее
    if (currentFloorTemp <= setpoint - hysteresis) {
        dev["wb-gpio/EXT1_ON1"] = true;
        log("Режим '" + mode + "'. Температура пола (" + currentFloorTemp + "°C) <= уставки (" + setpoint + "°C) - гистерезис. Включаем теплый пол.");
    } else if (currentFloorTemp >= setpoint + hysteresis) {
        dev["wb-gpio/EXT1_ON1"] = false;
        log("Режим '" + mode + "'. Температура пола (" + currentFloorTemp + "°C) >= уставки (" + setpoint + "°C) + гистерезис. Выключаем теплый пол.");
    } else {
        log("Режим '" + mode + "'. Температура пола (" + currentFloorTemp + "°C) в зоне гистерезиса (" + (setpoint - hysteresis) + " - " + (setpoint + hysteresis) + "). Ничего не меняем.");
    }

    // Обновляем отображаемые значения на экране
    dev["shoe_dryer_corridor/current_humidity"] = currentHumidity;
    dev["shoe_dryer_corridor/current_temperature"] = currentTemp;
    if (!isNaN(currentFloorTemp)) {
        dev["shoe_dryer_corridor/current_floor_temperature"] = currentFloorTemp;
    }
  }
});

// 4. Правило: обновляет состояние реле на экране
defineRule({
  name: 'relay_state_monitor',
  whenChanged: "wb-gpio/EXT1_ON1",
  then: function (newValue, devName, cellName) {
    dev["shoe_dryer_corridor/current_state"] = newValue;
  }
});

// === ОСТАЛЬНЫЙ КОД (туалет, датчики, ошибки) — остаётся без изменений ===
// ... (ваш остальной код здесь, как и было)