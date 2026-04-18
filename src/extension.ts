import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

const STATE_KEY = "gitignoreHider.addedPatterns";
const STATE_HIDDEN = "gitignoreHider.isHidden";

function parseGitignore(content: string): string[] {
  const patterns: string[] = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("!")) continue;

    let pattern = line;
    const anchored = pattern.startsWith("/");
    if (anchored) pattern = pattern.slice(1);
    if (pattern.endsWith("/")) pattern = pattern.slice(0, -1);
    if (!pattern) continue;

    if (!anchored && !pattern.includes("/")) {
      patterns.push(`**/${pattern}`);
    } else {
      patterns.push(pattern);
    }
  }
  return Array.from(new Set(patterns));
}

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function readGitignorePatterns(): string[] {
  const root = getWorkspaceRoot();
  if (!root) return [];
  const gitignorePath = path.join(root, ".gitignore");
  if (!fs.existsSync(gitignorePath)) return [];
  const content = fs.readFileSync(gitignorePath, "utf-8");
  const extras = vscode.workspace
    .getConfiguration("gitignoreHider")
    .get<string[]>("additionalPatterns", []);
  return Array.from(new Set([...parseGitignore(content), ...extras]));
}

async function applyHide(context: vscode.ExtensionContext): Promise<void> {
  const patterns = readGitignorePatterns();
  if (patterns.length === 0) {
    vscode.window.showInformationMessage(
      "Gitignore Hider: no patterns found in .gitignore",
    );
    return;
  }

  const filesConfig = vscode.workspace.getConfiguration("files");
  const currentExclude =
    (filesConfig.get<Record<string, boolean>>("exclude") as Record<
      string,
      boolean
    >) ?? {};

  const next = { ...currentExclude };
  for (const p of patterns) next[p] = true;

  await filesConfig.update(
    "exclude",
    next,
    vscode.ConfigurationTarget.Workspace,
  );
  await context.workspaceState.update(STATE_KEY, patterns);
  await context.workspaceState.update(STATE_HIDDEN, true);
  vscode.window.setStatusBarMessage(
    `Gitignore Hider: hid ${patterns.length} patterns`,
    3000,
  );
}

async function applyShow(context: vscode.ExtensionContext): Promise<void> {
  const added = context.workspaceState.get<string[]>(STATE_KEY, []);
  if (added.length === 0) {
    await context.workspaceState.update(STATE_HIDDEN, false);
    vscode.window.showInformationMessage(
      "Gitignore Hider: nothing to restore",
    );
    return;
  }

  const filesConfig = vscode.workspace.getConfiguration("files");
  const currentExclude =
    (filesConfig.get<Record<string, boolean>>("exclude") as Record<
      string,
      boolean
    >) ?? {};

  const next = { ...currentExclude };
  for (const p of added) delete next[p];

  await filesConfig.update(
    "exclude",
    next,
    vscode.ConfigurationTarget.Workspace,
  );
  await context.workspaceState.update(STATE_KEY, []);
  await context.workspaceState.update(STATE_HIDDEN, false);
  vscode.window.setStatusBarMessage(
    `Gitignore Hider: restored ${added.length} patterns`,
    3000,
  );
}

function updateStatusBar(
  item: vscode.StatusBarItem,
  hidden: boolean,
): void {
  item.text = hidden ? "$(eye-closed)" : "$(eye)";
  item.tooltip = hidden
    ? ".gitignore entries hidden — click to show"
    : ".gitignore entries visible — click to hide";
  item.command = "gitignoreHider.toggle";
  item.show();
}

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  context.subscriptions.push(statusBar);
  updateStatusBar(
    statusBar,
    context.workspaceState.get<boolean>(STATE_HIDDEN, false),
  );

  const toggle = async () => {
    const isHidden = context.workspaceState.get<boolean>(STATE_HIDDEN, false);
    if (isHidden) await applyShow(context);
    else await applyHide(context);
    updateStatusBar(
      statusBar,
      context.workspaceState.get<boolean>(STATE_HIDDEN, false),
    );
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("gitignoreHider.hide", async () => {
      await applyHide(context);
      updateStatusBar(statusBar, true);
    }),
    vscode.commands.registerCommand("gitignoreHider.show", async () => {
      await applyShow(context);
      updateStatusBar(statusBar, false);
    }),
    vscode.commands.registerCommand("gitignoreHider.toggle", toggle),
    vscode.commands.registerCommand("gitignoreHider.refresh", async () => {
      const wasHidden = context.workspaceState.get<boolean>(
        STATE_HIDDEN,
        false,
      );
      if (wasHidden) {
        await applyShow(context);
        await applyHide(context);
        updateStatusBar(statusBar, true);
      } else {
        vscode.window.showInformationMessage(
          "Gitignore Hider: not currently hiding — run Hide first",
        );
      }
    }),
  );

  const root = getWorkspaceRoot();
  if (root) {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(root, ".gitignore"),
    );
    const refreshIfHidden = async () => {
      if (context.workspaceState.get<boolean>(STATE_HIDDEN, false)) {
        await applyShow(context);
        await applyHide(context);
        updateStatusBar(statusBar, true);
      }
    };
    watcher.onDidChange(refreshIfHidden);
    watcher.onDidCreate(refreshIfHidden);
    watcher.onDidDelete(refreshIfHidden);
    context.subscriptions.push(watcher);
  }

  const autoHide = vscode.workspace
    .getConfiguration("gitignoreHider")
    .get<boolean>("autoHideOnStartup", false);
  if (autoHide && !context.workspaceState.get<boolean>(STATE_HIDDEN, false)) {
    await applyHide(context);
    updateStatusBar(statusBar, true);
  }
}

export function deactivate(): void {}
