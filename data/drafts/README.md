# Как заполнять заготовки

Здесь лежат предметы, которые ещё не в игре. Пока файл лежит в этой папке,
сборка его не видит вообще. Он попадает в игру только командой `promote`, и
только если прошёл проверку.

## Проще всего — форма

```bash
python3 tools/verify_ui.py
```

Откроется `http://127.0.0.1:8765` — слева очередь, справа форма. Адресаты там
чекбоксами, построенными из `data/places.json`, поэтому опечатку в
идентификаторе контейнера сделать нечем. Ошибки проверки показываются под
формой сразу, кнопка «сохранить и перенести в игру» не сработает, пока предмет
их не пройдёт. Файлы пишутся те же самые — форма это просто редактор поверх
JSON, а не отдельное хранилище.

Форма слушает только 127.0.0.1 и наружу не смотрит.

Ниже — то же самое руками, если редактор ближе.

## Что делать, по шагам

**Шаг 1. Посмотреть очередь.**

```bash
python3 tools/drafts.py list
```

Показывает все заготовки и чего в каждой не хватает.

**Шаг 1а. Один раз — попросить машину предложить очевидное.**

```bash
python3 tools/drafts.py propose
```

Там, где адресат AWM однозначно отображается на контейнер игры (Restmüll, Papier,
Bio, Altkleider, Sperrmüll, Problemabfall), поле `destinations` заполнится само, и
в файле появится пометка `_destinations_proposed`. Wertstoffhof и Wertstoffinsel
держат по нескольку контейнеров — там выбор остаётся за вами.

Это предложение, а не сверка: подпись под ним всё равно ставите вы, открыв
страницу. Если прочитали и не согласны — исправьте.

**Шаг 2. Открыть один файл.** Например `data/drafts/backpapier.json`.
Берите по одному, не пытайтесь заполнить всё сразу.

**Шаг 3. Открыть ссылку из поля `source.url`** и прочитать запись на сайте AWM.
Именно страницу, не только то, что уже подставлено в файл: подстановка сделана
машиной по снимку и нужна только чтобы вы не искали руками.

**Шаг 4. Заполнить пять мест в файле.** Всё, что начинается с подчёркивания
(`_todo`, `_awm_tip`, `_awm_notes`), — подсказки для вас, их править не нужно,
в игру они не попадут.

1. `labels.en` — английское название предмета.
2. `variants[0].labels` — как вариант называется. Если вариант один и он
   очевиден, напишите то же, что в названии, или короткое уточнение.
3. `variants[0].destinations` — **куда предмет идёт в игре**. Это идентификаторы
   контейнеров из `data/places.json`, а не адресаты AWM. Список допустимых:
   `restmuell`, `papier`, `bio`, `gelbe_tonne`,
   `pfandautomat`, `batteriebox`, `elektro_ruecknahme`,
   `glas_weiss`, `glas_gruen`, `glas_braun`, `altkleider`, `lvp`,
   `elektroschrott`, `batterien`, `sperrmuell`,
   `giftmobil`, `problemstoffannahme`.
   Если правильных мест несколько — перечисляйте все, игра засчитает любое и
   назовёт остальные.
4. `explanation.de` и `explanation.en` — почему так. Одно-два предложения.
   Если по-немецки писать не хочется, напишите по-русски в поле `_note_ru`, а
   немецкий и английский текст сделаю я.
5. `source.verified_by` — ваше имя, `source.verified_on` — сегодняшняя дата в
   виде `2026-08-24`.

Если в файле есть блок `sources` (второй источник — норма закона), подпись
нужна и там: этот предмет возвращают в магазин по федеральному закону, и это
отдельное утверждение, отдельно подтверждаемое.

**Шаг 5. Перенести в игру.**

```bash
python3 tools/drafts.py promote backpapier
```

Не пройдёт проверку — скажет, что именно не так, и файл останется здесь.

**Шаг 6. Убедиться, что сборка чистая.**

```bash
python3 tools/build_data.py --check
```

## Как выглядит заполненный файл

До:

```json
  "labels": { "de": "Backpapier", "en": "" },
  "variants": [
    { "id": "standard", "kind": "simple",
      "labels": { "de": "", "en": "" }, "destinations": [] }
  ],
  "explanation": { "de": "", "en": "" },
  "source": { ..., "verified_by": "", "verified_on": "" }
```

После:

```json
  "labels": { "de": "Backpapier", "en": "Baking paper" },
  "variants": [
    { "id": "standard", "kind": "simple",
      "labels": { "de": "beschichtet", "en": "coated" },
      "destinations": ["restmuell"] }
  ],
  "explanation": {
    "de": "Backpapier ist mit Silikon beschichtet und lässt sich nicht recyceln.",
    "en": "Baking paper is silicone-coated and cannot be recycled."
  },
  "source": { ..., "verified_by": "sergei", "verified_on": "2026-08-24" }
```

`destinations` здесь — то, что подсказывает снимок. Подтвердить его должны вы,
открыв страницу: снимок выведен машиной и ошибается ровно там, где ошибку
труднее всего заметить.

## Стенд для разработки движка

Пока предметы не подписаны, игру всё равно надо на чём-то отлаживать:

```bash
python3 tools/build_data.py --fixtures
```

Такая сборка берёт черновики без подписей, помечает каждый предмет
`"unverified": true`, а всю сборку — `"fixture": true`. Выложить её нельзя:
`publish.py` откажется. Это стенд, а не релиз.

## Чего делать не нужно

- Не заполнять `destinations_at_verification` — это слепок ответа AWM на день
  сверки, его ставит инструмент, и по нему потом ловится изменение правил.
- Не ставить `verified_on`, не открыв страницу. Проверка кода этого не поймает —
  на этом месте держится вся ценность проекта.
- Не редактировать поля с подчёркиванием.

## Если предмета нет в лексиконе

Так бывает: залоговой тары в Abfalllexikon нет вообще, потому что это не мусор.
Такая заготовка создаётся отдельно и ссылается на закон:

```bash
python3 tools/drafts.py new-law --id pfandflasche_einweg --tier 2 \
  --term "Einwegflasche mit Pfand (PET)" --reference "VerpackG § 31" \
  --url "https://www.gesetze-im-internet.de/verpackg/__31.html"
```

## Новая заготовка из лексикона

```bash
python3 tools/drafts.py new zeitung-zeitschrift-illustrierte --tier 1 --id zeitung
python3 tools/drafts.py new batterien-knopfzellen --tier 2 --id batterien \
  --law "BattG § 9" --law-url "https://www.gesetze-im-internet.de/battg/__9.html"
```

Ключ — это поле `key` в снимке `data/verified/lexikon-*.json`. Ошибётесь в
ключе — инструмент предложит похожие.
