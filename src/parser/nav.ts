import { LineSource, floatField, normalizeSat } from './text';
import { RinexHeader, v2NavSystem } from './header';
import { Epoch, epochToMs, parseEpoch } from './time';
import { Field, legacyMessage, navRows } from './navfields';

export type NavKind = 'EPH' | 'STO' | 'EOP' | 'ION';

export interface NavRecord {
    kind: NavKind;
    sys: string;
    /** Satellite id, e.g. "G01". */
    sat: string;
    /** Message type: "LNAV", "CNAV", "FDMA", ... (inferred for RINEX 2/3). */
    msg: string;
    /** First line of the record (RINEX 4: the "> EPH ..." line). */
    line: number;
    /** Line carrying the satellite id / epoch (row 0 of the field layout). */
    dataLine: number;
    /** Last line of the record (inclusive). */
    endLine: number;
    time?: Epoch;
}

export interface NavIndex {
    header: RinexHeader;
    records: NavRecord[];
}

const V4_KINDS = new Set(['EPH', 'STO', 'EOP', 'ION']);

export function parseNav(src: LineSource, header: RinexHeader): NavIndex {
    const index: NavIndex = { header, records: [] };
    if (header.endLine < 0) {
        return index;
    }
    if (header.version >= 4) {
        parseV4(src, index);
    } else {
        parseV2V3(src, index);
    }
    return index;
}

/** RINEX 2/3: a record starts on a line whose first column(s) are not blank. */
function parseV2V3(src: LineSource, index: NavIndex) {
    const v2 = index.header.version < 3;
    const defaultSys = v2 ? v2NavSystem(index.header.typeChar) : 'G';
    let current: NavRecord | undefined;

    for (let i = index.header.endLine + 1; i < src.lineCount; i++) {
        const line = src.line(i);
        if (line.trim() === '') {
            continue;
        }
        const isStart = v2 ? line.substring(0, 2).trim() !== '' : line.charAt(0) !== ' ';
        if (!isStart) {
            if (current) {
                current.endLine = i;
            }
            continue;
        }
        let sat: string;
        let time: Epoch | undefined;
        if (v2) {
            // Some RINEX 2 variants (e.g. mixed nav) prefix the system letter
            const prefixed = /[A-Z]/.test(line.charAt(0));
            sat = normalizeSat(prefixed ? line.substring(0, 3) : ' ' + line.substring(0, 2), defaultSys);
            time = parseEpoch(line.substring(prefixed ? 3 : 2, 22));
        } else {
            sat = normalizeSat(line.substring(0, 3));
            time = parseEpoch(line.substring(4, 23));
        }
        const sys = sat.charAt(0);
        current = { kind: 'EPH', sys, sat, msg: legacyMessage(sys), line: i, dataLine: i, endLine: i, time };
        index.records.push(current);
    }
}

/** RINEX 4: records start with "> EPH G01 LNAV" style lines. */
function parseV4(src: LineSource, index: NavIndex) {
    let current: NavRecord | undefined;
    for (let i = index.header.endLine + 1; i < src.lineCount; i++) {
        const line = src.line(i);
        if (line.charAt(0) === '>') {
            const kind = line.substring(2, 5);
            if (!V4_KINDS.has(kind)) {
                current = undefined;
                continue;
            }
            // STO/EOP/ION records may carry only the system letter (e.g. "R  ")
            const sys = line.charAt(6);
            const sat = normalizeSat(line.substring(6, 9)) || sys;
            current = {
                kind: kind as NavKind,
                sys,
                sat,
                msg: line.substring(10).trim(),
                line: i,
                dataLine: i + 1,
                endLine: i,
                time: parseEpoch(src.line(i + 1).substring(4, 23)),
            };
            index.records.push(current);
        } else if (current && line.trim() !== '') {
            current.endLine = i;
        }
    }
}

/** One value field located in a record. */
export interface NavCell {
    line: number;
    start: number;
    end: number;
    row: number;
    col: number;
    field: Field;
    raw: string;
    value: number;
}

/** Column starts of the value fields on a given row. */
function columnStarts(rec: NavRecord, version: number, row: number): number[] {
    if (rec.kind === 'STO') {
        return row === 0 ? [24, 42, 60] : [4, 23, 42, 61];
    }
    if (rec.kind === 'EOP') {
        return row <= 1 ? [23, 42, 61] : [4, 23, 42, 61];
    }
    if (version < 3) {
        return row === 0 ? [22, 41, 60] : [3, 22, 41, 60];
    }
    return row === 0 ? [23, 42, 61] : [4, 23, 42, 61];
}

/** Enumerate the fields on one line of a record. */
export function navCellsOnLine(src: LineSource, index: NavIndex, rec: NavRecord, line: number): NavCell[] {
    const row = line - rec.dataLine;
    if (row < 0 || line > rec.endLine) {
        return [];
    }
    const rows = navRows(rec.kind, rec.sys, rec.msg);
    const text = src.line(line);
    const cells: NavCell[] = [];
    const starts = columnStarts(rec, index.header.version, row);
    const width = rec.kind === 'STO' && row === 0 ? 18 : 19;
    starts.forEach((start, col) => {
        if (start >= text.length) {
            return;
        }
        const raw = text.substring(start, start + width);
        if (raw.trim() === '') {
            return;
        }
        cells.push({
            line,
            start,
            end: Math.min(start + width, text.length),
            row,
            col,
            field: rows?.[row]?.[col] ?? null,
            raw: raw.trim(),
            value: floatField(raw, 0, raw.length),
        });
    });
    return cells;
}

export interface NavSummary {
    start?: Epoch;
    end?: Epoch;
    /** Count of records per "KIND SYS MSG" key. */
    messages: Map<string, number>;
    /** Number of ephemerides per satellite. */
    satellites: Map<string, Map<string, number>>;
    ephemerisCount: number;
}

export function summarizeNav(index: NavIndex): NavSummary {
    const messages = new Map<string, number>();
    const bySys = new Map<string, Map<string, number>>();
    let start: Epoch | undefined;
    let end: Epoch | undefined;
    let ephemerisCount = 0;
    for (const r of index.records) {
        const key = `${r.kind} ${r.sys} ${r.msg}`;
        messages.set(key, (messages.get(key) ?? 0) + 1);
        if (r.kind !== 'EPH') {
            continue;
        }
        ephemerisCount++;
        let m = bySys.get(r.sys);
        if (!m) {
            m = new Map();
            bySys.set(r.sys, m);
        }
        m.set(r.sat, (m.get(r.sat) ?? 0) + 1);
        if (r.time) {
            const t = epochToMs(r.time);
            if (!start || t < epochToMs(start)) {
                start = r.time;
            }
            if (!end || t > epochToMs(end)) {
                end = r.time;
            }
        }
    }
    const satellites = new Map(
        [...bySys]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([sys, m]) => [sys, new Map([...m].sort(([a], [b]) => a.localeCompare(b)))]),
    );
    return { start, end, messages: new Map([...messages].sort(([a], [b]) => a.localeCompare(b))), satellites, ephemerisCount };
}
