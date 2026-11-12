import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { LanguageProvider } from '@/test/language-provider'
import type { TaskView } from './sdk'
import { TaskProgress, TaskState } from './builtin/task-status'

const task: TaskView = {
  id: 'task', attempt: 1, status: 'running', sourceName: 'video.mp4', createdAt: '2026-10-09T00:00:00Z',
  workflowId: 'test', workflowVersion: '1', config: {}, outputs: [], allowedActions: [],
  steps: [{ id: 'first', label: '前一步', status: 'completed', progress: 1 }, { id: 'current', label: 'Tạo lồng tiếng', status: 'running', progress: 0.25 }],
}
afterEach(() => { cleanup(); window.localStorage.clear() })

it('labels numerical progress as the current step, while retaining completed step counts', () => {
  render(<LanguageProvider><TaskProgress task={task} /></LanguageProvider>)
  expect(screen.getByText('Tạo lồng tiếng · 25%')).toBeInTheDocument()
  expect(screen.getByText('Đã hoàn tất 1/2 步')).toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: 'Tạo lồng tiếng tiến độ' })).toHaveAttribute('aria-valuenow', '25')
})

it.each([
  ['queued', 'Đang xếp hàng'], ['waiting', 'Đang chờ'], ['cancelling', 'Đang hủy'],
  ['succeeded', 'Đã hoàn tất'], ['failed', 'Thất bại'], ['cancelled', 'Đã hủy'],
] as const)('keeps %s distinct and never presents an old running step as live progress', (status, label) => {
  render(<LanguageProvider><TaskState status={status} /><TaskProgress task={{ ...task, status }} /></LanguageProvider>)
  expect(screen.getByText(label)).toBeInTheDocument()
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  expect(screen.queryByText(/25%/)).not.toBeInTheDocument()
  if (['succeeded', 'failed', 'cancelled'].includes(status)) expect(screen.queryByText('Tạo lồng tiếng')).not.toBeInTheDocument()
})
