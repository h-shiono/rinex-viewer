import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';

const FIXTURES = path.resolve(__dirname, '../../../test/fixtures');

async function open(name: string): Promise<vscode.TextDocument> {
    let doc = await vscode.workspace.openTextDocument(path.join(FIXTURES, name));
    doc = await vscode.languages.setTextDocumentLanguage(doc, 'rinex');
    await vscode.window.showTextDocument(doc);
    return doc;
}

async function hoverText(doc: vscode.TextDocument, line: number, character: number): Promise<string> {
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
        'vscode.executeHoverProvider', doc.uri, new vscode.Position(line, character));
    return hovers.flatMap((h) => h.contents.map((c) => (typeof c === 'string' ? c : (c as vscode.MarkdownString).value))).join('\n');
}

suite('Extension Test Suite', () => {
    const id = 'hato-gnss.rinex-viewer';

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension(id));
    });

    test('Extension should be able to activate', async function () {
        this.timeout(60 * 1000);
        const extension = vscode.extensions.getExtension(id)!;
        await extension.activate();
        assert.ok(extension.isActive);
    });

    test('Observation hover is computed on demand', async () => {
        const doc = await open('v211_edge.99o');
        // first value of the first satellite: L1 of G01 at 1998-12-31 23:59:59.5
        const text = await hoverText(doc, 8, 5);
        assert.match(text, /1998-12-31 23:59:59\.500/);
        assert.match(text, /G01/);
        assert.match(text, /L1/);
    });
});
