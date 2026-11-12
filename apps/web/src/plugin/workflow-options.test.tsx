import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { LanguageProvider } from '@/test/language-provider'
import type { Bindings, JsonObject, NodeTypeDefinition, WorkflowDocument } from './sdk'
import { WorkflowOptions } from './builtin/workflow-options'
import { nodeDescriptors } from '../../../../packages/builtin/src/node-contracts'

const type: NodeTypeDefinition = { type: 'test.options', version: '1', label: 'Nút', category: 'test', providerId: 'test', operation: 'test', provider: { id: 'test', operations: [] }, inputs: [], outputs: [], defaults: {}, configSchema: { type: 'object' }, ui: { quickFields: [] } }
const useSlot = (() => []) as Bindings<'useSlot'>['useSlot']
function mount(definition: NodeTypeDefinition, configs: JsonObject[]) {
  const changed = vi.fn()
  function View() {
    const [document, setDocument] = useState<WorkflowDocument>({ format: 'youdub.workflow', formatVersion: 1, id: 'test', title: 'test', inputs: [], outputs: [], edges: [], nodes: configs.map((config, index) => ({ id: `node-${index}`, type: definition.type, typeVersion: definition.version, provider: { id: definition.providerId, model: typeof definition.provider.models?.[0] === 'string' ? definition.provider.models[0] : definition.provider.models?.[0]?.id }, config, autoContinue: false })), presentation: { positions: {}, viewport: { x: 0, y: 0, zoom: 1 } } })
    return <WorkflowOptions document={document} types={[definition]} disabled={false} useSlot={useSlot} onChange={(id, config) => { changed(id, config); setDocument({ ...document, nodes: document.nodes.map((node) => node.id === id ? { ...node, config } : node) }) }} />
  }
  render(<LanguageProvider><View /></LanguageProvider>)
  return changed
}
afterEach(() => { cleanup(); window.localStorage.clear() })

it('renders accessible language choices from node metadata without restricting the schema', async () => {
  const descriptor = nodeDescriptors.recognize
  const changed = mount({ ...type, configSchema: descriptor.configSchema, ui: descriptor.ui }, [{ sourceLanguage: 'auto', initialPrompt: 'keep' }])
  const trigger = screen.getByLabelText('Ngôn ngữ nguồn')
  expect(trigger).toHaveTextContent('Ngôn ngữ nguồnTự động nhận diện')
  expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(descriptor.configSchema.properties.sourceLanguage.enum).toBeUndefined()
  const user = userEvent.setup()
  await user.click(trigger)
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await user.click(await screen.findByRole('menuitem', { name: '日本語' }))
  expect(trigger).toHaveTextContent('日本語')
  expect(changed).toHaveBeenLastCalledWith('node-0', { sourceLanguage: 'ja', initialPrompt: 'keep' })
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
})

it('distinguishes repeated node labels and changes only the selected instance', async () => {
  const changed = mount({ ...type, label: 'Dịch', configSchema: { properties: { mode: { type: 'string', enum: ['a', 'b'], 'x-title': 'Chế độ' } } }, ui: { quickFields: ['mode'] } }, [{ mode: 'a' }, { mode: 'a' }])
  const user = userEvent.setup()
  await user.click(screen.getByLabelText('Dịch · 1 · Chế độ'))
  await user.click(await screen.findByRole('menuitem', { name: 'b' }))
  expect(screen.getByLabelText('Dịch · 2 · Chế độ')).toHaveTextContent('a')
  expect(changed).toHaveBeenLastCalledWith('node-0', { mode: 'b' })
})

it('preserves a configured language outside the suggestions without mutating node metadata', async () => {
  const descriptor = nodeDescriptors.recognize
  const original = structuredClone(descriptor.configSchema)
  mount({ ...type, configSchema: descriptor.configSchema, ui: descriptor.ui }, [{ sourceLanguage: 'es' }])
  const user = userEvent.setup()
  await user.click(screen.getByLabelText('Ngôn ngữ nguồn'))
  expect(await screen.findByRole('menuitem', { name: 'es · không khả dụng' })).toBeDisabled()
  expect(descriptor.configSchema).toEqual(original)
})

