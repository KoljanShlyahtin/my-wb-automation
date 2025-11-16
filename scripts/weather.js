// === Виртуальное устройство для погоды в Тюмени ===
defineVirtualDevice('weather_tymen', {
    title: { en: 'Weather in Tyumen', ru: 'Погода в Тюмени' },
    cells: {
        temperature: {
            title: { en: 'Temperature', ru: 'Температура' },
            type: "value",
            value: "--",
            units: "°C"
        },
        feels_like: {
            title: { en: 'Feels like', ru: 'Ощущается как' },
            type: "value",
            value: "--",
            units: "°C"
        },
        condition: {
            title: { en: 'Condition', ru: 'Состояние' },
            type: "text",
            value: "N/A"
        },
        humidity: { // <--- НОВОЕ: Контрол для влажности
            title: { en: 'Humidity', ru: 'Влажность' },
            type: "value",
            value: "--",
            units: "%"
        },
        pressure_mm: { // <--- Дополнительно: давление
            title: { en: 'Pressure', ru: 'Давление' },
            type: "value",
            value: "--",
            units: "мм рт. ст."
        }
    }
});

// === Функция получения погоды ===
function updateWeather() {
    var ACCESS_KEY = '4502feae-be68-4d7f-8cda-1a107155dd7e'; // Замените на ваш ключ!
    var LAT = '57.1522';
    var LON = '65.5341';
    var URL = 'https://api.weather.yandex.ru/v2/forecast?lat=' + LAT + '&lon=' + LON + '&lang=ru_RU';

    var command = 'curl -s -H "X-Yandex-Weather-Key: ' + ACCESS_KEY + '" "' + URL + '"';
    
    runShellCommand(command, {
        captureOutput: true,
        exitCallback: function(exitCode, output) {
            if (exitCode !== 0) {
                log("❌ Ошибка получения погоды");
                return;
            }

            if (output.indexOf('"error"') !== -1) {
                var error_message_match = output.match(/"message":\s*"([^"]+)"/);
                log("❌ Ошибка от API: " + (error_message_match ? error_message_match[1] : output));
                return;
            }

            // Используем jq для парсинга JSON
            var parseTempCmd = 'echo \'' + output + '\' | jq -r \'.fact.temp\'';
            var parseFeelsLikeCmd = 'echo \'' + output + '\' | jq -r \'.fact.feels_like\'';
            var parseConditionCmd = 'echo \'' + output + '\' | jq -r \'.fact.condition\'';
            var parseHumidityCmd = 'echo \'' + output + '\' | jq -r \'.fact.humidity\''; // <--- НОВОЕ
            var parsePressureCmd = 'echo \'' + output + '\' | jq -r \'.fact.pressure_mm\''; // <--- НОВОЕ

            runShellCommand(parseTempCmd, {
                captureOutput: true,
                exitCallback: function(code, temp) {
                    if (code === 0) dev["weather_tymen/temperature"] = parseFloat(temp.trim());
                }
            });
            runShellCommand(parseFeelsLikeCmd, {
                captureOutput: true,
                exitCallback: function(code, feelsLike) {
                    if (code === 0) dev["weather_tymen/feels_like"] = parseFloat(feelsLike.trim());
                }
            });
            runShellCommand(parseConditionCmd, {
                captureOutput: true,
                exitCallback: function(code, condition) {
                    if (code === 0) dev["weather_tymen/condition"] = condition.trim();
                }
            });
            runShellCommand(parseHumidityCmd, { // <--- НОВОЕ
                captureOutput: true,
                exitCallback: function(code, humidity) {
                    if (code === 0) dev["weather_tymen/humidity"] = parseFloat(humidity.trim());
                }
            });
            runShellCommand(parsePressureCmd, { // <--- НОВОЕ
                captureOutput: true,
                exitCallback: function(code, pressure) {
                    if (code === 0) dev["weather_tymen/pressure_mm"] = parseFloat(pressure.trim());
                }
            });
        }
    });
}

// === Обновлять погоду каждые 60 минут ===
var weatherIntervalId = setInterval(updateWeather, 60 * 60 * 1000);

// === Получить погоду при запуске ===
updateWeather();