// All times are in IST (UTC+5:30)
// Submission window: per-workspace and OFF by default (members submit anytime).
//   Admins can switch it on and pick the hours — see TaskWindow below.
// Completion deadline: 9:00 PM IST

const IST_OFFSET_MINUTES = 330; // UTC+5:30

// Fallback window used when a workspace has never been configured: 9–11 AM IST,
// the hard-coded window this app shipped with.
export const DEFAULT_TASK_WINDOW_START = 9 * 60;
export const DEFAULT_TASK_WINDOW_END = 11 * 60;

export function toIST(date: Date): Date {
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    return new Date(utc + IST_OFFSET_MINUTES * 60000);
}

export function getISTHour(): number {
    return toIST(new Date()).getHours();
}

export function getISTMinuteOfDay(date: Date = new Date()): number {
    const ist = toIST(date);
    return ist.getHours() * 60 + ist.getMinutes();
}

/** The legacy fixed 9–11 AM IST window. Kept for reporting/back-compat. */
export function isWithinTaskSubmissionWindow(): boolean {
    const hour = getISTHour();
    return hour >= 9 && hour < 11;
}

// ─── configurable per-workspace submission window ───────────────────────────

export interface TaskWindow {
    enabled: boolean;
    /** Minutes from IST midnight, inclusive. */
    startMinute: number;
    /** Minutes from IST midnight, exclusive. */
    endMinute: number;
}

/** Row shape any Prisma `workspace` select must provide to build a TaskWindow. */
export interface TaskWindowColumns {
    taskWindowEnabled: boolean;
    taskWindowStart: number;
    taskWindowEnd: number;
}

export const DEFAULT_TASK_WINDOW: TaskWindow = {
    enabled: false,
    startMinute: DEFAULT_TASK_WINDOW_START,
    endMinute: DEFAULT_TASK_WINDOW_END,
};

export function toTaskWindow(workspace: TaskWindowColumns | null | undefined): TaskWindow {
    if (!workspace) return DEFAULT_TASK_WINDOW;
    return {
        enabled: workspace.taskWindowEnabled,
        startMinute: workspace.taskWindowStart,
        endMinute: workspace.taskWindowEnd,
    };
}

/**
 * A disabled window is always open. An enabled window is `[start, end)` in IST;
 * when `end <= start` it wraps past midnight (e.g. 10:00 PM → 2:00 AM), and an
 * equal start/end means the whole day.
 */
export function isWithinTaskWindow(window: TaskWindow, now: Date = new Date()): boolean {
    if (!window.enabled) return true;
    if (window.startMinute === window.endMinute) return true;

    const minute = getISTMinuteOfDay(now);
    if (window.startMinute < window.endMinute) {
        return minute >= window.startMinute && minute < window.endMinute;
    }
    return minute >= window.startMinute || minute < window.endMinute;
}

/** "9:00 AM" — human copy for error messages and UI labels. */
export function formatISTMinute(minute: number): string {
    const normalized = ((minute % 1440) + 1440) % 1440;
    const hour24 = Math.floor(normalized / 60);
    const mins = normalized % 60;
    const suffix = hour24 < 12 ? "AM" : "PM";
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return `${hour12}:${String(mins).padStart(2, "0")} ${suffix}`;
}

/** "09:00" — the value shape an `<input type="time">` expects. */
export function toTimeString(minute: number): string {
    const normalized = ((minute % 1440) + 1440) % 1440;
    return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

/** Parses "HH:mm" (24h) into minutes from midnight; null when malformed. */
export function parseTimeString(value: string): number | null {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
    if (!match) return null;
    return parseInt(match[1]!, 10) * 60 + parseInt(match[2]!, 10);
}

/** The wire shape every task-window endpoint returns. */
export function serializeTaskWindow(
    window: TaskWindow,
    now: Date = new Date(),
): {
    enabled: boolean;
    startMinute: number;
    endMinute: number;
    startTime: string;
    endTime: string;
    label: string;
    open: boolean;
    currentTimeIST: string;
} {
    return {
        enabled: window.enabled,
        startMinute: window.startMinute,
        endMinute: window.endMinute,
        startTime: toTimeString(window.startMinute),
        endTime: toTimeString(window.endMinute),
        label: window.enabled
            ? `${formatISTMinute(window.startMinute)} – ${formatISTMinute(window.endMinute)} IST`
            : "Anytime",
        open: isWithinTaskWindow(window, now),
        currentTimeIST: formatISTMinute(getISTMinuteOfDay(now)),
    };
}

export function taskWindowClosedMessage(window: TaskWindow): string {
    return `Tasks can only be submitted between ${formatISTMinute(window.startMinute)} and ${formatISTMinute(window.endMinute)} IST`;
}

export function isAfterCompletionDeadline(): boolean {
    const hour = getISTHour();
    return hour >= 21;
}

export function getStartOfDay(date: Date): Date {
    const ist = toIST(date);
    return new Date(Date.UTC(ist.getFullYear(), ist.getMonth(), ist.getDate()));
}

export function getEndOfDay(date: Date): Date {
    const ist = toIST(date);
    return new Date(Date.UTC(ist.getFullYear(), ist.getMonth(), ist.getDate(), 23, 59, 59, 999));
}

export function formatDateOnly(date: Date): string {
    const ist = toIST(date);
    return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, "0")}-${String(ist.getDate()).padStart(2, "0")}`;
}

export function getTodayISTDate(): Date {
    const ist = toIST(new Date());
    // Return as UTC midnight so Prisma @db.Date stores correctly
    return new Date(Date.UTC(ist.getFullYear(), ist.getMonth(), ist.getDate()));
}
