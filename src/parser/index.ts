import { LineSource } from './text';
import { RinexHeader, parseHeader } from './header';
import { ObsIndex, parseObs } from './obs';
import { NavIndex, parseNav } from './nav';

export type RinexModel =
    | { kind: 'obs'; header: RinexHeader; obs: ObsIndex }
    | { kind: 'nav'; header: RinexHeader; nav: NavIndex }
    | { kind: 'other'; header: RinexHeader };

/** Parse a whole RINEX document into a line index (no vscode dependency). */
export function parseRinex(src: LineSource): RinexModel {
    const header = parseHeader(src);
    switch (header.kind) {
        case 'obs':
            return { kind: 'obs', header, obs: parseObs(src, header) };
        case 'nav':
            return { kind: 'nav', header, nav: parseNav(src, header) };
        default:
            return { kind: 'other', header };
    }
}

export * from './text';
export * from './time';
export * from './header';
export * from './obs';
export * from './nav';
export * from './navfields';
export * from './codes';
