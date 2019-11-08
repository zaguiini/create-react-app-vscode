import * as vscode from 'vscode'
import get from 'lodash.get'
import path from 'path'
import cp from 'child_process'
import kill from 'tree-kill'

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand('extension.cra', () => {
    let output = vscode.window.createOutputChannel('Create React App')

    const values = {
      path: '',
      id: '',
      typeScript: false,
    }

    const input = vscode.window.createInputBox()
    input.prompt = 'Type the identifier of your React app'
    input.show()

    input.onDidChangeValue(() => {
      input.validationMessage = undefined
    })

    input.onDidAccept(async () => {
      if (!input.value.length || /[^a-z0-9\-]/g.test(input.value)) {
        input.validationMessage = 'Invalid name'
        return
      }

      values.id = input.value
      input.dispose()

      await vscode.window.showQuickPick(['Yep', 'Nope'], {
        placeHolder: 'Typescript?',
        onDidSelectItem: item => {
          if (item === 'Yep') {
            values.typeScript = true
          }
        },
      })

      try {
        const result = await vscode.window.showOpenDialog({
          canSelectFolders: true,
          canSelectFiles: false,
        })

        const path = get(result, '[0].path')

        if (!path) {
          throw new Error('undefined path')
        }

        values.path = path
      } catch (e) {
        return
      }

      vscode.window.withProgress(
        {
          title: 'Creating your React app',
          location: vscode.ProgressLocation.Notification,
          cancellable: true,
        },
        (progress, token) => {
          return new Promise(async (resolve, reject) => {
            const reportTimeout = setTimeout(() => {
              progress.report({
                message: 'Hang on tight! I am working on it.',
              })
            }, 5000)

            let command = `npx create-react-app ${values.id}`

            if (values.typeScript) {
              command += ' --typescript'
            }

            const context = cp.exec(command, { cwd: values.path }, err => {
              clearTimeout(reportTimeout)

              if (err) {
                reject()

                if (!token.isCancellationRequested) {
                  vscode.window.showErrorMessage(
                    'Failed to create your React app. Sorry :/ Try again!'
                  )

                  output.append(err.name)
                  output.append(err.stack || '')
                  output.show()
                }

                return
              }

              resolve()

              vscode.window
                .showInformationMessage(
                  'Successfully created! Where do you want to open it?',
                  'Current workspace',
                  'New window',
                  `Don't open`
                )
                .then(item => {
                  const appUri = vscode.Uri.file(
                    path.resolve(values.path, values.id)
                  )

                  if (item === 'Current workspace') {
                    vscode.workspace.updateWorkspaceFolders(0, 0, {
                      uri: appUri,
                    })
                  } else if (item === 'New window') {
                    vscode.commands.executeCommand('vscode.openFolder', appUri)
                  }
                })
            })

            token.onCancellationRequested(() => {
              clearTimeout(reportTimeout)
              kill(context.pid)
              reject()

              vscode.window
                .showWarningMessage(
                  `Ok, canceled. What about the "${values.id}" folder that I created for the app?`,
                  'Delete it',
                  'Keep it as it is'
                )
                .then(item => {
                  if (item === 'Delete it') {
                    cp.exec(`rm -rf ${values.id}`, { cwd: values.path })
                  }
                })
            })
          })
        }
      )
    })
  })

  context.subscriptions.push(disposable)
}

export function deactivate() {}
