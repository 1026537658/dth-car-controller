# Car Web Controller

手机端 Web Bluetooth 控制页，包含循迹和避障两个页面。

## 页面

- `index.html`：项目二循迹控制
- `obstacle.html`：项目一避障控制

## 循迹指令协议

- `T`：开始循迹
- `X`：停止
- `R`：复位并重新开始
- `D`：切换串口调试输出
- `F:<speed>`：设置直线速度，例如 `F:120`
- `C:<speed>`：设置转弯速度，例如 `C:75`
- `A:<ms>`：设置侧边强修正时间，例如 `A:70`
- `B:<diff>`：设置侧边差速大小，例如 `B:70`
- `V:<speed>`：兼容旧协议，等同于设置直线速度
- `S:<left>,<center>,<right>,<active>,<state>,<straight>,<turn>,<error>,<adjust_ms>,<diff>`：Arduino 发给网页的三路数字循迹遥测，例如 `S:0,1,0,1,follow,115,80,0,70,70`

## 避障指令协议

- `T`：开始避障
- `X`：停止
- `R`：复位并重新开始
- `D`：切换串口调试输出
- `P:<speed>`：设置巡航速度，例如 `P:100`
- `C:<speed>`：设置转向速度，例如 `C:95`
- `B:<speed>`：设置后退速度，例如 `B:85`
- `G:<percent>`：设置左轮速度系数，例如 `G:88`
- `H:<percent>`：设置右轮速度系数，例如 `H:100`
- `L:<0|1>`：设置红外避障有效电平，`1` 表示 `LOW=障碍物`
- `M:<ms>`：设置传感器确认时间，例如 `M:60`
- `Q:<ms>`：设置单侧避障转向保持时间，例如 `Q:180`
- `N:<ms>`：设置后退时间，例如 `N:420`
- `E:<ms>`：设置脱困转向时间，例如 `E:520`
- `O:<left>,<right>,<state>,<cruise>,<turn>,<back>,<activeLow>,<confirm>,<sideTurn>,<backMs>,<escapeMs>,<leftScale>,<rightScale>`：Arduino 发给网页的避障遥测，例如 `O:0,1,turn-left,100,95,85,1,60,180,420,520,88,100`

网页通过 JDY-29 常用透传服务发送指令：

- Service UUID: `0000ffe0-0000-1000-8000-00805f9b34fb`
- Characteristic UUID: `0000ffe1-0000-1000-8000-00805f9b34fb`

## 手机访问

GitHub Pages 使用 HTTPS，Android Chrome/Edge 可直接使用 Web Bluetooth。

iPhone 普通 Safari/Chrome 不支持标准 Web Bluetooth，需使用支持 Web Bluetooth 的浏览器，例如 Bluefy。
