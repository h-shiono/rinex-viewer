import { LineSource, floatField, intField, normalizeSat } from './text';
import { RinexHeader } from './header';
import { Epoch, epochToMs, parseEpoch } from './time';

/** One epoch with observation data (epoch flag 0, 1 or 6). */
export interface ObsEpoch {
    /** First line of the epoch record. */
    line: number;
    /** Last line of the epoch record header (RINEX 2 satellite continuation lines). */
    headerEndLine: number;
    /** Last line belonging to this epoch (inclusive). */
    endLine: number;
    time?: Epoch;
    flag: number;
    sats: string[];
    /** Number of lines occupied by one satellite (RINEX 2: ceil(nobs / 5)). */
    linesPerSat: number;
}

/** Special event records (epoch flag 2-5) and the lines that follow them. */
export interface ObsEvent {
    line: number;
    endLine: number;
    flag: number;
    time?: Epoch;
}

export interface ObsIndex {
    header: RinexHeader;
    epochs: ObsEpoch[];
    events: ObsEvent[];
    /** Satellites per system, in first-seen order. */
    satellites: Map<string, Set<string>>;
}

export const EPOCH_FLAGS: Record<number, string> = {
    0: 'OK',
    1: 'Power failure between previous and current epoch',
    2: 'Start moving antenna',
    3: 'New site occupation (end of kinematic data)',
    4: 'Header information follows',
    5: 'External event',
    6: 'Cycle slip records follow',
};

export function parseObs(src: LineSource, header: RinexHeader): ObsIndex {
    const index: ObsIndex = { header, epochs: [], events: [], satellites: new Map() };
    if (header.endLine < 0) {
        return index;
    }
    if (header.version < 3) {
        parseV2Body(src, index);
    } else {
        parseV3Body(src, index);
    }
    return index;
}

function addSat(index: ObsIndex, sat: string) {
    const sys = sat.charAt(0);
    let set = index.satellites.get(sys);
    if (!set) {
        set = new Set();
        index.satellites.set(sys, set);
    }
    set.add(sat);
}

function parseV2Body(src: LineSource, index: ObsIndex) {
    const nobs = index.header.obsTypes.get('*')?.length ?? 0;
    const linesPerSat = Math.max(1, Math.ceil(nobs / 5));

    let i = index.header.endLine + 1;
    while (i < src.lineCount) {
        const line = src.line(i);
        if (line.trim() === '') {
            i++;
            continue;
        }
        const flag = intField(line, 28, 29);
        const num = intField(line, 29, 32);
        if (!Number.isFinite(num) || num < 0) {
            i++; // not an epoch line; resynchronize
            continue;
        }
        const time = parseEpoch(line.substring(0, 26));

        if (flag >= 2 && flag <= 5) {
            index.events.push({ line: i, endLine: i + num, flag, time });
            i += num + 1;
            continue;
        }

        const sats: string[] = [];
        for (let j = 0; j < num; j++) {
            const l = src.line(i + Math.floor(j / 12));
            const col = 32 + 3 * (j % 12);
            const sat = normalizeSat(l.substring(col, col + 3));
            sats.push(sat);
            if (sat) {
                addSat(index, sat);
            }
        }
        const headerEndLine = i + Math.max(0, Math.ceil(num / 12) - 1);
        const endLine = headerEndLine + num * linesPerSat;
        index.epochs.push({
            line: i,
            headerEndLine,
            endLine,
            time,
            flag: Number.isFinite(flag) ? flag : 0,
            sats,
            linesPerSat,
        });
        i = endLine + 1;
    }
}

function parseV3Body(src: LineSource, index: ObsIndex) {
    let i = index.header.endLine + 1;
    while (i < src.lineCount) {
        const line = src.line(i);
        if (line.charAt(0) !== '>') {
            i++; // stray line; resynchronize on the next epoch record
            continue;
        }
        const flag = intField(line, 31, 32);
        const num = intField(line, 32, 35);
        const time = parseEpoch(line.substring(2, 29));
        const count = Number.isFinite(num) && num > 0 ? num : 0;

        if (flag >= 2 && flag <= 5) {
            index.events.push({ line: i, endLine: i + count, flag, time });
            i += count + 1;
            continue;
        }

        const sats: string[] = [];
        for (let j = 1; j <= count && i + j < src.lineCount; j++) {
            const sat = normalizeSat(src.line(i + j).substring(0, 3));
            sats.push(sat);
            if (sat) {
                addSat(index, sat);
            }
        }
        index.epochs.push({
            line: i,
            headerEndLine: i,
            endLine: i + sats.length,
            time,
            flag: Number.isFinite(flag) ? flag : 0,
            sats,
            linesPerSat: 1,
        });
        i += sats.length + 1;
    }
}

