import { TestFeatureProvider, type TestContext } from './test-bindings'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { LanguageProvider } from '@/test/language-provider'
import { type NodeTypeDefinition, type WorkflowDocument } from './sdk'
import { StudioPage as Page } from '../../../harness/src/frontend/studio-page'

const definitions: NodeTypeDefinition[] = [{
  type: 'test.process', version: '1', providerId: 'test', operation: 'process',
  label: '处理', category: 'media', provider: { id: 'test', operations: [] },
  inputs: [], outputs: [], configSchema: {}, defaults: {},
  runtimeInputSchema: { type: 'object', properties: { note: { type: 'string', 'x-title': 'Chạy备注' } } },
}, {
  type: 'youdub.download', version: '1', providerId: 'media', operation: 'download',
  label: 'Tải xuống', category: 'input', provider: { id: 'media', operations: [] },
  inputs: [], outputs: [{ name: 'video', kind: 'artifact', schemaId: 'video/mp4/v1', required: true }], configSchema: {}, defaults: {},
}]
function graph(id: string, title: string): WorkflowDocument {
  return {
    format: 'youdub.workflow', formatVersion: 1, id, title,
    inputs: [{ id: 'video', label: 'Video', kind: 'artifact', schemaId: 'video/mp4/v1', required: true, acceptedMimeTypes: ['video/*'], maxBytes: 100 }],
    nodes: [{ id: 'process', type: 'test.process', typeVersion: '1', provider: { id: 'test' }, config: {}, autoContinue: true }],
    edges: [], outputs: [], presentation: { positions: {}, viewport: { x: 0, y: 0, zoom: 1 } },
  }
}

afterEach(() => { cleanup(); window.localStorage.clear() })

function mount() {
  const documents = [graph('first', '第一个Quy trình'), graph('second', '第二个Quy trình')]
  const request = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/v2/catalog') return { providers: [], workflows: [
      { id: 'youdub.graph', version: '1', label: 'Graph' },
      { id: 'external.text', version: '1', label: 'Text workflow', inputs: [{ name: 'video', label: '文档', acceptedMimeTypes: ['text/plain'], required: true }], configSchema: {}, defaults: {} },
    ] }
    if (path.startsWith('/api/v2/workflow-documents?')) return { items: documents.map((document) => ({ id: document.id, revision: 1, origin: 'builtin', document })) }
    if (path === '/api/v2/node-types') return { items: definitions }
    if (path.endsWith('/resources/check')) return { status: 'ready', requirements: [] }
    if (path.endsWith('/validate')) return { valid: true, diagnostics: [] }
    if (path.startsWith('/api/v2/tasks?')) return { items: [] }
    if (path === '/api/v2/tasks' && init?.method === 'POST') throw new Error('Connection interrupted')
    if (path.startsWith('/api/v2/imports/') && init?.method === 'DELETE') return undefined
    throw new Error(`Unexpected request ${path}`)
  })
  const context = {
    apiClient: { request }, navigation: { push: vi.fn() },
    slots: { subscribe: () => () => {}, getSnapshot: () => 0, list: () => [] },
    effect: (effect: () => unknown) => effect(),
  } as unknown as TestContext
  const page = <TestFeatureProvider context={context}><LanguageProvider><Page /></LanguageProvider></TestFeatureProvider>
  const view = render(page)
  return { request, user: userEvent.setup(), revisit: () => { view.rerender(<div>Cài đặt</div>); view.rerender(page) } }
}

async function selectWorkflow(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(screen.getByRole('button', { name: 'Quy trình' }))
  await user.click(await screen.findByRole('menuitem', { name: title }))
}

it('preserves the selected graph, file and node runtime draft across an external workflow', async () => {
  const { request, user } = mount()
  await screen.findByLabelText('Video *')
  await selectWorkflow(user, '第二个Quy trình')
  await user.upload(screen.getByLabelText('Video *'), new File(['video'], 'keep.mp4', { type: 'video/mp4' }))
  await user.type(screen.getByLabelText('Chạy备注'), 'Giữ第二个Quy trình的备注')
  await selectWorkflow(user, 'Text workflow')
  expect(screen.queryByText('keep.mp4')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Chạy备注')).not.toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Bắt đầu xử lý' })).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'Bắt đầu xử lý' })).toBeDisabled()
  const externalInput = screen.getByLabelText('文档 *') as HTMLInputElement
  expect(externalInput).toHaveAttribute('accept', 'text/plain')
  expect((screen.getByText('文档 *') as HTMLLabelElement).control).toBe(externalInput)
  expect(screen.queryByLabelText('Video *')).not.toBeInTheDocument()
  await selectWorkflow(user, '第二个Quy trình')
  expect(screen.getByText('keep.mp4')).toBeVisible()
  expect(screen.getByLabelText('Chạy备注')).toHaveValue('Giữ第二个Quy trình的备注')
  expect(screen.queryByRole('link', { name: 'Chỉnh sửaQuy trình' })).not.toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Bắt đầu xử lý' })).toBeEnabled())
  await user.click(screen.getByRole('button', { name: 'Bắt đầu xử lý' }))
  await screen.findByText('Connection interrupted')
  const calls = request.mock.calls.filter(([path]) => path === '/api/v2/tasks')
  expect(calls).toHaveLength(1)
  const body = calls[0][1]!.body as FormData
  expect((body.get('input.video') as File).name).toBe('keep.mp4')
  expect(JSON.parse(String(body.get('request')))).toMatchObject({ graphDocument: { id: 'second' }, nodeRuntimeInputs: { process: { note: 'Giữ第二个Quy trình的备注' } } })
  expect(screen.getByRole('button', { name: 'Quy trình' })).toBeDisabled()
})

