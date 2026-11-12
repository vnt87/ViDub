import { TestFeatureProvider, type TestContext } from './test-bindings'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { LanguageProvider } from '@/test/language-provider'
import { LocalizeEditor } from './builtin/localize-editor'
import { bindTestComponent } from './test-bindings'
const Editor = bindTestComponent(LocalizeEditor, ['useQuery'])

afterEach(() => { cleanup(); window.localStorage.clear() })
it('uses the refreshed runtime capabilities without replacing them with a stale catalog snapshot', async () => {
  const capabilities = ['asr', 'translation'].map((kind) => ({ adapter: kind, capability: kind, available: true, execution: kind === 'translation' ? 'remote' : 'local', models: [{ id: kind, devices: [kind === 'translation' ? 'remote' : 'cpu'], source_languages: ['en'], target_languages: ['zh'], voice_modes: [], voices: [] }] }))
  const request = vi.fn(async (path: string) => path === '/api/v2/runtime' ? { devices: [{ id: 'cpu', available: true }], capabilities } : { providers: capabilities.map((item) => ({ ...item, available: false })), workflows: [] })
  const context = { apiClient: { request }, effect: (effect: () => unknown) => effect() } as unknown as TestContext
  const value = { output_mode: 'subtitles', source_language: 'en', target_language: 'zh', keep_background: false, asr: { adapter: 'asr', model: 'asr', device: 'cpu' }, translation: { adapter: 'translation', model: 'translation', device: 'remote' }, tts: null, separation: null }
  const { rerender } = render(<TestFeatureProvider context={context}><LanguageProvider><Editor mode="options" value={value} schema={{}} diagnostics={[]} readOnly={false} onChange={vi.fn()} /></LanguageProvider></TestFeatureProvider>)
  await screen.findByLabelText('Ngôn ngữ đích')
  expect(screen.queryByLabelText('Nhận dạng giọng nóiMô hình')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Gợi ý tên riêng (không bắt buộc)')).not.toBeInTheDocument()
  await userEvent.setup().click(screen.getByLabelText('Ngôn ngữ đích'))
  expect(await screen.findByRole('menuitem', { name: 'Tiếng Trung' })).toBeInTheDocument()
  await userEvent.setup().keyboard('{Escape}')
  // Reruns retain their full editor so old model selections can be corrected.
  rerender(<TestFeatureProvider context={context}><LanguageProvider><Editor value={value} schema={{}} diagnostics={[]} readOnly={false} onChange={vi.fn()} /></LanguageProvider></TestFeatureProvider>)
  expect(screen.getByLabelText('Nhận dạng giọng nóiMô hình')).not.toHaveTextContent('Không khả dụng')
  expect(request).toHaveBeenCalledTimes(1)
})

it('opens retained task options without writing global processing defaults', async () => {
  const request = vi.fn(async () => ({ devices: [], capabilities: [] }))
  const context = { apiClient: { request } } as unknown as TestContext
  render(<TestFeatureProvider context={context}><LanguageProvider><Editor mode="options" value={{ source_language: 'en', target_language: 'ja', output_mode: 'subtitles' }} schema={{}} diagnostics={[]} readOnly={false} onChange={vi.fn()} /></LanguageProvider></TestFeatureProvider>)
  await screen.findByLabelText('Ngôn ngữ đích')
  expect(screen.getByLabelText('Ngôn ngữ đích')).toHaveTextContent('日本語')
  expect(request).toHaveBeenCalledTimes(1)
  expect(request).toHaveBeenCalledWith('/api/v2/runtime', expect.objectContaining({ signal: expect.any(AbortSignal) }))
})
