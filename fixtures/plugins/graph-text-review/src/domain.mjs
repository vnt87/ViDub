import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { AppError } from '@youdub/harness-subtitles'

export const name = 'example-graph-text-review'
export const inject = ['catalog']
const providerId = 'example.graph-text'
const textSchema = { type: 'object', required: ['text'], properties: { text: { type: 'string', minLength: 1 } }, additionalProperties: false }
const metadataSchema = { type: 'object', required: ['sources'], properties: { sources: { type: 'integer', minimum: 1 } }, additionalProperties: false }
const emptySchema = { type: 'object', properties: {}, additionalProperties: false }
const textPort = { name: 'text', label: 'Văn bản', kind: 'json', schemaId: 'example/text/v1', required: true, schema: textSchema }
const metadataPort = { name: 'metadata', label: 'Số nguồn', kind: 'json', schemaId: 'example/text-metadata/v1', required: true, schema: metadataSchema }
const inputPort = (id, schemaId, label) => ({ id, label, kind: 'json', acceptedSchemaIds: [schemaId], required: true })
const descriptor = (type, label, inputs, configSchema = emptySchema, defaults = {}) => ({
  type, version: '1.0.0', label, category: 'Văn bản', inputs, configSchema, defaults,
})
const operations = [
  { id: 'example.text-source/v1', inputSchema: emptySchema, outputs: [textPort],
    node: { ...descriptor('example.text-source', 'Nội dung văn bản', [], textSchema, { text: 'Hello YouDub' }), ui: { quickFields: ['text'] } } },
  { id: 'example.text-review/v1', inputSchema: { type: 'object', required: ['left', 'right'], properties: { left: textSchema, right: textSchema }, additionalProperties: false },
    outputs: [textPort, metadataPort],
    node: { ...descriptor('example.text-review', 'Gộp và hiệu đính', [inputPort('left', textPort.schemaId, 'Đoạn thứ nhất'), inputPort('right', textPort.schemaId, 'Đoạn thứ hai')]),
      ui: { detailId: 'example.text-review.details' }, corrections: { outputPorts: ['text'], schemaIds: [textPort.schemaId] } } },
  { id: 'example.text-export/v1', inputSchema: { type: 'object', required: ['text', 'metadata'], properties: { text: textSchema, metadata: metadataSchema }, additionalProperties: false },
    outputs: [{ name: 'document', label: 'Tệp văn bản', kind: 'artifact', schemaId: 'file/v1', required: true }],
    node: descriptor('example.text-export', 'Xuất văn bản', [inputPort('text', textPort.schemaId, 'Văn bản hiệu đính'), inputPort('metadata', metadataPort.schemaId, 'Số nguồn')]) },
]
const node = (id, type, config, autoContinue = true) => ({ id, type, typeVersion: '1.0.0', provider: { id: providerId }, config, autoContinue })
const edge = (id, from, port, to, input) => ({ id, source: { nodeId: from, portId: port }, target: { nodeId: to, portId: input } })
export const graphTemplate = {
  format: 'youdub.workflow', formatVersion: 1, id: 'example.text-review', title: 'Gộp văn bản và hiệu đính thủ công',
  nodes: [
    node('first', 'example.text-source', { text: 'Hello YouDub' }),
    node('second', 'example.text-source', { text: 'Nội dung đoạn thứ hai chờ hiệu đính' }),
    node('review', 'example.text-review', {}, false),
    node('export', 'example.text-export', {}),
  ],
  edges: [
    edge('first-review', 'first', 'text', 'review', 'left'),
    edge('second-review', 'second', 'text', 'review', 'right'),
    edge('review-text', 'review', 'text', 'export', 'text'),
    edge('review-metadata', 'review', 'metadata', 'export', 'metadata'),
  ],
  inputs: [],
  outputs: [{ id: 'document', label: 'Văn bản hiệu đính', kind: 'artifact', schemaId: 'file/v1', required: true, source: { nodeId: 'export', portId: 'document' } }],
  presentation: { positions: { first: { x: 0, y: 0 }, second: { x: 0, y: 220 }, review: { x: 340, y: 100 }, export: { x: 680, y: 100 } }, viewport: { x: 0, y: 0, zoom: 1 } },
}

export function apply(ctx, config = {}) {
  const owner = config.$plugin || { id: 'example.graph-text-review', version: '1.0.0', integrity: 'fixture:development' }
  const identity = { pluginId: owner.id, pluginVersion: owner.version, integrity: owner.integrity }
  const provider = {
    id: providerId,
    describe: () => ({ id: providerId, label: 'Ví dụ hiệu đính văn bản', ...identity, available: true, execution: 'local', operations: structuredClone(operations) }),
    probe: async () => ({ available: true }),
    async execute(request, invocation) {
      invocation.signal.throwIfAborted()
      switch (request.operation) {
        case 'example.text-source/v1':
          return { state: 'completed', outputs: { text: { text: request.binding.options.text } } }
        case 'example.text-review/v1':
          return { state: 'completed', outputs: { text: { text: `${request.inputs.left.text}\n${request.inputs.right.text}` }, metadata: { sources: 2 } } }
        case 'example.text-export/v1': {
          await writeFile(join(request.workDir, 'reviewed.txt'), `${request.inputs.text.text}\n\nSố nguồn: ${request.inputs.metadata.sources}\n`, { flag: 'wx', mode: 0o600 })
          const document = await invocation.register({ path: 'reviewed.txt', mimeType: 'text/plain', schemaId: 'file/v1' })
          return { state: 'completed', outputs: { document } }
        }
        default: throw new AppError('UNKNOWN_OPERATION', `Unsupported operation: ${request.operation}`, 422)
      }
    },
    validateCorrection({ operation, baselineOutputs, patch }) {
      if (operation !== 'example.text-review/v1' || Object.keys(patch).some(key => key !== 'text') ||
        typeof patch.text?.text !== 'string' || !patch.text.text.trim()) {
        throw new AppError('INVALID_CORRECTION', 'Văn bản sau hiệu đính không được rỗng, và chỉ được sửa đầu ra văn bản.', 422)
      }
      // The Host validates the declared output schema; the plugin validates meaning.
      return { ...baselineOutputs, ...patch }
    },
  }
  const workflow = {
    id: 'example.text-review', version: '1.0.0', ...identity,
    describe: () => ({ id: 'example.text-review', version: '1.0.0', label: graphTemplate.title, inputs: [], configSchema: emptySchema, defaults: {}, graphTemplate: structuredClone(graphTemplate) }),
    graph: { async compile(request, catalog) {
      const compiled = await catalog.workflow('youdub.graph').graph.compile(request, catalog)
      compiled.plan.workflow = { id: workflow.id, version: workflow.version, ...identity }
      return compiled
    } },
  }
  ctx.effect(() => ctx.catalog.registerProvider(provider))
  ctx.effect(() => ctx.catalog.registerWorkflow(workflow))
}
