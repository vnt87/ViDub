import { TestFeatureProvider, testHost, type TestContext } from './test-bindings'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { LanguageProvider } from '@/test/language-provider'
import { type Catalog, type NodeTypeDefinition, type TaskView, type WorkflowDocument } from './sdk'
import { StudioPage as Page } from '../../../harness/src/frontend/studio-page'
import reviewedSubtitles from '../../../../packages/builtin/src/workflow-templates/reviewed-subtitles.json'
import { nodeDescriptors } from '../../../../packages/builtin/src/node-contracts'

const catalog: Catalog = { providers: [], workflows: [{ id: 'external.text', version: '2.0.0', label: 'Text workflow', inputs: [{ name: 'document', label: 'Document', acceptedMimeTypes: ['text/plain'], required: true }], configSchema: { type: 'object', properties: { mode: { type: 'string', enum: ['upper', 'lower'] } }, required: ['mode'] }, defaults: { mode: 'upper' } }] }
afterEach(() => { cleanup(); window.localStorage.clear() })

it('keeps dropped media across workflows and edits only each node’s declared basic settings for this run', async () => {
  const template = structuredClone(reviewedSubtitles) as WorkflowDocument
  template.nodes = [
    { ...template.nodes[1], label: '第一段识别', config: { sourceLanguage: 'auto', initialPrompt: 'preserved' } },
    { ...template.nodes[1], id: 'recognize-second', label: '第二段识别', config: { sourceLanguage: 'en', initialPrompt: 'second' } },
  ]
  const another = { ...structuredClone(template), id: 'another', title: '另一个Quy trình', inputs: [{ ...template.inputs[0], id: 'renamed-video' }] }
  const definitions: NodeTypeDefinition[] = [{ type: 'youdub.transcribe', version: '1.0.0', providerId: 'whisper', operation: 'transcribe', provider: { id: 'whisper', operations: [] }, label: '识别', category: 'text', inputs: [], outputs: [], defaults: {}, configSchema: { type: 'object', properties: { sourceLanguage: { type: 'string', enum: ['auto', 'en', 'ja'], 'x-title': 'Ngôn ngữ nguồn' }, initialPrompt: { type: 'string', 'x-title': 'Gợi ý nhận dạng' } } }, ui: { quickFields: ['sourceLanguage'] } }]
  const request = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/v2/catalog') return { providers: [], workflows: [{ ...catalog.workflows[0], id: 'youdub.graph' }, { ...catalog.workflows[0], id: 'youdub.localize', label: '旧Video流程' }, { ...catalog.workflows[0], id: 'external.graph', label: template.title, graphTemplate: template }, catalog.workflows[0]] }
    if (path.startsWith('/api/v2/workflow-documents?')) return { items: [template, another].map((document) => ({ id: document.id, revision: 1, origin: 'builtin', document })) }
    if (path === '/api/v2/node-types') return { items: definitions }
    if (path.includes('/resources/check')) return { status: 'ready', requirements: [] }
    if (path.includes('/validate')) return { valid: true, diagnostics: [] }
    if (path.startsWith('/api/v2/tasks?')) return { items: [] }
    if (path === '/api/v2/tasks' && init?.method === 'POST') throw new Error('Connection interrupted')
    throw new Error(`Unexpected request ${path}`)
  })
  mount(request, false)
  await screen.findByText('Thả video vào đây, hoặc nhấp để chọn')
  expect(screen.getByRole('heading', { name: 'Làm cho mọi video nóibằng ngôn ngữ khác' })).toBeInTheDocument()
  expect(screen.queryByText('Quy trình')).not.toBeInTheDocument()
  expect(screen.queryByText('其他处理方式')).not.toBeInTheDocument()
  const user = userEvent.setup()
  await user.click(screen.getByLabelText('Quy trình'))
  expect(screen.queryByRole('menuitem', { name: '旧Video流程' })).not.toBeInTheDocument()
  expect(await screen.findByRole('menuitem', { name: 'Text workflow' })).toBeInTheDocument()
  expect(screen.getAllByRole('menuitem', { name: template.title })).toHaveLength(1)
  await user.keyboard('{Escape}')
  expect(screen.queryByLabelText('Gợi ý nhận dạng')).not.toBeInTheDocument()
  const input = screen.getByLabelText('Video *')
  fireEvent.drop(input.parentElement!, { dataTransfer: { files: [new File(['video'], 'dropped.mp4', { type: 'video/mp4' })] } })
  await user.click(screen.getByLabelText('第一段识别 · Ngôn ngữ nguồn'))
  await user.click(await screen.findByRole('menuitem', { name: 'ja' }))
  expect(screen.getByLabelText('第二段识别 · Ngôn ngữ nguồn')).toHaveTextContent('en')
  await user.click(screen.getByLabelText('Quy trình'))
  await user.click(await screen.findByRole('menuitem', { name: '另一个Quy trình' }))
  expect(screen.getByText('dropped.mp4')).toBeInTheDocument()
  await user.click(screen.getByLabelText('Quy trình'))
  await user.click(await screen.findByRole('menuitem', { name: template.title }))
  expect(screen.getByLabelText('第一段识别 · Ngôn ngữ nguồn')).toHaveTextContent('ja')
  expect(template.nodes[0].config.sourceLanguage).toBe('auto')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Bắt đầu xử lý' })).toBeEnabled())
  await user.click(screen.getByRole('button', { name: 'Bắt đầu xử lý' }))
  await screen.findByText('Connection interrupted')
  const body = request.mock.calls.find(([path, init]) => path === '/api/v2/tasks' && init?.method === 'POST')![1]!.body as FormData
  const submitted = JSON.parse(String(body.get('request')))
  expect(submitted).toMatchObject({ workflowId: 'youdub.graph', documentRevision: null })
  expect(submitted.graphDocument.nodes[0].config).toEqual({ sourceLanguage: 'ja', initialPrompt: 'preserved' })
  expect(submitted.graphDocument.nodes[1].config.sourceLanguage).toBe('en')
  expect(submitted.graphDocument.nodes[0].autoContinue).toBe(false)
  expect((body.get('input.video') as File).name).toBe('dropped.mp4')
  expect(screen.getByLabelText('Quy trình')).toBeDisabled()
  expect(screen.getByLabelText('第一段识别 · Ngôn ngữ nguồn')).toBeDisabled()
})

