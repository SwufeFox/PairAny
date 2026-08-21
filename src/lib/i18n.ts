/** Lightweight i18n: en / zh / ja bundles, browser-language detection. */

export type Locale = 'en' | 'zh' | 'ja'
export type LanguagePref = 'auto' | Locale

export interface I18n {
  localeName: string
  toolbar: {
    synthetic: string
    direct: string
    indicators: string
    compare: string
    linear: string
    log: string
    settings: string
    fullscreen: string
    exitFullscreen: string
    changePair: string
    allIntervals: string
    chartType: string
    dataWindow: string
    hideDataWindow: string
    compareDescription: string
    swap: string
  }
  symbolDialog: {
    title: string
    description: string
    baseAsset: string
    quoteAsset: string
    pairType: string
    directPair: string
    syntheticPair: string
    recent: string
    cancel: string
    apply: string
    noMatch: string
    loadingMarkets: string
    syntheticLegs: string
    directExists: string
    sameAsset: string
    noDirect: string
    noCommonQuote: string
    notTradable: string
  }
  indicatorDialog: {
    title: string
    description: string
    trend: string
    momentum: string
    volume: string
    active: string
    none: string
    position: string
    overlay: string
    pane: string
    delete: string
    show: string
    hide: string
  }
  settings: {
    title: string
    description: string
    theme: string
    dark: string
    light: string
    colorBlind: string
    chart: string
    showGrid: string
    volume: string
    volumeHint: string
    language: string
    auto: string
    advanced: string
    ratioMode: string
    approximate: string
    tickAccurate: string
    alignedCandles: string
    missingCandles: string
    volumeMode: string
    hidden: string
    estimated: string
    dataSource: string
    restEndpoint: string
    wsEndpoint: string
    endpointNote: string
  }
  statusBar: {
    syntheticPair: string
    directPair: string
    connected: string
    connecting: string
    reconnecting: string
    disconnected: string
    idle: string
    retry: string
    live: string
    detail: string
  }
  contextMenu: {
    resetChart: string
    fitContent: string
    copyPrice: string
    addIndicator: string
    removeIndicator: string
    toggleLog: string
    fullscreen: string
  }
  tooltip: {
    open: string
    high: string
    low: string
    close: string
    change: string
    changePct: string
    vsNow: string
    volume: string
    syntheticVolume: string
    hidden: string
    syntheticClose: string
  }
  canvas: {
    loading: string
    currentPrice: string
    o: string
    h: string
    l: string
    c: string
  }
  errors: {
    exchangeFailed: string
    pairUnavailable: string
    choosePair: string
    retry: string
  }
  colorBlind: Record<'normal' | 'rg-safe' | 'deuteranopia' | 'protanopia' | 'tritanopia', { label: string; description: string }>
  indicators: Record<string, string>
  params: Record<string, string>
  sources: Record<string, string>
  intervals: Record<string, string>
  drawings: {
    trendline: string
    horizontal: string
    rectangle: string
    arrow: string
    clear: string
    pan: string
  }
  zoom: {
    zoomIn: string
    zoomOut: string
    fit: string
    reset: string
  }
  chartTypes: Record<string, string>
}

