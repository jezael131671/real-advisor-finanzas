// __ Bajoquinto CRM pipeline ________________________________________________
export const BAJOQUINTO_STATUSES = [
  { key: "nuevo",          label: "Nuevo Lead",  color: "text-slate-600",   bg: "bg-slate-50",    border: "border-slate-200"   },
  { key: "contactado",     label: "Contactado",  color: "text-sky-600",     bg: "bg-sky-50",      border: "border-sky-200"     },
  { key: "cotizado",       label: "Cotizado",    color: "text-purple-600",  bg: "bg-purple-50",   border: "border-purple-200"  },
  { key: "seguimiento",    label: "Seguimiento", color: "text-indigo-600",  bg: "bg-indigo-50",   border: "border-indigo-200"  },
  { key: "apartado",       label: "Apartado",    color: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200"   },
  { key: "en_fabricacion", label: "Fabricando",  color: "text-orange-600",  bg: "bg-orange-50",   border: "border-orange-200"  },
  { key: "terminado",      label: "Terminado",   color: "text-teal-700",    bg: "bg-teal-50",     border: "border-teal-200"    },
  { key: "cobrado",        label: "Cobrado",     color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200" },
  { key: "entregado",      label: "Entregado",   color: "text-green-700",   bg: "bg-green-50",    border: "border-green-200"   },
  { key: "testimonio",     label: "Testimonio",  color: "text-violet-700",  bg: "bg-violet-50",   border: "border-violet-200"  },
  { key: "perdido",        label: "Perdido",     color: "text-red-600",     bg: "bg-red-50",      border: "border-red-200"     },
  { key: "prospecto",      label: "Prospecto",   color: "text-sky-600",     bg: "bg-sky-50",      border: "border-sky-200"     },
  { key: "liquidado",      label: "Liquidado",   color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200" },
  { key: "enviado",        label: "Enviado",     color: "text-cyan-700",    bg: "bg-cyan-50",     border: "border-cyan-200"    },
]

export const PROSPECT_STATUSES = ["nuevo", "contactado", "cotizado", "seguimiento", "prospecto"]
export const ORDER_STATUSES    = ["apartado", "en_fabricacion", "terminado", "cobrado"]
export const CLOSED_STATUSES   = ["entregado", "testimonio", "perdido", "liquidado"]

export const LEAD_SOURCES = [
  { key: "instagram",  label: "Instagram"   },
  { key: "facebook",   label: "Facebook"    },
  { key: "referido",   label: "Referido"    },
  { key: "whatsapp",   label: "WhatsApp"    },
  { key: "tiktok",     label: "TikTok"      },
  { key: "expo",       label: "Exposicion"  },
  { key: "web",        label: "Sitio web"   },
  { key: "otro",       label: "Otro"        },
]

// __ Accounts _______________________________________________________________
export const INSTITUTIONS = [
  "BBVA", "Banamex / Citibanamex", "Santander", "Banorte", "HSBC",
  "Scotiabank", "Inbursa", "BanBajio", "Banca Mifel", "Multiva",
  "Nu", "Hey Banco", "Spin by OXXO", "Mercado Pago", "Clip",
  "CETES Directo", "GBM+", "Efectivo", "Otro",
]

export const ACCOUNT_TYPES = [
  { key: "debito",    icon: "💳", label: "Debito"    },
  { key: "ahorro",    icon: "🏦", label: "Ahorro"    },
  { key: "efectivo",  icon: "💵", label: "Efectivo"  },
  { key: "inversion", icon: "📈", label: "Inversion" },
  { key: "otro",      icon: "🏷️", label: "Otro"      },
]

export const ACCOUNT_GRADIENTS = [
  { id: 0, css: "from-violet-700 to-indigo-800" },
  { id: 1, css: "from-blue-700 to-cyan-800"     },
  { id: 2, css: "from-teal-600 to-emerald-800"  },
  { id: 3, css: "from-rose-700 to-pink-800"     },
  { id: 4, css: "from-amber-600 to-orange-700"  },
  { id: 5, css: "from-indigo-700 to-violet-900" },
  { id: 6, css: "from-green-700 to-teal-900"    },
  { id: 7, css: "from-slate-600 to-slate-800"   },
]

// __ Transactions ___________________________________________________________
export const TX_TYPES = [
  { key: "ingreso",       label: "Ingreso",       emoji: "💰" },
  { key: "gasto",         label: "Gasto",         emoji: "💸" },
  { key: "transferencia", label: "Transferencia", emoji: "🔄" },
  { key: "pago_tarjeta",  label: "Pago tarjeta",  emoji: "💳" },
  { key: "inversion",     label: "Inversion",     emoji: "📈" },
  { key: "bajoquinto",    label: "Bajoquinto",    emoji: "🎸" },
]

export const TX_LABELS = [
  { key: "personal",  label: "Personal"  },
  { key: "negocio",   label: "Negocio"   },
  { key: "inversion", label: "Inversion" },
  { key: "deducible", label: "Deducible" },
  { key: "urgente",   label: "Urgente"   },
]

// __ Investments ____________________________________________________________
export const INVESTMENT_TYPES = [
  { key: "accion",   label: "Accion",   emoji: "📈" },
  { key: "etf",      label: "ETF",      emoji: "📊" },
  { key: "cripto",   label: "Cripto",   emoji: "₿"  },
  { key: "cetes",    label: "CETES",    emoji: "🏛"  },
  { key: "call",     label: "Call",     emoji: "📞" },
  { key: "put",      label: "Put",      emoji: "📉" },
  { key: "efectivo", label: "Efectivo", emoji: "💵" },
  { key: "otro",     label: "Otro",     emoji: "💼" },
]

export const BROKERS = [
  { key: "ibkr",         label: "Interactive Brokers" },
  { key: "gbm",          label: "GBM+"                },
  { key: "actinver",     label: "Actinver"             },
  { key: "bursanet",     label: "Bursanet"             },
  { key: "valore",       label: "Valore"               },
  { key: "nu",           label: "Nu Investments"       },
  { key: "cetesdirecto", label: "CETES Directo"        },
  { key: "otro",         label: "Otro"                 },
]

export const CURRENCIES = [
  { key: "MXN", label: "MXN - Peso Mexicano"   },
  { key: "USD", label: "USD - Dolar Americano"  },
  { key: "EUR", label: "EUR - Euro"             },
  { key: "BTC", label: "BTC - Bitcoin"          },
  { key: "ETH", label: "ETH - Ethereum"         },
]

export const TICKER_DB = {
  AAPL:     { name: "Apple Inc.",              type: "accion" },
  MSFT:     { name: "Microsoft Corp.",         type: "accion" },
  GOOGL:    { name: "Alphabet Inc.",           type: "accion" },
  GOOG:     { name: "Alphabet Inc. (C)",       type: "accion" },
  AMZN:     { name: "Amazon.com Inc.",         type: "accion" },
  TSLA:     { name: "Tesla Inc.",              type: "accion" },
  META:     { name: "Meta Platforms Inc.",     type: "accion" },
  NVDA:     { name: "NVIDIA Corp.",            type: "accion" },
  NFLX:     { name: "Netflix Inc.",            type: "accion" },
  DIS:      { name: "Walt Disney Co.",         type: "accion" },
  JPM:      { name: "JPMorgan Chase and Co.",  type: "accion" },
  BAC:      { name: "Bank of America Corp.",   type: "accion" },
  WMT:      { name: "Walmart Inc.",            type: "accion" },
  V:        { name: "Visa Inc.",               type: "accion" },
  MA:       { name: "Mastercard Inc.",         type: "accion" },
  AMD:      { name: "Advanced Micro Devices",  type: "accion" },
  INTC:     { name: "Intel Corp.",             type: "accion" },
  SPY:      { name: "SPDR S and P 500 ETF",    type: "etf"    },
  QQQ:      { name: "Invesco QQQ Trust",       type: "etf"    },
  IVV:      { name: "iShares Core SP500",      type: "etf"    },
  VTI:      { name: "Vanguard Total Stk Mkt",  type: "etf"    },
  VOO:      { name: "Vanguard SP500",          type: "etf"    },
  VGT:      { name: "Vanguard IT ETF",         type: "etf"    },
  ARKK:     { name: "ARK Innovation ETF",      type: "etf"    },
  EEM:      { name: "iShares MSCI Emerging",   type: "etf"    },
  GLD:      { name: "SPDR Gold Shares",        type: "etf"    },
  AMXL:     { name: "America Movil SAB",       type: "accion" },
  FEMSAUBD: { name: "Fomento Economico Mex.",  type: "accion" },
  WALMEX:   { name: "Wal-Mart de Mexico",      type: "accion" },
  GFNORTEO: { name: "Grupo Financiero Banorte",type: "accion" },
  BIMBOA:   { name: "Grupo Bimbo SAB",         type: "accion" },
  GMEXICOB: { name: "Grupo Mexico SAB",        type: "accion" },
  BTC:      { name: "Bitcoin",                 type: "cripto" },
  ETH:      { name: "Ethereum",                type: "cripto" },
  SOL:      { name: "Solana",                  type: "cripto" },
  ADA:      { name: "Cardano",                 type: "cripto" },
  XRP:      { name: "XRP",                     type: "cripto" },
  BNB:      { name: "Binance Coin",            type: "cripto" },
  DOGE:     { name: "Dogecoin",                type: "cripto" },
  MATIC:    { name: "Polygon",                 type: "cripto" },
  DOT:      { name: "Polkadot",                type: "cripto" },
  AVAX:     { name: "Avalanche",               type: "cripto" },
}

// __ Assets and Liabilities __________________________________________________
export const ASSET_TYPES = [
  { key: "inmueble",  label: "Inmueble",     emoji: "🏠" },
  { key: "vehiculo",  label: "Vehiculo",     emoji: "🚗" },
  { key: "negocio",   label: "Negocio",      emoji: "💼" },
  { key: "joyeria",   label: "Joyeria",      emoji: "💎" },
  { key: "equipo",    label: "Equipo",       emoji: "💻" },
  { key: "terreno",   label: "Terreno",      emoji: "🌳" },
  { key: "otro",      label: "Otro",         emoji: "📦" },
]

export const LIABILITY_TYPES = [
  { key: "hipoteca",  label: "Hipoteca",     emoji: "🏠" },
  { key: "auto",      label: "Credito auto", emoji: "🚗" },
  { key: "personal",  label: "Prestamo",     emoji: "🏦" },
  { key: "tarjeta",   label: "Tarjeta",      emoji: "💳" },
  { key: "negocio",   label: "Negocio",      emoji: "💼" },
  { key: "familiar",  label: "Familiar",     emoji: "👨" },
  { key: "otro",      label: "Otro",         emoji: "📦" },
]

// __ Goals __________________________________________________________________
export const META_CATEGORIES = [
  { key: "emergencia", label: "Emergencia", emoji: "🛡"  },
  { key: "inversion",  label: "Inversion",  emoji: "📈" },
  { key: "deuda",      label: "Deuda",      emoji: "💳" },
  { key: "viaje",      label: "Viaje",      emoji: "✈"  },
  { key: "educacion",  label: "Educacion",  emoji: "🎓" },
  { key: "hogar",      label: "Hogar",      emoji: "🏠" },
  { key: "auto",       label: "Auto",       emoji: "🚗" },
  { key: "retiro",     label: "Retiro",     emoji: "🌅" },
  { key: "negocio",    label: "Negocio",    emoji: "💼" },
  { key: "otro",       label: "Otro",       emoji: "🎯" },
]

// __ Subscriptions ___________________________________________________________
export const SUB_FREQUENCIES = [
  { key: "semanal",    label: "Semanal"    },
  { key: "mensual",    label: "Mensual"    },
  { key: "trimestral", label: "Trimestral" },
  { key: "semestral",  label: "Semestral"  },
  { key: "anual",      label: "Anual"      },
]

export const SUB_CATEGORIES = [
  "Streaming", "Musica", "Software", "Gaming", "Almacenamiento",
  "Seguridad", "Educacion", "Fitness", "Noticias", "Herramientas", "Otro",
]

// __ Default categories ______________________________________________________
export const DEFAULT_CATEGORIES = [
  { id: "cat-alimentos",      name: "Alimentos",        type: "gasto",   icon: "🍕", isDefault: true },
  { id: "cat-transporte",     name: "Transporte",       type: "gasto",   icon: "⛽", isDefault: true },
  { id: "cat-vivienda",       name: "Vivienda / Renta", type: "gasto",   icon: "🏠", isDefault: true },
  { id: "cat-salud",          name: "Salud",            type: "gasto",   icon: "💊", isDefault: true },
  { id: "cat-entretenimiento",name: "Entretenimiento",  type: "gasto",   icon: "🎭", isDefault: true },
  { id: "cat-ropa",           name: "Ropa",             type: "gasto",   icon: "👕", isDefault: true },
  { id: "cat-tecnologia",     name: "Tecnologia",       type: "gasto",   icon: "📱", isDefault: true },
  { id: "cat-educacion",      name: "Educacion",        type: "gasto",   icon: "📚", isDefault: true },
  { id: "cat-restaurantes",   name: "Restaurantes",     type: "gasto",   icon: "🍔", isDefault: true },
  { id: "cat-viajes",         name: "Viajes",           type: "gasto",   icon: "✈",  isDefault: true },
  { id: "cat-mascotas",       name: "Mascotas",         type: "gasto",   icon: "🐾", isDefault: true },
  { id: "cat-gym",            name: "Gym / Deporte",    type: "gasto",   icon: "🏋", isDefault: true },
  { id: "cat-servicios",      name: "Servicios",        type: "gasto",   icon: "💡", isDefault: true },
  { id: "cat-otros-gastos",   name: "Otros gastos",     type: "gasto",   icon: "💸", isDefault: true },
  { id: "cat-sueldo",         name: "Sueldo",           type: "ingreso", icon: "💰", isDefault: true },
  { id: "cat-freelance",      name: "Freelance",        type: "ingreso", icon: "💼", isDefault: true },
  { id: "cat-rentas",         name: "Rentas",           type: "ingreso", icon: "🏠", isDefault: true },
  { id: "cat-dividendos",     name: "Dividendos",       type: "ingreso", icon: "📈", isDefault: true },
  { id: "cat-ventas",         name: "Ventas",           type: "ingreso", icon: "🎸", isDefault: true },
  { id: "cat-otros-ing",      name: "Otros ingresos",   type: "ingreso", icon: "✨", isDefault: true },
]

// __ Default metas ___________________________________________________________
export const DEFAULT_METAS = [
  {
    id:        "meta-emergencia",
    name:      "Fondo de emergencia",
    emoji:     "🛡",
    target:    50000,
    current:   0,
    category:  "emergencia",
    isDefault: true,
    notes:     "3-6 meses de gastos cubiertos",
  },
  {
    id:        "meta-inversion",
    name:      "Portafolio de inversion",
    emoji:     "📈",
    target:    100000,
    current:   0,
    category:  "inversion",
    isDefault: true,
    notes:     "Meta de largo plazo",
  },
]
