# Архитектура игры «Управление своей кофейней» (Yandex Games)

## 1) Рекомендуемый стек

- **TypeScript** — типобезопасность и поддержка долгой разработки.
- **Phaser 3** — 2D runtime/scene lifecycle/input для web + mobile.
- **JSON-конфиги** — data-driven баланс и контент.
- **Vite** (на следующем шаге) — быстрый dev server/build.

## 2) Слои системы

### Core (чистая логика)
- Экономика, расчёт доходов/ROI.
- Симуляция клиентского потока.
- Производственные очереди станций.
- Апгрейды, персонал, unlock-правила.
- Оффлайн-прогресс и save-миграции.
- Не зависит от Phaser и SDK платформы.

### Game/Application Layer
- Жизненный цикл игры и оркестрация модулей.
- Игровой tick (fixed step), event bus.
- Синхронизация Core State -> Presentation State.

### Presentation Layer
- Phaser scenes, HUD, панели апгрейдов/офферов.
- ViewModel-представление чисел/статусов для UI.
- Анимации прогресса, денег, unlock-событий.

### Platform Layer
- Адаптер Яндекс Игр SDK через интерфейс `IPlatformAdapter`.
- Ads, IAP, save backend, analytics.
- Обработка unavailable/fail-state платформенных вызовов.

### Content/Data Layer
- Конфиги экономики, станций, клиентов, апгрейдов, unlock.
- Версионирование данных и валидация схем.

## 3) Модульная схема (упрощённо)

1. `GameApp` получает `deltaTime`.
2. `SimulationEngine` обновляет Core системы.
3. Core публикует доменные события (`money_earned`, `upgrade_bought`, `zone_unlocked`).
4. `UIStateStore` собирает snapshot для экранов.
5. Presentation подписывается на store/event bus.
6. Монетизация/покупки идут через `PlatformServices` -> `IPlatformAdapter`.

## 4) Game State (единый источник правды)

Корневое состояние: `GameState`.

- `player`: валюты, бусты, покупки, мета-прогресс.
- `cafe`: станции, зоны, очередь клиентов, сервисные множители.
- `progress`: туториал, milestone-флаги, unlock-статусы.
- `timing`: lastActiveTimestamp, session stats.
- `version`: версия save/schema.

Хранение: immutable snapshot + controlled reducers/commands в Core.

## 5) Основные сущности

- `PlayerState` — кошелёк, премиум, ад-бонусы, перки.
- `CafeState` — активные станции, ёмкость, throughput, menu tiers.
- `StationState` — level, queue, processTime, modifiers.
- `CustomerState` — archetype, patience, orderValue, waitTimer.
- `UpgradeState` — текущие уровни и доступность.
- `StaffState` — найм, назначение на станции, эффективность.
- `MetaProgressState` — престиж-очки/постоянные бонусы.
- `SaveData` — сериализуемая версия `GameState` + метаинфо.
- `OfferConfig` / `AdRewardConfig` / `IapProductConfig` — монетизация.

## 6) Data flow ключевых сценариев

### Покупка апгрейда
1. UI -> `BuyUpgradeCommand(upgradeId)`.
2. Core `UpgradeSystem` проверяет preconditions/цены.
3. `EconomySystem` списывает валюту.
4. Применяется эффект в `CafeState`/`StationState`.
5. Публикуются события `upgrade_bought`, `economy_changed`.

### Rewarded ad
1. UI вызывает `MonetizationService.requestRewarded(rewardId)`.
2. Через `IPlatformAdapter.showRewardedAd`.
3. На success Core получает `GrantRewardCommand`.
4. Выдача буста/валюты + аналитика `ad_reward_granted`.

### Оффлайн доход
1. При resume берём `now - lastActiveTimestamp`.
2. Ограничиваем `maxOfflineSeconds` из конфига.
3. `OfflineProgressService` считает доход из текущего throughput.
4. Выдаём итог и логируем `offline_income_granted`.

## 7) Формат конфигов

Основные JSON-таблицы в `src/data/configs/`:

- `economy.json` — базовые коэффициенты дохода и inflation curves.
- `stations.json` — станции, этапы производства, скейлинг параметров.
- `customers.json` — archetypes, spawn weights, patience/value профили.
- `upgrades.json` — эффекты, цены по уровням, unlock conditions.
- `zones.json` — расширение пространства и гейты.
- `monetization.json` — rewarded, IAP продукты, ad cooldowns.

## 8) MVP scope

Включить:
- 1 локацию/кофейню.
- 1 базовый loop клиентов.
- 3 логические станции: касса, эспрессо, выдача.
- 3 ветки апгрейдов: скорость, чек, поток.
- 1 soft currency.
- 1 rewarded ad (например x2 income на 3–5 мин).
- save/load + offline income.
- базовый onboarding.

Исключить из MVP:
- multi-location,
- сложные liveops,
- расширенный персонал/декор,
- глубокая meta-экономика.

## 9) Масштабирование после MVP

- Новые зоны + menu category (выпечка/десерты).
- Персонал и полуавтоматизация.
- Prestige/reset-lite слой.
- Season events и time-limited offers.
- A/B параметров экономики через remote-config (следующий этап).

## 10) Риски и снижение

- **Производительность mobile**: фиксированный tick, batching UI updates, object pooling.
- **Разрастание экономики**: data-driven curves + автотесты sanity-check по ROI.
- **Ломкие сейвы**: versioned schema + migrations + safe defaults.
- **UX перегрузка**: progressive disclosure UI, минимум текста, приоритет CTA.
- **SDK нестабильность**: fallback-адаптер и явные error states в Platform Layer.

