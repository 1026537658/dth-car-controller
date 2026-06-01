const DEVICE_NAME_HINT = '=DTH';
const SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
let bluetoothDevice = null;
let carCharacteristic = null;
let writeQueue = Promise.resolve();
let lastStraightSpeedSentAt = 0;
let lastTurnSpeedSentAt = 0;
let lastKpSentAt = 0;
let lastKdSentAt = 0;
let telemetryBuffer = '';

const connectButton = document.querySelector('#connectButton');
const connectLabel = document.querySelector('#connectLabel');
const connectionStatus = document.querySelector('#connectionStatus');
const statusDot = document.querySelector('#statusDot');
const lastCommand = document.querySelector('#lastCommand');
const straightSpeedSlider = document.querySelector('#straightSpeedSlider');
const straightSpeedValue = document.querySelector('#straightSpeedValue');
const turnSpeedSlider = document.querySelector('#turnSpeedSlider');
const turnSpeedValue = document.querySelector('#turnSpeedValue');
const kpSlider = document.querySelector('#kpSlider');
const kpValue = document.querySelector('#kpValue');
const kdSlider = document.querySelector('#kdSlider');
const kdValue = document.querySelector('#kdValue');
const startButton = document.querySelector('#startButton');
const stopButton = document.querySelector('#stopButton');
const resetButton = document.querySelector('#resetButton');
const debugButton = document.querySelector('#debugButton');
const deviceName = document.querySelector('#deviceName');
const commandEcho = document.querySelector('#commandEcho');
const leftSensor = document.querySelector('#leftSensor');
const centerSensor = document.querySelector('#centerSensor');
const rightSensor = document.querySelector('#rightSensor');
const activeCount = document.querySelector('#activeCount');
const runState = document.querySelector('#runState');
const speedEcho = document.querySelector('#speedEcho');
const gainEcho = document.querySelector('#gainEcho');
const errorEcho = document.querySelector('#errorEcho');

const controls = [startButton, stopButton, resetButton, debugButton, straightSpeedSlider, turnSpeedSlider, kpSlider, kdSlider];

function setControlsEnabled(enabled) {
  controls.forEach((control) => {
    control.disabled = !enabled;
  });
}

function setStatus(text, connected = false) {
  connectionStatus.textContent = text;
  connectLabel.textContent = connected ? '已连接' : '连接';
  statusDot.classList.toggle('connected', connected);
  setControlsEnabled(connected);
}

function setLastCommand(label, command) {
  lastCommand.textContent = label;
  commandEcho.textContent = command.trim() || 'X';
}

function showError(prefix, error) {
  const message = error && error.message ? error.message : String(error);
  setStatus(`${prefix}: ${message}`);
}

async function connectBluetooth() {
  if (!('bluetooth' in navigator)) {
    setStatus('浏览器不支持 Web Bluetooth');
    alert('当前浏览器没有 Web Bluetooth。Android 可用 Chrome/Edge；iPhone 请用 Bluefy 打开 GitHub Pages 网页。');
    return;
  }

  try {
    setStatus('正在搜索设备...');
    bluetoothDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SERVICE_UUID],
    });

    bluetoothDevice.addEventListener('gattserverdisconnected', handleDisconnect);
    deviceName.textContent = bluetoothDevice.name || DEVICE_NAME_HINT;
    setStatus('正在连接...');

    const server = await bluetoothDevice.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    carCharacteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
    await startTelemetryNotifications();

    setStatus(deviceName.textContent, true);
    await sendStraightSpeed(true);
    await sendTurnSpeed(true);
    await sendKp(true);
    await sendKd(true);
    await sendCommand('X', '待机');
  } catch (error) {
    console.error('Bluetooth connection failed:', error);
    carCharacteristic = null;
    showError(error.name || '连接失败', error);
  }
}

function handleDisconnect() {
  carCharacteristic = null;
  setStatus('已断开');
}

async function startTelemetryNotifications() {
  try {
    await carCharacteristic.startNotifications();
    carCharacteristic.addEventListener('characteristicvaluechanged', handleTelemetryChanged);
  } catch (error) {
    console.warn('Notifications unavailable:', error);
    setStatus('已连接，遥测通知不可用', true);
  }
}

function handleTelemetryChanged(event) {
  telemetryBuffer += decoder.decode(event.target.value);

  let lineBreakIndex = telemetryBuffer.search(/[\r\n]/);
  while (lineBreakIndex >= 0) {
    const line = telemetryBuffer.slice(0, lineBreakIndex).trim();
    telemetryBuffer = telemetryBuffer.slice(lineBreakIndex + 1);
    if (line) {
      handleTelemetryLine(line);
    }
    lineBreakIndex = telemetryBuffer.search(/[\r\n]/);
  }
}

