import { AppError, type JsonObject, type NodeDescriptor, type OperationProvider } from '@youdub/sdk'
import { isDeepStrictEqual } from 'node:util'

const object = (properties: JsonObject, required: string[] = []) => ({ type: 'object', additionalProperties: false, properties, required })
const language = { type: 'string', minLength: 2 }
const languageOptions = [
  { value: 'auto', label: { default: 'Auto detect', translations: { vi: 'Tự động nhận diện', ja: '自動検出' } } },
  { value: 'en', label: 'English' }, { value: 'zh', label: '中文' }, { value: 'ja', label: '日本語' },
]
const source = { sourceLanguage: { ...language, 'x-options': languageOptions, 'x-optionsFrom': 'source_languages', 'x-short-title': { default: 'Source language', translations: { vi: 'Ngôn ngữ nguồn', ja: '元の言語' } } } }
const target = { targetLanguage: { ...language, 'x-options': languageOptions.filter((item) => item.value !== 'auto'), 'x-optionsFrom': 'target_languages', 'x-short-title': { default: 'Translation language', translations: { vi: 'Ngôn ngữ đích', ja: '翻訳先の言語' } } } }
const port = (id: string, label: string, schema: string | string[], kind: 'json' | 'artifact' = 'json', required = true) => ({ id, label, kind, acceptedSchemaIds: typeof schema === 'string' ? [schema] : schema, required })
const audio = (id: string, label: string, required = true) => port(id, label, 'audio/wav/v1', 'artifact', required)
const transcript = () => port('transcript', 'Bản ghi', 'transcript/v1')
const translation = () => port('translation', 'Bản dịch', 'translation/v1')
const media = () => port('mediaInfo', 'Thông tin phương tiện', 'media-info/v1')
const video = () => port('video', 'Video', ['file/v1', 'video/mp4/v1'], 'artifact')
const make = (type: string, vi: string, en: string, ja: string, category: string, inputs: NodeDescriptor['inputs'], properties: JsonObject = {}, defaults: JsonObject = {}): NodeDescriptor => ({
  type: 'youdub.' + type, version: '1.0.0', label: { default: en, translations: { vi, ja } }, category, inputs, configSchema: object(properties), defaults,
  ui: { quickFields: Object.keys(properties).slice(0, 3) },
})
export const nodeDescriptors: Record<string, NodeDescriptor> = {
  download: { ...make('download', 'Tải video', 'Download video', '動画をダウンロード', 'input', [], { proxyPort: { type: 'integer', minimum: 0, maximum: 65535 } }, { proxyPort: 0 }), ui: { quickFields: ['proxyPort'] }, runtimeInputSchema: object({ url: { type: 'string', minLength: 1 } }, ['url']) },
  prepare: make('prepare', 'Chuẩn bị phương tiện', 'Prepare media', 'メディアを準備', 'media', [video()]),
  separate: make('separate', 'Tách giọng', 'Separate vocals', '音声を分離', 'audio', [audio('sourceAudio', 'Âm thanh gốc')]),
  recognize: { ...make('transcribe', 'Nhận dạng giọng nói', 'Transcribe', '文字起こし', 'text', [audio('audio', 'Âm thanh'), media()], { ...source, initialPrompt: { type: ['string', 'null'] } }, { sourceLanguage: 'auto', initialPrompt: null }), corrections: { outputPorts: ['transcript'], schemaIds: ['transcript/v1'] }, ui: { quickFields: ['sourceLanguage'], detailId: 'youdub.transcript' } },
  translate: { ...make('translate', 'Dịch', 'Translate', '翻訳', 'text', [transcript()], { ...source, ...target }, { sourceLanguage: 'auto', targetLanguage: 'zh' }), corrections: { outputPorts: ['translation'], schemaIds: ['translation/v1'] }, ui: { quickFields: ['targetLanguage'], detailId: 'youdub.translation' } },
  reference: make('reference', 'Chuẩn bị âm thanh tham chiếu', 'Voice reference', '参照音声', 'audio', [transcript(), audio('audio', 'Giọng hát')]),
  synthesize: make('synthesize', 'Tạo lồng tiếng', 'Synthesize speech', '吹き替え生成', 'audio', [transcript(), translation(), port('references', 'Âm thanh tham chiếu', 'voice-references/v1', 'json', false)], { ...target, voice: { oneOf: [object({ mode: { const: 'source_clone' } }, ['mode']), object({ mode: { const: 'preset' }, id: { type: 'string', minLength: 1 } }, ['mode', 'id'])] } }, { targetLanguage: 'zh', voice: { mode: 'source_clone' } }),
  mix: make('mix', 'Trộn âm thanh', 'Mix audio', 'ミックス', 'audio', [transcript(), port('speechAudio', 'Lồng tiếng theo đoạn', 'speech-audio/v1'), media(), audio('background', 'Âm thanh nền', false)], { keepBackground: { type: 'boolean' } }, { keepBackground: false }),
  align: make('align', 'Căn chỉnh phụ đề', 'Align subtitles', '字幕の整列', 'text', [transcript(), translation(), port('dubbedTimeline', 'Dòng thời gian lồng tiếng', 'dubbed-timeline/v1'), port('adjustedSpeech', 'Lồng tiếng đã điều chỉnh', 'speech-audio/v1')], target, { targetLanguage: 'zh' }),
  export: make('export', 'Xuất video', 'Export video', '動画を書き出し', 'output', [video(), media(), transcript(), translation(), audio('finalAudio', 'Âm thanh tổng hợp', false), port('dubbedTimeline', 'Dòng thời gian lồng tiếng', 'dubbed-timeline/v1', 'json', false), port('wordAlignment', 'Mốc thời gian theo từ', 'word-alignment/v1', 'json', false)], { ...source, ...target, renderSubtitles: { type: 'boolean' } }, { sourceLanguage: 'auto', targetLanguage: 'zh', renderSubtitles: true }),
  importSubtitles: make('importSubtitles', 'Nhập phụ đề', 'Import subtitles', '字幕を読み込み', 'input', [port('sourceSubtitles', 'Phụ đề gốc', ['file/v1', 'application/x-subrip/v1'], 'artifact'), port('translatedSubtitles', 'Phụ đề đã dịch', ['file/v1', 'application/x-subrip/v1'], 'artifact')], { ...source, ...target }, { sourceLanguage: 'en', targetLanguage: 'zh' }),
}


