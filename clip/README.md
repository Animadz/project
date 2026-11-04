# BONFIRE LIT — процедурный клип

Видеоряд к треку по Dark Souls (первая часть). Вся графика рисуется кодом на Canvas: никаких ассетов из игры, только оригинальные силуэты, огонь, частицы, свет и кинетическая типографика.

## Как устроено
- `data/lyrics.srt` — текст с таймингами (вытащен из субтитров внутри m4a).
- `tools/analyze.py` — анализ аудио (librosa): темп ~96 BPM, доли, удары баса, громкость по кадрам.
- `tools/build_data.py` — упаковывает анализ и текст в `data/data.js`.
- `scene.js` — весь клип. Каждый кадр — чистая функция времени `renderFrame(t)`; сцены, тряска, вспышки, зум и частицы привязаны к долям и бочке.
- `render.mjs` — headless Chromium рисует кадры, ffmpeg кодирует (параллельно в 4 потока), затем подмешивается звук.

## Сцены
| Время | Сцена |
|---|---|
| 0:00 | Титры, «имя в огне», DARK SOULS |
| 0:12 | Полёт через тёмный склеп к свету |
| 0:25 | Выбор класса, маг перечёркнут, меч/щит/броня в бит, полые, трещина «обломался» |
| 0:45 | Огонёк во тьме |
| 0:57 | BONFIRE LIT — смерть и воскрешение, HUMANITY RESTORED |
| 1:23 | Босс-демон, перекат ×500, эстус 0, YOU DIED, «Снова ×4», контроллер, паттерн, удар |
| 1:43 | Золотой город на закате, крыши, лучники, падения, «ТВОЮ МАТЬ» |
| 2:05 | Фантом-маг с белым флагом снимает на камеру (REC) |
| 2:18 | Дуэт: молния против молота, стены сходятся |
| 2:28 | Красный туннель ярости → тишина, одна искра |
| 2:42 | Финальный припев: рассвет, меч к солнцу |
| 3:07 | YOU DIED… VICTORY ACHIEVED |

## Рендер
```bash
pip install librosa numpy scipy soundfile
python3 tools/analyze.py track.wav analysis.json      # wav: ffmpeg -i track.m4a -ac 1 -ar 22050 track.wav
python3 tools/parse_srt.py data/lyrics.srt lyrics.json
python3 tools/build_data.py analysis.json lyrics.json data/data.js
node render.mjs --stills 8.6,58,92.6 --out stills/          # кадры на проверку
node render.mjs --audio track.m4a --out clip.mp4 --workers 4 --crf 20
```
Нужны Node + Playwright (Chromium) и ffmpeg. Чтобы посмотреть вживую, откройте `index.html` через любой локальный сервер и в консоли вызовите `renderFrame(60)`.
