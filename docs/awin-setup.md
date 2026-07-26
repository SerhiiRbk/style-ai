# Awin: регистрация и подключение фида (runbook)

Цель — получить один CSV-фид Awin со всеми одобренными мерчантами и завести его в каталог Valetti. Код уже готов: адаптер `awin` есть в `scripts/feeds/sources.mjs`, писать ничего не нужно — только положить URL в `AWIN_FEED_URL`.

Почему Awin: через него идёт Zalando (главный приоритет по глубине каталога), сильное покрытие EU/DACH/CZ, и Create-a-Feed отдаёт **один файл со всеми мерчантами** — ровно под наш адаптер (`merchantField: "merchant_name"` разложит строки на `awin:cos`, `awin:asos`, …).

---

## 0. Подготовить до регистрации

Заявки проверяются вручную, поэтому лучше прийти подготовленным:

- **Сайт живой и наполненный** — valetti.fit подходит.
- **Раскрытие аффилиатных ссылок** — обязательное требование. У нас уже есть в FAQ («any affiliate links are disclosed»), убедиться, что формулировка на видном месте.
- **Privacy policy / Terms** — есть.
- **Реквизиты для выплат**: IBAN, юрлицо или ИП/самозанятость, налоговый номер (VAT/DIČ, если есть).
- **Карта для $5** — verification fee (возвращается на баланс к первой выплате).

---

## 1. Регистрация паблишера

1. Открыть <https://ui.awin.com/publisher-signup/en/awin/step1>.
2. Тип аккаунта — **Publisher**.
3. Регион/страна — та, где ты платишь налоги (для выплат), это не ограничивает мерчантов.
4. Указать сайт `https://www.valetti.fit`.
5. **Promotional type** — выбрать что-то из «Content / Comparison / Technology», НЕ «Coupon / Cashback». Ближе всего: **Content & Editorial** (+ Technology, если можно несколько).
6. Оплатить **$5** verification fee.

### Как описать проект, чтобы одобрили

Это главный текст заявки. Не «блог», а конкретная модель — она сильная:

> Valetti is an AI-assisted men's personal styling service. Users receive a personalised style report (colour analysis, fit, capsule wardrobe) and a shopping list of specific products matched to their colouring, body type and budget. Traffic to advertisers is high-intent: every product link is a personalised recommendation with a stated reason, not a generic listing. Affiliate relationships are disclosed on-site.

Полезно упомянуть: EU-аудитория (CZ/DE), каталог уже ~10k товаров, ссылки ведут на конкретные SKU.

---

## 2. Заявки на рекламодателей

После одобрения в сети — **каждый мерчант одобряет отдельно**.

В директории (Advertisers → Join Programmes) фильтровать:
- **Country**: Czech Republic и Germany (наши пользователи), плюс общеевропейские;
- **Sector**: Fashion / Clothing;
- **важно**: признак наличия **datafeed** (Product feed). Без фида мерчант нам бесполезен — только ссылки.

Приоритет заявок (по дырам каталога):

| Приоритет | Мерчант | Зачем |
|---|---|---|
| 1 | **Zalando** | Глубина по всем слотам сразу: обувь, премиум, аксессуары, бренды |
| 2 | **Loake** | Формальная обувь (сейчас в каталоге 16 моделей на всё) |
| 3 | **COS** | Премиум-полоса €100–300, эстетика совпадает с рекомендациями Карло |
| 4 | **Massimo Dutti** | Мид-премиум портновка (рубашки/брюки/трикотаж ≥€100 — сейчас 2/4/8 шт.) |
| 5 | **Reiss** | «Invest»-тир, которого нет |
| 6 | **Uniqlo** | Базис с лучшим восприятием качества, чем Zara |
| 7 | **ASOS** | Широта аксессуаров (очки, ремни, украшения) |

Часть откажет — это норма при маленьком трафике. Не блокироваться: одобренных достаточно, чтобы начать.

---

## 3. Create-a-Feed: собрать фид

Toolbox → **Create-a-Feed**.

