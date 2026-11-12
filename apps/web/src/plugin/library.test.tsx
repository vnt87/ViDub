import { TestFeatureProvider, type TestContext } from './test-bindings'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { LanguageProvider } from '@/test/language-provider'
import { type Catalog, type TaskView } from './sdk'
import { TasksPage, TaskPage } from '../../../harness/src/frontend/task-pages'

const workflow = { id: 'external.text', version: '2.0.0', label: 'Text workflow', inputs: [], configSchema: { type: 'object', properties: { mode: { type: 'string', enum: ['upper', 'lower'] } }, required: ['mode'] }, defaults: { mode: 'upper' } }
const catalog: Catalog = { providers: [], workflows: [workflow, { ...workflow, id: 'another', label: 'Another workflow' }] }
const task: TaskView = { id: 'original', attempt: 2, status: 'succeeded', sourceName: 'document.txt', createdAt: '2026-10-09T00:00:00Z', workflowId: workflow.id, workflowVersion: workflow.version, config: { mode: 'upper' }, steps: [], outputs: [], allowedActions: ['rerun', 'delete'] }
function mount(request: ReturnType<typeof vi.fn>, route = 'task-detail') {
  const push = vi.fn()
  const Page = route === 'library' ? TasksPage : TaskPage
  const context = { apiClient: { request }, navigation: { push },
    slots: { subscribe: () => () => {}, getSnapshot: () => 0, list: () => [] },
    effect: (effect: () => unknown) => effect(),
  } as unknown as TestContext
  const show = () => render(<TestFeatureProvider context={context}><LanguageProvider><Page params={{ id: task.id }} /></LanguageProvider></TestFeatureProvider>)
  const view = show()
  return Object.assign(push, { unmount: view.unmount, show })
}
afterEach(() => { cleanup(); window.localStorage.clear(); vi.restoreAllMocks() })

it('continues a failed task through its existing retry endpoint and refreshes the same task', async () => {
  const failed = { ...task, status: 'failed', allowedActions: ['retry', 'rerun', 'delete'], error: { code: 'FAILED', message: 'Fifth node unavailable' } }
  let current = failed
  const request = vi.fn(async (path: string, init?: RequestInit) => {
    if (path.endsWith('/retry')) {
      expect(init?.method).toBe('POST')
      expect(JSON.parse(init!.body as string)).toEqual({ expectedAttempt: 2 })
      current = { ...failed, status: 'queued', allowedActions: ['cancel'] }
    }
    return current
  })
  const push = mount(request)
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Tiếp tục tác vụ' }))
  await screen.findByRole('button', { name: 'Hủy tác vụ' })
  expect(request).toHaveBeenCalledWith('/api/v2/tasks/original/retry', expect.anything())
  expect(push).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: '从头Thử lại' })).not.toBeInTheDocument()
})

