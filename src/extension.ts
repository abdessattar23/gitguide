import * as vscode from 'vscode';
import { GitExtension } from './types/git';

let gitExtension: GitExtension | undefined;
let commitReminderTimer: NodeJS.Timeout | undefined;
let autoSnapshotTimer: NodeJS.Timeout | undefined;

// Create output channel for logging
let outputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext) {
    // Initialize output channel
    outputChannel = vscode.window.createOutputChannel('GitGuide');
    outputChannel.appendLine('GitGuide activated');

    // Get the Git extension
    gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')?.exports;
    if (!gitExtension) {
        const error = 'Git extension required';
        outputChannel.appendLine(`Error: ${error}`);
        vscode.window.showErrorMessage(error);
        return;
    }
    outputChannel.appendLine('Git extension found');

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('gitguide.undoLastCommit', StartCommittingAgain),
        vscode.commands.registerCommand('gitguide.applyLastStash', RestoreLastBackup),
        vscode.commands.registerCommand('gitguide.createFeatureBranch', CreateNewBranch)
    );

    // Start timers for reminders and snapshots
    StartReminderTimer();
    StartBackupTimer();

    // Listen for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('gitguide')) {
                RestartTimers();
            }
        })
    );

    // Listen for workspace changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            CheckBranchSuggestion();
        })
    );

    // Listen for Git state changes
    const gitApi = gitExtension.getAPI(1);
    context.subscriptions.push(
        gitApi.onDidChangeState(() => {
            CheckBranchSuggestion();
        })
    );

    // Check if we're on main branch and should create a feature branch
    CheckBranchSuggestion();
}

function StartReminderTimer() {
    const config = vscode.workspace.getConfiguration('gitguide');
    const interval = config.get<number>('commitReminderInterval', 15) * 60 * 1000; // Convert to milliseconds
    outputChannel.appendLine(`Reminder timer: ${interval}ms`);

    if (commitReminderTimer) {
        clearInterval(commitReminderTimer);
    }

    commitReminderTimer = setInterval(async () => {
        const repo = gitExtension?.getAPI(1).repositories[0];
        if (!repo) {
            outputChannel.appendLine('No repo found');
            return;
        }

        // Check if we're in a Git repository
        const { exec } = require('child_process');
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) {
            outputChannel.appendLine('No workspace folder found, skipping commit reminder check');
            return;
        }

        const isGitRepo = await new Promise<boolean>((resolve) => {
            exec('git rev-parse --is-inside-work-tree', { cwd: workspacePath }, (error: any) => {
                resolve(!error);
            });
        });

        if (!isGitRepo) {
            outputChannel.appendLine('Not in a Git repository, skipping commit reminder check');
            return;
        }

        if (repo.state.workingTreeChanges.length > 0) {
            const changes = repo.state.workingTreeChanges.length;
            const threshold = config.get<number>('maxFileChangesBeforeReminder', 5);
            outputChannel.appendLine(`Found ${changes} uncommitted changes (threshold: ${threshold})`);
            
            if (changes >= threshold) {
                outputChannel.appendLine('Showing commit reminder');
                const message = `${changes} changes pending. Commit now?`;
                const response = await vscode.window.showInformationMessage(message, 'Yes', 'No');
                if (response === 'Yes') {
                    outputChannel.appendLine('User chose to commit changes');
                    vscode.commands.executeCommand('workbench.view.scm');
                } else {
                    outputChannel.appendLine('User declined to commit changes');
                }
            }
        } else {
            outputChannel.appendLine('No uncommitted changes found');
        }
    }, interval);
}

function StartBackupTimer() {
    const config = vscode.workspace.getConfiguration('gitguide');
    const interval = config.get<number>('autoSnapshotInterval', 10) * 60 * 1000; // Convert to milliseconds
    outputChannel.appendLine(`Backup timer: ${interval}ms`);

    if (autoSnapshotTimer) {
        clearInterval(autoSnapshotTimer);
    }

    autoSnapshotTimer = setInterval(async () => {
        const repo = gitExtension?.getAPI(1).repositories[0];
        if (repo && repo.state.workingTreeChanges.length > 0) {
            outputChannel.appendLine('Found uncommitted changes, showing snapshot prompt');
            const message = 'Backup your changes?';
            const response = await vscode.window.showInformationMessage(message, 'Yes', 'No');
            if (response === 'Yes') {
                outputChannel.appendLine('User chose to create snapshot');
                try {
                    await repo.stash();
                    outputChannel.appendLine('Snapshot created successfully');
                    vscode.window.showInformationMessage('Changes have been stashed successfully.');
                } catch (error) {
                    outputChannel.appendLine(`Error creating snapshot: ${error}`);
                    vscode.window.showErrorMessage('Failed to create snapshot.');
                }
            }
        }
    }, interval);
}

function RestartTimers() {
    StartReminderTimer();
    StartBackupTimer();
}

