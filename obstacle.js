const DEVICE_NAME_HINT = '=DTH';
const SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
let bluetoothDevice = null;
let carCharacteristic = null;
let writeQueue = Promise.resolve();
let telemetryBuffer = '';
let activeLow = true;
const sendTimes = {};

const connectButton = document.querySelector('#connectButton');
const connectLabel = document.querySelector('#connectLabel');
const connectionStatus = document.querySelector('#connectionStatus');
const statusDot = document.querySelector('#statusDot');
const lastCommand = document.querySelector('#lastCommand');
const startButton = document.querySelector('#startButton');
const stopButton = document.querySelector('#stopButton');
const debugButton = document.querySelector('#debugButton');
const logicButton = document.querySelector('#logicButton');
const deviceName = document.querySelector('#deviceName');
const commandEcho = document.querySelector('#commandEcho');
const leftSensor = document.querySelector('#leftSensor');
const rightSensor = document.querySelector('#rightSensor');
const runState = document.querySelector('#runState');
const speedEcho = document.querySelector('#speedEcho');
const scaleEcho = document.querySelector('#scaleEcho');
const logicEcho = document.querySelector('#logicEcho');
const timingEcho = document.querySelector('#timingEcho');

const controls = [
  startButton,
  stopButton,
  debugButton,
  logicButton,
  document.querySelector('#cruiseSlider'),
  document.querySelector('#turnSlider'),
  document.querySelector('#backSlider'),
  document.querySelector('#leftScaleSlider'),
  document.querySelector('#rightScaleSlider'),
  document.querySelector('#confirmSlider'),
  document.querySelector('#sideTurnSlider'),
  document.querySelector('#backMsSlider'),
  document.querySelector('#escapeMsSlider'),
];

const tunables = [
  { slider: '#cruiseSlider', output: '#cruiseValue', prefix: 'P', label: '巡航' },
  { slider: '#turnSlider', output: '#turnValue', prefix: 'C', label: '转向' },
  { slider: '#backSlider', output: '#backValue', prefix: 'B', label: '后退' },
  { slider: '#leftScaleSlider', output: '#leftScaleValue', prefix: 'G', label: '左轮系数' },
  { slider: '#rightScaleSlider', output: '#rightScaleValue', prefix: 'H', label: '右轮系数' },
  { slider: '#confirmSlider', output: '#confirmValue', prefix: 'M', label: '确认' },
  { slider: '#sideTurnSlider', output: '#sideTurnValue', prefix: 'Q', label: '单侧转向' },
  { slider: '#backMsSlider', output: '#backMsValue', prefix: 'N', label: '后退时间' },
  { slider: '#escapeMsSlider', output: '#escapeMsValue', prefix: 'E', label: '脱困' },
].map((item) => ({
  ...item,
  sliderElement: document.querySelector(item.slider),
  outputElement: document.querySelector(item.output),
}));

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
    for (const item of tunables) {
      await sendTunable(item, true);
    }
    await sendLogic(true);
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
  if (!line.startsWith('O:')) {
    return;
  }

  const parts = line.slice(2).split(',');
  if (parts.length < 10) {
    return;
  }

  leftSensor.textContent = parts[0];
  rightSensor.textContent = parts[1];
  runState.textContent = parts[2];
  speedEcho.textContent = `${parts[3]} / ${parts[4]} / ${parts[5]}`;
  activeLow = parts[6] === '1';
  logicButton.textContent = activeLow ? 'LOW=障碍' : 'HIGH=障碍';
  logicEcho.textContent = activeLow ? 'LOW=障碍' : 'HIGH=障碍';
  if (parts.length >= 13) {
    timingEcho.textContent = `${parts[7]} / ${parts[8]} / ${parts[9]} / ${parts[10]} ms`;
    scaleEcho.textContent = `${parts[11]}% / ${parts[12]}%`;
  } else {
    timingEcho.textContent = `${parts[7]} / ${parts[8]} / ${parts[9]} ms`;
    scaleEcho.textContent = '-';
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

async function sendTunable(item, force = false) {
  item.outputElement.textContent = item.sliderElement.value;
  const now = performance.now();

  if (!force && now - (sendTimes[item.prefix] || 0) < 70) {
    return;
  }

  sendTimes[item.prefix] = now;
  await sendCommand(`${item.prefix}:${item.sliderElement.value}\n`, `${item.label} ${item.sliderElement.value}`);
}

async function sendLogic(force = false) {
  activeLow = force ? activeLow : !activeLow;
  logicButton.textContent = activeLow ? 'LOW=障碍' : 'HIGH=障碍';
  await sendCommand(`L:${activeLow ? 1 : 0}\n`, logicButton.textContent);
}

connectButton.addEventListener('click', connectBluetooth);
startButton.addEventListener('click', () => sendCommand('T', '开始避障'));
stopButton.addEventListener('click', () => sendCommand('X', '停止'));
debugButton.addEventListener('click', () => sendCommand('D', '调试开关'));
logicButton.addEventListener('click', () => sendLogic(false));

tunables.forEach((item) => {
  item.sliderElement.addEventListener('input', () => {
    item.outputElement.textContent = item.sliderElement.value;
    sendTunable(item);
  });
  item.sliderElement.addEventListener('change', () => sendTunable(item, true));
});

setControlsEnabled(false);
if (!('bluetooth' in navigator)) {
  setStatus('浏览器不支持 Web Bluetooth');
}
