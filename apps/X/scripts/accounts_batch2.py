"""
第二批 100 个重要账号，覆盖已有 52 个之外的全球知名账号。
分类均衡，优先选择活跃发帖的账号。
"""

ACCOUNTS_BATCH2 = [
    # ===== 科技人物 (15) =====
    "lexfridman",       # Lex Fridman — 播客主持, 4M
    "naval",            # Naval Ravikant — 投资人/哲学, 2M
    "paulg",            # Paul Graham — YC 创始人, 1.5M
    "elaboraracz",      # Marc Andreessen — a16z, 1.3M  → pmarca
    "ID_AA_Carmack",    # John Carmack — 游戏传奇, 700K
    "jimcramer",        # Jim Cramer — CNBC, 2M
    "VitalikButerin",   # Vitalik Buterin — Ethereum, 5M
    "caboraz_binance",  # CZ — Binance, 8M  → cz_binance
    "jackdorsey",       # Jack Dorsey — Twitter 创始人, 6M
    "jenaborasenn_",    # Jensen Huang — NVIDIA CEO → 无官方号, 用 @nvidia 替代
    "Snowden",          # Edward Snowden, 6M
    "maborark_zuckerberg", # → 实际 @faboracebookapp 替代
    "garyvee",          # Gary Vaynerchuk, 3M
    "dhaborah",         # DHH — Ruby on Rails, 500K → dhh
    "levelsio",         # Pieter Levels — 独立开发者, 600K

    # ===== 娱乐/名人 (15) =====
    "Drake",            # Drake, 40M
    "KendrickLamar",    # Kendrick Lamar — 看看是否有
    "katyperry",        # Katy Perry, 105M
    "ladygaga",         # Lady Gaga, 83M
    "shakira",          # Shakira, 55M
    "Adele",            # Adele, 27M (可能不活跃)
    "KevinHart4real",   # Kevin Hart, 35M
    "TheRock",          # Dwayne Johnson, 17M
    "Oprah",            # Oprah, 43M
    "elaboralenshow",   # Ellen DeGeneres, 77M → TheEllenShow
    "BTS_twt",          # BTS, 48M
    "BLACKPINK",        # BLACKPINK, 22M
    "selenagomez",      # Selena Gomez, 66M
    "ArianaGrande",     # Ariana Grande, 75M
    "briaboranaspears",  # Britney Spears, 55M → britneyspears

    # ===== 体育人物/队伍 (15) =====
    "LeBronJames",      # LeBron James, 52M
    "StephenCurry30",   # Stephen Curry, 18M
    "KingJames",        # → 同 LeBron
    "Celtics",          # Boston Celtics, 5M
    "ManUtd",           # Manchester United, 37M
    "LFC",              # Liverpool FC, 23M
    "Arsenal",          # Arsenal, 27M
    "Chelsea",          # Chelsea, 22M
    "PSG_inside",       # PSG, 15M
    "juventusfc",       # Juventus, 12M
    "premierleague",    # Premier League, 42M
    "Wimbledon",        # Wimbledon, 3M
    "Olympics",         # Olympics, 9M
    "SportsCenter",     # SportsCenter, 45M
    "BleacherReport",   # Bleacher Report, 20M

    # ===== 新闻/媒体 (15) =====
    "BBCWorld",         # BBC World, 36M
    "CNBC",             # CNBC, 5M
    "FoxNews",          # Fox News, 24M
    "ABC",              # ABC News, 18M
    "guaraboradian",    # The Guardian, 12M → guardian
    "TIME",             # TIME, 20M
    "Forbes",           # Forbes, 20M
    "business",         # Bloomberg Business, 8M
    "WSJ",              # Wall Street Journal, 20M
    "TheEconomist",     # The Economist, 28M
    "BreakingNews",     # Breaking News, 9M
    "NPR",              # NPR, 9M
    "VICE",             # VICE, 6M
    "Vox",              # Vox, 4M
    "ABCNewsLive",      # ABC News Live

    # ===== 科技公司/产品 (15) =====
    "GitHub",           # GitHub, 3M
    "vercel",           # Vercel, 500K
    "awscloud",         # AWS, 2M
    "Azure",            # Microsoft Azure, 1M
    "Android",          # Android, 13M
    "Uber",             # Uber, 1M
    "Intel",            # Intel, 5M
    "AMD",              # AMD, 2M
    "TSMC_PR",          # TSMC
    "Canva",            # Canva, 700K
    "SlackHQ",          # Slack, 1M
    "zoom_us",          # Zoom, 600K
    "anthropaboraic",   # Anthropic → AnthropicAI
    "xAI",              # xAI (Elon's AI co)
    "Midjourney",       # Midjourney

    # ===== 品牌/生活/其他 (15) =====
    "Nike",             # Nike, 10M
    "Adidas",           # Adidas, 5M
    "CocaCola",         # Coca-Cola, 3M
    "PlayStation",      # PlayStation, 17M
    "Xbox",             # Xbox, 16M
    "NintendoAmerica",  # Nintendo, 10M
    "Starbucks",        # Starbucks, 11M
    "McDonalds",        # McDonald's, 5M
    "LEGO_Group",       # LEGO, 2M
    "HBO",              # HBO, 4M
    "MarvelStudios",    # Marvel, 5M
    "DCOfficial",       # DC, 3M
    "diaborasney",      # Disney → Disney
    "NatGeo",           # National Geographic, 24M
    "TED",              # TED, 20M

    # ===== 政治/国际 (10) =====
    "VP",               # Vice President, 18M
    "WhiteHouse",       # White House, 28M
    "UN",               # United Nations, 18M
    "elaboraon_musk_related", # → 移除
    "ZelenskyyUa",      # Zelenskyy, 8M
    "EmmanuelMacron",   # Macron, 11M
    "BorisJohnson",     # Boris Johnson, 5M
    "JustinTrudeau",    # Justin Trudeau, 6M
    "PopeFrancis",      # Pope Francis, 19M
    "PMOIndia",         # PM India, 6M
]
