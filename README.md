# Tracking Car Web Controller

手机端 Web Bluetooth 循迹小车控制页。

## 指令协议

- `T`：开始循迹
- `X`：停止
- `R`：复位并重新开始
- `D`：切换串口调试输出
- `V:<speed>`：设置循迹速度，例如 `V:95`

网页通过 JDY-29 常用透传服务发送指令：

- Service UUID: `0000ffe0-0000-1000-8000-00805f9b34fb`
- Characteristic UUID: `0000ffe1-0000-1000-8000-00805f9b34fb`

## 手机访问

GitHub Pages 使用 HTTPS，Android Chrome/Edge 可直接使用 Web Bluetooth。

iPhone 普通 Safari/Chrome 不支持标准 Web Bluetooth，需使用支持 Web Bluetooth 的浏览器，例如 Bluefy。
