# RemiDe: 100 сценариев конверсии, монетизации и роста

## Комплексный отчёт по оптимизации бизнес-модели

---

## 1. ЦЕНООБРАЗОВАНИЕ И ТАРИФНЫЕ ПЛАНЫ (Scenarios 1–15)

### 1. Трёхуровневая тарифная сетка: Analyst / Professional / Enterprise

**Описание:** Внедрить классическую трёхуровневую модель. Analyst ($49/мес) — доступ к базе юрисдикций и сущностей без блюра, лимит 50 экспортов/мес. Professional ($149/мес) — полный доступ + API (1000 запросов), алерты, экспорт CSV. Enterprise ($499+/мес) — безлимит, SLA, кастомные отчёты, SSO.

**Ожидаемый эффект:** High — стандарт B2B SaaS, снижает барьер входа и даёт путь роста выручки.
**Трудоёмкость:** Medium — нужна интеграция Stripe, middleware для rate limiting.
**Приоритет:** 10

---

### 2. Годовая подписка со скидкой 20%

**Описание:** Предложить annual billing со скидкой (например, $39/мес вместо $49 при оплате за год). Это стандартная практика Ahrefs, Semrush и PitchBook — увеличивает LTV и снижает churn. Отображать экономию в долларах прямо на странице pricing.

**Ожидаемый эффект:** Medium — увеличение LTV на 15-25%, снижение ежемесячного churn.
**Трудоёмкость:** Low — только конфигурация Stripe plans.
**Приоритет:** 8

---

### 3. Тариф «Jurisdiction Pack» — оплата за регион

**Описание:** Вместо полного доступа позволить покупать доступ к конкретным регионам: EU Pack (27 стран MiCA), Asia Pack (SG, JP, HK, KR, TW), Americas Pack. По $29/мес за пак. Подходит для комплаенс-офицеров, которые работают только в одной юрисдикции.

**Ожидаемый эффект:** Medium — снижает барьер входа для нишевых пользователей.
**Трудоёмкость:** Medium — нужна логика granular access control по country_code.
**Приоритет:** 6

---

### 4. Pay-per-report модель для разовых покупателей

**Описание:** Генерировать PDF-отчёты по юрисдикциям (например, «UAE Stablecoin Licensing Framework 2026») и продавать по $19-49 за отчёт. Модель CB Insights и Chainalysis. Подходит для консультантов, которым нужен один документ для клиента.

**Ожидаемый эффект:** Medium — дополнительный revenue stream, лид-генерация.
**Трудоёмкость:** Medium — генерация PDF, Stripe Checkout для одноразовых платежей.
**Приоритет:** 7

---

### 5. Freemium с лимитом на количество просмотров детальных страниц

**Описание:** Вместо полного блюра дать бесплатным пользователям 5 детальных просмотров юрисдикций и 10 сущностей в месяц (как Crunchbase даёт 5 профилей/мес). Это создаёт привычку использования и демонстрирует ценность перед paywall.

**Ожидаемый эффект:** High — увеличение conversion rate с бесплатного на платный в 2-3 раза по сравнению с полным блюром.
**Трудоёмкость:** Medium — трекинг просмотров в Supabase, middleware.
**Приоритет:** 9

---

### 6. Startup/Academic тариф ($19/мес)

**Описание:** Специальный тариф для стартапов (< 10 сотрудников) и академических исследователей. Полный доступ к данным, но без API и экспорта. Аналог GitHub Education / Notion for Startups. Привлекает будущих enterprise-клиентов на ранней стадии.

**Ожидаемый эффект:** Low-Medium — расширение базы пользователей, долгосрочная конверсия.
**Трудоёмкость:** Low — просто дополнительный Stripe plan + верификация.
**Приоритет:** 5

---

### 7. «Compliance Team» тариф с мультипользовательским доступом

**Описание:** Тариф для команд: 5 мест за $349/мес (vs $149x5 = $745). Compliance-отделы банков и VASP обычно 3-8 человек. Предложить shared workspace с общими алертами, комментариями, тегами. Модель Figma/Notion for Teams.

**Ожидаемый эффект:** High — увеличение ARPU в 2-3 раза за один аккаунт.
**Трудоёмкость:** High — multi-tenant architecture, role management.
**Приоритет:** 7

---

### 8. Usage-based pricing для API

**Описание:** API-доступ с оплатой за запросы: первые 100 бесплатно, далее $0.05 за запрос (entities), $0.10 за запрос (jurisdictions с полными данными). Модель Clearbit / FullContact. Подходит для RegTech-компаний, которые интегрируют данные RemiDe в свои продукты.

**Ожидаемый эффект:** High — потенциально самый масштабируемый revenue stream.
**Трудоёмкость:** High — нужен полноценный API gateway, key management, billing metering.
**Приоритет:** 6

---

### 9. Динамическое ценообразование по размеру компании

**Описание:** На странице pricing спрашивать размер компании (1-10, 11-50, 51-200, 200+) и показывать соответствующую цену. Мелкие VASP платят $49, крупные банки — $499. Модель HubSpot/Intercom. Максимизирует revenue с enterprise при сохранении доступности для SMB.

**Ожидаемый эффект:** Medium — увеличение ARPU от крупных клиентов.
**Трудоёмкость:** Low — только UI/UX на pricing page, разные Stripe plans.
**Приоритет:** 5

---

### 10. Бесплатный триал 14 дней без карты

**Описание:** Дать полный доступ на 14 дней без привязки карты. После — soft paywall с предложением подписки. Benchmark: Ahrefs даёт 7 дней за $7, Semrush — 7 дней бесплатно. Для B2B regulatory data 14 дней оптимально — достаточно для оценки полноты данных.

**Ожидаемый эффект:** High — резко увеличивает количество активированных пользователей.
**Трудоёмкость:** Low — триал-флаг в Supabase auth metadata, cron для деактивации.
**Приоритет:** 9

---

### 11. «Data Freshness» тариф — премиум за real-time обновления

**Описание:** Базовый тариф обновляется еженедельно, премиум — ежедневно. Для compliance-офицеров критично знать о новых лицензиях/отзывах в течение 24 часов. Модель Bloomberg Terminal (real-time vs delayed data).

**Ожидаемый эффект:** Medium — дифференциация тарифов по ценности, не по количеству.
**Трудоёмкость:** Medium — нужна инфраструктура частого парсинга и уведомлений.
**Приоритет:** 6

---

### 12. Бандл «Stablecoin Intelligence + Entity Database»

**Описание:** Продавать отдельно два продукта: Entity Database (реестры VASP/CASP/EMI) и Stablecoin Intelligence (эмитенты, блокчейны, законы). Бандл дешевле на 25%. Это позволяет привлекать клиентов с разными потребностями и upsell на полный пакет.

**Ожидаемый эффект:** Medium — сегментация аудитории, upsell path.
**Трудоёмкость:** Medium — раздельный access control по data domains.
**Приоритет:** 5

---

