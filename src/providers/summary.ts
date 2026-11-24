import { RinexModel, SYSTEM_NAMES, formatEpoch, summarizeNav, summarizeObs } from '../parser';

const code = (s: string | number) => '`' + String(s).replace(/`/g, '') + '`';
const sysName = (sys: string) => SYSTEM_NAMES[sys] ?? sys;

/** Short label for the status bar. */
export function statusText(model: RinexModel): string {
    const v = model.header.version.toFixed(2).replace(/0$/, '');
    if (model.kind === 'obs') {
        return `RINEX ${v} OBS · ${model.obs.epochs.length} epochs`;
    }
    if (model.kind === 'nav') {
        return `RINEX ${v} NAV · ${model.nav.records.length} records`;
    }
    return `RINEX ${v}`;
}

/** Markdown summary of the file (status bar tooltip and summary command). */
export function summaryMarkdown(model: RinexModel, title?: string): string {
    const h = model.header;
    const out: string[] = [];
    if (title) {
        out.push(`# ${title}`, '');
    }
    out.push('| Item | Value |', '| --- | --- |');
    out.push(`| RINEX version | ${code(h.version)} |`);
    out.push(`| File type | ${code(h.typeChar)}${h.systemChar.trim() ? ' / ' + code(h.systemChar) : ''} |`);

    if (model.kind === 'obs') {
        const s = summarizeObs(model.obs);
        out.push(`| Start epoch | ${code(formatEpoch(s.start))} |`);
        out.push(`| End epoch | ${code(formatEpoch(s.end))} |`);
        if (s.interval !== undefined) {
            out.push(`| Interval | ${code(s.interval + ' s')} |`);
        }
        out.push(`| Epochs | ${code(s.epochCount)} |`);
        if (s.eventCount) {
            out.push(`| Event records | ${code(s.eventCount)} |`);
        }
        out.push(`| Satellites | ${code(s.satelliteCount)} |`);
        for (const [sys, sats] of s.satellites) {
            const types = (h.obsTypes.get(sys) ?? h.obsTypes.get('*') ?? []).map((e) => e.code);
            out.push(`| ${sysName(sys)} (${sats.length}) | ${sats.map(code).join(' ')} |`);
            if (types.length) {
                out.push(`| ${sysName(sys)} obs types | ${types.map(code).join(' ')} |`);
            }
        }
    } else if (model.kind === 'nav') {
        const s = summarizeNav(model.nav);
        out.push(`| First ephemeris | ${code(formatEpoch(s.start))} |`);
        out.push(`| Last ephemeris | ${code(formatEpoch(s.end))} |`);
        out.push(`| Ephemerides | ${code(s.ephemerisCount)} |`);
        for (const [sys, sats] of s.satellites) {
            const list = [...sats].map(([sat, n]) => `${code(sat)}×${n}`).join(' ');
            out.push(`| ${sysName(sys)} (${sats.size}) | ${list} |`);
        }
        out.push('', '| Record | Count |', '| --- | --- |');
        for (const [key, n] of s.messages) {
            out.push(`| ${code(key)} | ${n} |`);
        }
    }
    return out.join('\n');
}