nodeDescriptors.synthesize.ui = { quickFields: ['targetLanguage'], editorId: 'youdub.synthesize' }
nodeDescriptors.export.ui = { quickFields: ['targetLanguage'] }
for (const [operation, title] of Object.entries({ synthesize: ['Dubbing language', 'Ngôn ngữ lồng tiếng', '吹き替えの言語'], align: ['Alignment language', 'Ngôn ngữ căn chỉnh', '整列の言語'], export: ['Export language', 'Ngôn ngữ xuất', '書き出しの言語'] })) {
  const properties = nodeDescriptors[operation].configSchema.properties
  properties.targetLanguage = { ...properties.targetLanguage, 'x-short-title': { default: title[0], translations: { vi: title[1], ja: title[2] } } }
}

const portTitles: Record<string, [string, string, string]> = {
  video: ['Video', 'Video', '動画'], sourceAudio: ['Source audio', 'Âm thanh gốc', '元の音声'], audio: ['Audio', 'Âm thanh', '音声'],
  vocals: ['Vocals', 'Giọng hát', 'ボーカル'], background: ['Background', 'Âm thanh nền', '背景音'], mediaInfo: ['Media info', 'Thông tin phương tiện', 'メディア情報'],
  transcript: ['Transcript', 'Bản ghi', '原文'], translation: ['Translation', 'Bản dịch', '翻訳'], raw: ['Raw result', 'Dữ liệu gốc', '元データ'],
  references: ['Voice references', 'Âm thanh tham chiếu', '参照音声'], speechAudio: ['Speech segments', 'Lồng tiếng theo đoạn', '分割音声'], finalAudio: ['Mixed audio', 'Âm thanh tổng hợp', '合成音声'],
  dubbedTimeline: ['Dubbed timeline', 'Dòng thời gian lồng tiếng', '吹き替えタイムライン'], adjustedSpeech: ['Adjusted speech', 'Lồng tiếng đã điều chỉnh', '調整済み音声'],
  wordAlignment: ['Word alignment', 'Mốc thời gian theo từ', '単語の時刻'], sourceSubtitles: ['Source subtitles', 'Phụ đề gốc', '原文字幕'], translatedSubtitles: ['Translated subtitles', 'Phụ đề đã dịch', '翻訳字幕'],
}
export const outputPortLabels = Object.fromEntries(Object.entries(portTitles).map(([key, title]) => [key, { default: title[0], translations: { vi: title[1], ja: title[2] } }]))
for (const descriptor of Object.values(nodeDescriptors)) for (const input of descriptor.inputs) if (outputPortLabels[input.id]) input.label = outputPortLabels[input.id]