**Настройки:**
- **Advertisers**: выбрать всех одобренных (кроме Zalando — см. §5).
- **Формат**: **CSV**, разделитель — **запятая** (`,`). Наш парсер настроен на `delimiter: ","`.
- **Compression**: `.gz` можно оставить — загрузчик распаковывает прозрачно (`load.mjs` понимает и `.gz`, и gzip-магию).
- **Encoding**: UTF-8.

**Колонки — включить именно эти** (адаптер `awinMap` читает их по этим именам):

| Назначение | Колонки Awin |
|---|---|
| **merchant_name** | обязательно! иначе все строки схлопнутся в один источник |
| ID | `aw_product_id`, `merchant_product_id`, `ean`, `mpn` |
| Бренд | `brand_name` |
| Название | `product_name` |
| Описание | `description` |
| Категория | `merchant_category` (или `category_name` / `product_type`) |
| Цвет | `colour` |
| Пол | `gender` |
| Цена | `search_price` (и `store_price`), `currency` |
| Картинка | `merchant_image_url` (или `aw_image_url` / `large_image`) |
| Ссылка | `aw_deep_link` — **обязательна**, без неё строка невалидна |
| Наличие | `in_stock` |

Минимум, без которого товар отбраковывается схемой: `product_name`, `search_price`, `currency`, `aw_deep_link`.

Готовый фид даёт постоянный URL — его и берём.

---

## 4. Подключить в проект

Локально в `.env.local`:

```
AWIN_FEED_URL="https://productdata.awin.com/datafeed/download/apikey/.../fid/.../format/csv/delimiter/%2C/compression/gzip/"
```

Проверка без записи в БД:

```bash
node --env-file=.env.local scripts/import-feed.mjs --source awin --url "$AWIN_FEED_URL" --dry-run --limit 50
```

Смотреть в выводе: `rows parsed / canonical / valid / invalid`. Если много `invalid` — почти всегда не хватает колонки из таблицы выше (чаще `aw_deep_link` или `currency`).

Боевой прогон:

```bash
node --env-file=.env.local scripts/import-feed.mjs --source awin --url "$AWIN_FEED_URL"
```

Затем добавить `AWIN_FEED_URL` в переменные окружения Vercel (Production) — дальше её подхватит ежедневный крон `/api/cron/refresh-catalog`, который сам обходит все настроенные `*_FEED_URL`.

---

## 5. Zalando — отдельным слотом

В `sources.mjs` для Zalando есть собственный источник с тем же форматом колонок, но своей переменной `ZALANDO_FEED_URL`. Причина — фид огромный, его удобно обновлять/лимитировать отдельно.

Поэтому: собрать **второй** Create-a-Feed только с Zalando и положить его в `ZALANDO_FEED_URL`.

Если Zalando в CZ окажется доступен только через локальную сеть (eHUB / AffiliatePort), напиши — адаптер под неё это ~20 строк карты колонок в `SOURCES`.

---

## 6. Проверить результат

После импорта прогнать аудит каталога и сравнить с базовыми цифрами (замер от 25.07.2026):

| Метрика | Было | Цель |
|---|---|---|
| Обувь | 532 | ≥1 500 |
| Формальная обувь | 16 | ≥150 |
| Полоса €100–400 | ~470 | ≥1 500 |
| Часы | 1 | ≥100 |
| Очки | 55 | ≥150 |
| Доля одного источника | 54% (Zara) | ≤30% |
| Оферы на CZ | ~5 000 | ≥80% каталога |

---

## 7. Сроки и подводные камни

- **Одобрение в сети** — обычно дни, не часы (ручная проверка).
- **Одобрение мерчантами** — от часов до пары недель, часть откажет молча.
- **Фид обновляется раз в сутки** — не ждать мгновенных изменений цен.
- **Без раскрытия аффилиатных ссылок** можно получить отказ или бан — держать формулировку на сайте.
- **Не подавать как coupon/cashback** — другой набор требований и хуже одобрение для нашей модели.
- Пока идут одобрения, параллельно имеет смысл завести **FlexOffers** (там нашёлся COS, адаптер уже есть) и **Tradedoubler** (Timex — часы).
