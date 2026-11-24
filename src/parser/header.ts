import { LineSource, headerLabel, intField } from './text';

export type RinexKind = 'obs' | 'nav' | 'other';

/** An observation type code located in the header. */
export interface ObsTypeEntry {
    code: string;
    line: number;
    start: number;
    end: number;
}

export interface HeaderRecord {
    line: number;
    label: string;
}

export interface RinexHeader {
    version: number;
    /** Column 21 of "RINEX VERSION / TYPE" ("O", "N", "G", "H", ...). */
    typeChar: string;
    /** Column 41 of "RINEX VERSION / TYPE" (satellite system, may be blank). */
    systemChar: string;
    kind: RinexKind;
    /**
     * Observation types per system. RINEX 2 types apply to every system and
     * are stored under the key "*".
     */
    obsTypes: Map<string, ObsTypeEntry[]>;
    records: HeaderRecord[];
    /** Line index of "END OF HEADER" (-1 when missing). */
    endLine: number;
    interval?: number;
}

const V2_OBS_LABEL = '# / TYPES OF OBSERV';
const V3_OBS_LABEL = 'SYS / # / OBS TYPES';

/** Upper bound for header scanning (guards against non-RINEX text). */
const MAX_HEADER_LINES = 5000;

export function isRinexFirstLine(line: string): boolean {
    return headerLabel(line) === 'RINEX VERSION / TYPE';
}

export function parseHeader(src: LineSource): RinexHeader {
    const header: RinexHeader = {
        version: 0,
        typeChar: '',
        systemChar: '',
        kind: 'other',
        obsTypes: new Map(),
        records: [],
        endLine: -1,
    };
    if (src.lineCount === 0 || !isRinexFirstLine(src.line(0))) {
        return header;
    }

    // State for observation type lists continued over several lines
    let pendingSys = '';
    let pendingCount = 0;

    const limit = Math.min(src.lineCount, MAX_HEADER_LINES);
    for (let i = 0; i < limit; i++) {
        const line = src.line(i);
        const label = headerLabel(line);
        header.records.push({ line: i, label });

        if (label === 'RINEX VERSION / TYPE') {
            header.version = parseFloat(line.substring(0, 9));
            header.typeChar = line.charAt(20);
            header.systemChar = line.charAt(40);
            header.kind = classify(header.version, header.typeChar);
        } else if (label === V2_OBS_LABEL) {
            if (line.substring(0, 6).trim() !== '') {
                pendingSys = '*';
                pendingCount = intField(line, 0, 6) || 0;
                header.obsTypes.set('*', []);
            }
            const list = header.obsTypes.get('*');
            for (let k = 0; k < 9 && list && list.length < pendingCount; k++) {
                const start = 10 + 6 * k;
                const code = line.substring(start, start + 2).trim();
                if (code) {
                    list.push({ code, line: i, start, end: start + 2 });
                }
            }
        } else if (label === V3_OBS_LABEL) {
            const sys = line.charAt(0);
            if (sys !== ' ') {
                pendingSys = sys;
                pendingCount = intField(line, 3, 6) || 0;
                header.obsTypes.set(sys, []);
            }
            const list = header.obsTypes.get(pendingSys);
            for (let k = 0; k < 13 && list && list.length < pendingCount; k++) {
                const start = 7 + 4 * k;
                const code = line.substring(start, start + 3).trim();
                if (code) {
                    list.push({ code, line: i, start, end: start + 3 });
                }
            }
        } else if (label === 'INTERVAL') {
            const v = parseFloat(line.substring(0, 10));
            if (v > 0) {
                header.interval = v;
            }
        } else if (label === 'END OF HEADER') {
            header.endLine = i;
            break;
        }
    }
    return header;
}

function classify(version: number, typeChar: string): RinexKind {
    if (typeChar === 'O') {
        return 'obs';
    }
    // RINEX 2: N (GPS), G (GLONASS), H (GEO/SBAS), and the de-facto L/P/Q/E/J
    // RINEX 3/4: N
    if (typeChar === 'N' || (version < 3 && 'GHLPQEJ'.includes(typeChar) && typeChar !== '')) {
        return 'nav';
    }
    return 'other';
}

/** Satellite system implied by a RINEX 2 navigation file type character. */
export function v2NavSystem(typeChar: string): string {
    switch (typeChar) {
        case 'G': return 'R';
        case 'H': return 'S';
        case 'L': case 'E': return 'E';
        case 'Q': case 'J': return 'J';
        default: return 'G';
    }
}