### 13. Гранулярный экспорт: бесплатные CSV-превью, платные полные файлы

**Описание:** Показывать первые 10 строк CSV-экспорта бесплатно, полный файл — за подписку. Модель Statista/Data.gov premium. Compliance-офицеры часто начинают с экспорта в Excel для внутренних отчётов — это natural conversion trigger.

**Ожидаемый эффект:** Medium — конвертирует data-oriented пользователей.
**Трудоёмкость:** Low — генерация truncated CSV, gate на полный.
**Приоритет:** 7

---

### 14. «Regulatory Alert» subscription — standalone продукт

**Описание:** Отдельная подписка ($29/мес) только на email-алерты: новые лицензии, отзывы, изменения законов по выбранным юрисдикциям. Не требует использования платформы. Модель Google Alerts premium / Meltwater. Идеально для busy executives.

**Ожидаемый эффект:** Medium — low-touch revenue, высокий retention.
**Трудоёмкость:** Medium — email pipeline, event detection system.
**Приоритет:** 6

---

### 15. «Founder's Price» — ранняя цена с lock-in

**Описание:** Первые 100 подписчиков получают пожизненную скидку 50% («Founder's Pricing»). Создаёт urgency, social proof и лояльную базу первых пользователей. Модель AppSumo lifetime deals, но более устойчивая (скидка, а не lifetime).

**Ожидаемый эффект:** Medium — быстрый набор первых платящих клиентов.
**Трудоёмкость:** Low — маркетинговый лендинг + купон в Stripe.
**Приоритет:** 8

---

## 2. КОНВЕРСИЯ FREE-TO-PAID (Scenarios 16–30)

### 16. Прогрессивный блюр вместо бинарного

**Описание:** Вместо полного блюра показывать 30% контента детальной страницы (заголовок юрисдикции, количество сущностей, статус регулирования), а блюрить только ценные секции (конкретные законы, лицензии, контакты сущностей). Пользователь видит достаточно, чтобы понять ценность, но не достаточно для работы.

**Ожидаемый эффект:** High — увеличение конверсии на 30-50% по сравнению с полным блюром (данные Crunchbase).
**Трудоёмкость:** Low — изменение CSS/JS блюра на фронтенде.
**Приоритет:** 9

---

### 17. Контекстный CTA «Unlock this jurisdiction» на каждой заблюренной секции

**Описание:** Вместо одного общего paywall-баннера, ставить кнопку «Unlock UAE Stablecoin Framework — Start Free Trial» прямо на каждой заблюренной секции. Personalised CTA конвертирует на 202% лучше, чем generic (HubSpot research).

**Ожидаемый эффект:** High — прямое увеличение click-through на signup.
**Трудоёмкость:** Low — компонент с динамическим текстом.
**Приоритет:** 9

---

### 18. Exit-intent popup с предложением триала

**Описание:** При попытке уйти со страницы юрисдикции/сущности показывать popup: «You were looking at [Entity Name]. Get full access to 14,090+ regulated entities — free for 14 days.» Модель OptinMonster / Sumo. Подходит для пользователей, пришедших из поиска.

**Ожидаемый эффект:** Medium — 2-4% дополнительная конверсия из уходящего трафика.
**Трудоёмкость:** Low — JavaScript event listener + modal.
**Приоритет:** 7

---

### 19. Email gate на ценный контент (lead magnet)

**Описание:** Предлагать скачать «2026 Global Stablecoin Regulation Map» (PDF) в обмен на email. После — drip email sequence из 5 писем, ведущий к триалу. Модель CB Insights / Chainalysis research reports. Контент генерируется из уже имеющихся данных.

**Ожидаемый эффект:** High — основной канал lead generation для B2B SaaS.
**Трудоёмкость:** Medium — генерация PDF, email automation (Resend уже настроен).
**Приоритет:** 8

---

### 20. «Saved search» как конверсионный триггер

**Описание:** Позволить бесплатным пользователям сохранять поисковые запросы и фильтры, но email-уведомления об изменениях — только для платных. Человек настраивает «VASP + EU + active license» и видит: «Get notified when new entities match — Upgrade to Pro.»

**Ожидаемый эффект:** Medium — создаёт sticky behaviour и natural upsell момент.
**Трудоёмкость:** Medium — saved searches в Supabase, notification pipeline.
**Приоритет:** 6

---

### 21. Inline signup form внутри контента

**Описание:** На длинных страницах юрисдикций вставлять signup-форму между секциями (после «Regulatory Framework» и перед «Licensed Entities»). Не popup, а inline — менее агрессивно. Модель Medium / Substack interstitial.

**Ожидаемый эффект:** Medium — 5-10% дополнительная конверсия.
**Трудоёмкость:** Low — React-компонент между секциями.
**Приоритет:** 7

---

### 22. Comparison table на pricing page: Free vs Paid

**Описание:** Детальная таблица сравнения: Free (10 юрисдикций/мес, без детальных страниц, без экспорта) vs Paid (безлимит, API, алерты, CSV). Визуально показать, что бесплатный пользователь теряет. Модель Ahrefs pricing page.

**Ожидаемый эффект:** Medium — ускорение решения о покупке.
**Трудоёмкость:** Low — статическая UI-таблица.
**Приоритет:** 8

---

### 23. Персонализированный onboarding по роли

**Описание:** При регистрации спрашивать: «I am a...» (Compliance Officer / Crypto Lawyer / Regulator / Investor / Consultant). В зависимости от роли показывать разный контент и тарифы. Compliance officer видит Entity Database, Lawyer — Laws & Frameworks, Investor — Stablecoin Issuers.

**Ожидаемый эффект:** High — увеличение activation rate на 40-60% (данные Appcues).
**Трудоёмкость:** Medium — onboarding wizard + conditional routing.
**Приоритет:** 8

---

### 24. «This data is X hours old» urgency

**Описание:** На каждой детальной странице показывать: «Last updated: 4 hours ago. Next update in 2 hours.» Подчёркивает свежесть данных и value proposition real-time monitoring. Compliance-офицеры обязаны использовать актуальные данные.

**Ожидаемый эффект:** Low-Medium — усиление perceived value.
**Трудоёмкость:** Low — отображение last_quality_at из Supabase.
**Приоритет:** 5

---

### 25. Social login (Google, LinkedIn)

**Описание:** Добавить signup через Google и LinkedIn (OAuth). Снижает friction при регистрации на 20-30%. LinkedIn особенно релевантен для B2B compliance-аудитории. Supabase Auth нативно поддерживает оба провайдера.

**Ожидаемый эффект:** Medium — увеличение signup rate на 20-30%.
**Трудоёмкость:** Low — конфигурация Supabase Auth providers.
**Приоритет:** 8

---

### 26. «You're missing X entities in your jurisdiction» teaser

**Описание:** На списке сущностей показывать: «Showing 10 of 287 entities in Singapore. Unlock all 287 — Start Free Trial.» Конкретные цифры создают FOMO и демонстрируют глубину данных. Модель LinkedIn Sales Navigator «X results hidden.»

**Ожидаемый эффект:** High — один из самых эффективных conversion triggers для data products.
**Трудоёмкость:** Low — count query + UI компонент.
**Приоритет:** 9

---

### 27. Weekly email digest как retention hook

**Описание:** Отправлять зарегистрированным бесплатным пользователям еженедельный email: «3 new VASPs licensed this week, 1 license revoked, UAE updated stablecoin framework.» В конце — CTA на полный доступ. Модель Crunchbase Daily / CB Insights newsletter.

**Ожидаемый эффект:** Medium — retention бесплатных пользователей и nurturing к конверсии.
**Трудоёмкость:** Medium — email template, data aggregation, Resend integration.
**Приоритет:** 7

---

### 28. «Compare jurisdictions» feature — платная

**Описание:** Инструмент сравнения двух юрисдикций side-by-side (UAE vs Singapore: licensing requirements, fees, timelines, stablecoin rules). Бесплатно — одно сравнение, далее paywall. Уникальная фича, которой нет у конкурентов. Критически полезна для VASP, выбирающих юрисдикцию.

**Ожидаемый эффект:** High — killer feature для conversion + SEO (comparison pages высоко ранжируются).
**Трудоёмкость:** Medium — UI + data normalization для сравнения.
**Приоритет:** 8

---

### 29. Referral program: «Give 1 month, get 1 month»

**Описание:** Платящий пользователь приглашает коллегу — оба получают месяц бесплатно. Compliance-комьюнити тесное, рекомендации коллег — основной канал доверия. Модель Dropbox / Notion referral.

**Ожидаемый эффект:** Medium — вирусный рост в нишевом B2B сообществе.
**Трудоёмкость:** Medium — referral tracking, coupon system в Stripe.
**Приоритет:** 6

---

### 30. «Unlock with company email» — квалификация лидов

**Описание:** Требовать corporate email для триала (не Gmail/Outlook). Автоматически определять компанию по домену (Clearbit-style enrichment). Пользователь с @hsbc.com получает enterprise trial, с @small-vasp.io — standard. Это квалифицирует лидов для sales outreach.

**Ожидаемый эффект:** Medium — повышение качества лидов, но может снизить signup volume.
**Трудоёмкость:** Low — валидация email домена, lookup по домену.
**Приоритет:** 5

---

## 3. VALUE PROPOSITION И ПОЗИЦИОНИРОВАНИЕ (Scenarios 31–40)

### 31. Repositioning: «Regulatory Intelligence» вместо «Tracker»

**Описание:** Сменить позиционирование с «трекера» на «intelligence platform». Bloomberg Terminal не называет себя «stock tracker». RemiDe — это regulatory intelligence для принятия решений, а не просто база данных. Обновить все тексты, meta, OG-теги.

**Ожидаемый эффект:** High — увеличение perceived value и готовности платить premium цену.
**Трудоёмкость:** Low — копирайтинг, обновление текстов.
**Приоритет:** 8

---

### 32. Landing page с ROI-калькулятором

**Описание:** «How much does regulatory non-compliance cost you?» Интерактивный калькулятор: выбрать юрисдикцию, тип бизнеса, объём — показать потенциальные штрафы (из реальных данных: Binance $4.3B, BitMEX $100M). Итог: «RemiDe costs $149/mo. A licensing mistake costs $X.»

**Ожидаемый эффект:** High — один из самых эффективных B2B conversion tools.
**Трудоёмкость:** Medium — калькулятор + база штрафов.
**Приоритет:** 7

---

### 33. «Coverage Map» как hero-секция лендинга

**Описание:** Интерактивная карта мира с подсвеченными 207 юрисдикциями — как hero-элемент landing page. Click на страну показывает preview данных. Визуально демонстрирует масштаб покрытия. Аналог: Chainalysis Reactor map, S&P Global coverage maps.

**Ожидаемый эффект:** Medium — визуальное wow-эффект, усиление доверия.
**Трудоёмкость:** Low — карта уже существует, нужно переместить на лендинг.
**Приоритет:** 7

---

### 34. Dedicated landing pages для каждого сегмента аудитории

**Описание:** Создать отдельные лендинги: /for-compliance-officers, /for-crypto-lawyers, /for-regulators, /for-investors. Каждый с кейсами, терминологией и CTA, релевантными сегменту. Модель Notion (/for-engineering, /for-hr).

**Ожидаемый эффект:** High — увеличение conversion на 30-50% за счёт персонализации.
**Трудоёмкость:** Medium — 4-5 статических страниц.
**Приоритет:** 7

---

### 35. «Data Depth Score» для каждой юрисдикции

**Описание:** Показывать метрику глубины данных (A/B/C/D) для каждой страны. UAE: A (полные данные, real-time обновления), Somalia: D (только базовый статус). Это управляет ожиданиями и показывает, где RemiDe сильнее всего. Модель Glassdoor company ratings.

**Ожидаемый эффект:** Low-Medium — повышение доверия, снижение churn из-за неоправданных ожиданий.
**Трудоёмкость:** Low — quality_score уже есть, нужна агрегация по юрисдикции.
**Приоритет:** 4

---

### 36. Кейс-стади: «How [VASP Name] used RemiDe to get licensed in 3 jurisdictions»

**Описание:** Даже если пока нет реальных клиентов — создать hypothetical case study, основанный на реальном процессе лицензирования. Показать workflow: research юрисдикции -> сравнение -> application. Конвертировать в PDF lead magnet.

**Ожидаемый эффект:** Medium — social proof и demonstration of value.
**Трудоёмкость:** Low — копирайтинг, 1 страница.
**Приоритет:** 6

---

### 37. «Regulatory Status Badges» для клиентов

**Описание:** Платные клиенты могут встраивать на свой сайт badge: «Verified by RemiDe — Licensed in [X] jurisdictions.» Это бесплатная реклама RemiDe + value-add для клиентов. Модель Trustpilot / Norton Verified.

**Ожидаемый эффект:** Medium — вирусный маркетинг + brand building.
**Трудоёмкость:** Low — embed-код + SVG badge.
**Приоритет:** 5

---

### 38. «Regulatory Risk Score» для сущностей

**Описание:** Вычислять risk score (1-100) для каждой зарегистрированной сущности на основе: количество юрисдикций, тип лицензий, DNS-статус, возраст компании, enforcement history. Уникальный data product, аналог кредитного рейтинга для крипто-компаний.

**Ожидаемый эффект:** High — killer differentiator, justifies premium pricing.
**Трудоёмкость:** High — алгоритм scoring, data enrichment, validation.
**Приоритет:** 7

---

### 39. Позиционирование через «cost of not knowing»

**Описание:** На лендинге акцентировать не фичи, а стоимость незнания: «In 2025, $2.1B in crypto fines were issued. 73% could have been prevented with proper regulatory monitoring.» Конкретные цифры из публичных enforcement actions. Модель страховых компаний.

**Ожидаемый эффект:** Medium — эмоциональный conversion trigger для risk-averse аудитории.
**Трудоёмкость:** Low — копирайтинг + research enforcement data.
**Приоритет:** 7

---

### 40. White-label option для консалтинговых компаний

**Описание:** Позволить юридическим и compliance-консалтинговым фирмам (PwC, Deloitte, нишевые) встраивать данные RemiDe под своим брендом в отчёты для клиентов. Цена: $999+/мес. Модель Pitchbook white-label / Refinitiv Eikon embedding.

**Ожидаемый эффект:** High — высокий ARPU, B2B2B канал.
**Трудоёмкость:** High — white-label инфраструктура, API, branding config.
**Приоритет:** 5

---

## 4. СТРАТЕГИЯ PAYWALL (Scenarios 41–50)

### 41. «Smart paywall» на основе поведения пользователя

**Описание:** Не показывать paywall на первом визите. Дать просмотреть 3 страницы свободно, на 4-й — мягкий paywall. На 7-й — жёсткий блюр. Модель New York Times / Financial Times metered paywall. Увеличивает время на сайте и activation.

**Ожидаемый эффект:** High — баланс между доступностью и конверсией.
**Трудоёмкость:** Medium — session tracking, progressive gate logic.
**Приоритет:** 8

---

### 42. Paywall с preview конкретных data points

**Описание:** На заблюренной странице юрисдикции показывать 2-3 конкретных факта незаблюренными: «UAE requires $545K minimum capital for VASP license» (остальное заблюрено). Пользователь видит quality данных и хочет больше. Модель Statista preview.

**Ожидаемый эффект:** High — демонстрация конкретной ценности.
**Трудоёмкость:** Low — выбор «teaser» data points для каждого типа страницы.
**Приоритет:** 9

---

### 43. A/B тестирование вариантов paywall

**Описание:** Запустить A/B тест: (A) полный блюр + CTA, (B) частичный блюр + inline CTA, (C) countdown «3 free views remaining». Умами уже интегрирован для аналитики. Принимать решения на данных, а не на интуиции.

**Ожидаемый эффект:** High — data-driven оптимизация главного conversion point.
**Трудоёмкость:** Medium — A/B testing framework, event tracking.
**Приоритет:** 7

---

### 44. Отложенный paywall для SEO-трафика

**Описание:** Пользователи из Google видят полный контент на первой странице (для SEO и bounce rate), paywall начинается со второй. Google индексирует полный контент, пользователь получает value и хочет больше. Модель Medium «read for free with Google.»

**Ожидаемый эффект:** High — сохранение SEO rankings + conversion из organic трафика.
**Трудоёмкость:** Medium — referrer detection, conditional rendering.
**Приоритет:** 7

---

### 45. «Unlock this section» micro-payment ($2.99)

**Описание:** Для пользователей, не готовых к подписке, предложить разовую разблокировку одной секции (например, «Full Entity List for Singapore» за $2.99). Модель Apple News+ single article. Снижает барьер первой оплаты.

**Ожидаемый эффект:** Low-Medium — дополнительный revenue, но может каннибализировать подписки.
**Трудоёмкость:** Medium — Stripe micro-payments, granular unlock tracking.
**Приоритет:** 4

---

### 46. «Time-limited full access» после регистрации

**Описание:** Новый зарегистрированный пользователь получает 1 час полного доступа немедленно (без подтверждения email). Таймер обратного отсчёта на каждой странице: «47:23 remaining.» Urgency + immediate value. Модель dating apps / Bumble.

**Ожидаемый эффект:** Medium — высокий activation, но aggressive UX.
**Трудоёмкость:** Low — таймер + session flag.
**Приоритет:** 6

---

### 47. Paywall-free для определённых типов данных

**Описание:** CBDC data — полностью бесплатно (24 записи, не core value). Stablecoin issuers — free summary, paid details. Entity database — основной paywall. Разная монетизация для разных data domains. Free CBDC привлекает трафик от регуляторов.

**Ожидаемый эффект:** Medium — привлечение регуляторов (high-value сегмент) через бесплатный контент.
**Трудоёмкость:** Low — conditional paywall по типу страницы.
**Приоритет:** 6

---

### 48. «Guest pass» — одноразовый полный доступ по ссылке

**Описание:** Платный пользователь может сгенерировать 3 guest-ссылки в месяц. Коллега получает 24 часа полного доступа. Compliance-офицеры часто делятся данными с юристами и менеджментом. Это приводит новых лидов. Модель Spotify/YouTube Premium family sharing.

**Ожидаемый эффект:** Medium — вирусный рост + lead generation от существующих клиентов.
**Трудоёмкость:** Medium — link generation, time-limited access, tracking.
**Приоритет:** 5

---

### 49. Paywall с social proof: «1,247 compliance professionals use RemiDe»

**Описание:** На paywall-баннере показывать live counter пользователей (даже если пока это бесплатные). «Join 1,247 compliance professionals tracking regulatory changes.» Модель Basecamp landing page.

**Ожидаемый эффект:** Medium — social proof снижает perceived risk подписки.
**Трудоёмкость:** Low — counter из Supabase auth users count.
**Приоритет:** 7

---

### 50. «Preview mode» для enterprise demo

**Описание:** Специальный URL (/demo) с full access на ограниченном dataset (только 5 юрисдикций: UAE, Singapore, EU, US, UK). Для enterprise sales calls — показать продукт без trial-аккаунта. Модель Salesforce demo org.

**Ожидаемый эффект:** Medium — ускорение enterprise sales cycle.
**Трудоёмкость:** Low — route + filtered data access.
**Приоритет:** 5

---

## 5. ONBOARDING И АКТИВАЦИЯ (Scenarios 51–58)

### 51. «Welcome tour» с 3 ключевыми действиями

**Описание:** После регистрации — guided tour: (1) Search for your jurisdiction, (2) Find a competitor entity, (3) Check stablecoin framework. Completion rate = activation. Если пользователь выполнил все 3 — вероятность конверсии в платного x3. Модель Notion onboarding checklist.

**Ожидаемый эффект:** High — увеличение activation rate на 30-50%.
**Трудоёмкость:** Medium — onboarding UI, progress tracking.
**Приоритет:** 8

---

### 52. Pre-populated dashboard на основе выбранной юрисдикции

**Описание:** При регистрации спрашивать: «Which jurisdictions are you interested in?» и сразу показывать dashboard с этими юрисдикциями, количеством сущностей, последними изменениями. Персонализированный first experience. Модель Bloomberg Terminal workspace.

**Ожидаемый эффект:** High — immediate value demonstration.
**Трудоёмкость:** Medium — personalization layer + dashboard component.
**Приоритет:** 7

---

### 53. «Quick Win» email через 1 час после регистрации

**Описание:** Автоматическое письмо: «You signed up interested in UAE. Here are 3 things you should know about UAE stablecoin regulation.» Персонализировано по выбранной юрисдикции. Модель Mixpanel / Amplitude onboarding emails.

**Ожидаемый эффект:** Medium — re-engagement, nudge к первому глубокому использованию.
**Трудоёмкость:** Low-Medium — email template + personalization logic.
**Приоритет:** 6

---

### 54. Interactive «Regulatory Readiness Checklist»

**Описание:** Инструмент для VASP: «Check if you're ready to apply for a license in [jurisdiction].» Вопросы: капитал, AML-политика, директора, аудит. Результат: «You meet 7/12 requirements.» Полный чеклист — за подписку. Уникальный value-add.

**Ожидаемый эффект:** High — sticky feature, natural paywall moment.
**Трудоёмкость:** High — нужна структурированная data по requirements каждой юрисдикции.
**Приоритет:** 6

---

### 55. «Bookmark» feature для бесплатных пользователей

**Описание:** Позволить бесплатным пользователям «звёздочить» юрисдикции и сущности. Через неделю email: «You bookmarked 7 jurisdictions. Here's what changed this week.» Детали — за paywall. Создаёт invested behaviour + re-engagement.

**Ожидаемый эффект:** Medium — retention бесплатных пользователей, данные для персонализации.
**Трудоёмкость:** Low — bookmarks table в Supabase, email cron.
**Приоритет:** 6

---

### 56. Gamified onboarding: «Platform Explorer» badge

**Описание:** За просмотр 10 юрисдикций, 20 сущностей и 5 стейблкоинов — badge «Platform Explorer» + unlock bonus content (exclusive PDF report). Не для всех аудиторий, но для individual users (исследователи, студенты) работает. Модель Duolingo / Khan Academy.

**Ожидаемый эффект:** Low — нишевый эффект, больше для B2C-сегмента.
**Трудоёмкость:** Medium — gamification layer.
**Приоритет:** 3

---

### 57. «Import your watchlist» — интеграция с существующими workflow

**Описание:** Позволить загрузить CSV с названиями компаний, которые пользователь уже мониторит. RemiDe мэтчит их с базой и показывает: «12 of your 15 companies found in our database. 3 have licensing changes.» Мгновенная демонстрация value.

**Ожидаемый эффект:** High — immediate personal relevance.
**Трудоёмкость:** Medium — CSV upload, fuzzy matching, results page.
**Приоритет:** 7

---

### 58. Onboarding video (90 секунд)

**Описание:** Короткое видео на landing page: «How compliance officers use RemiDe to track 14,000+ entities across 207 jurisdictions.» Screencast с voiceover. Video increases conversion by 80% (Wyzowl study). Может быть записано через Loom бесплатно.

**Ожидаемый эффект:** Medium — увеличение signup rate на 20-40%.
**Трудоёмкость:** Low — Loom запись, embed.
**Приоритет:** 7

---

## 6. RETENTION И ENGAGEMENT (Scenarios 59–66)

### 59. «Regulatory Change Alerts» — push-уведомления при изменениях

**Описание:** Email/browser notification при: новая лицензия выдана, лицензия отозвана, новый закон принят, стейблкоин зарегистрирован. Пользователь подписывается на конкретные юрисдикции. Это reason to come back daily. Модель Google Alerts / Meltwater.

**Ожидаемый эффект:** High — основной retention driver для B2B intelligence products.
**Трудоёмкость:** High — change detection pipeline, notification system.
**Приоритет:** 8

---

### 60. Monthly «Regulatory Landscape Report» для платных

**Описание:** Автоматически генерируемый ежемесячный отчёт: сколько новых лицензий, какие страны обновили законы, тренды. Доступен только подписчикам. PDF + in-app dashboard. Модель Chainalysis Geography of Cryptocurrency Report.

**Ожидаемый эффект:** Medium — retention + demonstration of ongoing value.
**Трудоёмкость:** Medium — data aggregation, template, PDF generation.
**Приоритет:** 6

---

### 61. «Personal dashboard» с tracked entities и jurisdictions

**Описание:** Персонализированный dashboard: мои юрисдикции, мои отслеживаемые сущности, последние изменения по моему watchlist. Вместо generic homepage. Модель Bloomberg Terminal / Refinitiv Eikon workspace.

**Ожидаемый эффект:** High — sticky product, увеличение DAU.
**Трудоёмкость:** Medium — personalization layer, dashboard UI.
**Приоритет:** 7

---

### 62. «Annotation & Notes» на сущностях

**Описание:** Платные пользователи могут оставлять личные заметки на сущностях и юрисдикциях. «Reviewed for Q3 compliance report», «Client inquired about this entity.» Создаёт switching cost — данные пользователя привязаны к платформе. Модель Evernote / Notion inline comments.

**Ожидаемый эффект:** Medium — увеличение retention через switching cost.
**Трудоёмкость:** Medium — notes table, UI.
**Приоритет:** 5

---

### 63. «Activity feed» — лента изменений

**Описание:** Real-time лента: «Binance получил лицензию в Казахстане», «UAE обновил закон о стейблкоинах», «3 новых VASP зарегистрированы в Сингапуре.» Привлекает ежедневные визиты. Модель Twitter/LinkedIn feed, но для regulatory data.

**Ожидаемый эффект:** High — основной reason to visit daily.
**Трудоёмкость:** High — event detection, feed algorithm, UI.
**Приоритет:** 7

---

### 64. Quarterly «Data Quality Report» для пользователей

**Описание:** Показывать пользователям: «This quarter: 1,247 new entities added, 89 licenses revoked, 12 jurisdictions updated, 99.3% data accuracy.» Прозрачность quality + demonstration of active maintenance. Модель Cloudflare Radar.

**Ожидаемый эффект:** Low-Medium — trust building, churn prevention.
**Трудоёмкость:** Low — automated report from parser/quality metrics.
**Приоритет:** 4

---

### 65. «Competitor tracking» feature

**Описание:** VASP вводит названия своих конкурентов — RemiDe показывает их лицензионный статус, юрисдикции присутствия, изменения. «Your competitor CryptoX just got licensed in UAE.» Sticky use case, justifies premium subscription.

**Ожидаемый эффект:** High — unique value proposition, premium feature.
**Трудоёмкость:** Medium — matching, comparison UI, alerts.
**Приоритет:** 7

---

### 66. «Churning user» reactivation email sequence

**Описание:** Пользователь не заходил 14 дней — email: «Since you last visited, 47 regulatory changes happened in your tracked jurisdictions.» 30 дней — предложение скидки 30% на 3 месяца. Модель Ahrefs win-back campaign.

**Ожидаемый эффект:** Medium — recovery 10-15% churning пользователей.
**Трудоёмкость:** Low-Medium — email automation, triggers.
**Приоритет:** 6

---

## 7. UPSELL И EXPANSION REVENUE (Scenarios 67–72)

### 67. «Data Export» как premium feature

**Описание:** CSV/JSON/Excel экспорт доступен только на Professional+. Free — только просмотр. Compliance-офицеры обязаны экспортировать данные для отчётов. Это natural upsell moment. Модель Crunchbase Pro CSV export.

**Ожидаемый эффект:** Medium — конвертирует power users.
**Трудоёмкость:** Low — gate на export endpoint.
**Приоритет:** 8

---

### 68. Custom reports по запросу ($500-2000)

**Описание:** Сервис кастомных отчётов: «Stablecoin Licensing Landscape for Southeast Asia» на заказ. Данные из RemiDe + ручная аналитика. Модель Frost & Sullivan / Mordor Intelligence. Высокомаржинальный revenue stream для enterprise.

**Ожидаемый эффект:** Medium — high-value revenue, но не масштабируется.
**Трудоёмкость:** High — manual work per report.
**Приоритет:** 4

---

### 69. «Compliance Calendar» — платная надстройка

**Описание:** Календарь regulatory deadlines: «MiCA full implementation deadline: June 30, 2026», «UAE VASP renewal deadline: Q4 2026.» Подписка на календарь — $29/мес дополнительно. Уникальный tool для compliance planning.

**Ожидаемый эффект:** Medium — low-effort value-add, recurring revenue.
**Трудоёмкость:** Medium — data collection, calendar UI, notification system.
**Приоритет:** 5

---

### 70. Upsell prompt при достижении лимитов

**Описание:** Не просто «You've reached your limit» — а «You've viewed 5 of 287 entities in Singapore. Unlock all 287 plus 14,090 entities globally. Upgrade now — first month 50% off.» Contextual upsell с конкретными цифрами + discount.

**Ожидаемый эффект:** High — contextual upsell конвертирует в 3-5x лучше, чем generic.
**Трудоёмкость:** Low — dynamic text в paywall component.
**Приоритет:** 9

---

### 71. «Team admin panel» для enterprise upsell

**Описание:** Когда 3+ пользователя с одного домена регистрируются — автоматически предлагать Team plan. «3 people from @bankxyz.com are using RemiDe. Upgrade to Team and save 30%.» Email sales outreach.

**Ожидаемый эффект:** High — enterprise conversion trigger.
**Трудоёмкость:** Medium — domain aggregation, auto-detection, outreach.
**Приоритет:** 6

---

### 72. Annual «State of Stablecoin Regulation» report — premium content

**Описание:** Годовой аналитический отчёт (50+ страниц): тренды, прогнозы, сравнение юрисдикций, top entities, enforcement actions. Цена: $299 для non-subscribers, бесплатно для Pro+. Модель CB Insights State of Blockchain, PwC Global Crypto Report.

**Ожидаемый эффект:** Medium — lead generation + brand positioning + upsell incentive.
**Трудоёмкость:** High — significant content creation.
**Приоритет:** 5

---

## 8. CONTENT MARKETING И SEO КАК CONVERSION LEVER (Scenarios 73–80)

### 73. Programmatic SEO: страница для каждой сущности

**Описание:** Создать публичные страницы /entity/[slug] с базовой информацией (название, страна, тип, статус) + CTA на полные данные. 14,090 страниц = massive long-tail SEO. «Binance Holdings regulatory status» ищут реальные люди. Модель Crunchbase / Glassdoor.

**Ожидаемый эффект:** High — органический трафик x10-50 за 3-6 месяцев.
**Трудоёмкость:** Medium — SSR/pre-rendering для GitHub Pages (или переход на Vercel/Cloudflare Pages).
**Приоритет:** 9

---

### 74. Blog с regulatory analysis articles

**Описание:** Еженедельные статьи: «MiCA Implementation: What Changes for CASPs in Q3 2026», «UAE vs Singapore: Where to Register Your Stablecoin.» SEO + thought leadership + email capture. Модель Ahrefs Blog (40% their total traffic).

**Ожидаемый эффект:** High — organic traffic + brand authority + lead generation.
**Трудоёмкость:** Medium — content creation pipeline (может быть AI-assisted).
**Приоритет:** 7

---

### 75. «Jurisdiction Guide» формат для SEO

**Описание:** Длинные (3000+ слов) гайды: «Complete Guide to Stablecoin Regulation in the EU (2026)». Каждый гайд таргетирует высокочастотные запросы. Бесплатный доступ к гайду, gate на underlying data. Модель Investopedia / NerdWallet guides.

**Ожидаемый эффект:** High — SEO authority building, top-of-funnel acquisition.
**Трудоёмкость:** Medium — content creation, one-time per jurisdiction.
**Приоритет:** 7

---

### 76. Glossary / Encyclopedia of stablecoin regulatory terms

**Описание:** Страница /glossary с определениями: MiCA, CASP, EMI, VASP, Travel Rule, FATF, etc. Каждый термин — отдельный URL. Low-competition long-tail SEO. Internal linking к юрисдикциям и сущностям. Модель Investopedia dictionary.

**Ожидаемый эффект:** Medium — SEO foundation + educational content.
**Трудоёмкость:** Low — static content, можно генерировать из существующих данных.
**Приоритет:** 6

---

### 77. «Data Snippet» embeds для медиа и аналитиков

**Описание:** Embeddable виджеты с данными RemiDe: «Number of licensed VASPs in EU — updated daily.» Журналисты и аналитики встраивают в свои статьи. Каждый embed — обратная ссылка + brand exposure. Модель Statista embed / Our World in Data.

**Ожидаемый эффект:** Medium — backlinks + brand awareness + organic traffic.
**Трудоёмкость:** Medium — embed generator, iframe/JS snippet.
**Приоритет:** 5

---

### 78. LinkedIn content strategy

**Описание:** Ежедневные посты с insights из данных: «Today: 3 new VASP licenses issued globally. 2 in EU, 1 in UAE. MiCA adoption accelerates.» С ссылкой на RemiDe. LinkedIn — основная B2B платформа для compliance audience. 3 поста/неделю.

**Ожидаемый эффект:** Medium — top-of-funnel awareness в целевой аудитории.
**Трудоёмкость:** Low — automated data extraction + manual posting.
**Приоритет:** 7

---

### 79. «Regulatory Map» инфографика для social sharing

**Описание:** Ежемесячная инфографика: карта мира с цветовой кодировкой regulatory status по стейблкоинам. Shareable в Twitter/LinkedIn. Watermark «Source: RemiDe.xyz.» Модель Chainalysis Geography of Crypto annual map.

**Ожидаемый эффект:** Medium — viral potential + brand building.
**Трудоёмкость:** Low-Medium — automated map generation из существующих данных.
**Приоритет:** 6

---

### 80. «Stablecoin Regulation Newsletter» на Substack/Beehiiv

**Описание:** Еженедельная рассылка: последние изменения, новые лицензии, enforcement. Бесплатная, но ведёт на RemiDe для deep-dive. Модель The Information / Morning Brew для регуляторного пространства. Email list — актив для long-term conversion.

**Ожидаемый эффект:** High — email list building, nurturing, conversion pipeline.
**Трудоёмкость:** Medium — content creation + email platform setup.
**Приоритет:** 7

---

## 9. SOCIAL PROOF И TRUST SIGNALS (Scenarios 81–85)

### 81. Live counter: «14,090 entities tracked across 207 jurisdictions»

**Описание:** Динамический счётчик на лендинге, обновляемый в реальном времени из Supabase. Показывает масштаб данных. «Updated 4 minutes ago.» Демонстрирует, что платформа живая и данные свежие.

**Ожидаемый эффект:** Medium — immediate trust signal.
**Трудоёмкость:** Low — API endpoint + UI component.
**Приоритет:** 8

---

### 82. «Trusted by» логотипы (даже бесплатных пользователей)

**Описание:** Если пользователи с корпоративных доменов (@deloitte.com, @binance.com) зарегистрированы — показать логотипы. «Used by professionals from:» + лого. С разрешения или generic «Big 4 firms, Top 10 exchanges.» Модель каждого B2B SaaS landing page.

**Ожидаемый эффект:** High — social proof от узнаваемых брендов.
**Трудоёмкость:** Low — статические логотипы + доменная проверка.
**Приоритет:** 8

---

### 83. Testimonial quotes от beta users

**Описание:** Собрать 3-5 отзывов от первых пользователей (даже бесплатных): «RemiDe saved me hours of manual research comparing VASP licensing requirements.» Имя, должность, компания. Или anonymous: «Senior Compliance Officer, Global Bank.»

**Ожидаемый эффект:** Medium — trust + social proof.
**Трудоёмкость:** Low — outreach + UI placement.
**Приоритет:** 7

---

### 84. «Data Sources» transparency page

**Описание:** Публичная страница /data-sources с перечислением всех регуляторных органов, из которых берутся данные: ESMA, FCA, MAS, AUSTRAC, BaFin... (49+ парсеров). Показывает, что данные из первоисточников, а не агрегаторов. Модель Our World in Data sources page.

**Ожидаемый эффект:** Medium — trust для research-oriented пользователей.
**Трудоёмкость:** Low — статическая страница.
**Приоритет:** 6

---

### 85. Security & compliance badges

**Описание:** Показать на сайте: «Data stored in EU (Supabase)», «GDPR Compliant», «SOC 2 in progress» (если актуально). Для compliance-аудитории это критически важно — они не будут использовать инструмент, который сам не compliant.

**Ожидаемый эффект:** Medium — trust barrier removal для regulated entities.
**Трудоёмкость:** Low-Medium — policy pages, badges.
**Приоритет:** 6

---

## 10. UX И СНИЖЕНИЕ FRICTION (Scenarios 86–90)

### 86. Instant search с автокомплитом

**Описание:** Global search bar на каждой странице: начинаешь вводить «Bin...» — выпадает «Binance Holdings (UAE, Active License), Binance.US (US, Pending).» Instant results без перезагрузки страницы. Модель Algolia / Spotlight search.

**Ожидаемый эффект:** High — улучшение discoverability и UX.
**Трудоёмкость:** Medium — search index, autocomplete UI.
**Приоритет:** 7

---

### 87. Breadcrumb navigation: Home > Jurisdictions > UAE > Licensed Entities

**Описание:** Чёткая навигация с breadcrumbs на каждой странице. Пользователи часто приходят из поиска Google на глубокие страницы — breadcrumbs помогают ориентироваться. Уменьшает bounce rate. SEO-бонус (structured data).

**Ожидаемый эффект:** Low-Medium — снижение bounce rate, улучшение UX.
**Трудоёмкость:** Low — UI component.
**Приоритет:** 5

---

### 88. «Loading skeleton» вместо спиннеров

**Описание:** При загрузке данных показывать skeleton screens (как LinkedIn/Facebook) вместо спиннеров. Perceived performance увеличивается на 40%. Критично для SPA на GitHub Pages, где API-запросы к Supabase могут занимать 1-2 секунды.

**Ожидаемый эффект:** Low-Medium — улучшение perceived performance.
**Трудоёмкость:** Low — CSS skeleton components.
**Приоритет:** 4

---

### 89. Keyboard shortcuts для power users

**Описание:** «/» — focus search, «j/k» — navigate list, «Enter» — open entity, «Esc» — close modal. Power users (compliance officers) работают быстро и ценят keyboard navigation. Модель Gmail / Notion / VS Code.

**Ожидаемый эффект:** Low — retention power users.
**Трудоёмкость:** Low — keyboard event listeners.
**Приоритет:** 3

---

### 90. Dark mode

**Описание:** Опциональный тёмный режим. Compliance-офицеры часто работают допоздна с множеством мониторов. Dark mode снижает eye strain. Также сигнализирует «современный продукт» для crypto-аудитории. Модель — стандарт для всех SaaS в 2026.

**Ожидаемый эффект:** Low — quality of life, brand perception.
**Трудоёмкость:** Medium — CSS variables, theme toggle.
**Приоритет:** 3

---

## 11. АНАЛИТИКА И DATA-DRIVEN ОПТИМИЗАЦИЯ (Scenarios 91–93)

### 91. Event tracking: каждый paywall hit, каждый signup attempt

**Описание:** Umami уже интегрирован. Добавить custom events: paywall_shown, paywall_clicked, signup_started, signup_completed, trial_started, trial_converted, export_attempted. Воронка конверсии на каждом шаге. Нельзя оптимизировать то, что не измеряешь.

**Ожидаемый эффект:** High — foundation для всех других оптимизаций.
**Трудоёмкость:** Low — Umami event tracking API calls.
**Приоритет:** 10

---

### 92. Cohort analysis: какие юрисдикции конвертируют лучше

**Описание:** Анализировать: пользователи, которые начали с UAE конвертируются в 2x чаще, чем начавшие с generic list. Продвигать high-converting entry points. Настроить UTM-параметры для разных каналов.

**Ожидаемый эффект:** Medium — data-driven marketing decisions.
**Трудоёмкость:** Medium — analytics pipeline, reporting.
**Приоритет:** 6

---

### 93. Heatmap на paywall-страницах

**Описание:** Добавить Microsoft Clarity (бесплатно) для heatmaps и session recordings на страницах с paywall. Увидеть, где пользователи кликают, сколько скроллят до CTA, какие элементы игнорируют. Модель Hotjar / Crazy Egg.

**Ожидаемый эффект:** Medium — insights для UX-оптимизации paywall.
**Трудоёмкость:** Low — embed Clarity script.
**Приоритет:** 7

---

## 12. ПАРТНЁРСТВА И КАНАЛЫ (Scenarios 94–96)

### 94. Интеграция с AML/KYC провайдерами (Chainalysis, Elliptic, Sumsub)

**Описание:** API-интеграция: KYC-провайдер проверяет клиента -> запрашивает RemiDe: «Есть ли у этой компании лицензия в [юрисдикции]?» Это B2B2B канал — каждый клиент KYC-провайдера потенциально использует данные RemiDe. Revenue share модель.

**Ожидаемый эффект:** High — масштабируемый B2B канал.
**Трудоёмкость:** High — API development, partnerships, integration.
**Приоритет:** 6

---

### 95. Co-marketing с legal firms

**Описание:** Партнёрство с crypto-юридическими фирмами (Simmons & Simmons, DLA Piper, Baker McKenzie): RemiDe предоставляет данные, фирма — экспертизу. Совместные вебинары, reports. Фирма рекомендует RemiDe клиентам. Модель HubSpot Solutions Partners.

**Ожидаемый эффект:** Medium — lead generation + credibility.
**Трудоёмкость:** Medium — partnership outreach, co-branded content.
**Приоритет:** 5

---

### 96. Affiliate program для compliance consultants

**Описание:** Compliance-консультанты рекомендуют RemiDe клиентам, получают 20% recurring commission. Консультанты — trusted advisors для VASP. Их рекомендация = highest conversion rate. Модель Ahrefs / Semrush affiliate.

**Ожидаемый эффект:** Medium — low-CAC acquisition channel.
**Трудоёмкость:** Medium — affiliate tracking, payout system.
**Приоритет:** 5

---

## 13. ENTERPRISE SALES (Scenario 97–98)

### 97. «Book a Demo» CTA для enterprise

**Описание:** Кнопка «Book a Demo» на pricing page и enterprise tier. Ведёт на Calendly/Cal.com. Для enterprise клиентов ($500+/мес) personal demo увеличивает конверсию в 5-10x. Показать custom dashboards, API capabilities, data depth.

**Ожидаемый эффект:** High — enterprise conversion.
**Трудоёмкость:** Low — Calendly embed + CTA.
**Приоритет:** 8

---

### 98. Outbound sales по компаниям с corporate email signups

**Описание:** Когда пользователь с @hsbc.com регистрируется — автоматический LinkedIn Sales Navigator alert для sales outreach. Персонализированное письмо: «I noticed your colleague at HSBC is using RemiDe for regulatory tracking...» Модель Slack/Figma bottom-up enterprise.

**Ожидаемый эффект:** High — enterprise pipeline.
**Трудоёмкость:** Medium — enrichment, CRM, outreach templates.
**Приоритет:** 6

---

## 14. API MONETIZATION (Scenario 99)

### 99. Public REST API с документацией на Swagger/OpenAPI

**Описание:** Полноценный REST API: /api/v1/entities, /api/v1/jurisdictions, /api/v1/stablecoins. Swagger UI документация. Rate limiting по тарифу. Developer-facing landing page. RegTech-компании интегрируют данные RemiDe в свои продукты. Модель Crunchbase API / PitchBook Data API.

**Ожидаемый эффект:** High — масштабируемый B2B revenue, platform play.
**Трудоёмкость:** High — API gateway, auth, documentation, rate limiting.
**Приоритет:** 7

---

## 15. COMPETITIVE DIFFERENTIATION (Scenario 100)

### 100. «Regulatory Timeline» — визуализация эволюции регулирования по стране

**Описание:** Интерактивный timeline для каждой юрисдикции: когда приняли первый закон о крипто, когда ввели лицензирование, когда обновили framework, enforcement actions. Визуальная history регулирования. Ни у одного конкурента этого нет. Данные: stablecoin_laws (132 записи) + stablecoin_events (102 записи). Модель FATF Mutual Evaluation timeline.

**Ожидаемый эффект:** High — уникальная feature, SEO-магнит, premium value.
**Трудоёмкость:** Medium — timeline UI component + data formatting.
**Приоритет:** 7

---

## СВОДНАЯ ТАБЛИЦА ПРИОРИТЕТОВ (Top-20)

| # | Сценарий | Приоритет | Эффект | Трудоёмкость |
|---|----------|-----------|--------|--------------|
| 91 | Event tracking в Umami | 10 | High | Low |
| 1 | Трёхуровневая тарифная сетка | 10 | High | Medium |
| 5 | Freemium с лимитом просмотров | 9 | High | Medium |
| 10 | 14-дневный триал без карты | 9 | High | Low |
| 16 | Прогрессивный блюр | 9 | High | Low |
| 17 | Контекстный CTA на каждой секции | 9 | High | Low |
| 26 | «Showing X of Y entities» teaser | 9 | High | Low |
| 42 | Paywall с preview data points | 9 | High | Low |
| 70 | Contextual upsell при лимитах | 9 | High | Low |
| 73 | Programmatic SEO (14K entity pages) | 9 | High | Medium |
| 2 | Годовая подписка -20% | 8 | Medium | Low |
| 15 | Founder's Pricing | 8 | Medium | Low |
| 19 | Email gate lead magnet (PDF) | 8 | High | Medium |
| 22 | Comparison table Free vs Paid | 8 | Medium | Low |
| 23 | Onboarding по роли | 8 | High | Medium |
| 25 | Social login | 8 | Medium | Low |
| 28 | Compare jurisdictions feature | 8 | High | Medium |
| 41 | Smart paywall по поведению | 8 | High | Medium |
| 51 | Welcome tour 3 действия | 8 | High | Medium |
| 59 | Regulatory Change Alerts | 8 | High | High |
| 67 | Data Export как premium | 8 | Medium | Low |
| 81 | Live counter entities | 8 | Medium | Low |
| 82 | «Trusted by» логотипы | 8 | High | Low |
| 97 | Book a Demo CTA | 8 | High | Low |

---

## РЕКОМЕНДУЕМЫЙ ПОРЯДОК РЕАЛИЗАЦИИ

### Фаза 1: «Foundation» (1-2 недели)
Минимальные изменения с максимальным ROI — всё Low effort:
- **#91** Event tracking (без данных нет оптимизации)
- **#16** Прогрессивный блюр (замена бинарного)
- **#17** Контекстный CTA на секциях
- **#26** «Showing X of Y» teaser
- **#42** Preview data points в paywall
- **#81** Live counter на лендинге
- **#82** «Trusted by» логотипы
- **#22** Comparison table
- **#97** Book a Demo CTA

### Фаза 2: «Monetization» (2-4 недели)
Запуск платежей:
- **#1** Тарифная сетка (Stripe интеграция)
- **#10** 14-дневный триал
- **#5** Freemium с лимитами
- **#25** Social login
- **#15** Founder's Pricing (первые 100 клиентов)
- **#67** Export как premium feature
- **#70** Contextual upsell prompts

### Фаза 3: «Growth» (1-2 месяца)
Масштабирование:
- **#73** Programmatic SEO (entity pages)
- **#19** Lead magnet PDF
- **#23** Onboarding по роли
- **#28** Compare jurisdictions
- **#41** Smart paywall
- **#59** Regulatory alerts
- **#78** LinkedIn content strategy

### Фаза 4: «Scale» (3-6 месяцев)
Enterprise и API:
- **#99** Public API
- **#7** Team plans
- **#94** Интеграции с KYC-провайдерами
- **#38** Risk Score
- **#100** Regulatory Timeline
- **#40** White-label
