import type { SetupState } from '@/runtime/setup-contracts'

const phases = { installation: 'Thiết lập cài đặt', environment: 'Chuẩn bị môi trường', models: 'Chuẩn bị mô hình', starting: 'Khởi động không gian làm việc', ready: 'Đã sẵn sàng', failed: 'Chuẩn bị thất bại' }
const statuses = { pending: 'Đang chờ', running: 'Đang chuẩn bị', downloading: 'Đang tải', paused: 'Đã tạm dừng', ready: 'Đã sẵn sàng', failed: 'Thất bại' }

// Only the explicit fields below enter a report; never serialize private configuration.
export function redactDiagnostics(text: string, homeDir?: string) {
  if (homeDir) text = text.replaceAll(homeDir, '[HOME]').replaceAll(homeDir.replaceAll('\\', '/'), '[HOME]')
  return text
    .replace(/https?:\/\/[^\s<>"']+/gi, raw => raw
      .replace(/^(https?:\/\/)[^/]+@/i, '$1[REDACTED]@')
      .replace(/[?#].*$/, '?[REDACTED]'))
    .replace(/((?:authorization|proxy-authorization)\s*[:=]\s*)(?:bearer|basic)\s+[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/((?:[\w-]*(?:api[_-]?key|token|password|secret)|authorization)\s*["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1[REDACTED]')
    .replace(/(?:[A-Z]:[\\/]Users[\\/]|\/(?:Users|home)\/)[^\\/\r\n]+/gi, '[HOME]')
}

export function setupReport(state?: SetupState | null, requestError = '') {
  if (state?.resources) {
    const resource = state.resources
    state = { ...state, resources: undefined,
      phase: resource.status === 'failed' ? 'failed' : resource.status === 'preparing' || resource.status === 'missing' ? 'models' : state.phase,
      environment: resource.environment.length ? resource.environment : state.environment,
      models: resource.models, error: [state.error, resource.error].filter(Boolean).join('\n') || undefined }
  }
  const lines = [
    `YouDub: ${state?.version || 'Chưa rõ (chưa lấy được phiên bản)'}`,
    `Hệ thống: ${state ? `${state.platform} ${state.arch}${state.osVersion ? ` / ${state.osVersion}` : ''}` : 'Chưa rõ (chưa kết nối dịch vụ)'}`,
    `Giai đoạn: ${state ? phases[state.phase] : 'Kết nối dịch vụ chuẩn bị'}`,
  ]
  if (state) {
    lines.push('', 'Chuẩn bị môi trường:')
    for (const step of state.environment) lines.push(
      `[${statuses[step.status]}] ${step.name}${step.source ? ` | ${step.source}` : ''}`,
      ...(step.detail && step.status !== 'failed' && step.detail !== state.error ? [step.detail] : []),
      ...(step.activity && step.activity !== step.detail && !step.log?.includes(step.activity) ? [step.activity] : []),
    )
    lines.push('', 'Chuẩn bị mô hình:')
    for (const model of state.models) lines.push(
      `[${model.status === 'ready' ? 'Đã đủ tệp' : statuses[model.status]}] ${model.name} ${model.variant} | ${model.received}/${model.total} bytes${model.source ? ` | ${model.source}` : ''}`,
    )
  }
  const errors: string[] = []
  if (requestError) errors.push('Lỗi kết nối:', requestError)
  if (state?.error) errors.push('Lỗi chuẩn bị:', state.error)
  for (const step of state?.environment || []) {
    if (step.status === 'failed' && step.detail && step.detail !== state?.error) errors.push(`${step.name} lỗi:`, step.detail)
  }
  for (const model of state?.models || []) if (model.error) errors.push(`${model.name} lỗi:`, model.error)
  const logs = [...(state?.environment || []), ...(state?.models || [])].filter(item => item.log)
  if (logs.length) { lines.push('', 'Nhật ký tải và cài đặt:'); for (const item of logs) lines.push(`[${item.name}]`, item.log!) }
  if (errors.length) lines.push('', 'Nhật ký lỗi:', ...errors)
  return redactDiagnostics(lines.join('\n'), state?.homeDir)
}

function codeBlock(text: string) {
  const longest = [...text.matchAll(/`+/g)].reduce((length, match) => Math.max(length, match[0].length), 2)
  const fence = '`'.repeat(longest + 1)
  return `${fence}text\n${text}\n${fence}`
}

const issueIntro = '### Mô tả vấn đề\n\nHãy mô tả vấn đề gặp phải.\n\n### Các bước tái hiện\n\n1. \n2. \n\n### Kết quả mong đợi\n\n\n\n### Kết quả thực tế\n\n\n\n### Thông tin cơ bản\n\n'
const issueLogs = '### Nhật ký hoặc ảnh chụp (không bắt buộc)\n\nHãy bổ sung nhật ký hoặc ảnh chụp liên quan, và xóa các thông tin nhạy cảm như API Key, Token, mật khẩu.'
function newIssue(template: 'setup-problem.md' | 'bug-report.md', title: string, body: string) {
  return { url: `https://github.com/liuzhao1225/YouDub-webui/issues/new?${new URLSearchParams({ template, title, body })}` }
}

export interface FeedbackInfo {
  version?: string; platform?: string; arch?: string; osVersion?: string
  page?: string; language?: string; theme?: string; userAgent?: string
}

export function feedbackIssue(info: FeedbackInfo) {
  const platform = ({ darwin: 'macOS', win32: 'Windows', linux: 'Linux' } as Record<string, string>)[info.platform ?? ''] ?? info.platform
  const theme = ({ system: 'Tự động (theo hệ thống)', light: 'Sáng', dark: 'Tối' } as Record<string, string>)[info.theme ?? ''] ?? info.theme
  const details = redactDiagnostics([
    `YouDub: ${info.version || 'Chưa rõ'}`,
    `Hệ thống: ${platform || 'Chưa rõ'}${info.osVersion ? ` / ${info.osVersion}` : ''}`,
    `Kiến trúc: ${info.arch || 'Chưa rõ'}`,
    `Trang: ${info.page?.split(/[?#]/, 1)[0] || 'Chưa rõ'}`,
    `Ngôn ngữ: ${info.language || 'Chưa rõ'}`,
    `Giao diện: ${theme || 'Chưa rõ'}`,
    `Trình khách: ${info.userAgent || 'Chưa rõ'}`,
  ].join('\n'))
  return newIssue('bug-report.md', '[Báo lỗi] ', issueIntro + codeBlock(details) + '\n\n' + issueLogs)
}

export function setupIssue(report: string, state?: SetupState | null) {
  const title = `[Cấu hình môi trường] ${state ? phases[state.phase] : 'Kết nối dịch vụ chuẩn bị'}`
  const intro = '### Mô tả vấn đề\n\nHãy mô tả vấn đề gặp phải khi cấu hình môi trường và các thao tác trước khi lỗi xảy ra.\n\n### Thông tin môi trường\n\n'
  const logs = '### Nhật ký chẩn đoán\n\nHãy dán toàn bộ nhật ký chẩn đoán lấy từ nút "Sao chép nhật ký" trên trang cấu hình môi trường, và bổ sung ảnh chụp liên quan (nếu có).'
  return newIssue('setup-problem.md', title, intro + codeBlock(report.split('\n').slice(0, 3).join('\n')) + '\n\n' + logs)
}
