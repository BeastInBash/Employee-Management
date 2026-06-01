// All times are in IST (UTC+5:30)
// Submission window: 9:00 AM - 11:00 AM IST
// Completion deadline: 9:00 PM IST

const IST_OFFSET_MINUTES = 330; // UTC+5:30

export function toIST(date: Date): Date {
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    return new Date(utc + IST_OFFSET_MINUTES * 60000);
}

export function getISTHour(): number {
    return toIST(new Date()).getHours();
}

export function isWithinTaskSubmissionWindow(): boolean {
    const hour = getISTHour();
    return hour >= 9 && hour < 11;
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
