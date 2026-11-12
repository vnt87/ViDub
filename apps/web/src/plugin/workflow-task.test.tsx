import { TestFeatureProvider, type TestContext } from './test-bindings'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { StudioDraftStore } from '@/runtime/studio-draft'
import { LanguageProvider } from '@/test/language-provider'
import { type NodeTypeDefinition, type SlotMap, type TaskNodeDetail, type TaskStatus, type TaskView } from './sdk'
import { TaskNodePage as TaskNodePageView, TaskWorkflowPanel as TaskWorkflowPanelView, TranscriptNodeDetails, TranslationNodeDetails } from './builtin/workflow-task'

import { bindTestComponent } from './test-bindings'
const TaskNodePage = bindTestComponent(TaskNodePageView, ['request', 'navigate', 'blockNavigation', 'useQuery', 'useSlot'])
const TaskWorkflowPanel = bindTestComponent(TaskWorkflowPanelView, ['request', 'navigate', 'useQuery'])

vi.mock('./builtin/workflow-canvas', () => ({ WorkflowCanvas: () => <div>Workflow canvas</div> }))
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }))
afterEach(() => { cleanup(); window.localStorage.clear(); vi.unstubAllGlobals() })

function fixture(kind: 'transcript' | 'translation' = 'transcript') {
  const transcript = { detected_language: 'en', segments: [{ id: 'segment-000001', start_ms: 0, end_ms: 1000, text: 'Original source', words: [{ text: 'Original source', start_ms: 0, end_ms: 1000 }] }] }
  const outputs = kind === 'transcript' ? { transcript } : { translation: { source_language: 'en', target_language: 'zh', segments: [{ segment_id: 'segment-000001', text: '原始Bản dịch' }] } }
  const node = { id: 'node-primary', type: `test.${kind}`, typeVersion: '1', provider: { id: 'test', model: 'test-model', device: 'cpu' }, config: { sourceLanguage: 'en' }, autoContinue: false }
  const definition: NodeTypeDefinition = { type: node.type, version: '1', label: kind === 'transcript' ? '识别' : 'Dịch', category: 'text', providerId: 'test', provider: { id: 'test', label: '测试Nhà cung cấp', operations: [] }, operation: 'test.operation', inputs: [], outputs: [{ name: kind, kind: 'json', schemaId: `${kind}/v1`, required: true }], configSchema: { type: 'object', properties: { sourceLanguage: { type: 'string', title: 'Ngôn ngữ nguồn' } } }, defaults: {}, corrections: { outputPorts: [kind], schemaIds: [`${kind}/v1`] }, ui: { detailId: kind } }
  const task: TaskView = { id: 'task', attempt: 1, revision: 5, status: 'paused', sourceName: 'Video', createdAt: '2026-10-21T00:00:00Z', workflowId: 'youdub.graph', workflowVersion: '1', config: {}, steps: [{ id: node.id, label: definition.label, status: 'awaiting_review', progress: 1 }, { id: 'node-export', label: '导出Video', status: 'pending', progress: null }], outputs: [], allowedActions: ['cancel'], graphSnapshot: { format: 'youdub.workflow', formatVersion: 1, id: 'workflow', title: 'Dịch phụ đề', nodes: [node, { ...node, id: 'node-export', label: '导出Video', autoContinue: true }], edges: [], inputs: [], outputs: [], presentation: { positions: {}, viewport: { x: 0, y: 0, zoom: 1 } } } }
  const detail: TaskNodeDetail = { taskId: task.id, nodeId: node.id, taskRevision: 5, attempt: 1, status: 'paused', step: { ...task.steps[0], outputs }, spec: { operation: 'test.operation', input: {}, outputs: definition.outputs, autoContinue: false }, inputs: kind === 'translation' ? { transcript } : {}, outputRevision: 1, approvedRevision: null, resultRevisions: [{ revision: 1, source: 'computed', outputs, createdAt: '2026-10-21T00:00:00Z' }] }
  return { task, detail, definition }
}
type Fixture = ReturnType<typeof fixture>
function mount(data: Fixture, handler?: (path: string, init?: RequestInit) => Promise<unknown> | undefined, graph = false, details: SlotMap['workflow.node.details'][] = [{ id: 'transcript', component: TranscriptNodeDetails }, { id: 'translation', component: TranslationNodeDetails }]) {
  const request = vi.fn(async (path: string, init?: RequestInit) => {
    const result = handler?.(path, init)
    if (result) return result
    if (path === '/api/v2/node-types') return { items: [data.definition] }
    if (path === '/api/v2/tasks/task') return structuredClone(data.task)
    if (path === '/api/v2/tasks/task/nodes/node-primary') return structuredClone(data.detail)
    throw new Error(`Unexpected request: ${path}`)
  })
  const context = { apiClient: { request }, navigation: { push: vi.fn(), block: () => () => {} }, slots: { subscribe: () => () => {}, getSnapshot: () => 0, list: (slot: string) => slot === 'workflow.node.details' ? details : [] } } as unknown as TestContext
  const store = new StudioDraftStore()
  const show = () => render(<TestFeatureProvider context={context}><LanguageProvider>{graph ? <TaskWorkflowPanel task={data.task} refresh={() => {}} /> : <TaskNodePage submissionStore={store} params={{ id: data.task.id, nodeId: data.detail.nodeId }} />}</LanguageProvider></TestFeatureProvider>)
  const view = show()
  return Object.assign(request, { unmount: view.unmount, show, push: context.navigation!.push })
}
function addHistory(data: Fixture, port: 'transcript' | 'translation' = 'transcript') {
  const outputs = structuredClone(data.detail.resultRevisions[0].outputs)
  const result = outputs[port] as { segments: { text: string }[] }
  result.segments[0].text = port === 'transcript' ? 'Current source' : '当前Bản dịch'
  data.detail.resultRevisions.push({ revision: 2, source: 'correction', outputs, createdAt: '2026-10-21T00:01:00Z' })
  data.detail.outputRevision = 2; data.detail.step.outputs = outputs
}

