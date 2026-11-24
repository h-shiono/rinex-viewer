import * as vscode from 'vscode';
import { ModelCache, LANGUAGE_ID, isRinex } from './providers/model';
import { DecorationController } from './providers/decorations';
import { RinexHoverProvider } from './providers/hover';
import { RinexFoldingProvider, RinexSymbolProvider, goToEpoch } from './providers/structure';
import { statusText, summaryMarkdown } from './providers/summary';

const SELECTOR: vscode.DocumentSelector = { language: LANGUAGE_ID };

export function activate(context: vscode.ExtensionContext) {
    const cache = new ModelCache();
    const decorations = new DecorationController(cache);
    const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    status.command = 'rinexViewer.showSummary';

    const config = () => vscode.workspace.getConfiguration('rinexViewer');
    decorations.setEnabled(config().get('decorations.enabled', true));

    let statusTimer: ReturnType<typeof setTimeout> | undefined;
    const updateStatus = () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !isRinex(editor.document) || !config().get('statusBar.enabled', true)) {
            status.hide();
            return;
        }
        const model = cache.get(editor.document);
        status.text = `$(globe) ${statusText(model)}`;
        const tooltip = new vscode.MarkdownString(summaryMarkdown(model));
        tooltip.appendMarkdown('\n\n_Click to open the summary_');
        status.tooltip = tooltip;
        status.show();
    };
    const scheduleStatus = (delay: number) => {
        if (statusTimer) {
            clearTimeout(statusTimer);
        }
        statusTimer = setTimeout(updateStatus, delay);
    };

    context.subscriptions.push(
        cache,
        decorations,
        status,
        { dispose: () => statusTimer && clearTimeout(statusTimer) },
        vscode.languages.registerHoverProvider(SELECTOR, new RinexHoverProvider(cache)),
        vscode.languages.registerDocumentSymbolProvider(SELECTOR, new RinexSymbolProvider(cache), { label: 'RINEX' }),
        vscode.languages.registerFoldingRangeProvider(SELECTOR, new RinexFoldingProvider(cache)),
        vscode.window.onDidChangeActiveTextEditor(() => scheduleStatus(0)),
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (isRinex(e.document) && e.document === vscode.window.activeTextEditor?.document) {
                scheduleStatus(300);
            }
        }),
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('rinexViewer.decorations.enabled')) {
                decorations.setEnabled(config().get('decorations.enabled', true));
            }
            if (e.affectsConfiguration('rinexViewer')) {
                scheduleStatus(0);
            }
        }),
        vscode.commands.registerCommand('rinexViewer.showSummary', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || !isRinex(editor.document)) {
                vscode.window.showInformationMessage('Open a RINEX file to show its summary.');
                return;
            }
            const name = editor.document.uri.path.split('/').pop() ?? 'RINEX';
            const doc = await vscode.workspace.openTextDocument({
                language: 'markdown',
                content: summaryMarkdown(cache.get(editor.document), name),
            });
            await vscode.commands.executeCommand('markdown.showPreviewToSide', doc.uri);
        }),
        vscode.commands.registerCommand('rinexViewer.goToEpoch', () => goToEpoch(cache)),
        vscode.commands.registerCommand('rinexViewer.toggleDecorations', async () => {
            const next = !config().get('decorations.enabled', true);
            await config().update('decorations.enabled', next, vscode.ConfigurationTarget.Global);
        }),
    );

    decorations.refreshAll();
    updateStatus();
}

export function deactivate() {}