/** Binary search for the record (epoch or event) whose line range contains `line`. */
export function findByLine<T extends { line: number; endLine: number }>(items: T[], line: number): T | undefined {
    let lo = 0;
    let hi = items.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const it = items[mid];
        if (line < it.line) {
            hi = mid - 1;
        } else if (line > it.endLine) {
            lo = mid + 1;
        } else {
            return it;
        }
    }
    return undefined;
}

/** Index of the first item whose endLine >= line. */
export function lowerBound<T extends { endLine: number }>(items: T[], line: number): number {
    let lo = 0;
    let hi = items.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (items[mid].endLine < line) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    return lo;
}

/** A single observation value cell located on a data line. */
export interface ObsCell {
    line: number;
    /** Column range of the F14.3 value. */
    start: number;
    end: number;
    sat: string;
    obsType: string;
    /** Index of the observation type in the header list. */
    typeIndex: number;
    value: number;
    lli: string;
    ssi: string;
}

/** Observation types applicable to a satellite. */
export function obsTypesFor(header: RinexHeader, sat: string): string[] {
    const list = header.version < 3 ? header.obsTypes.get('*') : header.obsTypes.get(sat.charAt(0));
    return list ? list.map((e) => e.code) : [];
}

/**
 * Enumerate observation cells on a data line of an epoch.
 * Returns an empty array for epoch header lines.
 */
export function cellsOnLine(src: LineSource, index: ObsIndex, epoch: ObsEpoch, line: number): ObsCell[] {
    if (line <= epoch.headerEndLine || line > epoch.endLine) {
        return [];
    }
    const rel = line - epoch.headerEndLine - 1;
    const satIdx = Math.floor(rel / epoch.linesPerSat);
    const sub = rel % epoch.linesPerSat;
    const sat = epoch.sats[satIdx];
    if (!sat) {
        return [];
    }
    const types = obsTypesFor(index.header, sat);
    const text = src.line(line);
    const cells: ObsCell[] = [];
    const v2 = index.header.version < 3;
    const perLine = v2 ? 5 : types.length;
    const first = v2 ? sub * 5 : 0;
    const last = Math.min(types.length, first + perLine);
    for (let k = first; k < last; k++) {
        const start = v2 ? 16 * (k - first) : 3 + 16 * k;
        if (start >= text.length) {
            break;
        }
        const end = Math.min(start + 14, text.length);
        cells.push({
            line,
            start,
            end,
            sat,
            obsType: types[k],
            typeIndex: k,
            value: floatField(text, start, start + 14),
            lli: text.charAt(start + 14).trim(),
            ssi: text.charAt(start + 15).trim(),
        });
    }
    return cells;
}

export interface ObsSummary {
    start?: Epoch;
    end?: Epoch;
    epochCount: number;
    eventCount: number;
    /** Interval from the header, or the most frequent epoch spacing [s]. */
    interval?: number;
    satellites: Map<string, string[]>;
    satelliteCount: number;
}

export function summarizeObs(index: ObsIndex): ObsSummary {
    const timed = index.epochs.filter((e) => e.time);
    const satellites = new Map<string, string[]>();
    let satelliteCount = 0;
    for (const [sys, set] of [...index.satellites].sort(([a], [b]) => a.localeCompare(b))) {
        const list = [...set].sort();
        satellites.set(sys, list);
        satelliteCount += list.length;
    }
    return {
        start: timed[0]?.time,
        end: timed[timed.length - 1]?.time,
        epochCount: index.epochs.length,
        eventCount: index.events.length,
        interval: index.header.interval ?? estimateInterval(timed),
        satellites,
        satelliteCount,
    };
}

function estimateInterval(epochs: ObsEpoch[]): number | undefined {
    const counts = new Map<number, number>();
    for (let k = 1; k < Math.min(epochs.length, 200); k++) {
        const dt = Math.round(epochToMs(epochs[k].time!) - epochToMs(epochs[k - 1].time!)) / 1000;
        if (dt > 0) {
            counts.set(dt, (counts.get(dt) ?? 0) + 1);
        }
    }
    let best: number | undefined;
    let bestCount = 0;
    for (const [dt, c] of counts) {
        if (c > bestCount) {
            best = dt;
            bestCount = c;
        }
    }
    return best;
}
