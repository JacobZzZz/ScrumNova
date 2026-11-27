import { app } from 'electron'
import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

function resolveMacOcrBinary(): string {
  const packagedCandidate = join(process.resourcesPath, 'bin', 'macos-ocr')
  if (app.isPackaged && existsSync(packagedCandidate)) {
    return packagedCandidate
  }
  const devCandidate = join(app.getAppPath(), 'resources', 'bin', 'macos-ocr')
  if (existsSync(devCandidate)) {
    return devCandidate
  }
  throw new Error('未找到 macOS 本地 OCR 组件 (resources/bin/macos-ocr)')
}

export async function recognizeImageText(imagePath: string): Promise<string> {
  if (!existsSync(imagePath)) {
    throw new Error(`图片文件不存在: ${imagePath}`)
  }

  if (process.platform === 'darwin') {
    const binPath = resolveMacOcrBinary()
    const { stdout } = await execFileAsync(binPath, [imagePath], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    })
    return stdout.trim()
  }

  if (process.platform === 'win32') {
    const psScript = `
      Add-Type -AssemblyName System.Runtime.WindowsRuntime
      $null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
      $null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
      $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
      function Await($WinRtTask, $ResultType) {
        $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.IsGenericMethod })[0].MakeGenericMethod($ResultType)
        $netTask = $asTask.Invoke($null, @($WinRtTask))
        $netTask.Wait(-1) | Out-Null
        return $netTask.Result
      }
      $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($args[0])) ([Windows.Storage.StorageFile])
      $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
      $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
      $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
      $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
      $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
      Write-Output ($result.Lines | ForEach-Object { $_.Text })
    `
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', psScript, imagePath],
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    )
    return stdout.trim()
  }

  throw new Error(`当前系统暂不支持本地 OCR: ${process.platform}`)
}
