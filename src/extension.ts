import * as vscode from 'vscode';
import { ModelCache, LANGUAGE_ID } from './providers/model';
import { DecorationController } from './providers/decorations';
import { RinexHoverProvider } from './providers/hover';

const SELECTOR: vscode.DocumentSelector = { language: LANGUAGE_ID };

export function activate(context: vscode.ExtensionContext) {
    const cache = new ModelCache();
    const decorations = new DecorationController(cache);

    const config = () => vscode.workspace.getConfiguration('rinexViewer');
    decorations.setEnabled(config().get('decorations.enabled', true));

    context.subscriptions.push(
        cache,
        decorations,
        vscode.languages.registerHoverProvider(SELECTOR, new RinexHoverProvider(cache)),
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('rinexViewer.decorations.enabled')) {
                decorations.setEnabled(config().get('decorations.enabled', true));
            }
        }),
        vscode.commands.registerCommand('rinexViewer.toggleDecorations', async () => {
            const next = !config().get('decorations.enabled', true);
            await config().update('decorations.enabled', next, vscode.ConfigurationTarget.Global);
        }),
    );

    decorations.refreshAll();
}

export function deactivate() {}