it('edits freeform numeric and text fields in compact menus', async () => {
  const changed = mount({ ...type, configSchema: { properties: { count: { type: 'integer', 'x-title': '次数', minimum: 1, maximum: 10 }, title: { type: 'string', 'x-title': 'Tên' } } }, ui: { quickFields: ['count', 'title'] } }, [{ count: 3, title: '' }])
  const user = userEvent.setup()
  const countTrigger = screen.getByRole('button', { name: '次数' })
  await user.click(countTrigger)
  expect(countTrigger).toHaveAttribute('aria-haspopup', 'menu')
  expect(countTrigger).toHaveAttribute('aria-expanded', 'true')
  const number = await screen.findByRole('spinbutton', { name: '次数' })
  expect(number).toHaveFocus()
  await user.clear(number); await user.type(number, '7')
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  expect(countTrigger).toHaveFocus()
  await user.click(screen.getByRole('button', { name: 'Tên' }))
  await user.type(await screen.findByRole('textbox', { name: 'Tên' }), 'hello')
  expect(changed).toHaveBeenLastCalledWith('node-0', { count: 7, title: 'hello' })
})

it('only offers languages supported by the selected model and disables an unknown current value', async () => {
  const descriptor = nodeDescriptors.recognize
  const provider = { id: 'test', operations: [], capability: 'asr', models: [{ id: 'tiny', source_languages: ['auto', 'en'] }] } as unknown as NodeTypeDefinition['provider']
  mount({ ...type, provider, configSchema: descriptor.configSchema, ui: descriptor.ui }, [{ sourceLanguage: 'asdf' }])
  const user = userEvent.setup()
  await user.click(screen.getByLabelText('Ngôn ngữ nguồn'))
  expect(await screen.findByRole('menuitem', { name: 'asdf · không khả dụng' })).toBeDisabled()
  expect(screen.getByRole('menuitem', { name: 'Tự động nhận diện' })).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: 'English' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Tiếng Trung' })).not.toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: '日本語' })).not.toBeInTheDocument()
})

it.each([
  ['unconfigured provider', { available: false, unavailableReason: 'Provider connection is not configured.', models: [] }],
  ['model name without capabilities', { models: ['openai-compatible'] }],
  ['model without language capabilities', { models: [{ id: 'openai-compatible' }] }],
])('keeps declared language choices for a %s', async (_name, state) => {
  const descriptor = nodeDescriptors.translate
  const provider = { id: 'test', operations: [], capability: 'translation', ...state } as NodeTypeDefinition['provider']
  const changed = mount({ ...type, provider, configSchema: descriptor.configSchema, ui: descriptor.ui }, [{ targetLanguage: 'zh' }])
  const trigger = screen.getByLabelText('Bản dịchNgôn ngữ')
  expect(trigger).toHaveTextContent('Bản dịchNgôn ngữTiếng Trung')
  expect(trigger).not.toHaveTextContent('Không khả dụng')
  const user = userEvent.setup()
  await user.click(trigger)
  expect(await screen.findByRole('menuitem', { name: 'Tiếng Trung' })).not.toBeDisabled()
  await user.click(screen.getByRole('menuitem', { name: '日本語' }))
  expect(changed).toHaveBeenLastCalledWith('node-0', { targetLanguage: 'ja' })
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
})

it('honors an explicitly empty model language list', async () => {
  const descriptor = nodeDescriptors.translate
  const provider = { id: 'test', operations: [], capability: 'translation', models: [{ id: 'no-languages', target_languages: [] }] } as unknown as NodeTypeDefinition['provider']
  mount({ ...type, provider, configSchema: descriptor.configSchema, ui: descriptor.ui }, [{ targetLanguage: 'zh' }])
  const user = userEvent.setup()
  await user.click(screen.getByLabelText('Bản dịchNgôn ngữ'))
  expect(await screen.findByRole('menuitem', { name: 'Tiếng Trung · không khả dụng' })).toBeDisabled()
  expect(screen.queryByRole('menuitem', { name: '日本語' })).not.toBeInTheDocument()
})