it('submits declared input slots and preserves an uncertain creation ID until explicitly cleared', async () => {
  const request = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/v2/catalog') return catalog
    if (path.startsWith('/api/v2/tasks?')) return { items: [], hasMore: false, limit: 12, offset: 0 }
    if (init?.method === 'DELETE') return undefined
    throw new Error('Connection interrupted')
  })
  const context = externalContext(request)
  render(<TestFeatureProvider context={context}><LanguageProvider><Page /></LanguageProvider></TestFeatureProvider>)
  const input = await screen.findByLabelText('Document *')
  expect(screen.getByRole('link', { name: 'Xem ví dụ trên trang web' })).toHaveAttribute('href', 'https://liuzhao1225.github.io/YouDub-webui/#demo')
  const user = userEvent.setup()
  await user.upload(input, new File(['hello'], 'input.txt', { type: 'text/plain' }))
  expect((input as HTMLInputElement).files).toHaveLength(1)
  expect(screen.queryByLabelText('Quy trình')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Bắt đầu xử lý' })).toHaveAttribute('type', 'submit')
  // jsdom does not connect user-event's FileList to native file validity.
  fireEvent.submit(input.closest('form')!)
  await screen.findByText('Connection interrupted')
  const first = request.mock.calls.find(([, init]) => init?.method === 'POST')![1]!.body as FormData
  const firstRequest = JSON.parse(first.get('request') as string)
  expect(firstRequest).toMatchObject({ workflowId: 'external.text', workflowVersion: '2.0.0', config: { mode: 'upper' } })
  expect((first.get('input.document') as File).name).toBe('input.txt')
  expect(first.has('file')).toBe(false)
  expect(input).toBeDisabled()
  fireEvent.submit(input.closest('form')!)
  await waitFor(() => expect(request.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(2))
  const repeated = request.mock.calls.filter(([, init]) => init?.method === 'POST')[1][1]!.body as FormData
  expect(JSON.parse(repeated.get('request') as string).id).toBe(firstRequest.id)
  await user.click(screen.getByRole('button', { name: 'Xóa mục nhập này' }))
  await waitFor(() => expect(input).toBeEnabled())
  expect(request).toHaveBeenCalledWith(`/api/v2/imports/${firstRequest.id}`, { method: 'DELETE' })
})

