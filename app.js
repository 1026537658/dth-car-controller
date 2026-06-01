const DEVICE_NAME_HINT = '=DTH';
const SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
let bluetoothDevice = null;
let carCharacteristic = null;
let writeQueue = Promise.resolve();
let lastSpeedSentAt = 0;
let telemetryBuffer = '';

const connectButton = document.querySelector('#connectButton');
const connectLabel = document.querySelector('#connectLabel');
const connectionStatus = document.querySelector('#connectionStatus');
const statusDot = document.querySelector('#statusDot');
const lastCommand = document.querySelector('#lastCommand');
const speedSlider = document.querySelector('#speedSlider');
const speedValue = document.querySelector('#speedValue');
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

const controls = [startButton, stopButton, resetButton, debugButton, speedSlider];

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
    await sendSpeed(true);
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
  runState.textContent = parts.slice(4).join(',');
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

async function sendSpeed(force = false) {
  speedValue.textContent = speedSlider.value;
  const now = performance.now();

  if (!force && now - lastSpeedSentAt < 70) {
    return;
  }

  lastSpeedSentAt = now;
  await sendCommand(`V:${speedSlider.value}\n`, `速度 ${speedSlider.value}`);
}

connectButton.addEventListener('click', connectBluetooth);
startButton.addEventListener('click', () => sendCommand('T', '开始循迹'));
stopButton.addEventListener('click', () => sendCommand('X', '停止'));
resetButton.addEventListener('click', () => sendCommand('R', '复位运行'));
debugButton.addEventListener('click', () => sendCommand('D', '调试开关'));

speedSlider.addEventListener('input', () => {
  speedValue.textContent = speedSlider.value;
  sendSpeed();
});

speedSlider.addEventListener('change', () => sendSpeed(true));

setControlsEnabled(false);
if (!('bluetooth' in navigator)) {
  setStatus('浏览器不支持 Web Bluetooth');
}