function externalTextFixture() {
  const data = fixture()
  const outputs = { text: { text: 'External review text' }, metadata: { sources: 2 }, raw: { provider: 'external-review' } }
  data.definition.ui = { detailId: 'external.text-review' }
  data.definition.corrections = { outputPorts: ['text'], schemaIds: ['text/v1'] }
  data.definition.outputs = data.detail.spec.outputs = [
    { name: 'text', label: '文本', kind: 'json', schemaId: 'text/v1', required: true },
    { name: 'metadata', label: '来源数量', kind: 'json', schemaId: 'metadata/v1', required: true },
    { name: 'raw', kind: 'json', schemaId: 'raw/v1', required: true },
  ]
  data.detail.step.outputs = outputs
  data.detail.resultRevisions[0].outputs = outputs
  return data
}

it('shows a custom text correction once while preserving metadata and raw outputs', async () => {
  mount(externalTextFixture(), undefined, false, [{ id: 'external.text-review', component: ({ outputs }) => <p>{(outputs.text as { text: string }).text}</p> }])
  expect(await screen.findByText('External review text')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '文本' })).not.toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: '来源数量' })).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: 'Phản hồi gốc' })).toHaveLength(1)
  await userEvent.click(screen.getByRole('button', { name: '来源数量' }))
  await userEvent.click(screen.getByRole('button', { name: 'Dữ liệu thô' }))
  expect(JSON.parse(screen.getByText(/"sources": 2/).textContent!)).toEqual({ sources: 2 })
  await userEvent.click(screen.getByRole('button', { name: '来源数量' }))
  await userEvent.click(screen.getByRole('button', { name: 'Phản hồi gốc' }))
  await userEvent.click(screen.getByRole('button', { name: 'Dữ liệu thô' }))
  expect(JSON.parse(screen.getByText(/"provider": "external-review"/).textContent!)).toEqual({ provider: 'external-review' })
})

