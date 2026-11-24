/**
 * Minimal read-only line accessor so that parsers do not depend on the
 * VS Code API. Lines are returned without their line terminator.
 */
export interface LineSource {
    readonly lineCount: number;
    line(index: number): string;
}

/** Build a LineSource from a string (CRLF and LF are both accepted). */
export function fromString(text: string): LineSource {
    const lines = text.split(/\r?\n/);
    return {
        lineCount: lines.length,
        line: (i) => lines[i] ?? '',
    };
}

/** Header label (columns 61-80), trimmed. */
export function headerLabel(line: string): string {
    return line.length > 60 ? line.substring(60).trim() : '';
}

/** Parse a fixed-width integer field; returns NaN when blank. */
export function intField(line: string, start: number, end: number): number {
    const s = line.substring(start, end).trim();
    return s === '' ? NaN : parseInt(s, 10);
}

/** Parse a Fortran style floating point field (accepts D/d exponents). */
export function floatField(line: string, start: number, end: number): number {
    const s = line.substring(start, end).trim();
    return s === '' ? NaN : parseFloat(s.replace(/[dD]/, 'E'));
}

/** Normalize a satellite id: "G 1" / " 1" / "G01" -> "G01". */
export function normalizeSat(raw: string, defaultSys = 'G'): string {
    const sys = raw.charAt(0) === ' ' || raw.charAt(0) === '' ? defaultSys : raw.charAt(0);
    const prn = raw.substring(1, 3).trim();
    return prn === '' ? '' : sys + prn.padStart(2, '0');
}
