# TaskFlow

Компактное desktop-like приложение для управления задачами дня в рамках проекта.
Совмещает три концепции в одном UI:

- **Workflowy** — бесконечный drilldown: любую задачу можно развернуть в подзадачи и «провалиться» (zoom in), сделав её временным корнем.
- **Things** — разделение по проектам, умные списки (Сегодня / Входящие / Предстоящее / Когда-нибудь / Журнал).

## Стек

- **TypeScript** + **React 18** + **Vite 5**
- **Zustand** + `persist` → localStorage (данные переживают перезагрузку)
- **Tailwind CSS 3** (CSS-переменные для тем)
- **@dnd-kit** для drag & drop задач
- **lucide-react** для иконок
- `date-fns`, `nanoid`, `clsx`, `tailwind-merge`

## Запуск

```bash
npm install
npm run dev       # http://localhost:5173
npm run typecheck # проверка TypeScript
npm run build     # prod-сборка в dist/
```

## Фичи

### Иерархия и навигация
- Неограниченная вложенность, сворачивание веток (chevron / `Space`-аналог через клик).
- **Zoom in/out** как в Workflowy: клик по bullet или иконке ↗ справа у строки → задача становится корнем, подзадачи — основным списком. Крошки сверху показывают путь.
- Проекты в сайдбаре справа с цветовой меткой и счётчиком активных задач.
- Smart-списки: Сегодня, Входящие, Предстоящее, Когда-нибудь, Журнал, Статистика.

### Ввод и редактирование
- Inline-редактирование названия (`contentEditable`).
- Быстрое добавление задач через поле внизу. Поддержка `#тега` прямо в тексте.
- Меню на строке (⋯): дата, теги, оценка в pomodoro, удаление.

### Drag & Drop
- Перетаскивание задач внутри siblings (один уровень).
- Drop на другую задачу на соседнем уровне → переезд в её скоуп.
- Между проектами и вложенностью — через горячие клавиши и DnD.

### Горячие клавиши

| Действие | Клавиши |
|---|---|
| Новая задача (sibling) | `Enter` |
| Сделать подзадачей / вложить | `Tab` |
| Поднять уровень | `Shift+Tab` |
| Отметить / снять выполненной | `⌘↩` |
| Провалиться в задачу (zoom in) | `⌘⇧.` |
| Выйти на уровень выше (zoom out) | `⌘⇧,` |
| Переместить задачу вверх/вниз | `⌘⌥↑` / `⌘⌥↓` |
| Удалить пустую задачу | `Backspace` |
| Палитра команд | `⌘K` |
| Старт pomodoro | `⌥P` |
| Пауза / продолжить | `⌥Space` |

### Теги и фильтры
- Теги цветные и детерминированно хэшируются.
- В шапке вида — поиск по названию/заметкам и фильтр по активному тегу.
- Тогл «Выполненные» отдельно для каждого вида.

### Статистика
- Сегодня / за неделю: фокус-время, количество сессий, закрытые задачи.
- Столбчатый график за 7 дней.
- Распределение фокус-времени по проектам.

## Структура

```
src/
  main.tsx
  App.tsx
  index.css              # Tailwind + design tokens
  types.ts               # Task, Project, PomodoroSession, ViewKey, ...
  store/
    useAppStore.ts       # zustand + persist: tasks, projects, roots, pomodoro
  lib/
    utils.ts             # cn(), formatSeconds, formatDuration, ...
  hooks/
    useTheme.ts          # light / dark / system
    useGlobalHotkeys.ts  # Cmd+K, pomodoro, zoom-out
    usePomodoroTicker.ts # 250-мс tick для таймера
  components/
    Sidebar.tsx          # проекты, smart-списки, theme toggle, новый проект
    TaskView.tsx         # header + tag-filters + TaskTree + NewTaskInput
    TaskTree.tsx         # DndContext + SortableContext верхнего уровня
    TaskNode.tsx         # рекурсивный узел: bullet, чекбокс, редактирование, zoom
    NewTaskInput.tsx
    Breadcrumbs.tsx
    CommandPalette.tsx   # ⌘K — поиск задач, переходы, действия
    Stats.tsx
    TagChip.tsx
```

## Модель данных (вкратце)

```ts
Task: {
  id, title, notes?, completed, completedAt?,
  projectId | null,       // null = Inbox
  parentId  | null,
  childrenIds: TaskId[],  // упорядоченные дети
  tags: string[],
  collapsed: boolean,
  secondsSpent: number,   // сумма из pomodoro-сессий
  estimatePomodoros?: number,
  dueDate?, createdAt, updatedAt,
}

Project:  { id, name, color, archived, createdAt }
Session:  { id, taskId, projectId, type, startedAt, endedAt, durationSeconds }
```

`roots: Record<projectId | "inbox", TaskId[]>` хранит упорядоченные id задач верхнего уровня для каждого скоупа. Глубже — `childrenIds` на каждой задаче.