const EN: I18n = {
  localeName: 'English',
  toolbar: {
    synthetic: 'Synthetic',
    direct: 'Direct',
    indicators: 'Indicators',
    compare: 'Compare',
    linear: 'Linear',
    log: 'Log',
    settings: 'Settings',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit fullscreen',
    changePair: 'Change pair',
    allIntervals: 'All intervals',
    chartType: 'Chart type',
    dataWindow: 'Data window',
    hideDataWindow: 'Hide data window',
    compareDescription: 'Overlay another USDT symbol close, %-normalized against the visible window.',
    swap: 'Swap base / quote',
  },
  symbolDialog: {
    title: 'Symbol',
    description: 'Pick two Binance spot assets. A direct pair is used when it exists; otherwise a synthetic pair is built from two legs quoted in the same asset (USDT preferred).',
    baseAsset: 'Base Asset',
    quoteAsset: 'Quote Asset',
    pairType: 'Pair type',
    directPair: 'Direct Pair',
    syntheticPair: 'Synthetic Pair',
    recent: 'Recent',
    cancel: 'Cancel',
    apply: 'Apply',
    noMatch: 'No matching asset.',
    loadingMarkets: 'Loading Binance markets…',
    syntheticLegs: 'Synthetic legs',
    directExists: 'Direct pair exists',
    sameAsset: 'Base and quote must be different assets.',
    noDirect: 'No direct {pair} pair exists on Binance spot.',
    noCommonQuote: 'No common quote asset found for {base} and {quote}.',
    notTradable: '{pair} is not tradable on Binance spot.',
  },
  indicatorDialog: {
    title: 'Indicators',
    description: 'Click an indicator to add it. Each instance is independent — MA(5), MA(20) and EMA(50) can coexist.',
    trend: 'Trend',
    momentum: 'Momentum',
    volume: 'Volume',
    active: 'Active',
    none: 'No indicators added.',
    position: 'Position',
    overlay: 'Overlay',
    pane: 'Pane',
    delete: 'Delete',
    show: 'Show',
    hide: 'Hide',
  },
  settings: {
    title: 'Settings',
    description: 'Preferences persist in localStorage.',
    theme: 'Theme',
    dark: 'Dark',
    light: 'Light',
    colorBlind: 'Color blind mode',
    chart: 'Chart',
    showGrid: 'Show grid',
    volume: 'Volume',
    volumeHint: 'Synthetic pairs show combined USDT notional, clearly labeled as estimated — or hide volume entirely.',
    language: 'Language',
    auto: 'Follow browser',
    advanced: 'Advanced',
    ratioMode: 'Ratio mode',
    approximate: 'Approximate (OHLC envelope)',
    tickAccurate: 'Tick-accurate',
    alignedCandles: 'Aligned candles',
    missingCandles: 'Skipped (leg gaps)',
    volumeMode: 'Volume',
    hidden: 'Hidden',
    estimated: 'Estimated (synthetic)',
    dataSource: 'Data source',
    restEndpoint: 'REST endpoint',
    wsEndpoint: 'WebSocket endpoint',
    endpointNote: 'Public Binance market-data endpoints — no API key required.',
  },
  statusBar: {
    syntheticPair: 'Synthetic Pair',
    directPair: 'Direct Pair',
    connected: 'Connected',
    connecting: 'Connecting…',
    reconnecting: 'Reconnecting…',
    disconnected: 'Disconnected',
    idle: 'Idle',
    retry: 'Retry',
    live: 'Live',
    detail: 'Detail',
  },
  contextMenu: {
    resetChart: 'Reset Chart',
    fitContent: 'Fit Content',
    copyPrice: 'Copy Price',
    addIndicator: 'Add Indicator',
    removeIndicator: 'Remove Indicator',
    toggleLog: 'Toggle Log Scale',
    fullscreen: 'Fullscreen',
  },
  tooltip: {
    open: 'Open',
    high: 'High',
    low: 'Low',
    close: 'Close',
    change: 'Change',
    changePct: 'Change %',
    vsNow: 'vs Current',
    volume: 'Volume',
    syntheticVolume: 'Synthetic Volume (est.)',
    hidden: 'Hidden',
    syntheticClose: 'Synthetic Close',
  },
  canvas: {
    loading: 'Loading market data…',
    currentPrice: 'Current',
    o: 'O',
    h: 'H',
    l: 'L',
    c: 'C',
  },
  errors: {
    exchangeFailed: 'Failed to load Binance market list',
    pairUnavailable: 'Pair unavailable',
    choosePair: 'Choose another pair',
    retry: 'Retry',
  },
  colorBlind: {
    normal: { label: 'Normal', description: 'Traditional green-up / red-down.' },
    'rg-safe': { label: 'Red-Green Safe', description: 'Blue-up / amber-down; discriminable without red-green vision.' },
    deuteranopia: { label: 'Deuteranopia', description: 'Tuned for green-blind (most common) deficiency.' },
    protanopia: { label: 'Protanopia', description: 'Tuned for red-blind deficiency.' },
    tritanopia: { label: 'Tritanopia', description: 'Tuned for blue-yellow deficiency.' },
  },
  indicators: {
    ma: 'MA', ema: 'EMA', wma: 'WMA', vwma: 'VWMA', bollinger: 'Bollinger Bands', ichimoku: 'Ichimoku Cloud',
    vwap: 'VWAP', supertrend: 'Supertrend', rsi: 'RSI', macd: 'MACD', stochastic: 'Stochastic', cci: 'CCI',
    'williams-r': 'Williams %R', volume: 'Volume', 'volume-ma': 'Volume MA', obv: 'OBV', mfi: 'MFI',
  },
  params: {
    period: 'Period', source: 'Source', mult: 'StdDev ×', multiplier: 'Multiplier',
    fast: 'Fast', slow: 'Slow', signal: 'Signal', kPeriod: 'K Period', kSmooth: 'K Smooth', dPeriod: 'D Period',
    tenkan: 'Tenkan', kijun: 'Kijun', senkouB: 'Senkou B',
  },
  sources: { open: 'Open', high: 'High', low: 'Low', close: 'Close', hlc3: 'HLC3', ohlc4: 'OHLC4' },
  intervals: {
    '1s': '1 second', '1m': '1 minute', '3m': '3 minutes', '5m': '5 minutes', '15m': '15 minutes', '30m': '30 minutes',
    '1h': '1 hour', '2h': '2 hours', '4h': '4 hours', '6h': '6 hours', '8h': '8 hours', '12h': '12 hours',
    '1d': '1 day', '3d': '3 days', '1w': '1 week', '1M': '1 month',
  },
  drawings: {
    trendline: 'Trend line', horizontal: 'Horizontal line', rectangle: 'Rectangle', arrow: 'Arrow',
    clear: 'Clear drawings', pan: 'Pan / crosshair',
  },
  zoom: { zoomIn: 'Zoom in', zoomOut: 'Zoom out', fit: 'Fit', reset: 'Reset' },
  chartTypes: { candles: 'Candlestick', hollow: 'Hollow Candle', ohlc: 'OHLC Bar', line: 'Line', area: 'Area' },
}

