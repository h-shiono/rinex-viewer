/** Calendar epoch as written in RINEX (seconds may be fractional). */
export interface Epoch {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
}

/**
 * Parse whitespace separated "Y M D h m s" fields.
 * Two digit years follow the RINEX 2 convention: 80-99 -> 19xx, 00-79 -> 20xx.
 */
export function parseEpoch(text: string): Epoch | undefined {
    const f = text.trim().split(/\s+/);
    if (f.length < 6) {
        return undefined;
    }
    const n = f.slice(0, 6).map(Number);
    if (n.some((v) => !Number.isFinite(v))) {
        return undefined;
    }
    let [year] = n;
    const [, month, day, hour, minute, second] = n;
    if (f[0].length <= 2) {
        year += year < 80 ? 2000 : 1900;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) {
        return undefined;
    }
    return { year, month, day, hour, minute, second };
}

const pad = (v: number, w = 2) => String(v).padStart(w, '0');

/**
 * Format as "YYYY-MM-DD hh:mm:ss.sss". Sub-millisecond digits are kept
 * (up to 7 decimals, as in RINEX) when they are not zero.
 * No Date object is used, so invalid values never throw.
 */
export function formatEpoch(e: Epoch | undefined): string {
    if (!e) {
        return '(invalid epoch)';
    }
    const whole = Math.floor(e.second);
    let frac = (e.second - whole).toFixed(7).substring(2).replace(/0+$/, '');
    if (frac.length < 3) {
        frac = frac.padEnd(3, '0');
    }
    return `${pad(e.year, 4)}-${pad(e.month)}-${pad(e.day)} ${pad(e.hour)}:${pad(e.minute)}:${pad(whole)}.${frac}`;
}

/** Milliseconds since 1970 (time-scale agnostic; only for differences/sorting). */
export function epochToMs(e: Epoch): number {
    return Date.UTC(e.year, e.month - 1, e.day, e.hour, e.minute, 0) + e.second * 1000;
}
