# 자녀용 할 일 보드 웹 앱 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** iPad Air 2(iPadOS 15.2 Safari)에서 홈 화면 웹 앱으로 동작하는 자녀 2명용 할 일 보드를 `web/`에 만들고 GitHub Pages로 배포합니다.

**Architecture:** 규칙(날짜, 일정, 보드 상태, 표시 규칙, 날씨, PIN)은 화면과 분리한 TypeScript 순수 함수로 `web/src/core/`에 둡니다. 기존 Swift 패키지 `Packages/KidBoardCore`의 테스트 입력과 기대값을 Vitest로 옮겨 같은 동작을 확인합니다. 저장소(`web/src/store/`)가 전체 데이터를 JSON 문서 하나로 IndexedDB에 저장하고 변경을 화면에 알립니다. 화면은 Preact로 만들고, 서비스 워커가 오프라인과 새 버전 적용을 맡습니다. GitHub Actions가 `main` push마다 빌드해서 Pages에 배포합니다.

**Tech Stack:** TypeScript(strict), Preact, Vite, Vitest, fake-indexeddb(개발 의존성), Playwright WebKit(개발 의존성, 화면 확인용), GitHub Actions

**Spec:** `docs/superpowers/specs/2026-11-19-kid-board-web-design.md` (이 문서가 가리키는 기존 설계 `docs/superpowers/specs/2026-11-19-kid-board-design.md`의 2장, 7.1~7.5, 9장도 함께 읽습니다)

## Global Constraints