const ZH: I18n = {
  localeName: '简体中文',
  toolbar: {
    synthetic: '合成',
    direct: '直接',
    indicators: '技术指标',
    compare: '对比',
    linear: '线性',
    log: '对数',
    settings: '设置',
    fullscreen: '全屏',
    exitFullscreen: '退出全屏',
    changePair: '切换交易对',
    allIntervals: '全部周期',
    chartType: '图表类型',
    dataWindow: '数据窗口',
    hideDataWindow: '隐藏数据窗口',
    compareDescription: '叠加另一只 USDT 交易对的收盘价，按可见区间归一化为百分比。',
    swap: '互换基础/计价资产',
  },
  symbolDialog: {
    title: '交易对',
    description: '选择两个币安现货标的。若存在直接交易对则使用直接交易对；否则由两条同一计价资产（优先 USDT）的腿合成虚拟交易对。',
    baseAsset: '基础资产',
    quoteAsset: '计价资产',
    pairType: '交易对类型',
    directPair: '直接交易对',
    syntheticPair: '合成交易对',
    recent: '最近使用',
    cancel: '取消',
    apply: '应用',
    noMatch: '没有匹配的资产。',
    loadingMarkets: '正在加载币安市场…',
    syntheticLegs: '合成腿',
    directExists: '存在直接交易对',
    sameAsset: '基础资产与计价资产不能相同。',
    noDirect: '币安现货不存在直接交易对 {pair}。',
    noCommonQuote: '未找到 {base} 与 {quote} 的公共计价资产。',
    notTradable: '{pair} 在币安现货不可交易。',
  },
  indicatorDialog: {
    title: '技术指标',
    description: '点击指标即可添加。每个实例相互独立——MA(5)、MA(20)、EMA(50) 可以同时存在。',
    trend: '趋势',
    momentum: '动量',
    volume: '成交量',
    active: '已添加',
    none: '尚未添加指标。',
    position: '显示位置',
    overlay: '主图叠加',
    pane: '独立窗口',
    delete: '删除',
    show: '显示',
    hide: '隐藏',
  },
  settings: {
    title: '设置',
    description: '偏好设置保存在 localStorage。',
    theme: '主题',
    dark: '深色',
    light: '浅色',
    colorBlind: '色觉模式',
    chart: '图表',
    showGrid: '显示网格',
    volume: '成交量',
    volumeHint: '合成交易对显示两腿合计名义额（USDT），明确标注为估算值；也可完全隐藏。',
    language: '语言',
    auto: '跟随浏览器',
    advanced: '高级',
    ratioMode: '比率模式',
    approximate: '近似（OHLC 包络）',
    tickAccurate: '逐笔精确',
    alignedCandles: '已对齐 K 线',
    missingCandles: '跳过（腿缺口）',
    volumeMode: '成交量',
    hidden: '隐藏',
    estimated: '估算（合成）',
    dataSource: '数据源',
    restEndpoint: 'REST 端点',
    wsEndpoint: 'WebSocket 端点',
    endpointNote: '币安公共行情端点——无需 API Key。',
  },
  statusBar: {
    syntheticPair: '合成交易对',
    directPair: '直接交易对',
    connected: '已连接',
    connecting: '连接中…',
    reconnecting: '重连中…',
    disconnected: '已断开',
    idle: '空闲',
    retry: '重试',
    live: '实时',
    detail: '详情',
  },
  contextMenu: {
    resetChart: '重置图表',
    fitContent: '自适应',
    copyPrice: '复制价格',
    addIndicator: '添加指标',
    removeIndicator: '移除指标',
    toggleLog: '切换对数坐标',
    fullscreen: '全屏',
  },
  tooltip: {
    open: '开盘',
    high: '最高',
    low: '最低',
    close: '收盘',
    change: '涨跌',
    changePct: '涨跌幅',
    vsNow: '对现价',
    volume: '成交量',
    syntheticVolume: '合成成交量（估算）',
    hidden: '隐藏',
    syntheticClose: '合成收盘',
  },
  canvas: {
    loading: '正在加载行情数据…',
    currentPrice: '现价',
    o: '开',
    h: '高',
    l: '低',
    c: '收',
  },
  errors: {
    exchangeFailed: '加载币安交易对列表失败',
    pairUnavailable: '交易对不可用',
    choosePair: '选择其他交易对',
    retry: '重试',
  },
  colorBlind: {
    normal: { label: '正常', description: '传统配色：涨绿跌红。' },
    'rg-safe': { label: '红绿安全', description: '涨蓝跌琥珀色；红绿色盲亦可分辨。' },
    deuteranopia: { label: '绿色盲', description: '针对绿色盲（最常见）优化。' },
    protanopia: { label: '红色盲', description: '针对红色盲优化。' },
    tritanopia: { label: '蓝色盲', description: '针对蓝黄色觉缺陷优化。' },
  },
  indicators: {
    ma: 'MA', ema: 'EMA', wma: 'WMA', vwma: 'VWMA', bollinger: '布林带', ichimoku: '一目均衡',
    vwap: 'VWAP', supertrend: '超级趋势', rsi: 'RSI', macd: 'MACD', stochastic: '随机指标', cci: 'CCI',
    'williams-r': '威廉指标', volume: '成交量', 'volume-ma': '成交量均线', obv: 'OBV', mfi: 'MFI',
  },
  params: {
    period: '周期', source: '数据源', mult: '标准差 ×', multiplier: '倍数',
    fast: '快线', slow: '慢线', signal: '信号线', kPeriod: 'K 周期', kSmooth: 'K 平滑', dPeriod: 'D 周期',
    tenkan: '转换线', kijun: '基准线', senkouB: '先行带 B',
  },
  sources: { open: '开盘', high: '最高', low: '最低', close: '收盘', hlc3: 'HLC3', ohlc4: 'OHLC4' },
  intervals: {
    '1s': '1 秒', '1m': '1 分钟', '3m': '3 分钟', '5m': '5 分钟', '15m': '15 分钟', '30m': '30 分钟',
    '1h': '1 小时', '2h': '2 小时', '4h': '4 小时', '6h': '6 小时', '8h': '8 小时', '12h': '12 小时',
    '1d': '1 天', '3d': '3 天', '1w': '1 周', '1M': '1 月',
  },
  drawings: {
    trendline: '趋势线', horizontal: '水平线', rectangle: '矩形', arrow: '箭头',
    clear: '清除图形', pan: '平移 / 十字光标',
  },
  zoom: { zoomIn: '放大', zoomOut: '缩小', fit: '自适应', reset: '重置' },
  chartTypes: { candles: '蜡烛图', hollow: '空心蜡烛', ohlc: 'OHLC 柱', line: '折线图', area: '面积图' },
}