it('locks workflow selection while a submitted import still needs reconciliation', async () => {
  const multiple = { ...catalog, workflows: [...catalog.workflows, { ...catalog.workflows[0], id: 'another', label: 'Another workflow' }] }
  const request = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/v2/catalog') return multiple
    if (path.startsWith('/api/v2/tasks?')) return { items: [], hasMore: false, limit: 12, offset: 0 }
    if (init?.method === 'DELETE') return undefined
    throw new Error('Connection interrupted')
  })
  const context = externalContext(request)
  render(<TestFeatureProvider context={context}><LanguageProvider><Page /></LanguageProvider></TestFeatureProvider>)
  const input = await screen.findByLabelText('Document *')
  const user = userEvent.setup()
  await user.upload(input, new File(['hello'], 'input.txt', { type: 'text/plain' }))
  fireEvent.submit(input.closest('form')!)
  await screen.findByText('Connection interrupted')
  expect(screen.getByLabelText('Quy trình')).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Xóa mục nhập này' }))
  await waitFor(() => expect(screen.getByLabelText('Quy trình')).toBeEnabled())
  await user.click(screen.getByLabelText('Quy trình'))
  await user.click(screen.getByRole('menuitem', { name: 'Another workflow' }))
  expect(screen.getByLabelText('Document *')).toHaveValue('')
})

it('retains each external composer draft after visiting settings and clears only the submitted draft', async () => {
  const media = { ...catalog.workflows[0], id: 'external.media', label: 'Media workflow', ui: { sourceUrlInput: 'video' }, inputs: [
    ...catalog.workflows[0].inputs,
    { name: 'video', label: 'Video', acceptedMimeTypes: ['video/*'], required: false },
  ] }
  const request = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/v2/catalog') return { ...catalog, workflows: [...catalog.workflows, media] }
    if (path === '/api/v2/tasks' && init?.method === 'POST') return { id: 'created' }
    return { items: [], hasMore: false }
  })
  const push = vi.fn()
  const context = externalContext(request, push)
  const showStudio = () => render(<TestFeatureProvider context={context}><LanguageProvider><Page /></LanguageProvider></TestFeatureProvider>)
  let view = showStudio()
  const user = userEvent.setup()
  await user.upload(await screen.findByLabelText('Document *'), new File(['text draft'], 'text.txt', { type: 'text/plain' }))
  await user.click(screen.getByLabelText('Quy trình'))
  await user.click(screen.getByRole('menuitem', { name: 'Media workflow' }))
  const file = new File(['media notes'], 'notes.txt', { type: 'text/plain' })
  await user.upload(screen.getByLabelText('Document *'), file)
  await user.type(screen.getByLabelText('Liên kết video'), 'https://youtu.be/jNQXAC9IVRw')
  await user.click(screen.getByLabelText('mode *'))
  await user.click(screen.getByRole('menuitem', { name: 'lower' }))

  view.unmount() // The settings route unmounts the studio, while its plugin remains active.
  view = showStudio()
  await screen.findByText('notes.txt')
  expect(screen.getByLabelText('Quy trình')).toHaveTextContent('Media workflow')
  expect(screen.getByLabelText('Liên kết video')).toHaveValue('https://youtu.be/jNQXAC9IVRw')
  expect(screen.getByLabelText('mode *')).toHaveTextContent('lower')
  fireEvent.submit(screen.getByLabelText('Liên kết video').closest('form')!)
  await waitFor(() => expect(push).toHaveBeenCalledWith('/tasks/created'))
  const body = request.mock.calls.find(([path, init]) => path === '/api/v2/tasks' && init?.method === 'POST')![1]!.body as FormData
  expect(body.get('input.document')).toBe(file)
  expect(JSON.parse(String(body.get('request')))).toMatchObject({ workflowId: media.id, config: { mode: 'lower', source_url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' } })

  view.unmount()
  showStudio()
  await screen.findByLabelText('Liên kết video')
  expect(screen.queryByText('notes.txt')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Liên kết video')).toHaveValue('')
  expect(screen.getByLabelText('mode *')).toHaveTextContent('upper')
  await user.click(screen.getByLabelText('Quy trình'))
  await user.click(screen.getByRole('menuitem', { name: 'Text workflow' }))
  expect(screen.getByText('text.txt')).toBeInTheDocument()
})

// The Host always registers Graph before exposing the catalog. External workflows
// run inside GraphStudio, with their persisted selection owned by the same draft store.
function externalContext(request: (path: string, init?: RequestInit) => Promise<unknown>, push = vi.fn()): TestContext {
  const context = { apiClient: { request: async (path: string, init?: RequestInit) => {
    if (path.startsWith('/api/v2/workflow-documents?')) return { items: [{ id: reviewedSubtitles.id, revision: 0, origin: 'builtin', document: reviewedSubtitles }] }
    if (path === '/api/v2/node-types') return { items: [] }
    if (path === '/api/v2/catalog') {
      const result = await request(path, init) as Catalog
      return { ...result, workflows: [{ ...catalog.workflows[0], id: 'youdub.graph' }, ...result.workflows] }
    }
    return request(path, init)
  } }, navigation: { push } } as TestContext
  testHost(context).value.draftStore.set('selected', 'workflow:external.text')
  return context
}

function mount(request: (path: string, init?: RequestInit) => Promise<unknown>, external = true) {
  const push = vi.fn()
  const context = external ? externalContext(request, push) : { apiClient: { request }, navigation: { push } } as TestContext
  render(<TestFeatureProvider context={context}><LanguageProvider><Page /></LanguageProvider></TestFeatureProvider>)
  return push
}

it('counts review nodes even while their independent branch is running', async () => {
  const active: TaskView = { id: 'review', status: 'running', attempt: 1, sourceName: 'review.mp4', createdAt: '2026-10-09T01:00:00Z', workflowId: 'youdub.graph', workflowVersion: '1', config: {}, outputs: [], allowedActions: [], steps: [
    { id: 'translate', label: 'Dịch', status: 'awaiting_review', progress: 1 },
    { id: 'audio', label: 'Tạo lồng tiếng', status: 'running', progress: 0.5 },
  ] }
  mount(vi.fn(async (path: string) => path === '/api/v2/catalog' ? catalog : { items: [active], hasMore: false }))
  const review = await screen.findByRole('link', { name: '1 个NútChờ duyệt' })
  expect(review).toHaveAttribute('href', '/tasks/review/nodes/translate')
  expect(screen.getByRole('link', { name: '1 个任务正在处理' })).toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: 'Tạo lồng tiếng tiến độ' })).toHaveAttribute('aria-valuenow', '50')
})

