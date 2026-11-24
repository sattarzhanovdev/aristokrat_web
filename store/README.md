# Публикация «Аристократ» в Google Play и App Store

Всё, что нужно для заливки, лежит в этой папке. Тексты ниже укладываются в лимиты магазинов (символы посчитаны).

```
store/
  google-play/
    app-release.aab        — подписанная сборка для Google Play
    icon-512.png           — значок 512×512
    feature-graphic.png    — баннер 1024×500
    screenshots/           — 1080×1920, PNG без прозрачности
  app-store/
    icon-1024.png          — значок 1024×1024 без прозрачности (уже в Xcode-проекте)
    screenshots/           — iPhone 6.9″ 1320×2868, PNG без прозрачности
```

## Что уже сделано в проекте

- **Capacitor 8, targetSdk 36 (Android 16)**. С 31 августа 2026 Google Play принимает новые приложения и обновления только с API 36. minSdk 24.
- **Edge-to-edge**: с Android 16 отключить его нельзя; отступы под статус-бар и жестовую панель приходят из Capacitor SystemBars (`--safe-area-inset-*`).
- **Подпись**: upload-ключ `android/aristokrat-upload.jks`, пароли — в `android/keystore.properties`. Оба файла в `.gitignore`. **Сохраните их в надёжное место (менеджер паролей + резервная копия).** Без ключа нельзя выпустить обновление; если ключ потерян, сброс upload-ключа делается через поддержку Google Play.
- **Резервные копии**: `allowBackup=false` и `data_extraction_rules.xml` — сессия входа не уезжает в облако и на другое устройство.
- **Иконки и сплэш**: заглушки Capacitor заменены на фирменный значок (адаптивная иконка + monochrome для тематических иконок Android 13+), сплэш — фирменный синий.
- **iOS**: deployment target 15.0, только iPhone (iPad-скриншоты не нужны), только портрет, `ITSAppUsesNonExemptEncryption = NO` (используется только HTTPS — экспортная декларация не нужна), `PrivacyInfo.xcprivacy` с перечнем собираемых данных, `arm64`.
- **Политика конфиденциальности**: `public/privacy.html` → после деплоя фронта будет по адресу `https://aristokrat-app.netlify.app/privacy.html`.

## Что сделать вам

1. **Добавить в политику контакт** (e-mail и/или телефон управляющей компании) в разделы «Ваши права» и «Контакты» — магазины требуют, чтобы с оператором данных можно было связаться. Задеплоить фронт.
2. **Создать аккаунт для проверки** на рабочем сервере: житель без паркинга (`has_parking = false`), например логин `appreview`. Иначе проверяющий нажмёт кнопку и откроет настоящий шлагбаум. Логин и пароль вписать в формы ниже.
3. **iOS-сборку** делаете на Mac с Xcode 26+: `npm run build && npx cap sync ios`, затем `cd ios/App && pod install`, открыть `App.xcworkspace`, выбрать команду (Signing & Capabilities → Team), Product → Archive → Distribute App → App Store Connect.

---

## Google Play

### Карточка

| Поле | Значение |
|---|---|
| Название (≤30) | `Аристократ — жителям ЖК` |
| Краткое описание (≤80) | `Шлагбаум, паркинг и счета ЖК «Аристократ» — в одном приложении` |
| Категория | Дом и семья (House & Home) |
| Теги | Управление недвижимостью, Утилиты |
| E-mail для связи | e-mail управляющей компании |
| Политика конфиденциальности | `https://aristokrat-app.netlify.app/privacy.html` |

**Полное описание (≤4000):**

```
«Аристократ» — официальное приложение для жителей ЖК «Аристократ».

ШЛАГБАУМ И ПАРКИНГ
• Открывайте шлагбаум и ворота паркинга одной кнопкой — без пультов и звонков.
• Видно, какие въезды доступны именно вам.

СЧЕТА
• Все счета управляющей компании в одном месте: паркинг, обслуживание и другие.
• Сумма, срок оплаты и статус каждого счёта.
• Напоминание, когда срок подходит к концу.
• История оплат.

ОПЛАТА
• Оплачивайте счета онлайн — после оплаты доступ открывается автоматически.
• Если по счёту предусмотрено ограничение при просрочке, приложение заранее предупредит и покажет, что нужно оплатить.

ДЛЯ ЖИТЕЛЕЙ
Вход по логину и паролю, которые выдаёт управляющая компания ЖК «Аристократ». Регистрации в приложении нет. Если у вас ещё нет доступа — обратитесь в управляющую компанию.
```

### Play Console → App content (Содержание приложения)

| Раздел | Ответ |
|---|---|
| Privacy policy | ссылка выше |
| App access | **All or some functionality is restricted** → инструкция: «Приложение только для жителей ЖК. Войдите: логин `appreview`, пароль `…`. Кнопки шлагбаума у этого аккаунта отключены.» |
| Ads | No, my app does not contain ads |
| Content rating (IARC) | Категория «Utility, Productivity, Communication, or Other»; на все вопросы о насилии, сексе, языке, наркотиках, азартных играх — No; обмен данными между пользователями — No; покупки цифровых товаров — No → рейтинг «Для всех / 3+» |
| Target audience | 18 и старше |
| News app | No |
| COVID-19 contact tracing | No |
| Government app | No |
| Financial features | My app doesn't provide any financial features (оплата счетов за услуги ЖК через страницу банка — это не финансовый продукт) |
| Health | No |
| Data safety | см. ниже |