const JA: I18n = {
  localeName: '日本語',
  toolbar: {
    synthetic: '合成',
    direct: '直接',
    indicators: 'インジケーター',
    compare: '比較',
    linear: 'リニア',
    log: 'ログ',
    settings: '設定',
    fullscreen: '全画面',
    exitFullscreen: '全画面を終了',
    changePair: 'ペア変更',
    allIntervals: '全期間',
    chartType: 'チャート種別',
    dataWindow: 'データウィンドウ',
    hideDataWindow: 'データウィンドウを隠す',
    compareDescription: '別の USDT 銘柄の終値を可視区間で正規化（%）して重ねて表示。',
    swap: 'ベース/クオート入替',
  },
  symbolDialog: {
    title: 'ペア',
    description: 'Binance スポットの銘柄を2つ選択します。直接ペアが存在すればそれを、なければ同一クオート（優先 USDT）の 2 足から合成ペアを構築します。',
    baseAsset: 'ベース資産',
    quoteAsset: 'クオート資産',
    pairType: 'ペア種別',
    directPair: '直接ペア',
    syntheticPair: '合成ペア',
    recent: '最近使用',
    cancel: 'キャンセル',
    apply: '適用',
    noMatch: '一致する銘柄がありません。',
    loadingMarkets: 'Binance マーケットを読み込み中…',
    syntheticLegs: '合成レッグ',
    directExists: '直接ペアが存在します',
    sameAsset: 'ベースとクオートは異なる資産にしてください。',
    noDirect: 'Binance スポットに直接ペア {pair} は存在しません。',
    noCommonQuote: '{base} と {quote} の共通クオート資産が見つかりません。',
    notTradable: '{pair} は Binance スポットで取引できません。',
  },
  indicatorDialog: {
    title: 'インジケーター',
    description: 'クリックで追加。各インスタンスは独立しており、MA(5)・MA(20)・EMA(50) を同時に持てます。',
    trend: 'トレンド',
    momentum: 'モメンタム',
    volume: '出来高',
    active: '追加済み',
    none: 'インジケーターはまだありません。',
    position: '表示位置',
    overlay: 'オーバーレイ',
    pane: 'ペイン',
    delete: '削除',
    show: '表示',
    hide: '非表示',
  },
  settings: {
    title: '設定',
    description: '設定は localStorage に保存されます。',
    theme: 'テーマ',
    dark: 'ダーク',
    light: 'ライト',
    colorBlind: '色覚モード',
    chart: 'チャート',
    showGrid: 'グリッド表示',
    volume: '出来高',
    volumeHint: '合成ペアでは両レッグの合計想定元本（USDT）を推定値として明示表示。非表示にもできます。',
    language: '言語',
    auto: 'ブラウザに従う',
    advanced: '詳細',
    ratioMode: '比率モード',
    approximate: '近似（OHLC 包絡）',
    tickAccurate: 'ティック精度',
    alignedCandles: '同期済みローソク',
    missingCandles: 'スキップ（欠損）',
    volumeMode: '出来高',
    hidden: '非表示',
    estimated: '推定（合成）',
    dataSource: 'データソース',
    restEndpoint: 'REST エンドポイント',
    wsEndpoint: 'WebSocket エンドポイント',
    endpointNote: 'Binance パブリック行情エンドポイント — API キー不要。',
  },
  statusBar: {
    syntheticPair: '合成ペア',
    directPair: '直接ペア',
    connected: '接続済み',
    connecting: '接続中…',
    reconnecting: '再接続中…',
    disconnected: '切断',
    idle: '待機',
    retry: '再試行',
    live: 'ライブ',
    detail: '詳細',
  },
  contextMenu: {
    resetChart: 'チャートをリセット',
    fitContent: 'フィット',
    copyPrice: '価格をコピー',
    addIndicator: 'インジケーターを追加',
    removeIndicator: 'インジケーターを削除',
    toggleLog: 'ログスケール切替',
    fullscreen: '全画面',
  },
  tooltip: {
    open: '始値',
    high: '高値',
    low: '安値',
    close: '終値',
    change: '変化',
    changePct: '変化率',
    vsNow: '現在値比',
    volume: '出来高',
    syntheticVolume: '合成出来高（推定）',
    hidden: '非表示',
    syntheticClose: '合成終値',
  },
  canvas: {
    loading: '行情データを読み込み中…',
    currentPrice: '現在値',
    o: '始',
    h: '高',
    l: '安',
    c: '終',
  },
  errors: {
    exchangeFailed: 'Binance 銘柄一覧の読み込みに失敗しました',
    pairUnavailable: 'ペアを利用できません',
    choosePair: '別のペアを選択',
    retry: '再試行',
  },
  colorBlind: {
    normal: { label: 'ノーマル', description: '伝統的な緑上昇・赤下落。' },
    'rg-safe': { label: '赤緑セーフ', description: '青上昇・琥珀下落。赤緑の区別なしでも判別可能。' },
    deuteranopia: { label: '第2色覚異常', description: '緑色盲（最多）向けに調整。' },
    protanopia: { label: '第1色覚異常', description: '赤色盲向けに調整。' },
    tritanopia: { label: '第3色覚異常', description: '青黄色覚異常向けに調整。' },
  },
  indicators: {
    ma: 'MA', ema: 'EMA', wma: 'WMA', vwma: 'VWMA', bollinger: 'ボリンジャーバンド', ichimoku: '一目均衡表',
    vwap: 'VWAP', supertrend: 'スーパートレンド', rsi: 'RSI', macd: 'MACD', stochastic: 'ストキャスティクス', cci: 'CCI',
    'williams-r': 'ウィリアムズ%R', volume: '出来高', 'volume-ma': '出来高MA', obv: 'OBV', mfi: 'MFI',
  },
  params: {
    period: '期間', source: 'ソース', mult: '標準偏差 ×', multiplier: '倍率',
    fast: '短期', slow: '長期', signal: 'シグナル', kPeriod: 'K 期間', kSmooth: 'K 平滑', dPeriod: 'D 期間',
    tenkan: '転換線', kijun: '基準線', senkouB: '先行スパンB',
  },
  sources: { open: '始値', high: '高値', low: '安値', close: '終値', hlc3: 'HLC3', ohlc4: 'OHLC4' },
  intervals: {
    '1s': '1 秒', '1m': '1 分', '3m': '3 分', '5m': '5 分', '15m': '15 分', '30m': '30 分',
    '1h': '1 時間', '2h': '2 時間', '4h': '4 時間', '6h': '6 時間', '8h': '8 時間', '12h': '12 時間',
    '1d': '1 日', '3d': '3 日', '1w': '1 週', '1M': '1 ヶ月',
  },
  drawings: {
    trendline: 'トレンドライン', horizontal: '水平線', rectangle: '矩形', arrow: '矢印',
    clear: '描画をクリア', pan: 'パン / クロスヘア',
  },
  zoom: { zoomIn: '拡大', zoomOut: '縮小', fit: 'フィット', reset: 'リセット' },
  chartTypes: { candles: 'ローソク足', hollow: '中空ローソク', ohlc: 'OHLC バー', line: '折れ線', area: 'エリア' },
}

export const STRINGS: Record<Locale, I18n> = { en: EN, zh: ZH, ja: JA }

export function detectLocale(navLang: string): Locale {
  const lang = navLang.toLowerCase()
  if (lang.startsWith('zh')) return 'zh'
  if (lang.startsWith('ja')) return 'ja'
  return 'en'
}

export function resolveLocale(pref: LanguagePref | undefined, navLang: string): Locale {
  return pref === 'auto' || !pref ? detectLocale(navLang) : pref
}

/** Apply {placeholder} substitution. */
export function format(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`)
}
