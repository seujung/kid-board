import { atTime } from "../core/dayDate";
import type { DayDate, TimeOfDay } from "../core/dayDate";
import type { BoardData, DailyTimesInfo, TimeSlot, Weekday } from "../core/domain";

interface SeedTask {
  title: string;
  icon: string;
  slot: TimeSlot;
  weekdays: Weekday[];
}

const SEED_CHILDREN: Array<{ name: string; avatar: string; themeColor: string }> = [
  { name: "첫째", avatar: "🐰", themeColor: "coral" },
  { name: "둘째", avatar: "🐻", themeColor: "sky" },
];

const WEEKDAYS_ONLY: Weekday[] = [1, 2, 3, 4, 5];
const EVERY_DAY: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

const SEED_TASKS: SeedTask[] = [
  { title: "세수하기", icon: "🧼", slot: "morning", weekdays: WEEKDAYS_ONLY },
  { title: "옷 입기", icon: "👕", slot: "morning", weekdays: WEEKDAYS_ONLY },
  { title: "아침 먹기", icon: "🍚", slot: "morning", weekdays: WEEKDAYS_ONLY },
  { title: "양치하기", icon: "🪥", slot: "morning", weekdays: WEEKDAYS_ONLY },
  { title: "가방 챙기기", icon: "🎒", slot: "morning", weekdays: WEEKDAYS_ONLY },
  { title: "숙제하기", icon: "📚", slot: "evening", weekdays: EVERY_DAY },
  { title: "책 읽기", icon: "📖", slot: "evening", weekdays: EVERY_DAY },
  { title: "내일 준비물 챙기기", icon: "✏️", slot: "evening", weekdays: EVERY_DAY },
  { title: "샤워하기", icon: "🛁", slot: "evening", weekdays: EVERY_DAY },
];

const SCHOOL: TimeOfDay = { hour: 8, minute: 20 };
const BED: TimeOfDay = { hour: 21, minute: 30 };

/** 새 자녀의 요일별 기본 시각입니다. 월~금은 등교 08:20, 토·일은 등교 없음, 취침은 매일 21:30입니다. */
export function defaultTimes(childID: string): DailyTimesInfo[] {
  return EVERY_DAY.map((weekday) => ({
    childID,
    weekday,
    schoolTime: weekday >= 6 ? null : { ...SCHOOL },
    bedTime: { ...BED },
  }));
}

/** 첫 실행 예시 데이터입니다. 값은 네이티브 앱의 `SeedData.swift`와 같습니다. */
export function seedData(today: DayDate, newID: () => string): BoardData {
  const data: BoardData = { children: [], tasks: [], schedules: [], times: [], completions: [] };
  const createdAt = atTime(today, { hour: 0, minute: 0 }).getTime();
  SEED_CHILDREN.forEach((seed, index) => {
    const childID = newID();
    data.children.push({ id: childID, name: seed.name, avatar: seed.avatar, themeColor: seed.themeColor, order: index });
    data.times.push(...defaultTimes(childID));
    SEED_TASKS.forEach((t, order) => {
      const taskID = newID();
      data.tasks.push({ id: taskID, childID, title: t.title, icon: t.icon, order, createdAt, archivedOn: null });
      data.schedules.push({
        id: newID(),
        taskID,
        slot: t.slot,
        weekdays: t.weekdays.slice(),
        startOn: { ...today },
        endOn: null,
      });
    });
  });
  return data;
}
