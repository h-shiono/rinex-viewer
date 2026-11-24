import * as vscode from 'vscode';
import { LineSource, RinexModel, parseRinex } from '../parser';

export const LANGUAGE_ID = 'rinex';

export function isRinex(doc: vscode.TextDocument): boolean {
    return doc.languageId === LANGUAGE_ID;
}

/** Adapts a TextDocument to the parser's LineSource. */
export function documentSource(doc: vscode.TextDocument): LineSource {
    const count = doc.lineCount;
    return {
        lineCount: count,
        line: (i) => (i >= 0 && i < count ? doc.lineAt(i).text : ''),
    };
}

interface Entry {
    version: number;
    model: RinexModel;
}

/**
 * Parses each RINEX document at most once per document version.
 * All providers share the same index.
 */
export class ModelCache implements vscode.Disposable {
    private readonly entries = new Map<string, Entry>();
    private readonly disposables: vscode.Disposable[] = [];

    constructor() {
        this.disposables.push(
            vscode.workspace.onDidCloseTextDocument((doc) => this.entries.delete(doc.uri.toString())),
        );
    }

    get(doc: vscode.TextDocument): RinexModel {
        const key = doc.uri.toString();
        const hit = this.entries.get(key);
        if (hit && hit.version === doc.version) {
            return hit.model;
        }
        const model = parseRinex(documentSource(doc));
        this.entries.set(key, { version: doc.version, model });
        return model;
    }

    dispose() {
        this.entries.clear();
        this.disposables.forEach((d) => d.dispose());
    }
}
