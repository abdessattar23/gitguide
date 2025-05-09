# GitGuide

A smart Git assistant for VS Code that helps you follow good Git practices.

## Features

- **Commit Reminders**: Get reminded to commit your changes after a configurable amount of time or number of file modifications
- **Auto Branch Suggestion**: Get prompted to create a feature branch when working on main/master
- **Auto Snapshot (Backup)**: Automatically create backups of your working directory using Git stash
- **Undo Changes**: Easily undo your last commit or retrieve the latest stash
- **Configurable**: Customize the extension's behavior through VS Code settings


## Requirements

- VS Code 1.85.0 or higher
- Git extension for VS Code

## Extension Settings

This extension contributes the following settings:

* `gitguide.commitReminderInterval`: Minutes before reminding to commit (default: 15)
* `gitguide.maxFileChangesBeforeReminder`: Number of changes before prompting to commit (default: 5)
* `gitguide.autoBranchOnMain`: Prompt to create a branch when on main/master (default: true)
* `gitguide.autoSnapshotInterval`: Minutes between auto-backups using git stash (default: 10)
* `gitguide.useCommitMessages`: Enable commit message prompts (default: true)
* `gitguide.undoEnabled`: Enable undo functionality (default: true)

## Commands

* `GitGuide: Undo Last Commit` - Undo the last commit
* `GitGuide: Apply Last Stash` - Apply the most recent stash
* `GitGuide: Create Feature Branch` - Create and switch to a new feature branch

## Known Issues

None at the moment.

## Release Notes

### 1.0.1

Initial release of GitGuide:
- Basic Git integration
- Commit reminders
- Auto branch suggestions
- Auto snapshots
- Undo functionality

### 1.0.2

Initial release of GitGuide:
- Fixing the stash apply command

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 