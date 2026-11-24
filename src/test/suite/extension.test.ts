import * as assert from 'assert';
import * as vscode from 'vscode';

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
});
