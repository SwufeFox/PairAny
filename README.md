# PairAny

专业级 Binance 现货 K 线终端，支持**虚拟交易对（合成对）**、实时 WebSocket 行情、可扩展指标系统、多语言与色觉友好配色。纯前端，无需后端、无需 API Key。

<img width="800" height="400" alt="image" src="https://github.com/user-attachments/assets/d1004048-fc2b-463e-a67b-498543fc44b4" />


## 功能

- **合成交易对**：任意两个标的的比率 K 线；两条腿统一到同一计价资产（USDT > FDUSD > USDC > BTC > ETH > BNB > …）；支持一键互换 base/quote
- **数据**：Binance REST 历史（默认 1000 根，向左拖拽自动加载更多）+ WebSocket 实时（自动重连、心跳看门狗、去重/乱序防护、断线 REST 补拉）
- **图表**：蜡烛/空心蜡烛/OHLC 柱/折线/面积；Linear/Log 坐标；缩放/拖拽（水平=时间，垂直=价格）、双击复位、Fit/Home
- **指标**：MA/EMA/WMA/VWMA/布林/一目均衡/VWAP/超级趋势 + RSI/MACD/随机/CCI/威廉 + 成交量/量均/OBV/MFI；多实例共存、参数编辑、Overlay/Pane 切换、增量计算
- **十字光标**：右轴价格+涨跌幅双行读数、底部时间标签、数据窗口（Ctrl+Shift+D）、绘图工具（趋势线/水平线/矩形/箭头）
- **多语言**：简体中文 / English / 日本語，默认跟随浏览器
- **主题**：浅色/深色 + 5 套色觉模式（Normal / Red-Green Safe / Deuteranopia / Protanopia / Tritanopia），蜡烛/成交量/指标/十字光标全部同步换色
- **数据精度**：内部浮点计算与显示格式分离，按数量级自适应有效位数

## 技术栈

React 19 · TypeScript（零 `any`）· Tailwind CSS v4 · [Appica UI](https://appica.dev)（语义 token、子路径导入）· 自研 Canvas 图表引擎 · Vite · Vitest

## 快速开始

```bash
npm install
npm start        # 或 npm run dev → http://localhost:5173
```

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest（56 个用例）
npm run build       # 产物 dist/
npm run preview     # 本地预览构建产物
```

## 部署到 GitHub Pages

仓库已包含 `.github/workflows/deploy.yml`：push 到 `main` 或手动触发 → 安装依赖 → typecheck/lint/test 门禁 → 构建 → 发布 `dist/`。

一次性设置：仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。`vite.config.ts` 使用 `base: './'`，构建产物在仓库子路径下同样可用。

## 架构

```
src/
├── app/            Terminal 编排器（非 React 数据中枢）、快捷键、上下文菜单
├── chart/          Canvas 引擎：scale(线性/log) · crosshair · drawings · data-window
├── components/     chart / toolbar / indicators / symbol-selector / settings / status
├── market/         config(集中端点) · binance-rest · binance-websocket · candle-store · exchange-info · market-data
├── synthetic/      ratio-calculator · candle-sync · synthetic-pair-engine
├── indicators/     indicator-engine + registry + 17 个指标定义
├── settings/       persistence(localStorage) · color-blind(5 套调色板)
├── types/          market · indicators · chart（纯类型，零 any）
└── lib/            i18n(zh/en/ja) · format(自适应精度) · events · interval
```

### 数据流（市场数据不经过 React）

```
REST /klines ──┐
               ├─→ CandleStore（openTime 去重、排序、版本号）
WS @kline_* ───┘        │ upsert（x=true/false、乱序/重复防护）
                        ▼
              SyntheticPairEngine（两腿按 openTime 对齐，微任务合并重建）
                        ▼
              IndicatorEngine（仅重算尾部窗口，增量续算）
                        ▼
              ChartEngine（rAF 合并，每 tick 一帧；十字光标/数据窗口命令式更新）
```

WebSocket tick 只会触发 canvas 重绘，**不会引起 React 重渲染**（实测 10 秒实时 tick 期间 DOM 突变 0 次）。

### 合成对计算

```
A/B = A/USDT ÷ B/USDT（或统一到任意公共计价 Q：A/B = A/Q ÷ B/Q）

open  = A.open  / B.open
close = A.close / B.close
high  = max(A.h/B.l, A.h/B.h, A.l/B.l, A.l/B.h)   ← OHLC 四角包络
low   = min(同上)
```

OHLC 无法还原两腿价格路径内的真实极值，四角包络是可由 OHLC 证明的保守界（真实极值必落在区间内），UI 中明确标注 **近似（OHLC 包络）**，绝不冒充逐笔精确。合成对成交量 = 两腿合计名义额（真实数据），明确标注 **估算**，可整体隐藏。

### 指标扩展

在 `src/indicators/registry.ts` 注册即可：实现 `IndicatorDefinition`（`id/name/category/params/outputs/lookback/compute`）。`compute(data, params, state, from)` 支持增量续算——窗口指标 O(window)/tick，EMA/RSI/MACD/OBV/VWAP/Supertrend 走 carry-state O(1)/tick。多实例（MA5/MA20/EMA50 共存）、参数编辑、Overlay/Pane 切换、显隐、删除均内置。

### 快捷键

| 按键 | 功能 |
| --- | --- |
| `+` / `-` | 放大 / 缩小 |
| `←` / `→` | 左移 / 右移 |
| `Home` | 回到最新 |
| `F` | Fit Content（同时重置价格刻度） |
| `L` | Linear / Log |
| `Ctrl+K` | 交易对搜索 |
| `Ctrl+Shift+D` | 数据窗口 |
| `Esc` | 关闭菜单 / 面板 |

## 测试

Vitest，56 个用例覆盖：合成对比率与倒数恒等（ETH/BTC = 1/(BTC/ETH)）、蜡烛同步（缺失/重复/乱序）、指标（MA/EMA/RSI/MACD/布林 + 0/1/不足/大数据边界 + 增量与全量一致性）、WebSocket（连接/消息/重复/乱序/断线/重连）、i18n 完整性、格式化精度。

## 免责声明

行情数据来自 Binance 公共市场数据端点，仅供技术展示，不构成投资建议。
