import { existsSync } from 'node:fs'
import { join } from 'node:path'
import runtimeManifest from './setup-runtime.json' with { type: 'json' }

/**
 * Gói nén FFmpeg trên Windows được giải nén thành thư mục khác nhau tùy theo nguồn tải, nên trình cài đặt và runtime phải dùng cùng một thư mục.
 * Trả về thư mục chứa ffmpeg/ffprobe: trên Windows là thư mục bin sau khi giải nén, các nền tảng khác là runtime/ffmpeg.
 */
export function ffmpegDirectory(root: string, platform = process.platform) {
  const directory = join(root, 'runtime', 'ffmpeg')
  if (platform !== 'win32') return directory
  const assets = runtimeManifest.ffmpeg['win32-x64']
  const installed = assets.find(asset => existsSync(join(directory, asset.directory, 'bin', 'ffmpeg.exe')))
  return join(directory, installed?.directory ?? assets[0]!.directory, 'bin')
}