it('shows the selected file and clears it before allowing a fresh selection', async () => {
  mount(vi.fn(async (path: string) => path === '/api/v2/catalog' ? catalog : { items: [], hasMore: false, limit: 12, offset: 0 }))
  const user = userEvent.setup()
  const input = await screen.findByLabelText('Document *')
  expect(screen.getByRole('button', { name: 'Bắt đầu xử lý' })).toBeDisabled()
  await user.upload(input, new File(['hello'], 'first.txt', { type: 'text/plain' }))
  expect(screen.getByText('first.txt')).toBeInTheDocument()
  expect(screen.getByText(/5 B/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Bắt đầu xử lý' })).toBeEnabled()
  await user.click(screen.getByRole('button', { name: 'Xóa first.txt' }))
  expect(screen.queryByText('first.txt')).not.toBeInTheDocument()
  expect(input).toHaveValue('')
  expect(screen.getByRole('button', { name: 'Bắt đầu xử lý' })).toBeDisabled()
  await user.upload(input, new File(['again'], 'second.txt', { type: 'text/plain' }))
  expect(screen.getByText('second.txt')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Bắt đầu xử lý' })).toBeEnabled()
})

it('keeps active tasks separate from recent results and links to their detail pages', async () => {
  const task = (id: string, status: TaskView['status']): TaskView => ({
    id, status, attempt: 1, sourceName: `${id}.mp4`, createdAt: '2026-10-09T01:00:00Z',
    workflowId: 'external.text', workflowVersion: '2.0.0', config: {}, steps: [], outputs: [], allowedActions: [], cover: { url: `/cover/${id}.jpg` },
  })
  const items = [task('running', 'running'), task('completed', 'succeeded'), task('failed', 'failed'), task('cancelling', 'cancelling')]
  items[0].steps = [{ id: 'synthesize', label: 'Tạo lồng tiếng', status: 'running', progress: null }, { id: 'export', label: '导出', status: 'pending', progress: null }]
  const push = mount(vi.fn(async (path: string) => path === '/api/v2/catalog' ? catalog : { items, hasMore: false, limit: 12, offset: 0 }))
  const active = await screen.findByRole('region', { name: 'Đang xử lý' })
  const recent = screen.getByRole('region', { name: 'Tác vụ gần đây' })
  expect(active).toHaveTextContent('running.mp4')
  expect(active).toHaveTextContent('cancelling.mp4')
  expect(active).not.toHaveTextContent('completed.mp4')
  expect(active).toHaveTextContent('Tạo lồng tiếng')
  expect(active).toHaveTextContent('Đã hoàn tất 0/2 步')
  expect(active.querySelector('img')).toHaveAttribute('src', '/cover/running.jpg')
  expect(active.querySelector('progress')).toBeNull()
  expect(recent).toHaveTextContent('completed.mp4')
  expect(recent).toHaveTextContent('failed.mp4')
  expect(recent).not.toHaveTextContent('running.mp4')
  expect(recent.querySelector('img')).toHaveAttribute('src', '/cover/completed.jpg')
  await userEvent.setup().click(screen.getByRole('link', { name: /completed.mp4/ }))
  expect(push).toHaveBeenCalledWith('/tasks/completed')
})

it('places the link first, switches between sources and submits a canonical URL without a file', async () => {
  const linked: Catalog = { providers: [], workflows: [{ ...catalog.workflows[0], ui: { sourceUrlInput: 'video' }, inputs: [{ name: 'video', label: 'Video', acceptedMimeTypes: ['video/*'], required: false }], configSchema: { type: 'object', properties: { source_url: { type: 'string' }, source_proxy_port: nodeDescriptors.download.configSchema.properties!.proxyPort } }, defaults: {} }] }
  const request = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/v2/catalog') return linked
    if (init?.method === 'POST') return { id: 'download' }
    return { items: [], hasMore: false, limit: 12, offset: 0 }
  })
  const push = mount(request)
  const user = userEvent.setup()
  const link = await screen.findByLabelText('Liên kết video')
  const file = screen.getByLabelText('Video') as HTMLInputElement
  expect(link.compareDocumentPosition(file) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Bắt đầu xử lý' })).toBeDisabled()
  await user.upload(file, new File(['video'], 'clip.mp4', { type: 'video/mp4' }))
  await user.type(link, 'https://youtu.be/jNQXAC9IVRw')
  expect(file.files).toHaveLength(0)
  expect(screen.queryByText('clip.mp4')).not.toBeInTheDocument()
  await user.upload(file, new File(['video'], 'clip.mp4', { type: 'video/mp4' }))
  expect(link).toHaveValue('')
  await user.type(link, 'http://127.0.0.1/secret')
  await user.tab()
  expect(screen.getByRole('button', { name: 'Bắt đầu xử lý' })).toBeDisabled()
  expect(screen.getByText('请Đầu vào YouTube 或 B 站的单个Liên kết video。')).toBeInTheDocument()
  await user.clear(link)
  await user.type(link, 'https://youtu.be/jNQXAC9IVRw')
  const proxy = screen.getAllByRole('spinbutton', { name: '本机 HTTP 代理端口（0 为直连）' })[0]
  fireEvent.change(proxy, { target: { value: '7897' } })
  await user.click(screen.getByRole('button', { name: 'Tải xuống và xử lý' }))
  await waitFor(() => expect(push).toHaveBeenCalledWith('/tasks/download'))
  const body = request.mock.calls.find(([, init]) => init?.method === 'POST')![1]!.body as FormData
  expect(JSON.parse(body.get('request') as string).config.source_url).toBe('https://www.youtube.com/watch?v=jNQXAC9IVRw')
  expect(JSON.parse(body.get('request') as string).config.source_proxy_port).toBe(7897)
  expect(body.has('input.video')).toBe(false)
})

it('retains a submission across a route unmount and does not navigate from its late response', async () => {
  let finish!: (task: { id: string }) => void
  const request = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/v2/catalog') return catalog
    if (path.startsWith('/api/v2/tasks?')) return { items: [] }
    if (path === '/api/v2/tasks' && init?.method === 'POST') return new Promise<{ id: string }>(resolve => { finish = resolve })
    throw new Error('Unexpected request ' + path)
  })
  const push = vi.fn()
  const context = externalContext(request, push)
  const show = () => render(<TestFeatureProvider context={context}><LanguageProvider><Page /></LanguageProvider></TestFeatureProvider>)
  const first = show(), user = userEvent.setup()
  const input = await screen.findByLabelText('Document *')
  await user.upload(input, new File(['data'], 'pending.txt', { type: 'text/plain' }))
  fireEvent.submit(input.closest('form')!)
  await waitFor(() => expect(finish).toBeDefined())
  first.unmount()
  await act(async () => finish({ id: 'created-while-away' }))
  expect(push).not.toHaveBeenCalled()
  show()
  expect(await screen.findByText('pending.txt')).toBeInTheDocument()
  expect(screen.getByLabelText('Document *')).toBeDisabled()
  await user.click(screen.getByRole('button', { name: '查询创建Kết quả' }))
  expect(push).toHaveBeenCalledWith('/tasks/created-while-away')
  expect(request.mock.calls.filter(([path, init]) => path === '/api/v2/tasks' && init?.method === 'POST')).toHaveLength(1)
})