it('keeps the continuation error visible when retry is rejected', async () => {
  mount(vi.fn(async (path: string) => {
    if (path.endsWith('/retry')) throw new Error('Saved result file is missing')
    return { ...task, status: 'failed', allowedActions: ['retry'] }
  }))
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Tiếp tục tác vụ' }))
  expect(await screen.findByText('Saved result file is missing')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Tiếp tục tác vụ' })).toBeEnabled()
})

it('shows the running step and completed step count without inventing total progress', async () => {
  const current: TaskView = { ...task, status: 'running', sourceName: 'very-long-video-title-without-any-spaces-to-keep-the-status-readable.mp4', cover: { url: '/cover/current.jpg' }, steps: [
    ...Array.from({ length: 5 }, (_, index) => ({ id: `done-${index}`, label: 'Done', status: 'completed', progress: 1 })),
    { id: 'synthesize', label: 'Tạo lồng tiếng', status: 'running', progress: null },
    { id: 'align', label: 'Căn chỉnh phụ đề', status: 'pending', progress: null },
    { id: 'export', label: '导出', status: 'pending', progress: null },
  ] }
  mount(vi.fn(async () => ({ items: [current], hasMore: false, limit: 20, offset: 0 })), 'library')
  const heading = await screen.findByRole('heading', { name: current.sourceName })
  expect(heading).toHaveAttribute('title', current.sourceName)
  expect(screen.getByText('Tạo lồng tiếng')).toBeInTheDocument()
  expect(screen.getByText('Đã hoàn tất 5/8 步')).toBeInTheDocument()
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  expect(screen.queryByText(workflow.id)).not.toBeInTheDocument()
  expect(document.querySelector('img')).toHaveAttribute('src', '/cover/current.jpg')
})

it('filters cancelling tasks and distinguishes an empty filter from an empty library', async () => {
  const request = vi.fn(async () => ({ items: [], hasMore: false, limit: 20, offset: 0 }))
  mount(request, 'library')
  await screen.findByText('Chưa có tác vụ nào')
  expect(screen.queryByRole('button', { name: 'Trước' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Tiếp' })).not.toBeInTheDocument()
  await userEvent.setup().click(screen.getByLabelText('Trạng thái tác vụ'))
  await userEvent.setup().click(screen.getByRole('menuitem', { name: 'Đang hủy' }))
  await screen.findByText('Không có tác vụ nào ở trạng thái này')
  expect(screen.queryByText('Chưa có tác vụ nào')).not.toBeInTheDocument()
  expect(request).toHaveBeenCalledWith('/api/v2/tasks?limit=20&offset=0&status=cancelling', expect.objectContaining({ signal: expect.any(AbortSignal) }))
})

it('keeps a way back when the last page becomes empty', async () => {
  const request = vi.fn(async (path: string) => ({ items: path.includes('offset=20') ? [] : [task], hasMore: !path.includes('offset=20'), limit: 20, offset: path.includes('offset=20') ? 20 : 0 }))
  mount(request, 'library')
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Tiếp' }))
  await screen.findByText('Không có tác vụ nào ở trang này')
  expect(screen.queryByText('Chưa có tác vụ nào')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tiếp' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Trước' }))
  await screen.findByRole('heading', { name: 'document.txt' })
  expect(screen.getByRole('button', { name: 'Trước' })).toBeDisabled()
})

it('keeps rerun state until the user checks or clears the failed import, then allows changed configuration', async () => {
  const request = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/v2/catalog') return catalog
    if (path === '/api/v2/tasks/original') return task
    if (init?.method === 'DELETE') return undefined
    if (init?.method === 'POST') throw new Error('Connection interrupted')
    throw new Error('Task not found')
  })
  mount(request)
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Tạo lại' }))
  const workflowSelect = await screen.findByLabelText('Quy trình')
  await user.click(await screen.findByRole('button', { name: 'Tạo tác vụ' }))
  await screen.findByText(/Connection interrupted/)
  const first = JSON.parse(request.mock.calls.find(([, init]) => init?.method === 'POST')![1]!.body as string)
  expect(workflowSelect).toBeDisabled()
  expect(screen.getByLabelText('mode *')).toBeDisabled()
  await user.click(screen.getByRole('button', { name: '查询创建Kết quả' }))
  await screen.findByText(/Task not found/)
  expect(request).toHaveBeenCalledWith(`/api/v2/tasks/${first.id}`, undefined)
  await user.click(screen.getByRole('button', { name: 'Xóa mục nhập này' }))
  await waitFor(() => expect(workflowSelect).toBeEnabled())
  expect(request).toHaveBeenCalledWith(`/api/v2/imports/${first.id}`, { method: 'DELETE' })
  await user.click(screen.getByLabelText('mode *'))
  await user.click(screen.getByRole('menuitem', { name: 'lower' }))
  await user.click(screen.getByRole('button', { name: 'Tạo tác vụ' }))
  const second = JSON.parse(request.mock.calls.filter(([, init]) => init?.method === 'POST').at(-1)![1]!.body as string)
  expect(second.id).not.toBe(first.id)
  expect(second.config).toEqual({ mode: 'lower' })
})

it('releases audio reads before allowing task deletion', async () => {
  const request = vi.fn(async () => ({ ...task, outputs: [{ id: 'audio', label: 'Audio', mimeType: 'audio/wav', url: '/api/v2/tasks/original/files/audio' }] }))
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  mount(request)
  await screen.findByRole('button', { name: 'Xóa tác vụ' })
  const audio = document.querySelector('audio')!
  Object.defineProperty(audio, 'paused', { value: false })
  Object.defineProperty(audio, 'networkState', { value: 2 })
  await userEvent.setup().click(screen.getByRole('button', { name: 'Xóa tác vụ' }))
  expect(audio.getAttribute('src')).toBeNull()
  expect(pause).toHaveBeenCalledOnce()
  expect(load).toHaveBeenCalledOnce()
})