it('shows a custom detail failure and opens one complete read-only result without duplicate metadata', async () => {
  const data = externalTextFixture()
  mount(data, undefined, false, [{ id: 'external.text-review', component: () => { throw new Error('External editor failed') } }])
  expect(await screen.findByText('External editor failed')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '来源数量' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Mở chế độ chỉ xem' }))
  expect(screen.getAllByRole('button', { name: 'Dữ liệu thô' })).toHaveLength(1)
  expect(screen.queryByRole('button', { name: '来源数量' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Phản hồi gốc' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Dữ liệu thô' }))
  expect(JSON.parse(screen.getByText(/"sources": 2/).textContent!)).toEqual(data.detail.resultRevisions[0].outputs)
})

it.each(['queued', 'running', 'waiting', 'paused'] as TaskStatus[])('reviews the current node while the task is %s', async (status) => {
  const data = fixture(); data.task.status = data.detail.status = status
  data.task.steps[1].status = status === 'running' ? 'running' : 'pending'
  mount(data)
  expect(await screen.findByRole('button', { name: 'Duyệt và tiếp tục' })).toBeEnabled()
  expect(screen.getByLabelText('Bản ghi 1')).not.toHaveAttribute('readonly')
})

it('does not expose a single task-level approval button for several waiting nodes', async () => {
  const data = fixture(); data.task.steps[1].status = 'awaiting_review'
  mount(data, undefined, true)
  await screen.findByText('Workflow canvas')
  expect(screen.queryByRole('button', { name: 'Duyệt kết quả' })).not.toBeInTheDocument()
})

it('keeps completed-node history read-only while another node awaits review', async () => {
  const data = fixture(); addHistory(data); data.detail.step.status = 'completed'; data.detail.approvedRevision = 2
  mount(data)
  await screen.findByLabelText('Bản ghi 1')
  await userEvent.click(screen.getByRole('button', { name: 'Phiên bản' }))
  await userEvent.click(screen.getByRole('menuitem', { name: /^1 · 原始/ }))
  expect(screen.getByLabelText('Bản ghi 1')).toHaveValue('Original source')
  expect(screen.getByLabelText('Bản ghi 1')).toHaveAttribute('readonly')
  expect(screen.getByLabelText('Bản ghi 1')).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'Khôi phục phiên bản này làm bản hiệu chỉnh' })).not.toBeInTheDocument()
})

