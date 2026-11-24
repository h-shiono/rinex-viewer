import * as vscode from 'vscode';
import { RinexModel, cellsOnLine, lowerBound } from '../parser';
import { ModelCache, isRinex, documentSource } from './model';

/** Lines decorated above and below the visible ranges. */
const MARGIN = 200;
/** Re-decorate only when the viewport leaves the decorated window by this much. */
const SLACK = 50;
const SCROLL_DELAY = 40;
const EDIT_DELAY = 300;

/** Underline style per observation kind (C/P solid, L double, D dotted, S dashed). */
const KIND_STYLE: Record<string, [style: string, width: string]> = {
    C: ['solid', '1px'],
    L: ['double', '3px'],
    D: ['dotted', '2px'],
    S: ['dashed', '1px'],
};
const BANDS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

interface Window {
    version: number;
    start: number;
    end: number;
}

export class DecorationController implements vscode.Disposable {
    private readonly obsTypes = new Map<string, vscode.TextEditorDecorationType>();
    private readonly epochHeader: vscode.TextEditorDecorationType;
    private readonly event: vscode.TextEditorDecorationType;
    private readonly all: vscode.TextEditorDecorationType[] = [];

    private readonly windows = new WeakMap<vscode.TextEditor, Window>();
    private readonly timers = new Map<vscode.TextEditor, ReturnType<typeof setTimeout>>();
    private readonly disposables: vscode.Disposable[] = [];
    private enabled = true;

    constructor(private readonly cache: ModelCache) {
        for (const [kind, [style, width]] of Object.entries(KIND_STYLE)) {
            for (const band of BANDS) {
                this.obsTypes.set(kind + band, this.create({
                    borderStyle: `none none ${style} none`,
                    borderWidth: `0 0 ${width} 0`,
                    borderColor: new vscode.ThemeColor(`rinexViewer.band${band}`),
                }));
            }
        }
        this.epochHeader = this.create({ fontWeight: 'bold' });
        this.event = this.create({ fontStyle: 'italic', color: new vscode.ThemeColor('rinexViewer.eventForeground') });

        this.disposables.push(
            vscode.window.onDidChangeVisibleTextEditors((editors) => editors.forEach((e) => this.schedule(e, 0))),
            vscode.window.onDidChangeTextEditorVisibleRanges((e) => this.schedule(e.textEditor, SCROLL_DELAY)),
            vscode.workspace.onDidChangeTextDocument((e) => {
                if (!isRinex(e.document) || e.contentChanges.length === 0) {
                    return;
                }
                for (const editor of vscode.window.visibleTextEditors) {
                    if (editor.document === e.document) {
                        this.schedule(editor, EDIT_DELAY);
                    }
                }
            }),
            vscode.workspace.onDidOpenTextDocument((doc) => {
                // Language mode changed (e.g. plaintext -> rinex) re-opens the document
                for (const editor of vscode.window.visibleTextEditors) {
                    if (editor.document === doc) {
                        this.schedule(editor, 0);
                    }
                }
            }),
        );
    }

    setEnabled(enabled: boolean) {
        this.enabled = enabled;
        this.refreshAll();
    }

    refreshAll() {
        vscode.window.visibleTextEditors.forEach((e) => {
            this.windows.delete(e);
            this.schedule(e, 0);
        });
    }

    private create(options: vscode.DecorationRenderOptions): vscode.TextEditorDecorationType {
        const type = vscode.window.createTextEditorDecorationType(options);
        this.all.push(type);
        return type;
    }

    private schedule(editor: vscode.TextEditor, delay: number) {
        if (!isRinex(editor.document) && !this.windows.has(editor)) {
            return;
        }
        const t = this.timers.get(editor);
        if (t) {
            clearTimeout(t);
        }
        this.timers.set(editor, setTimeout(() => {
            this.timers.delete(editor);
            try {
                this.update(editor);
            } catch (err) {
                console.error('[rinex-viewer] failed to update decorations', err);
            }
        }, delay));
    }

    private clear(editor: vscode.TextEditor) {
        for (const type of this.all) {
            editor.setDecorations(type, []);
        }
        this.windows.delete(editor);
    }

    private update(editor: vscode.TextEditor) {
        const doc = editor.document;
        if (!this.enabled || !isRinex(doc)) {
            this.clear(editor);
            return;
        }
        const visible = editor.visibleRanges;
        if (visible.length === 0) {
            return;
        }
        const first = visible[0].start.line;
        const last = visible[visible.length - 1].end.line;

        const prev = this.windows.get(editor);
        if (prev && prev.version === doc.version
            && (first >= prev.start + SLACK || prev.start === 0)
            && (last <= prev.end - SLACK || prev.end >= doc.lineCount - 1)) {
            return; // still inside the decorated window
        }
        const start = Math.max(0, first - MARGIN);
        const end = Math.min(doc.lineCount - 1, last + MARGIN);
        this.windows.set(editor, { version: doc.version, start, end });

        const model = this.cache.get(doc);
        const buckets = new Map<vscode.TextEditorDecorationType, vscode.Range[]>();
        for (const type of this.all) {
            buckets.set(type, []);
        }
        this.collect(model, doc, start, end, buckets);
        for (const [type, ranges] of buckets) {
            editor.setDecorations(type, ranges);
        }
    }

    private obsType(code: string): vscode.TextEditorDecorationType | undefined {
        const kind = code.charAt(0) === 'P' ? 'C' : code.charAt(0);
        return this.obsTypes.get(kind + code.charAt(1));
    }

    private collect(
        model: RinexModel,
        doc: vscode.TextDocument,
        start: number,
        end: number,
        out: Map<vscode.TextEditorDecorationType, vscode.Range[]>,
    ) {
        const push = (type: vscode.TextEditorDecorationType | undefined, range: vscode.Range) => {
            if (type) {
                out.get(type)!.push(range);
            }
        };
        const lineRange = (line: number) => doc.lineAt(line).range;

        // Header: observation type codes
        for (const list of model.header.obsTypes.values()) {
            for (const e of list) {
                if (e.line >= start && e.line <= end) {
                    push(this.obsType(e.code), new vscode.Range(e.line, e.start, e.line, e.end));
                }
            }
        }

        if (model.kind === 'obs') {
            const { epochs, events } = model.obs;
            const src = documentSource(doc);
            for (let k = lowerBound(epochs, start); k < epochs.length && epochs[k].line <= end; k++) {
                const ep = epochs[k];
                for (let l = Math.max(ep.line, start); l <= Math.min(ep.headerEndLine, end); l++) {
                    push(this.epochHeader, lineRange(l));
                }
                for (let l = Math.max(ep.headerEndLine + 1, start); l <= Math.min(ep.endLine, end); l++) {
                    for (const cell of cellsOnLine(src, model.obs, ep, l)) {
                        push(this.obsType(cell.obsType), new vscode.Range(l, cell.start, l, cell.end));
                    }
                }
            }
            for (let k = lowerBound(events, start); k < events.length && events[k].line <= end; k++) {
                const ev = events[k];
                for (let l = Math.max(ev.line, start); l <= Math.min(ev.endLine, end); l++) {
                    push(this.event, lineRange(l));
                }
            }
        }
    }

    dispose() {
        this.timers.forEach((t) => clearTimeout(t));
        this.timers.clear();
        this.disposables.forEach((d) => d.dispose());
        this.all.forEach((t) => t.dispose());
    }
}