it('stops inactive graph resource checks, preserves its URL and keeps an external submission locked', async () => {
  const { request, user } = mount()
  await screen.findByLabelText('Liên kết video')
  await selectWorkflow(user, '第二个Quy trình')
  fireEvent.change(screen.getByLabelText('Liên kết video'), { target: { value: 'https://youtu.be/abcdefghijk' } })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Tải xuống và xử lý' })).toBeEnabled())
  const checks = () => request.mock.calls.filter(([path]) => path.endsWith('/resources/check'))
  const signal = checks().at(-1)![1]!.signal!
  expect(signal.aborted).toBe(false)
  await selectWorkflow(user, 'Text workflow')
  await waitFor(() => expect(signal.aborted).toBe(true))
  const countWhileHidden = checks().length
  await user.upload(screen.getByLabelText('文档 *'), new File(['text'], 'document.txt', { type: 'text/plain' }))
  fireEvent.submit(screen.getByLabelText('文档 *').closest('form')!)
  await screen.findByText('Connection interrupted')
  expect(screen.getByRole('button', { name: 'Quy trình' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Gửi với cùng ID' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Tải xuống và xử lý' })).not.toBeInTheDocument()
  expect(checks()).toHaveLength(countWhileHidden)
  let submissions = request.mock.calls.filter(([path]) => path === '/api/v2/tasks')
  expect(submissions).toHaveLength(1)
  expect(JSON.parse(String((submissions[0][1]!.body as FormData).get('request'))).workflowId).toBe('external.text')
  await user.click(screen.getByRole('button', { name: 'Xóa mục nhập này' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Quy trình' })).toBeEnabled())
  await selectWorkflow(user, '第二个Quy trình')
  expect(screen.getByLabelText('Liên kết video')).toHaveValue('https://youtu.be/abcdefghijk')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Tải xuống và xử lý' })).toBeEnabled())
  // Returning to unchanged requirements reuses their completed readiness check.
  expect(checks()).toHaveLength(countWhileHidden)
  expect(JSON.parse(String(checks().at(-1)![1]!.body)).document.id).toBe('second')
  await user.click(screen.getByRole('button', { name: 'Tải xuống và xử lý' }))
  await screen.findByText('Connection interrupted')
  submissions = request.mock.calls.filter(([path]) => path === '/api/v2/tasks')
  expect(submissions).toHaveLength(2)
  const body = submissions[1][1]!.body as FormData
  expect(body.has('input.video')).toBe(false)
  expect(JSON.parse(String(body.get('request')))).toMatchObject({ workflowId: 'youdub.graph', graphDocument: { id: 'second' }, nodeRuntimeInputs: { 'source-download': { url: 'https://www.youtube.com/watch?v=abcdefghijk' } } })
})

it('retains the workflow, File and node options after visiting settings', async () => {
  const { request, user, revisit } = mount()
  await screen.findByLabelText('Video *')
  await selectWorkflow(user, '第二个Quy trình')
  const file = new File(['video'], 'settings-return.mp4', { type: 'video/mp4' })
  await user.upload(screen.getByLabelText('Video *'), file)
  await user.type(screen.getByLabelText('Chạy备注'), 'Cài đặtQuay lạiGiữ')
  revisit()
  expect(await screen.findByText('settings-return.mp4')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Quy trình' })).toHaveTextContent('第二个Quy trình')
  expect(screen.getByLabelText('Chạy备注')).toHaveValue('Cài đặtQuay lạiGiữ')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Bắt đầu xử lý' })).toBeEnabled())
  await user.click(screen.getByRole('button', { name: 'Bắt đầu xử lý' }))
  await screen.findByText('Connection interrupted')
  const body = request.mock.calls.find(([path]) => path === '/api/v2/tasks')![1]!.body as FormData
  expect(body.get('input.video')).toBe(file)
})
