import * as vscode from 'vscode';
import { EPOCH_FLAGS, RinexModel, SYSTEM_NAMES, formatEpoch } from '../parser';
import { ModelCache } from './model';

function lineSpan(doc: vscode.TextDocument, start: number, end: number): vscode.Range {
    const last = Math.min(end, doc.lineCount - 1);
    return new vscode.Range(start, 0, last, doc.lineAt(last).text.length);
}

function headerSymbol(model: RinexModel, doc: vscode.TextDocument): vscode.DocumentSymbol | undefined {
    if (model.header.endLine < 0) {
        return undefined;
    }
    const range = lineSpan(doc, 0, model.header.endLine);
    return new vscode.DocumentSymbol('Header', `RINEX ${model.header.version}`, vscode.SymbolKind.Namespace, range,
        lineSpan(doc, 0, 0));
}

/** Outline: header, then epochs grouped per hour. */
export class RinexSymbolProvider implements vscode.DocumentSymbolProvider {
    constructor(private readonly cache: ModelCache) {}

    provideDocumentSymbols(doc: vscode.TextDocument): vscode.DocumentSymbol[] {
        const model = this.cache.get(doc);
        const result: vscode.DocumentSymbol[] = [];
        const header = headerSymbol(model, doc);
        if (header) {
            result.push(header);
        }

        if (model.kind === 'obs') {
            const items = [
                ...model.obs.epochs.map((e) => ({
                    line: e.line, endLine: e.endLine, time: e.time,
                    name: formatEpoch(e.time),
                    detail: `${e.sats.length} sats${e.flag ? ' · flag ' + e.flag : ''}`,
                    kind: vscode.SymbolKind.Event,
                })),
                ...model.obs.events.map((e) => ({
                    line: e.line, endLine: e.endLine, time: e.time,
                    name: `Event: ${EPOCH_FLAGS[e.flag] ?? 'flag ' + e.flag}`,
                    detail: e.time ? formatEpoch(e.time) : '',
                    kind: vscode.SymbolKind.Key,
                })),
            ].sort((a, b) => a.line - b.line);

            let group: vscode.DocumentSymbol | undefined;
            let groupKey = '';
            for (const it of items) {
                const key = it.time ? formatEpoch(it.time).substring(0, 13) + ':00' : groupKey;
                const sym = new vscode.DocumentSymbol(it.name, it.detail, it.kind,
                    lineSpan(doc, it.line, it.endLine), lineSpan(doc, it.line, it.line));
                if (!group || key !== groupKey) {
                    groupKey = key;
                    group = new vscode.DocumentSymbol(key || '(no epoch)', '', vscode.SymbolKind.Module,
                        sym.range, sym.selectionRange);
                    result.push(group);
                }
                group.children.push(sym);
                group.range = group.range.union(sym.range);
            }
            result.filter((g) => g.kind === vscode.SymbolKind.Module)
                .forEach((g) => (g.detail = `${g.children.length} epochs`));
        }
        return result;
    }
}

/** Folding: header, each epoch / event. */
export class RinexFoldingProvider implements vscode.FoldingRangeProvider {
    constructor(private readonly cache: ModelCache) {}

    provideFoldingRanges(doc: vscode.TextDocument): vscode.FoldingRange[] {
        const model = this.cache.get(doc);
        const out: vscode.FoldingRange[] = [];
        if (model.header.endLine > 0) {
            out.push(new vscode.FoldingRange(0, model.header.endLine, vscode.FoldingRangeKind.Region));
        }
        const add = (items: { line: number; endLine: number }[]) => {
            for (const it of items) {
                if (it.endLine > it.line) {
                    out.push(new vscode.FoldingRange(it.line, it.endLine));
                }
            }
        };
        if (model.kind === 'obs') {
            add(model.obs.epochs);
            add(model.obs.events);
        }
        return out;
    }
}

/** "RINEX: Go to Epoch..." quick pick. */
export async function goToEpoch(cache: ModelCache) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'rinex') {
        return;
    }
    const model = cache.get(editor.document);
    type Item = vscode.QuickPickItem & { line: number };
    let items: Item[] = [];
    if (model.kind === 'obs') {
        items = model.obs.epochs.map((e) => ({
            label: formatEpoch(e.time),
            description: `${e.sats.length} sats${e.flag ? ' · flag ' + e.flag : ''}`,
            line: e.line,
        }));
    }
    if (items.length === 0) {
        vscode.window.showInformationMessage('No epochs found in this RINEX file.');
        return;
    }
    const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Type an epoch (e.g. 2024-08-22 11:30) or satellite', matchOnDescription: true });
    if (picked) {
        const pos = new vscode.Position(picked.line, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.AtTop);
    }
}
