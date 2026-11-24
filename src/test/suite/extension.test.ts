import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';

const FIXTURES = path.resolve(__dirname, '../../../test/fixtures');

async function open(name: string): Promise<vscode.TextDocument> {
    const doc = await vscode.workspace.openTextDocument(path.join(FIXTURES, name));
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

    // Must run before anything calls activate(): opening a RINEX file alone has to
    // activate the extension (regression: missing onLanguage activation event).
    test('Opening a RINEX file activates the extension', async function () {
        this.timeout(30 * 1000);
        const extension = vscode.extensions.getExtension(id)!;
        assert.ok(!extension.isActive, 'extension was already active before any RINEX file was opened');
        const doc = await open('v302_mixed_crlf.obs');
        for (let i = 0; i < 100 && !extension.isActive; i++) {
            await new Promise((r) => setTimeout(r, 100));
        }
        assert.ok(extension.isActive, 'extension did not activate on a RINEX file');
        assert.match(await hoverText(doc, 44, 24), /G12/);
    });

    test('Extension should be able to activate', async function () {
        this.timeout(60 * 1000);
        const extension = vscode.extensions.getExtension(id)!;
        await extension.activate();
        assert.ok(extension.isActive);
    });

    test('RINEX files are detected by name pattern and extension', async () => {
        for (const name of ['v211_edge.99o', 'v2_gps.10n', 'v201_glo.09g', 'v302_mixed.nav', 'v402_mixed.rnx', 'v302_mixed_crlf.obs']) {
            const doc = await open(name);
            assert.equal(doc.languageId, 'rinex', name);
        }
    });

    test('Observation hover is computed on demand', async () => {
        const doc = await open('v211_edge.99o');
        // first value of the first satellite: L1 of G01 at 1998-12-31 23:59:59.5
        const text = await hoverText(doc, 8, 5);
        assert.match(text, /1998-12-31 23:59:59\.500/);
        assert.match(text, /G01/);
        assert.match(text, /L1/);
    });

    test('Navigation hover shows the field name', async () => {
        const doc = await open('v2_gps.10n');
        const line = doc.getText().split(/\r?\n/).findIndex((l) => l.includes('END OF HEADER')) + 3;
        const text = await hoverText(doc, line, 70); // 4th field of BROADCAST ORBIT 2
        assert.match(text, /√A/);
    });

    test('Outline lists header and epoch groups', async () => {
        const doc = await open('v210_gps.05o');
        const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            'vscode.executeDocumentSymbolProvider', doc.uri);
        assert.equal(symbols[0].name, 'Header');
        assert.equal(symbols[1].name, '2005-04-02 00:00');
        assert.equal(symbols[1].children.length, 3);
    });
});
