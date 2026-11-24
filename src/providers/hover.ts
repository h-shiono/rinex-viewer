import * as vscode from 'vscode';
import {
    EPOCH_FLAGS, HEADER_LABELS, RinexModel, SYSTEM_NAMES,
    cellsOnLine, describeLli, describeObsCode, describeSsi, findByLine, formatEpoch, headerLabel,
} from '../parser';
import { ModelCache, documentSource } from './model';

const code = (s: string | number) => '`' + String(s).replace(/`/g, '') + '`';
const sysName = (sat: string) => SYSTEM_NAMES[sat.charAt(0)] ?? sat.charAt(0);

function table(rows: [string, string][]): vscode.MarkdownString {
    const md = ['| | |', '| --- | --- |', ...rows.filter(([, v]) => v !== '').map(([k, v]) => `| ${k} | ${v} |`)];
    return new vscode.MarkdownString(md.join('\n'));
}

function hit(pos: vscode.Position, start: number, end: number): boolean {
    return pos.character >= start && pos.character < Math.max(end, start + 1);
}

/** Hover computed on demand from the cached line index (no per-value objects). */
export class RinexHoverProvider implements vscode.HoverProvider {
    constructor(private readonly cache: ModelCache) {}

    provideHover(doc: vscode.TextDocument, pos: vscode.Position): vscode.Hover | undefined {
        const model = this.cache.get(doc);
        if (model.header.endLine < 0 && model.header.version === 0) {
            return undefined;
        }
        if (pos.line <= model.header.endLine || model.header.endLine < 0) {
            return this.headerHover(model, doc, pos);
        }
        if (model.kind === 'obs') {
            return this.obsHover(model, doc, pos);
        }
        return undefined;
    }

    private headerHover(model: RinexModel, doc: vscode.TextDocument, pos: vscode.Position): vscode.Hover | undefined {
        for (const [sys, list] of model.header.obsTypes) {
            const e = list.find((x) => x.line === pos.line && hit(pos, x.start, x.end));
            if (e) {
                const d = describeObsCode(e.code, sys === '*' ? 'G' : sys);
                return new vscode.Hover(table([
                    ['Obs. type', code(e.code)],
                    ['System', sys === '*' ? 'all' : SYSTEM_NAMES[sys] ?? sys],
                    ['Kind', d.kind + (d.unit ? ` [${d.unit}]` : '')],
                    ['Band', d.band],
                ]), new vscode.Range(e.line, e.start, e.line, e.end));
            }
        }
        const line = doc.lineAt(pos.line).text;
        const label = headerLabel(line);
        if (label && pos.character >= 60) {
            const desc = HEADER_LABELS[label];
            return new vscode.Hover(new vscode.MarkdownString(`**${label}**${desc ? '\n\n' + desc : ''}`),
                new vscode.Range(pos.line, 60, pos.line, line.length));
        }
        return undefined;
    }

    private obsHover(model: Extract<RinexModel, { kind: 'obs' }>, doc: vscode.TextDocument, pos: vscode.Position) {
        const obs = model.obs;
        const ev = findByLine(obs.events, pos.line);
        if (ev) {
            return new vscode.Hover(table([
                ['Event flag', `${code(ev.flag)} ${EPOCH_FLAGS[ev.flag] ?? ''}`],
                ['Epoch', ev.time ? code(formatEpoch(ev.time)) : ''],
                ['Records', code(ev.endLine - ev.line)],
            ]));
        }
        const ep = findByLine(obs.epochs, pos.line);
        if (!ep) {
            return undefined;
        }
        const epoch = code(formatEpoch(ep.time));
        if (pos.line <= ep.headerEndLine) {
            return new vscode.Hover(table([
                ['Epoch', epoch],
                ['Flag', `${code(ep.flag)} ${EPOCH_FLAGS[ep.flag] ?? ''}`],
                ['Satellites', code(ep.sats.length)],
            ]));
        }
        const cells = cellsOnLine(documentSource(doc), obs, ep, pos.line);
        const cell = cells.find((c) => hit(pos, c.start, c.start + 16));
        if (!cell) {
            const sat = cells[0]?.sat;
            return sat ? new vscode.Hover(table([['Epoch', epoch], ['Satellite', `${code(sat)} ${sysName(sat)}`]])) : undefined;
        }
        const d = describeObsCode(cell.obsType, cell.sat.charAt(0));
        return new vscode.Hover(table([
            ['Epoch', epoch],
            ['Satellite', `${code(cell.sat)} ${sysName(cell.sat)}`],
            ['Obs. type', `${code(cell.obsType)} ${d.kind}, ${d.band}`],
            ['Value', Number.isFinite(cell.value) ? code(`${cell.value}${d.unit ? ' ' + d.unit : ''}`) : '(blank)'],
            ['LLI', cell.lli ? describeLli(cell.lli) : ''],
            ['SSI', cell.ssi ? describeSsi(cell.ssi) : ''],
        ]), new vscode.Range(cell.line, cell.start, cell.line, cell.end));
    }
}
