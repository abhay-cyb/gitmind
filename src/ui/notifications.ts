import * as vscode from 'vscode';

export function showInfo(message: string): void {
  vscode.window.showInformationMessage(`GitMind: ${message}`);
}

export function showWarning(message: string): void {
  vscode.window.showWarningMessage(`GitMind: ${message}`);
}

export function showError(message: string): void {
  vscode.window.showErrorMessage(`GitMind: ${message}`);
}
