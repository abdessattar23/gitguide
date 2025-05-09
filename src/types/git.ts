import * as vscode from 'vscode';

export interface GitExtension {
    getAPI(version: number): GitAPI;
}

export interface GitAPI {
    repositories: Repository[];
    onDidChangeState: vscode.Event<void>;
}

export interface Repository {
    state: RepositoryState;
    stash(): Promise<void>;
    apply(stash: Stash): Promise<void>;
    revert(): Promise<void>;
    createBranch(name: string, checkout: boolean): Promise<void>;
    getStashes(): Promise<Stash[]>;
}

export interface RepositoryState {
    HEAD?: Branch;
    workingTreeChanges: Change[];
}

export interface Branch {
    name: string;
    commit: string;
    upstream?: {
        name: string;
        commit: string;
    };
}

export interface Change {
    uri: vscode.Uri;
    originalUri: vscode.Uri;
    renameUri?: vscode.Uri;
    status: Status;
}

export interface Stash {
    index: number;
    description: string;
    commit: string;
}

export enum Status {
    INDEX_MODIFIED = 'INDEX_MODIFIED',
    INDEX_ADDED = 'INDEX_ADDED',
    INDEX_DELETED = 'INDEX_DELETED',
    INDEX_RENAMED = 'INDEX_RENAMED',
    INDEX_COPIED = 'INDEX_COPIED',
    MODIFIED = 'MODIFIED',
    DELETED = 'DELETED',
    UNTRACKED = 'UNTRACKED',
    IGNORED = 'IGNORED',
    INTENT_TO_ADD = 'INTENT_TO_ADD',
    INTENT_TO_RENAME = 'INTENT_TO_RENAME',
    TYPE_CHANGED = 'TYPE_CHANGED',
    CONFLICTED = 'CONFLICTED'
} 