- 대상: iPad Air 2, iPadOS 15.2 Safari, 가로 1024×768 CSS 픽셀.
- Vite `build.target`은 `safari15`, `base`는 `/kid-board/`입니다.
- 쓰지 않을 기능: `Array.prototype.at`, `structuredClone`, CSS `:has()`, 컨테이너 쿼리, `dvh`·`svh` 단위, Screen Wake Lock API. `backdrop-filter`는 쓰지 않습니다.
- 런타임 의존성은 `preact` 하나입니다. 나머지는 개발 의존성입니다.
- 날짜는 `{year, month, day}` 숫자로 저장합니다. 날짜·요일 계산은 iPad의 현재 시간대 `Date`로 합니다. 테스트는 `TZ=Asia/Seoul`로 실행합니다.
- 데이터는 iPad 안에만 저장합니다. 외부 서버로 보내는 요청은 Open-Meteo 날씨와 지역 검색뿐입니다.
- 화면 문구는 한국어입니다. 스펙과 기존 설계에 적힌 문구는 그대로 씁니다.
- 기존 네이티브 코드(`App/`, `Packages/`, `scripts/`, `project.yml`, `Config/`)는 바꾸지 않습니다.
- 커밋 작성자는 저장소 설정(`seujung hwan, Jung <digit82@gmail.com>`)을 그대로 씁니다. 커밋 메시지는 영어 Conventional Commits이고 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`를 붙입니다.
- 모든 명령은 `web/` 안에서 실행합니다. 테스트: `npm test`, 타입 검사: `npm run typecheck`, 빌드: `npm run build`.

## Review Focus

1. **Safari 15에 없는 기능이 빌드 결과에 섞임**: `.at(`, `structuredClone`, `:has(` 같은 사용이 빌드 결과에 없어야 합니다. Task 1이 이를 검사하는 `npm run check:compat` 스크립트를 만들고 Task 10이 빌드 결과에 실행합니다.
2. **IndexedDB 문서가 손상되었거나 `schemaVersion`이 앱보다 높음**: 앱이 멈추지 않고 손상 문서를 덮어쓰지 않아야 합니다. 저장소는 읽기 전용 오류 상태를 보고합니다. (Task 7 테스트)
3. **잘못된 백업 파일(JSON 아님, 필드 누락, 미래 버전)**: 아무것도 바꾸지 않고 "백업 파일을 읽을 수 없어요"를 냅니다. (Task 7 테스트)
4. **자정과 시간대 경계에 앱이 켜져 있음**: 다시 그리지 않아도 다음 틱에 새 날짜와 새 시간대가 표시되어야 합니다. 보드 화면은 매 틱에 `boardState`를 다시 계산하되 데이터 스냅숏은 캐시합니다. (Task 3 테스트 + Task 8 `?fixedNow=` 확인)
5. **`crypto.subtle`이 없는 환경(HTTP 개발 서버 외부 접속)**: PIN 설정이 조용히 실패하면 안 됩니다. "보안 연결(HTTPS)에서만 PIN을 정할 수 있어요"를 표시합니다. (Task 6 테스트)

---

## 파일 구조

```
web/
├── package.json, tsconfig.json, vite.config.ts, vitest.config.ts, index.html
├── scripts/check-compat.mjs            # 빌드 결과의 Safari 15 비호환 문법 검사 (Task 1)
├── public/
│   ├── manifest.webmanifest, icon-180.png, icon-512.png   (Task 10)
├── src/
│   ├── core/                           # 순수 규칙 (Task 1~6)
│   │   ├── domain.ts, dayDate.ts
│   │   ├── scheduleEngine.ts, scheduleEditor.ts
│   │   ├── boardState.ts, copy.ts
│   │   ├── displayPolicy.ts
│   │   ├── weather.ts
│   │   └── parentLock.ts
│   ├── store/                          # 저장과 데이터 변경 (Task 7)
│   │   ├── schema.ts, seed.ts, idb.ts, boardStore.ts, backup.ts
│   ├── ui/
│   │   ├── board/                      # 보드 화면 (Task 8)
│   │   ├── parent/                     # 부모 모드 (Task 9)
│   │   └── display/                    # 야간 막, 새 버전 적용 (Task 10)
│   ├── sw.ts                           # 서비스 워커 (Task 10)
│   ├── clock.ts                        # 시각 공급, 개발용 ?fixedNow= (Task 8)
│   └── main.tsx                        # 진입점
├── test/                               # src와 같은 구조의 *.test.ts
├── BACKUP-FORMAT.md                    # 백업 형식 문서 (Task 7)
└── INSTALL.md                          # iPad 설치 안내 (Task 11)
.github/workflows/pages.yml             # 배포 (Task 11)
```

---

### Task 1: 웹 프로젝트 뼈대와 도메인 타입

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/vitest.config.ts`, `web/index.html`, `web/src/main.tsx`, `web/scripts/check-compat.mjs`, `web/src/core/domain.ts`, `web/src/core/dayDate.ts`
- Modify: `.gitignore` (추가: `web/node_modules/`, `web/dist/`, `web/test-results/`)
- Test: `web/test/core/dayDate.test.ts`, `web/test/support.ts`

**Interfaces:**
- Produces:
  - `type Weekday = 1|2|3|4|5|6|7` (1 = 월 … 7 = 일), `const WEEKDAY_KO: Record<Weekday,string>` ("월"…"일")
  - `type TimeSlot = "morning" | "evening"`
  - `interface TimeOfDay { hour: number; minute: number }`, `compareTime(a, b): number`
  - `interface DayDate { year: number; month: number; day: number }`
  - `dayDateOf(date: Date): DayDate`, `weekdayOf(d: DayDate): Weekday`, `addDays(d: DayDate, n: number): DayDate`, `atTime(d: DayDate, t: TimeOfDay): Date`, `compareDay(a, b): number`, `sameDay(a, b): boolean`
  - `interface ChildInfo { id: string; name: string; avatar: string; themeColor: string; order: number }`
  - `interface TaskInfo { id: string; childID: string; title: string; icon: string; order: number; createdAt: number; archivedOn: DayDate | null }`
  - `interface TaskScheduleInfo { id: string; taskID: string; slot: TimeSlot; weekdays: Weekday[]; startOn: DayDate; endOn: DayDate | null }`
  - `interface DailyTimesInfo { childID: string; weekday: Weekday; schoolTime: TimeOfDay | null; bedTime: TimeOfDay }`
  - `interface CompletionInfo { childID: string; taskID: string; day: DayDate; completedAt: number }`
  - `interface BoardData { children: ChildInfo[]; tasks: TaskInfo[]; schedules: TaskScheduleInfo[]; times: DailyTimesInfo[]; completions: CompletionInfo[] }`
  - 테스트 지원: `at(y, m, d, h = 0, min = 0, s = 0): Date` (현지 시각 = Asia/Seoul)
  - npm 스크립트: `dev`, `build`(= `tsc --noEmit && vite build`), `test`(= `TZ=Asia/Seoul vitest run`), `typecheck`, `check:compat`(= `node scripts/check-compat.mjs dist`)

`check-compat.mjs`는 지정 폴더의 `.js`와 `.css` 파일에서 `.at(`, `structuredClone`, `:has(`, `dvh`, `svh`, `backdrop-filter`를 찾습니다. 하나라도 있으면 파일과 위치를 출력하고 종료 코드 1로 끝납니다.

`main.tsx`는 이 단계에서 "할 일 보드"만 표시합니다.

- [ ] **Step 1: 프로젝트를 만들고 의존성을 설치합니다**

Run: `cd web && npm install preact && npm install -D typescript vite @preact/preset-vite vitest fake-indexeddb @playwright/test`
Expected: `web/package-lock.json` 생성

- [ ] **Step 2: 실패하는 테스트를 씁니다**

`Packages/KidBoardCore/Tests/KidBoardCoreTests/DayDateTests.swift`의 테스트 5개를 같은 이름(camelCase)과 같은 기대값으로 옮깁니다. 예: `weekdayOfThursday` → `weekdayOf(dayDateOf(at(2026,11,19,9))) === 4`. 다음 테스트를 더합니다.

```ts
test("addDaysCrossesYearAndLeapDay", () => {
  expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1 });
  expect(addDays({ year: 2028, month: 2, day: 28 }, 1)).toEqual({ year: 2028, month: 2, day: 29 });
  expect(addDays({ year: 2026, month: 3, day: 1 }, -1)).toEqual({ year: 2026, month: 2, day: 28 });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인합니다**

Run: `cd web && npm test`
Expected: FAIL (`dayDateOf` 없음)

- [ ] **Step 4: `domain.ts`, `dayDate.ts`, 설정 파일, `check-compat.mjs`를 구현합니다**

`addDays`는 정오(12:00) 기준 `Date`로 계산해 일광 절약 시간 경계를 피합니다.

- [ ] **Step 5: 테스트, 타입 검사, 빌드, 호환 검사를 확인합니다**

Run: `cd web && npm test && npm run typecheck && npm run build && npm run check:compat`
Expected: 테스트 6개 PASS, 빌드 성공, `check:compat` 종료 코드 0

- [ ] **Step 6: 커밋합니다**

```bash
git add .gitignore web
git commit -m "feat(web): scaffold Vite Preact app with domain types"
```

---

### Task 2: 일정 계산과 일정 수정 분할

**Files:**
- Create: `web/src/core/scheduleEngine.ts`, `web/src/core/scheduleEditor.ts`
- Test: `web/test/core/scheduleEngine.test.ts`, `web/test/core/scheduleEditor.test.ts`

**Interfaces:**
- Consumes: Task 1의 타입과 날짜 함수
- Produces:
  - `interface ScheduledTask { task: TaskInfo; slot: TimeSlot }`
  - `interface DaySummary { done: number; total: number }`, `isStar(s: DaySummary): boolean` (= `total > 0 && done === total`)
  - `tasksOn(childID: string, day: DayDate, data: BoardData): ScheduledTask[]` — 아침 먼저, 같은 시간대는 `order` 오름차순, 같은 `order`는 `task.id` 오름차순
  - `summaryOn(childID: string, day: DayDate, data: BoardData): DaySummary`
  - `timesOn(childID: string, day: DayDate, data: BoardData): DailyTimesInfo` — 없으면 `schoolTime: null`, `bedTime: {hour:21, minute:30}`
  - `changeSchedule(schedules: TaskScheduleInfo[], taskID: string, slot: TimeSlot, weekdays: Weekday[], today: DayDate, newID: string): TaskScheduleInfo[]`

할 일이 나타나는 조건과 분할 규칙은 기존 Swift 구현(`ScheduleEngine.swift`, `ScheduleEditor.swift`)과 같습니다. 기존 계획 `docs/superpowers/plans/2026-11-19-kid-board.md`의 Task 2 설명과 같은 규칙입니다.

- [ ] **Step 1: 실패하는 테스트를 씁니다**

`ScheduleEngineTests.swift`(8개)와 `ScheduleEditorTests.swift`(3개)를 같은 이름과 기대값으로 옮깁니다. 다음 테스트를 더합니다.

```ts
test("archivedTaskCompletionCountsOnPastDay", () => {
  // archivedOn = 11/19, 11/18 완료 1개 → summaryOn(11/18) = { done: 1, total: 1 }, summaryOn(11/19).total === 0
});
test("sameOrderTieBreaksById", () => {
  // order가 같은 아침 할 일 "b", "a" → tasksOn 결과 id 순서 ["a", "b"]
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인합니다**

Run: `cd web && npm test`
Expected: FAIL (`tasksOn` 없음)

- [ ] **Step 3: `scheduleEngine.ts`와 `scheduleEditor.ts`를 구현합니다**

- [ ] **Step 4: 테스트가 통과하는지 확인합니다**

Run: `cd web && npm test && npm run typecheck`
Expected: 모든 테스트 PASS

- [ ] **Step 5: 커밋합니다**

```bash
git add web
git commit -m "feat(web): port schedule engine and schedule editor"
```

---

### Task 3: 보드 상태와 화면 문구

**Files:**
- Create: `web/src/core/boardState.ts`, `web/src/core/copy.ts`
- Test: `web/test/core/boardState.test.ts`

**Interfaces:**
- Consumes: Task 2의 `tasksOn`, `summaryOn`, `timesOn`
- Produces:
  - `type BoardPhase = { kind: "morning"; deadline: Date } | { kind: "evening"; deadline: Date } | { kind: "allDay"; deadline: Date } | { kind: "finished"; allDone: boolean }`
  - `interface ChildBoardState { child: ChildInfo; day: DayDate; phase: BoardPhase; visibleTasks: ScheduledTask[]; doneTaskIDs: Set<string>; nowTaskID: string | null; remaining: number; progress: number }`
  - `boardState(child: ChildInfo, now: Date, data: BoardData): ChildBoardState`
  - `canToggle(taskID: string, childID: string, now: Date, data: BoardData): boolean`
  - `copy.ts`: `countdownLabel(phase): string | null`, `remainingText(n: number): string`, `finishedText(allDone: boolean): string`, `formatCountdown(ms: number): string` ("37분 55초", 1시간 이상이면 "1시간 29분 55초")

규칙은 기존 Swift `BoardStateEngine.swift`와 `BoardCopy`와 같습니다. `allDone`은 그날 전체 요약의 `done === total`입니다(할 일 0개면 `true`).

- [ ] **Step 1: 실패하는 테스트를 씁니다**

`BoardStateEngineTests.swift`(13개)를 같은 이름과 기대값으로 옮깁니다. 다음 테스트를 더합니다.

```ts
test("allDayTasksToggleableAndUndoable", () => {
  // 토 10:00, 등교 없음: 아침·저녁 할 일 모두 canToggle === true. 완료 기록이 있어도 canToggle === true
});
test("formatCountdown", () => {
  expect(formatCountdown((37 * 60 + 55) * 1000)).toBe("37분 55초");
  expect(formatCountdown((89 * 60 + 55) * 1000)).toBe("1시간 29분 55초");
  expect(formatCountdown(0)).toBe("0분 0초");
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인합니다**

Run: `cd web && npm test`
Expected: FAIL (`boardState` 없음)

- [ ] **Step 3: `boardState.ts`와 `copy.ts`를 구현합니다**

- [ ] **Step 4: 테스트가 통과하는지 확인합니다**

Run: `cd web && npm test && npm run typecheck`
Expected: 모든 테스트 PASS

- [ ] **Step 5: 커밋합니다**

```bash
git add web
git commit -m "feat(web): port board phase, countdown and toggle rules"
```

---

### Task 4: 표시 규칙

**Files:**
- Create: `web/src/core/displayPolicy.ts`
- Test: `web/test/core/displayPolicy.test.ts`

**Interfaces:**
- Produces:
  - `isNightMode(now: Date): boolean` (22:00 이상 또는 06:00 미만)
  - `sceneOf(now: Date): "day" | "night"` (06:00 이상 18:00 미만이면 `"day"`)
  - `showsUmbrella(precipitationProbability: number, now: Date, latestSchoolTime: Date | null): boolean`
  - `NIGHT_WAKE_MS = 30_000`

- [ ] **Step 1: 실패하는 테스트를 씁니다**

`DisplayPolicyTests.swift`(3개)를 같은 이름과 경계값으로 옮깁니다.

- [ ] **Step 2: 테스트가 실패하는지 확인합니다**

Run: `cd web && npm test`
Expected: FAIL

- [ ] **Step 3: `displayPolicy.ts`를 구현합니다**

- [ ] **Step 4: 테스트가 통과하는지 확인합니다**

Run: `cd web && npm test && npm run typecheck`
Expected: 모든 테스트 PASS

- [ ] **Step 5: 커밋합니다**

```bash
git add web
git commit -m "feat(web): port night mode, scene and umbrella rules"
```

---

### Task 5: 날씨 클라이언트와 캐시 규칙

**Files:**
- Create: `web/src/core/weather.ts`
- Test: `web/test/core/weather.test.ts`, `web/test/fixtures/forecast.json`, `web/test/fixtures/geocoding.json`

**Interfaces:**
- Produces:
  - `type Fetcher = (url: string, init?: { signal?: AbortSignal }) => Promise<unknown>` (JSON을 돌려주는 함수)
  - `interface WeatherSnapshot { temperature: number; weatherCode: number; high: number; low: number; precipitationProbability: number; fetchedAt: number }`
  - `interface GeoPlace { name: string; admin1: string | null; latitude: number; longitude: number }`
  - `forecastURL(lat: number, lon: number): string`, `geocodingURL(query: string): string`
  - `fetchForecast(fetcher: Fetcher, lat: number, lon: number, now: number, signal?: AbortSignal): Promise<WeatherSnapshot>`
  - `searchPlaces(fetcher: Fetcher, query: string): Promise<GeoPlace[]>`
  - `type WeatherDisplay = { kind: "fresh"; snap: WeatherSnapshot } | { kind: "stale"; snap: WeatherSnapshot } | { kind: "unavailable" }`
  - `weatherDisplay(cached: WeatherSnapshot | null, now: number): WeatherDisplay` (경과 10800초 이하 `fresh`, 초과 `stale`)
  - `REFRESH_MS = 1_800_000`
  - `jsonFetcher: Fetcher` — `fetch`로 받고 상태 코드가 200~299가 아니면 오류를 던집니다.

URL 문자열, 파싱 규칙(강수 확률 `null` → 0, 일별 배열 없음 → 오류, `results` 없음 → 빈 배열)은 기존 Swift `Weather.swift`와 같습니다. 픽스처는 `Packages/KidBoardCore/Tests/KidBoardCoreTests/Fixtures/`의 `forecast.json`, `geocoding.json`을 복사합니다.

- [ ] **Step 1: 실패하는 테스트를 씁니다**

`WeatherTests.swift`(8개)를 같은 이름과 기대값으로 옮깁니다. URL 기대 문자열도 그대로 옮깁니다.

- [ ] **Step 2: 테스트가 실패하는지 확인합니다**

Run: `cd web && npm test`
Expected: FAIL

- [ ] **Step 3: `weather.ts`를 구현합니다**

- [ ] **Step 4: 테스트가 통과하는지 확인합니다**

Run: `cd web && npm test && npm run typecheck`
Expected: 모든 테스트 PASS

- [ ] **Step 5: 커밋합니다**

```bash
git add web
git commit -m "feat(web): port Open-Meteo client and weather freshness policy"
```

---

### Task 6: 부모 잠금 (PIN, 잠금, 복구 코드)

**Files:**
- Create: `web/src/core/parentLock.ts`
- Test: `web/test/core/parentLock.test.ts`

**Interfaces:**
- Produces:
  - `isValidPin(pin: string): boolean` (ASCII 숫자 정확히 4자리)
  - `isValidRecoveryCode(code: string): boolean` (ASCII 숫자 정확히 8자리)
  - `makeSalt(): string` (16바이트 `crypto.getRandomValues`, 16진수 32자)
  - `hashSecret(secret: string, saltHex: string): Promise<string>` (`crypto.subtle.digest("SHA-256", salt 바이트 + secret UTF-8)`, 소문자 16진수 64자)
  - `makeRecoveryCode(): string` (8자리 숫자, `crypto.getRandomValues` 기반, 모듈로 편향 없이)
  - `class SecureContextError extends Error` — `crypto.subtle`이 없으면 `hashSecret`이 던집니다.
  - `interface Lockout { failures: number; lockedUntil: number | null }`, `EMPTY_LOCKOUT`
  - `recordFailure(l: Lockout, now: number): Lockout` (5번째 실패에서 `lockedUntil = now + 60000`, `failures = 0`), `recordSuccess(): Lockout`, `isLocked(l: Lockout, now: number): boolean`
  - `LONG_PRESS_MS = 3000`, `IDLE_TIMEOUT_MS = 120000`
  - 문구 상수: `SECURE_CONTEXT_MESSAGE = "보안 연결(HTTPS)에서만 PIN을 정할 수 있어요"`

- [ ] **Step 1: 실패하는 테스트를 씁니다**

`ParentLockTests.swift`의 PIN 형식, 해시, 잠금 테스트를 옮깁니다. 곱셈 복구 문제 테스트는 옮기지 않습니다. 다음 테스트를 더합니다.

```ts
test("recoveryCodeFormat", () => {
  for (let i = 0; i < 200; i++) expect(isValidRecoveryCode(makeRecoveryCode())).toBe(true);
  expect(isValidRecoveryCode("1234567")).toBe(false);
  expect(isValidRecoveryCode("1234567a")).toBe(false);
});
test("hashKnownVector", async () => {
  // salt "" + "abc" → "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
});
test("hashWithoutSubtleThrowsSecureContextError", async () => {
  // crypto.subtle을 undefined로 바꾼 상태에서 hashSecret이 SecureContextError로 거부됨
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인합니다**

Run: `cd web && npm test`
Expected: FAIL

- [ ] **Step 3: `parentLock.ts`를 구현합니다**

- [ ] **Step 4: 테스트가 통과하는지 확인합니다**

Run: `cd web && npm test && npm run typecheck`
Expected: 모든 테스트 PASS

- [ ] **Step 5: 커밋합니다**

```bash
git add web
git commit -m "feat(web): add PIN hashing, lockout and recovery code"
```

---

### Task 7: 저장소, 이전, 백업

**Files:**
- Create: `web/src/store/schema.ts`, `web/src/store/seed.ts`, `web/src/store/idb.ts`, `web/src/store/boardStore.ts`, `web/src/store/backup.ts`, `web/BACKUP-FORMAT.md`
- Test: `web/test/store/boardStore.test.ts`, `web/test/store/schema.test.ts`, `web/test/store/backup.test.ts`

**Interfaces:**
- Consumes: Task 1~6의 함수와 타입
- Produces:
  - `schema.ts`:
    - `CURRENT_SCHEMA = 1`
    - `interface Settings { pinHash: string | null; pinSalt: string | null; recoveryHash: string | null; recoverySalt: string | null; lockout: Lockout; recoveryLockout: Lockout; location: GeoPlace | null; didSeed: boolean; lastBackupAt: number | null }`
    - `interface AppDoc { schemaVersion: number; data: BoardData; settings: Settings; weather: WeatherSnapshot | null }`
    - `emptyDoc(): AppDoc`
    - `migrate(raw: unknown): { ok: true; doc: AppDoc } | { ok: false; reason: "corrupt" | "future" }`
  - `seed.ts`: `seedData(today: DayDate, newID: () => string): BoardData` (값은 기존 Swift `SeedData.swift`와 같습니다), `defaultTimes(childID: string): DailyTimesInfo[]`
  - `idb.ts`: `interface DocStorage { load(): Promise<unknown | null>; save(doc: AppDoc): Promise<void> }`, `idbStorage(dbName = "kid-board"): DocStorage`
  - `boardStore.ts`: `class BoardStore`
    - `static open(storage: DocStorage, now: () => Date, newID?: () => string): Promise<BoardStore>` — 읽기 → `migrate` → 실패하면 `status = "readOnlyError"`이고 이후 쓰기를 하지 않습니다.
    - `status: "ok" | "readOnlyError"`
    - `subscribe(fn: () => void): () => void`
    - `snapshot(): BoardData` (변경 전까지 같은 객체를 돌려줍니다), `settings(): Settings`, `weather(): WeatherSnapshot | null`
    - 변경 메서드(각 호출이 한 번 저장하고 한 번 알림): `seedIfNeeded()`, `addChild(name, avatar, themeColor): string`, `updateChild(info)`, `deleteChild(id)`, `moveChild(from, to)`, `addTask(childID, title, icon, slot, weekdays): string`, `updateTaskAppearance(taskID, title, icon)`, `updateTaskSchedule(taskID, slot, weekdays)`, `archiveTask(taskID)`, `moveTask(childID, slot, from, to)`, `copyTask(taskID, toChildID): string | null`, `setTimes(childID, weekday, schoolTime, bedTime)`, `toggleCompletion(childID, taskID): boolean`, `setPin(pin): Promise<string>`(새 복구 코드 반환), `verifyPin(pin): Promise<"ok" | "wrong" | {lockedUntil: number}>`, `verifyRecoveryCode(code): Promise<"ok" | "wrong" | {lockedUntil: number}>`, `regenerateRecoveryCode(): Promise<string>`, `setLocation(place: GeoPlace)`(날씨 캐시도 지움), `setWeather(snap: WeatherSnapshot | null)`, `markBackedUp()`
    - `today`는 생성자의 `now()`로 구합니다.
  - `backup.ts`:
    - `exportBackup(doc: AppDoc, now: Date): { fileName: string; json: string }` (`kid-board-backup-YYYYMMDD.json`, `settings`의 PIN·복구 코드·잠금 필드 제외)
    - `parseBackup(text: string): { ok: true; doc: AppDoc } | { ok: false; message: "백업 파일을 읽을 수 없어요" }`
    - `BoardStore.restore(doc: AppDoc)`: 데이터·지역을 바꾸고 현재 PIN·복구 코드·잠금은 유지합니다.

`BACKUP-FORMAT.md`는 백업 JSON의 필드와 `schemaVersion`을 표로 적습니다.

- [ ] **Step 1: 실패하는 테스트를 씁니다** (`fake-indexeddb/auto` 사용)

기존 앱 테스트 `AppTests/BoardStoreTests.swift`의 테스트를 옮깁니다(시드 1회, 시드 플래그, 토글 생성·삭제, 마감 후 토글 거부, 중복 없음, 일정 분할, 자녀 삭제, 할 일 복사, 새 자녀 기본 시각, 변경 알림, 스냅숏 캐시, PIN 확인, 5회 잠금, 잠금 유지, 지역 저장). 다음 테스트를 더합니다.

```ts
test("corruptDocOpensReadOnlyAndIsNotOverwritten")   // load()가 "garbage" → status "readOnlyError", addChild 후 save 호출 0회
test("futureSchemaOpensReadOnly")                     // schemaVersion 99 → status "readOnlyError"
test("setPinReturnsRecoveryCodeThatResetsPin")        // code = await setPin("1234"); verifyRecoveryCode(code) === "ok"
test("recoveryCodeLocksAfterFive")                     // 틀린 코드 5회 → { lockedUntil }
test("regenerateInvalidatesOldCode")                   // 새 코드 발급 후 이전 코드 → "wrong"
test("setLocationClearsWeatherCache")
test("exportExcludesSecrets")                          // json에 pinHash, recoveryHash, lockout 문자열 없음
test("parseBackupRejectsBadInput")                     // "not json", "{}", schemaVersion 99 → ok false, 메시지 일치
test("restoreKeepsCurrentPin")                         // 복원 후 verifyPin(기존 PIN) === "ok"
```

- [ ] **Step 2: 테스트가 실패하는지 확인합니다**

Run: `cd web && npm test`
Expected: FAIL

- [ ] **Step 3: `schema.ts`, `seed.ts`, `idb.ts`, `boardStore.ts`, `backup.ts`, `BACKUP-FORMAT.md`를 구현합니다**

- [ ] **Step 4: 테스트가 통과하는지 확인합니다**

Run: `cd web && npm test && npm run typecheck`
Expected: 모든 테스트 PASS

- [ ] **Step 5: 커밋합니다**

```bash
git add web
git commit -m "feat(web): add IndexedDB board store with migration and backup"
```

---

### Task 8: 보드 화면

**Files:**
- Create: `web/src/clock.ts`, `web/src/ui/board/*` (BoardView, Header, SceneBackground, ChildPanel, CountdownCard, WeekStrip, TaskCard, Stamp, theme, useWeather), `web/src/ui/app.tsx`, `web/src/styles.css`
- Modify: `web/src/main.tsx`
- Test: `web/test/clock.test.ts`, `web/test/ui/screens.spec.ts` (Playwright WebKit)

**Interfaces:**
- Consumes: Task 3, 4, 5, 7
- Produces:
  - `clock.ts`: `interface Clock { now(): Date }`, `makeClock(search: string, isDev: boolean): Clock` — 개발 빌드에서 `?fixedNow=ISO8601`이면 그 시각 + 실행 후 경과 시간, 그 밖에는 `new Date()`
  - `BoardView`는 `Header`의 오른쪽 위에 `trailing` 자리를 둡니다. Task 9가 설정 아이콘을, Task 10이 야간 막을 붙입니다.
  - `useWeather(store, clock): { display: WeatherDisplay | "noLocation"; refreshNow(): void }` — 지역이 없으면 `"noLocation"`이고 요청하지 않습니다. 30분마다 갱신, 성공하면 `store.setWeather`, `refreshNow`는 진행 중 요청을 `AbortController`로 취소하고 다시 요청합니다.

화면 규칙은 기존 설계 7.2 규칙 1~9, 7.4, 웹 설계 6.8을 따릅니다. 기준 디자인은 `.superpowers/sdd/2026-11-19-kid-board/screens/a16-morning.png`입니다. 다음 값을 고정합니다.

- 테마 색: `coral` #E85A4F, `sky` #3B82C4, `mint` #2E9E7A, `lavender` #8A6BD1, `sunny` #E0A21B (나머지 이름은 `sunny`)
- 1초마다 다시 그리는 컴포넌트는 `Header`의 시계와 `CountdownCard`뿐입니다. `BoardView`는 `store.subscribe`와 "분이 바뀔 때"만 다시 그립니다. 분 단위 갱신에서 `boardState`를 다시 계산하므로 자정과 시간대 경계가 반영됩니다.
- 할 일 카드를 누르면 `canToggle`을 다시 확인합니다. 완료 카드는 "취소할까요?" 확인 후 취소합니다. 거부된 카드는 흔들림 효과만 냅니다.
- 다른 요일 칸을 누르면 그날 목록을 읽기 전용으로 보여 주고 "오늘로" 버튼을 표시합니다. 30초 동안 입력이 없으면 오늘로 돌아옵니다.
- 축하 효과는 2초입니다.

- [ ] **Step 1: `clock.ts` 테스트를 씁니다**

```ts
test("fixedNowOnlyInDev", () => {
  expect(makeClock("?fixedNow=2026-11-19T07:42:00%2B09:00", true).now().getHours()).toBe(7);
  expect(Math.abs(makeClock("?fixedNow=2026-11-19T07:42:00%2B09:00", false).now().getTime() - Date.now())).toBeLessThan(1000);
});
```

- [ ] **Step 2: 화면을 구현합니다**

- [ ] **Step 3: Playwright 화면 확인을 씁니다**

`screens.spec.ts`는 개발 서버를 띄우고 WebKit, 뷰포트 1024×768로 4개 화면을 캡처합니다: 목 07:42(아침), 목 20:00(저녁), 토 10:00(등교 없음), 목 22:30(마감 후). 각 화면에서 다음을 확인합니다.
- 두 패널이 모두 뷰포트 안에 있습니다.
- 아침 화면에서 할 일 카드 5개가 스크롤 없이 보입니다(`boundingBox().y + height <= 768`).
- 캡처 파일은 `web/test-results/screens/*.png`에 저장합니다.

Run: `cd web && npx playwright install webkit && npx playwright test`
Expected: 4개 PASS. 구현자가 캡처를 직접 열어 잘림과 겹침을 고칩니다.

- [ ] **Step 4: 전체 확인을 실행합니다**

Run: `cd web && npm test && npm run typecheck && npm run build && npm run check:compat`
Expected: 모두 성공

- [ ] **Step 5: 커밋합니다**

```bash
git add web
git commit -m "feat(web): add dual-child board screen with weather"
```

---

### Task 9: 부모 모드

**Files:**
- Create: `web/src/ui/parent/*` (ParentGate, PinPad, PinSetup, RecoveryCodeShow, RecoveryEntry, ParentHome, ChildrenEditor, TasksEditor, TaskEditor, TimesEditor, LocationPicker, History, BackupPanel, useIdle)
- Modify: `web/src/ui/board/Header.tsx` (설정 아이콘), `web/src/ui/app.tsx`
- Test: `web/test/ui/parentFlow.spec.ts` (Playwright WebKit), `web/test/ui/backupShare.test.ts`

**Interfaces:**
- Consumes: Task 6, 7, 8
- Produces:
  - `shareBackup(file: { fileName: string; json: string }, nav: Navigator, doc: Document): Promise<"shared" | "downloaded" | "cancelled">` — `nav.canShare?.({files})`가 참이면 `nav.share`, 아니면 `<a download>`. 사용자가 공유를 취소하면(`AbortError`) `"cancelled"`이고 `markBackedUp`을 부르지 않습니다.
  - 부모 모드 열림 상태 `parentOpen: boolean` (Task 10의 야간 막이 사용)

동작은 기존 설계 7.5와 웹 설계 6.5, 6.10을 따릅니다. 다음 값을 고정합니다.

- 설정 아이콘은 18px 회색(불투명도 0.45), 누름 영역 44px입니다. `LONG_PRESS_MS`(3초) 동안 계속 눌러야 열립니다.
- PIN을 처음 정하면 복구 코드를 "1234 5678"처럼 4자리씩 띄워 표시합니다. 문구: "이 복구 코드를 따로 적어 두세요. 다시 보여 드리지 않아요." 버튼: "적어 두었어요"
- PIN 화면의 "PIN을 잊었어요" → 복구 코드 입력 → 맞으면 새 PIN 설정
- 잠금 중 문구: "잠시 후 다시 해 주세요 (N초)"
- `IDLE_TIMEOUT_MS`(2분) 동안 입력(터치, 스크롤, 키 입력)이 없으면 보드로 돌아갑니다.
- 메뉴 순서: 자녀 관리, 할 일 관리, 시각 설정, 날씨 지역, 완료 기록, 백업, PIN 변경, 복구 코드 새로 만들기
- 메뉴 위쪽에 현재 버전, "새 버전 있음"과 "새 버전 적용" 버튼(Task 10이 연결), 백업 7일 경과 안내 "백업한 지 N일 지났어요"를 표시합니다.
- 백업 패널 문구: "공유 화면에서 '파일에 저장' > iCloud Drive를 고르세요." 와 "백업·복원 전에 홈 버튼을 세 번 눌러 사용법 유도 접근을 잠시 끄십시오."
- 복원 확인 문구: "지금 데이터를 백업 내용으로 바꿀까요?"
- 할 일 제목과 자녀 이름 입력 칸 아래 문구: "키보드의 🎤 버튼을 누르면 말로 입력할 수 있어요."
- 시각 오류 문구: "잘 준비 시각은 등교 시각보다 늦어야 해요"
- 완료 기록: 최근 28일, 최신 날짜 먼저, "M/d (요일)", "done/total", 별이면 " ★", 할 일 0개면 "-"
- 지역 검색 결과: "이름, 시도". 고르면 `store.setLocation` 후 `refreshNow()`

- [ ] **Step 1: `shareBackup` 테스트를 씁니다**

```ts
test("sharesWhenFilesSupported")      // canShare → true: share 1회 호출, 결과 "shared"
test("downloadsWhenShareUnsupported") // canShare 없음: <a download="kid-board-backup-20261119.json"> 클릭, 결과 "downloaded"
test("cancelledShareDoesNotMarkBackup") // share가 AbortError로 거부 → "cancelled"
```

- [ ] **Step 2: 테스트가 실패하는지 확인합니다**

Run: `cd web && npm test`
Expected: FAIL

- [ ] **Step 3: 부모 모드를 구현합니다**

- [ ] **Step 4: Playwright 흐름 확인을 씁니다**

`parentFlow.spec.ts`(WebKit, 1024×768, `localhost`는 보안 컨텍스트라 `crypto.subtle` 사용 가능):
1. 설정 아이콘 1초 누름 → 부모 모드 열리지 않음
2. 3초 누름 → PIN 설정 → 복구 코드 표시 → "적어 두었어요"
3. 할 일 관리에서 "이 닦기" 추가 → 보드로 돌아가 첫째 패널에 "이 닦기" 표시
4. 다시 열기 → 틀린 PIN 5회 → "잠시 후 다시 해 주세요" 표시
5. 각 단계 캡처를 `web/test-results/screens/parent-*.png`로 저장

Run: `cd web && npx playwright test`
Expected: PASS

- [ ] **Step 5: 전체 확인을 실행합니다**

Run: `cd web && npm test && npm run typecheck && npm run build && npm run check:compat`
Expected: 모두 성공

- [ ] **Step 6: 커밋합니다**

```bash
git add web
git commit -m "feat(web): add PIN-locked parent mode with backup and recovery code"
```

---

### Task 10: 야간 막, 오프라인, 새 버전 적용

**Files:**
- Create: `web/src/sw.ts`, `web/src/ui/display/NightOverlay.tsx`, `web/src/ui/display/updates.ts`, `web/public/manifest.webmanifest`, `web/public/icon-180.png`, `web/public/icon-512.png`
- Modify: `web/index.html` (홈 화면 메타 태그), `web/vite.config.ts` (서비스 워커 빌드), `web/src/ui/app.tsx`
- Test: `web/test/ui/nightState.test.ts`, `web/test/ui/updatePolicy.test.ts`

**Interfaces:**
- Consumes: Task 4의 `isNightMode`, `NIGHT_WAKE_MS`, Task 9의 `parentOpen`
- Produces:
  - `nightState(prev: { wakeUntil: number | null }, now: Date, touched: boolean, parentOpen: boolean): { dimmed: boolean; wakeUntil: number | null }`
  - `shouldApplyUpdate(input: { waiting: boolean; now: Date; lastInputAt: number; parentRequested: boolean }): boolean` — `waiting`이고 (`parentRequested` 또는 (`isNightMode(now)`이고 `now - lastInputAt >= 300000`))
  - 서비스 워커 메시지: 앱 → 워커 `{type: "SKIP_WAITING"}`

규칙:
- 야간 막: 불투명도 0.92 검은 막, `HH:mm` 시계만 크게 어둡게. 터치하면 30초 표시, 표시 중 터치는 30초를 다시 셉니다. `parentOpen`이면 어둡게 하지 않습니다.
- 서비스 워커: 빌드 결과 파일 목록(버전 해시 포함)을 설치 단계에서 캐시합니다. 같은 출처 요청은 캐시 우선, 날씨 요청(다른 출처)은 캐시하지 않습니다. 새 워커는 `waiting`으로 대기하고 `SKIP_WAITING` 메시지를 받을 때만 활성화합니다. 앱을 다시 열면 브라우저 기본 동작대로 새 버전이 적용됩니다.
- 활성화되면 앱이 `location.reload()` 합니다.
- `index.html` 메타: `apple-mobile-web-app-capable=yes`, `apple-mobile-web-app-status-bar-style=black-translucent`, `apple-mobile-web-app-title=할 일 보드`, `apple-touch-icon`(180), `viewport`에 `viewport-fit=cover, user-scalable=no`
- `manifest.webmanifest`: `name`·`short_name` "할 일 보드", `display` `standalone`, `orientation` `landscape`, `start_url`·`scope` `/kid-board/`
- 아이콘은 테마 색 배경에 흰 체크 표시가 있는 PNG로 만듭니다(빌더 재량).
- 앱 버전 문자열은 빌드 시각(`YYYYMMDD-HHmm`)이고 부모 모드에 표시합니다.

- [ ] **Step 1: 실패하는 테스트를 씁니다**

```ts
test("dimsAt22AndWakesFor30s")        // 22:00 dimmed; touch → 30초간 false; 30초 후 true
test("touchDuringWakeExtends")         // 22:00:20 touch → wakeUntil 22:00:50
test("parentOpenNeverDims")
test("undimsAt06")
test("appliesOnlyAtQuietNightOrParentRequest") // 낮 + 무입력 1시간 → false; 23:00 + 무입력 5분 → true; 23:00 + 무입력 4분 → false; 낮 + parentRequested → true; waiting false → false
```

- [ ] **Step 2: 테스트가 실패하는지 확인합니다**

Run: `cd web && npm test`
Expected: FAIL

- [ ] **Step 3: 야간 막, 서비스 워커, 메타 태그, 매니페스트, 아이콘을 구현합니다**

- [ ] **Step 4: 빌드 결과를 확인합니다**

Run: `cd web && npm test && npm run typecheck && npm run build && npm run check:compat && ls dist/sw.js dist/manifest.webmanifest dist/icon-180.png`
Expected: 모두 성공, 파일 3개 존재

- [ ] **Step 5: 오프라인 동작을 확인합니다**

Run: `cd web && npx vite preview --port 4173` 실행 후 Playwright로 페이지를 한 번 열고, `context.setOffline(true)` 상태에서 다시 열어 보드가 표시되는지 확인하는 테스트를 `web/test/ui/offline.spec.ts`에 씁니다.
Expected: PASS

- [ ] **Step 6: 커밋합니다**

```bash
git add web
git commit -m "feat(web): add night overlay, offline service worker and update policy"
```

---

### Task 11: 배포와 설치 안내

**Files:**
- Create: `.github/workflows/pages.yml`, `web/INSTALL.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 10의 `npm run build` 결과 `web/dist`

`pages.yml`:
- 트리거: `main`에 push, 수동 실행
- 작업: `actions/checkout`, `actions/setup-node`(Node 22, npm 캐시, `web/package-lock.json`), `npm ci`, `npm test`, `npm run build`, `npm run check:compat`, `actions/upload-pages-artifact`(`web/dist`), `actions/deploy-pages`
- 권한: `pages: write`, `id-token: write`, `contents: read`
- 동시 실행 그룹: `pages`

`web/INSTALL.md`(한국어 합쇼체, 번호 목록, 쌍반점 금지)는 웹 설계 6.9의 6단계와 다음을 적습니다.
- 백업 방법: 사용법 유도 접근 끄기 → 부모 모드 > 백업 > "백업 파일 저장" → 공유 화면 "파일에 저장" → iCloud Drive > `할 일 보드 백업`
- 복원 방법
- PIN과 복구 코드를 모두 잊었을 때: 설정 > Safari > 고급 > 웹사이트 데이터에서 `seujung.github.io` 삭제 → 앱 다시 열기 → 백업에서 복원
- 야간 모드는 화면 밝기를 낮추지 못한다는 점

`README.md`에 웹 앱 주소, `web/INSTALL.md` 링크, 기존 네이티브 앱 코드 설명(iPadOS 17 이상용)을 짧게 적습니다.

- [ ] **Step 1: 워크플로와 문서를 작성합니다**

- [ ] **Step 2: 워크플로 문법을 확인합니다**

Run: `cd web && npm ci && npm test && npm run build && npm run check:compat`
Expected: 모두 성공 (워크플로와 같은 명령)

- [ ] **Step 3: 커밋합니다**

```bash
git add .github/workflows/pages.yml web/INSTALL.md README.md
git commit -m "ci(web): deploy web app to GitHub Pages and add install guide"
```

- [ ] **Step 4: 배포 (사용자와 함께)**

1. 컨트롤러가 사용자에게 Pages Source를 "GitHub Actions"로 바꿔 달라고 요청합니다.
2. 컨트롤러가 `git push origin main`을 실행합니다.
3. `https://seujung.github.io/kid-board/`가 200을 반환하고 새 앱이 열리는지 확인합니다.
4. 사용자에게 iPad Air 2에서 웹 설계 6.11의 7개 항목 확인을 요청합니다.
5. 배포가 확인되면 컨트롤러가 사용자 동의를 받고 `gh-pages` 브랜치를 원격에서 지웁니다.

---

## 스펙 대응표

| 웹 설계 | Task |
|---|---|
| 2 기존 규칙 | 2, 3, 4, 5, 6, 7, 8, 9 |
| 3 목표·반목표 | 7(백업·손상), 8(성능), 10(오프라인·새 버전) |
| 4 제약 | 1(`check:compat`, 빌드 대상), 전 작업 |
| 6.1 저장소 구성 | 1, 11 |
| 6.4 데이터 저장 | 7 |
| 6.5 백업과 복원 | 7, 9, 11 |
| 6.6 야간 모드 | 10 |
| 6.7 오프라인과 새 버전 | 10 |
| 6.8 화면 | 8, 9 |
| 6.9 iPad 설정 | 11 |
| 6.10 PIN 복구 코드 | 6, 7, 9 |
| 6.11 테스트 | 1~10, 11 Step 4 |
