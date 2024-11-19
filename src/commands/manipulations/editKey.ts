import path from 'path'
import { workspace, Uri, window } from 'vscode'
import { CommandOptions, getNodeOrRecord, getRecordFromNode } from './common'
import { LocaleTreeItem } from '~/views'
import { Log, promptEdit } from '~/utils'
import { Config, CurrentFile, Telemetry, TelemetryKey } from '~/core'

export async function EditKey(item?: LocaleTreeItem | CommandOptions) {
  Telemetry.track(TelemetryKey.EditKey, { source: Telemetry.getActionSource(item) })

  let node = getNodeOrRecord(item)

  if (!node)
    return

  if (node.type === 'node') {
    let locale = Config.displayLanguage
    if (item instanceof LocaleTreeItem && item.displayLocale)
      locale = item.displayLocale

    const record = await getRecordFromNode(node, locale)
    if (!record)
      return
    node = record
  }

  let value = node.value

  if (Config.disablePathParsing && node.shadow && !node.value)
    value = node.keypath

  try {
    let targetFile: Uri | undefined
    let updateKeypath = node.keypath

    if (node.keypath.startsWith('global.')) {
      // 使用 workspace.findFiles 找到 share 目錄下的檔案
      const files = await workspace.findFiles(`**/locales/${node.locale}/share/*.json`)

      const fileChoice = await window.showQuickPick(
        files.map(file => ({
          label: path.basename(file.fsPath),
          description: `Write to share/${path.basename(file.fsPath)}`,
          uri: file,
        })),
        {
          placeHolder: 'Select file to write to',
        },
      )

      if (fileChoice) {
        targetFile = fileChoice.uri
        updateKeypath = node.keypath.replace('global.', '')
      }
    }

    const newvalue = await promptEdit(updateKeypath, node.locale, value)

    if (newvalue !== undefined && newvalue !== node.value) {
      await CurrentFile.loader.write({
        value: newvalue,
        keypath: node.keypath,
        filepath: targetFile?.path,
        locale: node.locale,
        features: node.features,
      })
    }
  }
  catch (err) {
    Log.error(err.toString())
  }
}
