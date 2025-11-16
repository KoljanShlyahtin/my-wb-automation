/**
 * Управление вентилятором в санузле
 * - Вентилятор (K3) общий для туалета и душевой.
 * - При включении света в туалете (K1) вентилятор включается через 1 мин на 20 мин.
 * - При включении света в душе (K2) вентилятор выключается.
 * - Если свет в душе горел >= 3 мин, после выключения вентилятор включается на 30 мин.
 * - Состояние вентилятора можно управлять вручную через виртуальное устройство 'ventilation'.
 */// === УПРАВЛЕНИЕ ВЕНТИЛЯТОРОМ В САНУЗЛЕ ===
// Один вентилятор (wb-mr6c_117/K3) на туалет и душевую

defineVirtualDevice("ventilation", {
  cells: {
    fan_state: { type: "switch", value: false }
  }
});

var ps = new PersistentStorage("bathroom_ventilation", { global: true });

var timers = {
  toiletOn: null,
  showerOn: null,
  fanOff: null
};

function clearTimer(name) {
  if (timers[name]) {
    clearTimeout(timers[name]);
    timers[name] = null;
  }
}

function turnFanOn(durationMinutes) {
  clearTimer("fanOff");
  dev["wb-mr6c_117/K3"] = true;
  ps["fanActive"] = true;
  timers.fanOff = setTimeout(function () {
    dev["wb-mr6c_117/K3"] = false;
    ps["fanActive"] = false;
  }, durationMinutes * 60 * 1000);
  log("🌀 Вентилятор включён на {} мин", durationMinutes);
}

// === Туалет: включить через 1 мин, выключить через 20 мин после выключения света ===
defineRule({
  whenChanged: "wb-mr6c_117/K1",
  then: function (on) {
    if (on) {
      clearTimer("toiletOn");
      timers.toiletOn = setTimeout(function () {
        turnFanOn(20);
      }, 60 * 1000); // 1 минута
    } else {
      clearTimer("toiletOn");
      // Если вентилятор включён и душ не горит — оставляем таймер включения
    }
  }
});

// === Душевая ===
defineRule({
  whenChanged: "wb-mr6c_117/K2",
  then: function (on) {
    if (on) {
      // При включении света — выключить вентилятор
      dev["wb-mr6c_117/K3"] = false;
      ps["fanActive"] = false;
      clearTimer("showerOn");
      clearTimer("fanOff");
      // Запомнить, что свет горит ≥5 мин
      timers.showerOn = setTimeout(function () {
        ps["showerLong"] = true;
        log("🚿 Свет в душевой горит ≥5 мин");
      }, 3 * 60 * 1000); // 5 минут!
    } else {
      clearTimer("showerOn");
      if (ps["showerLong"]) {
        ps["showerLong"] = false;
        turnFanOn(30);
      }
    }
  }
});

// === Восстановление после перезагрузки ===
setTimeout(function () {
  if (ps["fanActive"]) {
    dev["wb-mr6c_117/K3"] = true;
  }
}, 5000);