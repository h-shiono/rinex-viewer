import { LineSource } from './text';
import { RinexHeader, parseHeader } from './header';
import { ObsIndex, parseObs } from './obs';

export type RinexModel =
    | { kind: 'obs'; header: RinexHeader; obs: ObsIndex }
    | { kind: 'other'; header: RinexHeader };

/** Parse a whole RINEX document into a line index (no vscode dependency). */
export function parseRinex(src: LineSource): RinexModel {
    const header = parseHeader(src);
    switch (header.kind) {
        case 'obs':
            return { kind: 'obs', header, obs: parseObs(src, header) };
        default:
            return { kind: 'other', header };
    }
}

export * from './text';
export * from './time';
export * from './header';
export * from './obs';
export * from './codes';