const fieldTitles: Record<string, [string, string, string]> = {
  sourceLanguage: ['Source language', 'Ngôn ngữ nguồn', '元の言語'], targetLanguage: ['Target language', 'Ngôn ngữ đích', '翻訳先の言語'],
  initialPrompt: ['Recognition prompt', 'Gợi ý nhận dạng', '認識プロンプト'],
  proxyPort: ['Local HTTP proxy port (0 for direct)', 'Cổng proxy HTTP cục bộ (0 để kết nối trực tiếp)', 'ローカル HTTP プロキシポート（0 は直接接続）'],
  voice: ['Voice', 'Giọng', '音声'], keepBackground: ['Keep background audio', 'Giữ âm thanh nền', '背景音を保持'],
  renderSubtitles: ['Burn subtitles', 'Ghi phụ đề vào video', '字幕を焼き込む'], url: ['Video URL', 'Liên kết video', '動画リンク'],
}
for (const descriptor of Object.values(nodeDescriptors)) for (const schema of [descriptor.configSchema, descriptor.runtimeInputSchema]) {
  for (const [field, property] of Object.entries(schema?.properties ?? {})) {
    const title = fieldTitles[field]
    if (title) Object.assign(property as JsonObject, { title: title[0], 'x-title': { default: title[0], translations: { vi: title[1], ja: title[2] } } })
  }
}

/** Semantic checks supplement the host's schema and ownership checks. Original diagnostics remain immutable. */
export const validateMediaCorrection: NonNullable<OperationProvider['validateCorrection']> = ({ operation, inputs, baselineOutputs, patch }) => {
  const fail = (message: string): never => { throw new AppError('INVALID_CORRECTION', message, 422) }
  const result = { ...structuredClone(baselineOutputs), ...structuredClone(patch) }
  if (operation === 'speech.transcribe/v1') {
    const before = baselineOutputs.transcript, after = result.transcript
    if (after.detected_language !== before.detected_language) fail('Detected language cannot be changed by a segment correction.')
    if (after.segments.length !== before.segments.length) fail('Segment additions and removals are not supported.')
    let lastEnd = 0
    for (let index = 0; index < after.segments.length; index++) {
      const original = before.segments[index], segment = after.segments[index]
      if (segment.id !== original.id) fail('Segment IDs and order must stay unchanged.')
      if (segment.start_ms < lastEnd || segment.start_ms >= segment.end_ms) fail(`Invalid timing for segment ${segment.id}.`)
      if (segment.speaker_id !== original.speaker_id) fail('Speaker identity must stay unchanged.')
      if (segment.text !== original.text || segment.start_ms !== original.start_ms || segment.end_ms !== original.end_ms) segment.words = null
      else if (!isDeepStrictEqual(segment.words, original.words)) fail('Word timings cannot be edited separately.')
      lastEnd = segment.end_ms
    }
  } else if (operation === 'text.translate/v1') {
    const after = result.translation, before = baselineOutputs.translation
    if (after.source_language !== before.source_language || after.target_language !== before.target_language) fail('Translation languages must stay unchanged.')
    const expected = inputs.transcript.segments.map((segment: any) => segment.id)
    if (!isDeepStrictEqual(after.segments.map((segment: any) => segment.segment_id), expected)) fail('Translation must contain each source segment exactly once in source order.')
  } else fail('This operation does not support corrections.')
  return result
}