it('restores history only on the results tab and never pairs old translation with current source', async () => {
  const data = fixture('translation'); addHistory(data, 'translation')
  mount(data)
  await screen.findByLabelText('Bản dịch 1')
  expect(screen.getByText('Original source')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Phiên bản' }))
  await userEvent.click(screen.getByRole('menuitem', { name: /^1 · 原始/ }))
  expect(screen.queryByText('Original source')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Bản dịch 1')).toHaveValue('原始Bản dịch')
  expect(screen.getByRole('button', { name: 'Khôi phục phiên bản này làm bản hiệu chỉnh' })).toBeEnabled()
  await userEvent.click(screen.getByRole('tab', { name: 'Cấu hình' }))
  expect(screen.queryByRole('button', { name: 'Khôi phục phiên bản này làm bản hiệu chỉnh' })).not.toBeInTheDocument()
  expect(screen.getByText('测试Nhà cung cấp')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Cấu hình thô' })).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
})

it.each(['transcript', 'translation'] as const)('clears dirty state when %s text is changed and restored', async (kind) => {
  const data = fixture(kind), request = mount(data)
  const field = await screen.findByLabelText(kind === 'transcript' ? 'Bản ghi 1' : 'Bản dịch 1')
  const original = (field as HTMLTextAreaElement).value
  fireEvent.change(field, { target: { value: 'Changed' } })
  expect(screen.getByRole('button', { name: 'Lưu bản hiệu chỉnh' })).toBeEnabled()
  fireEvent.change(field, { target: { value: original } })
  expect(screen.getByRole('button', { name: 'Lưu bản hiệu chỉnh' })).toBeDisabled()
  expect(screen.queryByText('Bản hiệu chỉnh chưa lưu')).not.toBeInTheDocument()
  expect(request.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
})

it('restores ASR word timings when a timing edit is undone', async () => {
  mount(fixture())
  const end = await screen.findByLabelText('Kết thúc 1')
  fireEvent.change(end, { target: { value: '2' } })
  expect(screen.getByRole('button', { name: 'Lưu bản hiệu chỉnh' })).toBeEnabled()
  fireEvent.change(end, { target: { value: '1' } })
  expect(screen.getByRole('button', { name: 'Lưu bản hiệu chỉnh' })).toBeDisabled()
})

it('keeps a conflicting correction until the user explicitly discards and loads the latest result', async () => {
  const data = fixture()
  mount(data, (path) => path.endsWith('/corrections') ? Promise.reject(Object.assign(new Error('Result changed'), { status: 409 })) : undefined)
  const field = await screen.findByLabelText('Bản ghi 1')
  fireEvent.change(field, { target: { value: 'My correction' } })
  await userEvent.click(screen.getByRole('button', { name: 'Lưu bản hiệu chỉnh' }))
  await screen.findByText('Result changed')
  expect(field).toHaveValue('My correction')
  addHistory(data)
  await userEvent.click(screen.getByRole('button', { name: 'Bỏ bản hiệu chỉnh và tải lại' }))
  await waitFor(() => expect(field).toHaveValue('Current source'))
  expect(screen.getByRole('button', { name: 'Lưu bản hiệu chỉnh' })).toBeDisabled()
})

it('does not show an unknown submission while an ordinary save is still in flight', async () => {
  let reject!: (error: Error) => void
  const save = new Promise((_resolve, rejectRequest) => { reject = rejectRequest })
  mount(fixture(), (path) => path.endsWith('/corrections') ? save : undefined)
  fireEvent.change(await screen.findByLabelText('Bản ghi 1'), { target: { value: 'New text' } })
  await userEvent.click(screen.getByRole('button', { name: 'Lưu bản hiệu chỉnh' }))
  expect(screen.queryByText('Bài gửi cần được xác minh.')).not.toBeInTheDocument()
  await act(async () => reject(new Error('Connection lost')))
  expect(await screen.findByText('Bài gửi cần được xác minh.')).toBeInTheDocument()
  expect(screen.getByLabelText('Bản ghi 1')).toHaveValue('New text')
})

it('offers reload after an initial read failure and shows running progress', async () => {
  const data = fixture(); data.task.status = data.detail.status = 'running'; data.detail.step.status = 'running'; data.detail.step.progress = 0.4; data.detail.step.message = '正在识别第 2 段'
  let failed = false
  mount(data, (path) => { if (path.endsWith('/nodes/node-primary') && !failed) { failed = true; return Promise.reject(new Error('Read interrupted')) } })
  await screen.findByText('Read interrupted')
  await userEvent.click(screen.getByRole('button', { name: 'Tải lại' }))
  expect(await screen.findByText('正在识别第 2 段')).toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: 'Tiến độ nút' })).toHaveAttribute('aria-valuenow', '40')
})

it('uses node names in rerun preview and supplies a search empty state', async () => {
  const data = fixture('translation'); data.task.status = data.detail.status = 'succeeded'; data.detail.step.status = 'completed'; data.detail.approvedRevision = 1
  mount(data, (path) => path.endsWith('/rerun-preview') ? Promise.resolve({ reusedSteps: ['node-primary'], dirtySteps: ['node-export'], expectedAttempt: 1, expectedTaskRevision: 5, sourceRevisions: {} }) : undefined)
  fireEvent.change(await screen.findByLabelText('Bản dịch 1'), { target: { value: '修订Bản dịch' } })
  await userEvent.click(screen.getByRole('button', { name: 'Xem lại các bước bị ảnh hưởng' }))
  expect(await screen.findByText('Giữ kết quả hiện có: Dịch')).toBeInTheDocument()
  expect(screen.getByText('Xử lý lại: 导出Video')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Tìm trong bản dịch'), { target: { value: 'no match' } })
  expect(screen.getByText('Không có văn bản khớp.')).toBeInTheDocument()
})

it('says complete only when approval finishes all steps', async () => {
  const data = fixture(); data.task.steps[1].status = 'completed'
  data.task.graphSnapshot!.edges = [{ id: 'dependency', source: { nodeId: 'node-primary', portId: 'transcript' }, target: { nodeId: 'node-export', portId: 'transcript' } }]
  mount(data)
  expect(await screen.findByRole('button', { name: 'Duyệt và hoàn tất' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'Duyệt và tiếp tục' })).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Bản ghi 1'), { target: { value: 'A correction invalidates the reused downstream result' } })
  expect(screen.getByRole('button', { name: 'Lưu và tiếp tục' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'Lưu và hoàn tất' })).not.toBeInTheDocument()
})

function speechFixture() {
  const data = fixture('translation')
  const outputs = { speechAudio: { segments: ['one', 'two'].map((id) => ({ id, audio: { id: `audio-${id}`, schemaId: 'audio/wav/v1' }, sampleRate: 48000, channels: 1, sampleCount: 48000 })) } }
  data.definition.label = 'Tạo lồng tiếng'; delete data.definition.corrections; delete data.definition.ui
  data.definition.operation = data.detail.spec.operation = 'speech.synthesize/v1'
  data.definition.outputs = data.detail.spec.outputs = [{ name: 'speechAudio', kind: 'json', schemaId: 'speech-audio/v1', required: true }]
  data.detail.inputs = { translation: { source_language: 'en', target_language: 'zh', segments: [{ segment_id: 'two', text: '第二句Lồng tiếng。' }, { segment_id: 'one', text: '第一句Lồng tiếng。' }] } }
  data.detail.step.outputs = outputs
  data.detail.resultRevisions = [{ revision: 1, source: 'computed', outputs, createdAt: '2026-10-21T00:00:00Z' }]
  return data
}

it('pairs synthesized audio with translation by segment ID, with downloads and collapsed raw data', async () => {
  mount(speechFixture())
  const first = await screen.findByRole('listitem', { name: 'Lồng tiếng 1' }), second = screen.getByRole('listitem', { name: 'Lồng tiếng 2' })
  expect(within(first).getByText('第一句Lồng tiếng。')).toBeInTheDocument()
  expect(within(first).getByLabelText('Lồng tiếng 1')).toHaveAttribute('src', '/api/youdub/file?path=%2Fapi%2Fv2%2Ftasks%2Ftask%2Fartifacts%2Faudio-one')
  expect(within(first).getByRole('link', { name: 'Tải âm thanh 1' })).toHaveAttribute('download')
  expect(within(second).getByText('第二句Lồng tiếng。')).toBeInTheDocument()
  expect(within(second).getByLabelText('Lồng tiếng 2')).toHaveAttribute('src', '/api/youdub/file?path=%2Fapi%2Fv2%2Ftasks%2Ftask%2Fartifacts%2Faudio-two')
  expect(screen.getByRole('button', { name: 'Dữ liệu thô' })).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('button', { name: 'Lưu bản hiệu chỉnh' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Duyệt và tiếp tục' })).toBeEnabled()
})

it('keeps audio available without guessing missing or ambiguous translation matches', async () => {
  const data = speechFixture()
  data.detail.inputs.translation = { source_language: 'en', target_language: 'zh', segments: [{ segment_id: 'one', text: 'Ambiguous text A' }, { segment_id: 'one', text: 'Ambiguous text B' }, { segment_id: 'other', text: 'Wrong position match' }] }
  mount(data)
  await screen.findByRole('listitem', { name: 'Lồng tiếng 1' })
  expect(screen.getAllByText('Không có bản dịch khớp duy nhất.')).toHaveLength(2)
  expect(screen.queryByText(/Ambiguous text|Wrong position match/)).not.toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: /Tải âm thanh/ })).toHaveLength(2)
})

it('never pairs historical synthesized audio with current translation input', async () => {
  const data = speechFixture()
  const outputs = structuredClone(data.detail.resultRevisions[0].outputs)
  data.detail.outputRevision = 2
  data.detail.resultRevisions.push({ revision: 2, source: 'computed', outputs, createdAt: '2026-10-21T00:01:00Z' })
  mount(data)
  await screen.findByText('第一句Lồng tiếng。')
  await userEvent.click(screen.getByRole('button', { name: 'Phiên bản' }))
  await userEvent.click(screen.getByRole('menuitem', { name: /^1 · 原始/ }))
  expect(screen.getByText('Phiên bản lịch sử này không có văn bản đã lưu.')).toBeInTheDocument()
  expect(screen.queryByText('第一句Lồng tiếng。')).not.toBeInTheDocument()
  expect(screen.queryByText('第二句Lồng tiếng。')).not.toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: /Tải âm thanh/ })).toHaveLength(2)
})


