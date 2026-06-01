# Tracking Car Web Controller

手机端 Web Bluetooth 循迹小车控制页。

## 指令协议

- `T`：开始循迹
- `X`：停止
- `R`：复位并重新开始
- `D`：切换串口调试输出
- `F:<speed>`：设置直线速度，例如 `F:120`
- `C:<speed>`：设置转弯速度，例如 `C:75`
- `V:<speed>`：兼容旧协议，等同于设置直线速度
- `S:<left>,<center>,<right>,<active>,<state>,<straight>,<turn>,<error>`：Arduino 发给网页的三路数字循迹遥测，例如 `S:0,1,0,1,follow,115,80,0`

网页通过 JDY-29 常用透传服务发送指令：

- Service UUID: `0000ffe0-0000-1000-8000-00805f9b34fb`
- Characteristic UUID: `0000ffe1-0000-1000-8000-00805f9b34fb`

## 手机访问

GitHub Pages 使用 HTTPS，Android Chrome/Edge 可直接使用 Web Bluetooth。

iPhone 普通 Safari/Chrome 不支持标准 Web Bluetooth，需使用支持 Web Bluetooth 的浏览器，例如 Bluefy。
