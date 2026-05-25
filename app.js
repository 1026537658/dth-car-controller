const DEVICE_NAME = '=DTH';
const SERVICE_UUID = 0xFFE0;
const CHARACTERISTIC_UUID = 0xFFE1;

const encoder = new TextEncoder();
let bluetoothDevice = null;
let carCharacteristic = null;
let joystickPointerId = null;
let lastJoystickSentAt = 0;
let lastJoystickCommand = '';
let writeQueue = Promise.resolve();

const connectButton = document.querySelector('#connectButton');
const connectLabel = document.querySelector('#connectLabel');
const connectionStatus = document.querySelector('#connectionStatus');
const statusDot = document.querySelector('#statusDot');
const lastCommand = document.querySelector('#lastCommand');
const speedSlider = document.querySelector('#speedSlider');
const speedValue = document.querySelector('#speedValue');
const joystick = document.querySelector('#joystick');
const joystickKnob = document.querySelector('#joystickKnob');

function setStatus(text, connected = false) {
  connectionStatus.textContent = text;
  connectLabel.textContent = connected ? 'Connected' : 'Connect';
  statusDot.classList.toggle('connected', connected);
}

function setLastCommand(command) {
  lastCommand.textContent = command.trim() || 'X';
}

async function connectBluetooth() {
  if (!('bluetooth' in navigator)) {
    setStatus('Bluetooth unavailable');
    return;
  }

  try {
    setStatus('Searching...');
    bluetoothDevice = await requestBluetoothDevice();

    bluetoothDevice.addEventListener('gattserverdisconnected', handleDisconnect);
    setStatus('Connecting...');

    const server = await bluetoothDevice.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    carCharacteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);

    setStatus(DEVICE_NAME, true);
    await sendCommand('X');
  } catch (error) {
    console.error('Bluetooth connection failed:', error);
    carCharacteristic = null;
    setStatus('Offline');
  }
}

async function requestBluetoothDevice() {
  try {
    return await navigator.bluetooth.requestDevice({
      filters: [
        { name: DEVICE_NAME },
        { name: 'DTH' },
        { namePrefix: '=D' },
        { namePrefix: 'DT' },
      ],
      optionalServices: [SERVICE_UUID],
    });
  } catch (error) {
    if (error.name !== 'NotFoundError') {
      throw error;
    }

    return navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SERVICE_UUID],
    });
  }
}

function handleDisconnect() {
  carCharacteristic = null;
  setStatus('Offline');
}

async function sendCommand(command) {
  setLastCommand(command);

  if (!carCharacteristic) {
    return;
  }

  const payload = encoder.encode(command);
  writeQueue = writeQueue
    .then(() => carCharacteristic.writeValue(payload))
    .then(() => {
      setStatus(`${DEVICE_NAME} · sent ${command.trim() || 'X'}`, true);
    })
    .catch((error) => {
      console.error('Command write failed:', error);
      setStatus('Write failed', false);
    });

  await writeQueue;
}

function bindDirectionButtons() {
  document.querySelectorAll('[data-command]').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      sendCommand(button.dataset.command);
      if (navigator.vibrate) {
        navigator.vibrate(35);
      }
    });
  });
}

function bindSpeedSlider() {
  const sendSpeed = () => {
    speedValue.textContent = speedSlider.value;
    sendCommand(`V:${speedSlider.value}\n`);
  };

  speedSlider.addEventListener('input', () => {
    speedValue.textContent = speedSlider.value;
  });
  speedSlider.addEventListener('change', sendSpeed);
  speedSlider.addEventListener('pointerup', sendSpeed);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function joystickPointToCommand(event) {
  const rect = joystick.getBoundingClientRect();
  const radius = rect.width / 2;
  const knobRadius = joystickKnob.offsetWidth / 2;
  const maxDistance = radius - knobRadius - 14;
  const centerX = rect.left + radius;
  const centerY = rect.top + radius;
  const rawX = event.clientX - centerX;
  const rawY = event.clientY - centerY;
  const distance = Math.hypot(rawX, rawY);
  const limitedDistance = Math.min(distance, maxDistance);
  const angle = Math.atan2(rawY, rawX);
  const dx = Math.cos(angle) * limitedDistance;
  const dy = Math.sin(angle) * limitedDistance;
  const x = clamp(Math.round((dx / maxDistance) * 100), -100, 100);
  const y = clamp(Math.round((-dy / maxDistance) * 100), -100, 100);

  joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

  if (Math.abs(x) < 25 && Math.abs(y) < 25) {
    return 'X';
  }
  return `J:${x},${y}\n`;
}

function resetJoystick() {
  joystickKnob.style.transform = 'translate(-50%, -50%)';
  lastJoystickCommand = '';
  sendCommand('X');
}

function maybeSendJoystick(command) {
  const now = performance.now();
  if (command === lastJoystickCommand && now - lastJoystickSentAt < 90) {
    return;
  }

  lastJoystickCommand = command;
  lastJoystickSentAt = now;
  sendCommand(command);
}

function bindJoystick() {
  joystick.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    joystickPointerId = event.pointerId;
    joystick.setPointerCapture(joystickPointerId);
    maybeSendJoystick(joystickPointToCommand(event));
  });

  joystick.addEventListener('pointermove', (event) => {
    if (event.pointerId !== joystickPointerId) {
      return;
    }

    event.preventDefault();
    maybeSendJoystick(joystickPointToCommand(event));
  });

  const finish = (event) => {
    if (event.pointerId !== joystickPointerId) {
      return;
    }

    joystickPointerId = null;
    resetJoystick();
  };

  joystick.addEventListener('pointerup', finish);
  joystick.addEventListener('pointercancel', finish);
}

connectButton.addEventListener('click', connectBluetooth);
bindDirectionButtons();
bindSpeedSlider();
bindJoystick();

if (!('bluetooth' in navigator)) {
  setStatus('Bluetooth unavailable');
}