it('retains the derived task submission after leaving and ignores its late navigation callback', async () => {
  const data = fixture('translation'); data.task.status = data.detail.status = 'succeeded'; data.detail.step.status = 'completed'
  let finish!: (task: TaskView) => void
  const request = mount(data, path => path.endsWith('/rerun-preview') ? Promise.resolve({ reusedSteps: ['node-primary'], dirtySteps: ['node-export'], expectedAttempt: 1, expectedTaskRevision: 5, sourceRevisions: {} }) : path.endsWith('/rerun') ? new Promise<TaskView>(resolve => { finish = resolve }) : undefined)
  fireEvent.change(await screen.findByLabelText('Bản dịch 1'), { target: { value: '修订Bản dịch' } })
  await userEvent.click(screen.getByRole('button', { name: 'Xem lại các bước bị ảnh hưởng' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Tạo tác vụ và sinh kết quả' }))
  await waitFor(() => expect(finish).toBeDefined())
  request.unmount()
  await act(async () => finish({ ...data.task, id: 'derived' }))
  expect(request.push).not.toHaveBeenCalled()
  request.show()
  await userEvent.click(await screen.findByRole('button', { name: '查询创建Kết quả' }))
  expect(request.push).toHaveBeenCalledWith('/tasks/derived')
})
