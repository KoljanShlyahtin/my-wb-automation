// === Настройки ===
var CITY_NAME = "Тюмень";

// === Создание виртуального устройства (для отображения времени) ===
var sunInfoDevice = getDevice("sun_info");
if (!sunInfoDevice) {
    // Если устройство не существует — создаём его
    defineVirtualDevice('sun_info', {
        title: { en: 'Sun Info (' + CITY_NAME + ')', ru: 'Восход и закат (' + CITY_NAME + ')' },
        cells: {
            sunrise: {
                title: { en: 'Sunrise', ru: 'Восход' },
                type: "text",
                value: "--:--",
                description: "Время восхода солнца"
            },
            sunset: {
                title: { en: 'Sunset', ru: 'Закат' },
                type: "text",
                value: "--:--",
                description: "Время заката солнца"
            },
            daylight: {
                title: { en: 'Daylight', ru: 'Световой день' },
                type: "text",
                value: "-- ч -- мин",
                description: "Продолжительность светового дня"
            }
        }
    });
    log("✅ Виртуальное устройство 'sun_info' создано.");
} else {
    log("ℹ️ Виртуальное устройство 'sun_info' уже существует.");
}