### Data safety

- Собираются ли данные: **Да**. Передаются третьим лицам: **Нет** (платёжная система — обработчик по поручению, это не «sharing»).
- Шифрование при передаче: **Да**. Можно запросить удаление: **Да** (через управляющую компанию).

| Тип данных | Собирается | Обязательно | Цель |
|---|---|---|---|
| Personal info → Name | Да | Да | App functionality, Account management |
| Personal info → Address (номер квартиры) | Да | Да | App functionality |
| Personal info → Phone number | Да | Нет | Account management |
| Personal info → User IDs (логин) | Да | Да | Account management |
| Financial info → Purchase history (счета и оплаты) | Да | Да | App functionality |
| App activity → Other actions (открытие шлагбаума) | Да | Да | App functionality |

Номер автомобиля укажите как Personal info → Other info.

### Выпуск

1. **Новый личный аккаунт разработчика** (создан после ноября 2023): перед публикацией нужен **закрытый тест: минимум 12 тестировщиков 14 дней подряд**. Аккаунт организации (с D-U-N-S) от этого освобождён.
2. Release → Testing → Closed testing → Create release → загрузить `app-release.aab`. Google Play App Signing включается автоматически — согласитесь.
3. Название выпуска: `1.0 (1)`. Что нового: `Первая версия: шлагбаум, паркинг, счета и онлайн-оплата.`
4. Графика: значок `icon-512.png`, баннер `feature-graphic.png`, скриншоты телефона — все из `screenshots/` (2–8 штук).

Для каждого следующего обновления увеличивайте `versionCode` в `android/app/build.gradle` (2, 3, …) и `versionName`.

### Как собрать новую AAB

Нужны Android Studio (Otter 2025.2.1+) или JDK 21 + Android SDK 36. Ключ и `keystore.properties` должны лежать в `android/`.

```bash
npm run build && npx cap sync android && cd android && ./gradlew bundleRelease
```

Готовый файл: `android/app/build/outputs/bundle/release/app-release.aab` (в git не попадает).

---

## App Store

### Карточка

| Поле | Значение |
|---|---|
| Name (≤30) | `Аристократ — жителям ЖК` |
| Subtitle (≤30) | `Шлагбаум, паркинг и счета` |
| Bundle ID | `kg.aristokrat.app` |
| SKU | `aristokrat-ios` |
| Primary category | Lifestyle |
| Secondary category | Utilities |
| Keywords (≤100) | `жк,шлагбаум,паркинг,парковка,ворота,счета,оплата,коммуналка,управляющая,бишкек,жильцы,дом` |
| Promotional text (≤170) | `Открывайте шлагбаум и паркинг, следите за счетами и оплачивайте их онлайн — доступ откроется сразу после оплаты.` |
| Support URL | сайт или страница управляющей компании (можно `https://aristokrat-app.netlify.app/privacy.html`, если другой нет) |
| Privacy Policy URL | `https://aristokrat-app.netlify.app/privacy.html` |
| Copyright | `2026 ЖК «Аристократ»` |
| Age rating | на все вопросы — None / No → **4+** |
| Price | Free |

Description — тот же текст, что для Google Play.

### App Privacy (App Store Connect → App Privacy)

Data used to track you: **No**. Все типы ниже — **Linked to the user**, назначение **App Functionality**:

- Contact Info → Name, Phone Number, Physical Address (номер квартиры)
- Identifiers → User ID
- Purchases → Purchase History
- Other Data → Other Data Types (номер авто, команды шлагбаума)

Это совпадает с `ios/App/App/PrivacyInfo.xcprivacy` — Apple сверяет их.

### App Review Information

- Sign-in required: **Yes** → логин `appreview`, пароль `…`.
- Notes (вставить как есть):

```
«Аристократ» is the private app for residents of the «Aristokrat» residential complex in Bishkek, Kyrgyzstan. Accounts are issued by the property management company; there is no in-app sign-up, so there is no account creation and no in-app account deletion flow (residents request deletion from the management company, see the privacy policy).

The demo account above is a resident without parking access, so the gate buttons are disabled and no real barrier will open during review.

Bills in the app are for real-world services of the residential complex (parking spaces, building maintenance). They are paid on the bank's payment page outside the app (Guideline 3.1.3(e) / 3.1.5(a)); there are no digital goods.
```

### Возможные замечания Apple и что отвечать

- **4.2 «Minimum functionality / веб-обёртка»**: приложение решает реальную задачу (физический доступ на территорию и в паркинг, счета), использует нативные возможности (тактильный отклик, нативный сплэш). Если всё же откажут — выберите **Unlisted App Distribution** (приложение доступно только по прямой ссылке; Apple сама рекомендует это для приложений одной организации).
- **5.1.1 «Требуется вход»**: допустимо — приложение предназначено только для жителей конкретного ЖК, учётные записи выдаёт управляющая компания.

### Скриншоты

`app-store/screenshots/*.png`, 1320×2868 (iPhone 6.9″). Apple сама масштабирует их на остальные размеры iPhone. iPad не нужен — приложение только для iPhone.