it('shows graph results before a collapsed step list and uses the workflow title', async () => {
  const graph = { format: 'youdub.workflow', formatVersion: 1, id: 'graph', title: 'Phụ đề校对', nodes: [], edges: [], inputs: [], outputs: [], presentation: { positions: {}, viewport: { x: 0, y: 0, zoom: 1 } } }
  mount(vi.fn(async () => ({ ...task, sourceName: 'youdub.graph', workflowId: 'youdub.graph', graphSnapshot: graph, outputs: [{ id: 'subtitle', label: 'Tiếng TrungPhụ đề', mimeType: 'application/x-subrip', url: '/subtitle.srt' }], steps: [{ id: 'translate', label: 'Dịch', status: 'completed', progress: 1 }] })))
  await screen.findByRole('heading', { name: 'Phụ đề校对', level: 1 })
  expect(screen.queryByText(/youdub.graph/)).not.toBeInTheDocument()
  const results = screen.getByRole('heading', { name: 'Tệp đã tạo' })
  const steps = screen.getByRole('button', { name: /Danh sách bước/ })
  expect(steps).toHaveAttribute('aria-expanded', 'false')
  expect(results.compareDocumentPosition(steps) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  await userEvent.setup().click(screen.getByText(/Danh sách bước/))
  expect(steps).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('link', { name: 'Dịch' })).toHaveAttribute('href', '/tasks/original/nodes/translate')
})


it('previews subtitle cues in a dialog instead of opening the raw file', async () => {
  const srt = '1\n00:00:01,000 --> 00:00:02,500\n你好\n\n2\n00:00:03,000 --> 00:00:04,000\n再见\n'
  const request = vi.fn(async (path: string) => path.endsWith('/files/subtitle') ? srt : { ...task, outputs: [{ id: 'subtitle', label: 'Tiếng TrungPhụ đề', mimeType: 'application/x-subrip', size: 2048, url: '/subtitle.srt' }] })
  mount(request)
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Xem trước văn bản' }))
  const dialog = await screen.findByRole('dialog', { name: 'Tiếng TrungPhụ đề' })
  expect(await screen.findByText('你好')).toBeVisible()
  expect(screen.getByText('00:00:01,000 → 00:00:02,500')).toBeVisible()
  expect(dialog.querySelector('a[download]')).toHaveAttribute('href', '/subtitle.srt')
  expect(request.mock.calls.some(([path]) => path === '/api/v2/tasks/original/files/subtitle')).toBe(true)
})
it('keeps ordinary text complete even when it contains arrows and subtitle timestamps', async () => {
  const content = '说明\n需要Giữ的开头\n\nA --> B\n执行步骤\n\n00:00:01,000 --> 00:00:02,500\nThời gian示例\n\n结论\n需要Giữ的结尾'
  const request = vi.fn(async (path: string) => path.endsWith('/files/text') ? content : { ...task, outputs: [{ id: 'text', name: 'notes.txt', mimeType: 'text/plain', url: '/notes.txt' }] })
  mount(request)
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Xem trước văn bản' }))
  const dialog = await screen.findByRole('dialog', { name: 'notes.txt' })
  await waitFor(() => expect(dialog.querySelector('pre')?.textContent).toBe(content))
})
it('retains unrecognized subtitle blocks alongside formatted cues', async () => {
  const content = '说明\n需要Giữ的开头\n\n1\n00:00:01,000 --> 00:00:02,500\n你好\n\n2\n损坏的Thời gian轴\n这段文字不能消失'
  const request = vi.fn(async (path: string) => path.endsWith('/files/subtitle') ? content : { ...task, outputs: [{ id: 'subtitle', name: 'subtitles.srt', mimeType: 'text/plain', url: '/subtitles.srt' }] })
  mount(request)
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Xem trước văn bản' }))
  const dialog = await screen.findByRole('dialog', { name: 'subtitles.srt' })
  expect(await screen.findByText('00:00:01,000 → 00:00:02,500')).toBeVisible()
  expect(dialog).toHaveTextContent('需要Giữ的开头')
  expect(dialog).toHaveTextContent('损坏的Thời gian轴')
  expect(dialog).toHaveTextContent('这段文字不能消失')
})
it('restores an unresolved rerun on return and does not navigate after its source view closes', async () => {
  let complete!: (value: TaskView) => void
  const request = vi.fn(async (path: string) => {
    if (path === '/api/v2/catalog') return catalog
    if (path.endsWith('/rerun')) return new Promise<TaskView>(resolve => { complete = resolve })
    return task
  })
  const push = mount(request), user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Tạo lại' }))
  await user.click(await screen.findByLabelText('mode *'))
  await user.click(screen.getByRole('menuitem', { name: 'lower' }))
  await user.click(screen.getByRole('button', { name: 'Tạo tác vụ' }))
  await waitFor(() => expect(complete).toBeDefined())
  push.unmount()
  await act(async () => complete({ ...task, id: 'new-task' }))
  expect(push).not.toHaveBeenCalled()
  push.show()
  expect(await screen.findByLabelText('mode *')).toHaveTextContent('lower')
  expect(screen.getByLabelText('mode *')).toBeDisabled()
  await user.click(screen.getByRole('button', { name: '查询创建Kết quả' }))
  expect(push).toHaveBeenCalledWith('/tasks/new-task')
})