async function StartCommittingAgain() {
    outputChannel.appendLine('Attempting to undo last commit');
    const repo = gitExtension?.getAPI(1).repositories[0];
    if (!repo) {
        const error = 'No Git repository found.';
        outputChannel.appendLine(`Error: ${error}`);
        vscode.window.showErrorMessage(error);
        return;
    }

    const message = 'Undo last commit?';
    const response = await vscode.window.showWarningMessage(message, 'Yes', 'No');
    if (response === 'Yes') {
        outputChannel.appendLine('User confirmed undo commit');
        try {
            const { exec } = require('child_process');
            const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspacePath) {
                throw new Error('No workspace folder found');
            }

            // Get the current branch
            const currentBranch = repo.state.HEAD?.name;
            if (!currentBranch) {
                throw new Error('No current branch found');
            }

            outputChannel.appendLine(`Undoing last commit on branch: ${currentBranch}`);

            // Use git reset --soft HEAD~1 to undo the last commit while keeping changes
            await new Promise((resolve, reject) => {
                exec('git reset --soft HEAD~1', { cwd: workspacePath }, (error: any) => {
                    if (error) {
                        outputChannel.appendLine(`Git reset error: ${error.message}`);
                        reject(error);
                    } else {
                        outputChannel.appendLine('Git reset command executed successfully');
                        resolve(undefined);
                    }
                });
            });

            outputChannel.appendLine('Last commit undone successfully');
            vscode.window.showInformationMessage('Last commit has been undone. Changes are now staged.');
        } catch (error) {
            outputChannel.appendLine(`Error undoing commit: ${error}`);
            vscode.window.showErrorMessage('Failed to undo last commit.');
        }
    } else {
        outputChannel.appendLine('User cancelled undo commit');
    }
}

async function RestoreLastBackup() {
    outputChannel.appendLine('Attempting to apply last stash');
    const repo = gitExtension?.getAPI(1).repositories[0];
    if (!repo) {
        const error = 'No Git repository found.';
        outputChannel.appendLine(`Error: ${error}`);
        vscode.window.showErrorMessage(error);
        return;
    }

    try {
        const stashes = await repo.getStashes();
        if (stashes.length === 0) {
            outputChannel.appendLine('No stashes found');
            vscode.window.showInformationMessage('No stashes found.');
            return;
        }

        outputChannel.appendLine(`Found ${stashes.length} stashes, applying most recent`);
        await repo.apply(stashes[0]);
        outputChannel.appendLine('Stash applied successfully');
        vscode.window.showInformationMessage('Latest stash has been applied.');
    } catch (error) {
        outputChannel.appendLine(`Error applying stash: ${error}`);
        vscode.window.showErrorMessage('Failed to apply stash.');
    }
}

async function CreateNewBranch() {
    outputChannel.appendLine('Attempting to create feature branch');
    const repo = gitExtension?.getAPI(1).repositories[0];
    if (!repo) {
        const error = 'No Git repository found.';
        outputChannel.appendLine(`Error: ${error}`);
        vscode.window.showErrorMessage(error);
        return;
    }

    const branchName = await vscode.window.showInputBox({
        prompt: 'New branch name',
        placeHolder: 'feature/my-feature'
    });

    if (branchName) {
        outputChannel.appendLine(`Creating branch: ${branchName}`);
        try {
            await repo.createBranch(branchName, true);
            outputChannel.appendLine(`Branch ${branchName} created successfully`);
            vscode.window.showInformationMessage(`Created and switched to branch: ${branchName}`);
        } catch (error) {
            outputChannel.appendLine(`Error creating branch: ${error}`);
            vscode.window.showErrorMessage(`Failed to create branch: ${error}`);
        }
    } else {
        outputChannel.appendLine('Branch creation cancelled by user');
    }
}

async function CheckBranchSuggestion() {
    outputChannel.appendLine('Checking if feature branch suggestion is needed');
    const config = vscode.workspace.getConfiguration('gitguide');
    if (!config.get<boolean>('autoBranchOnMain', true)) {
        outputChannel.appendLine('Auto branch suggestion is disabled in settings');
        return;
    }

    const repo = gitExtension?.getAPI(1).repositories[0];
    if (!repo) {
        outputChannel.appendLine('No Git repository found');
        return;
    }

    const currentBranch = repo.state.HEAD?.name;
    outputChannel.appendLine(`Current branch: ${currentBranch}`);
    
    if (currentBranch === 'main' || currentBranch === 'master') {
        if (repo.state.workingTreeChanges.length > 0) {
            outputChannel.appendLine('On main branch with changes, showing branch suggestion');
            const message = 'You are working on the main branch. Would you like to create a feature branch?';
            const response = await vscode.window.showInformationMessage(message, 'Yes', 'No');
            if (response === 'Yes') {
                outputChannel.appendLine('User chose to create feature branch');
                CreateNewBranch();
            } else {
                outputChannel.appendLine('User declined branch suggestion');
            }
        } else {
            outputChannel.appendLine('On main branch but no changes, skipping suggestion');
        }
    } else {
        outputChannel.appendLine('Not on main branch, skipping suggestion');
    }
}

export function deactivate() {
    outputChannel.appendLine('GitGuide extension deactivated');
    if (commitReminderTimer) {
        clearInterval(commitReminderTimer);
    }
    if (autoSnapshotTimer) {
        clearInterval(autoSnapshotTimer);
    }
} 