function handleTelemetryLine(line) {
  if (!line.startsWith('S:')) {
    return;
  }

  const parts = line.slice(2).split(',');
  if (parts.length < 5) {
    return;
  }

  leftSensor.textContent = parts[0];
  centerSensor.textContent = parts[1];
  rightSensor.textContent = parts[2];
  activeCount.textContent = parts[3];
  runState.textContent = parts[4];
  if (parts.length >= 7) {
    speedEcho.textContent = `${parts[5]} / ${parts[6]}`;
  }
  if (parts.length >= 9) {
    gainEcho.textContent = `${parts[7]} / ${parts[8]}`;
  }
  if (parts.length >= 10) {
    errorEcho.textContent = parts[9];
  }
}

async function sendCommand(command, label = command) {
  setLastCommand(label, command);

  if (!carCharacteristic) {
    return;
  }

  const payload = encoder.encode(command);
  writeQueue = writeQueue
    .then(() => {
      if (carCharacteristic.writeValueWithoutResponse) {
        return carCharacteristic.writeValueWithoutResponse(payload);
      }
      return carCharacteristic.writeValue(payload);
    })
    .then(() => {
      setStatus(`${deviceName.textContent} · ${label}`, true);
      if (navigator.vibrate) {
        navigator.vibrate(25);
      }
    })
    .catch((error) => {
      console.error('Command write failed:', error);
      setStatus('发送失败');
    });

  await writeQueue;
}

async function sendStraightSpeed(force = false) {
  straightSpeedValue.textContent = straightSpeedSlider.value;
  const now = performance.now();

  if (!force && now - lastStraightSpeedSentAt < 70) {
    return;
  }

  lastStraightSpeedSentAt = now;
  await sendCommand(`F:${straightSpeedSlider.value}\n`, `直线 ${straightSpeedSlider.value}`);
}

async function sendTurnSpeed(force = false) {
  turnSpeedValue.textContent = turnSpeedSlider.value;
  const now = performance.now();

  if (!force && now - lastTurnSpeedSentAt < 70) {
    return;
  }

  lastTurnSpeedSentAt = now;
  await sendCommand(`C:${turnSpeedSlider.value}\n`, `转弯 ${turnSpeedSlider.value}`);
}

async function sendKp(force = false) {
  kpValue.textContent = kpSlider.value;
  const now = performance.now();

  if (!force && now - lastKpSentAt < 70) {
    return;
  }

  lastKpSentAt = now;
  await sendCommand(`P:${kpSlider.value}\n`, `Kp ${kpSlider.value}`);
}

async function sendKd(force = false) {
  kdValue.textContent = kdSlider.value;
  const now = performance.now();

  if (!force && now - lastKdSentAt < 70) {
    return;
  }

  lastKdSentAt = now;
  await sendCommand(`Q:${kdSlider.value}\n`, `Kd ${kdSlider.value}`);
}

connectButton.addEventListener('click', connectBluetooth);
startButton.addEventListener('click', () => sendCommand('T', '开始循迹'));
stopButton.addEventListener('click', () => sendCommand('X', '停止'));
resetButton.addEventListener('click', () => sendCommand('R', '复位运行'));
debugButton.addEventListener('click', () => sendCommand('D', '调试开关'));

straightSpeedSlider.addEventListener('input', () => {
  straightSpeedValue.textContent = straightSpeedSlider.value;
  sendStraightSpeed();
});

straightSpeedSlider.addEventListener('change', () => sendStraightSpeed(true));

turnSpeedSlider.addEventListener('input', () => {
  turnSpeedValue.textContent = turnSpeedSlider.value;
  sendTurnSpeed();
});

turnSpeedSlider.addEventListener('change', () => sendTurnSpeed(true));

kpSlider.addEventListener('input', () => {
  kpValue.textContent = kpSlider.value;
  sendKp();
});

kpSlider.addEventListener('change', () => sendKp(true));

kdSlider.addEventListener('input', () => {
  kdValue.textContent = kdSlider.value;
  sendKd();
});

kdSlider.addEventListener('change', () => sendKd(true));

setControlsEnabled(false);
if (!('bluetooth' in navigator)) {
  setStatus('浏览器不支持 Web Bluetooth');
}
