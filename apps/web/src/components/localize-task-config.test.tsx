import { useState } from "react"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TaskConfigForm, TaskOptions } from "@/components/localize-task-config"
import { LanguageProvider } from '@/test/language-provider'
import type { Runtime, TaskConfig } from "@/plugin/builtin/localize-contracts"
const testConfig: TaskConfig = {
  source_language: "en", target_language: "zh", output_mode: "subtitles", keep_background: false,
  asr: { adapter: "test_asr", model: "asr", device: "cpu" },
  translation: { adapter: "test_translation", model: "translation", device: "remote" },
  tts: null, separation: null,
}

function testRuntime(): Runtime {
  return {
    devices: [{ id: "cpu", available: true }],
    capabilities: (["asr", "translation", "tts", "separation"] as const).map((kind) => ({
      adapter: `test_${kind}`, capability: kind, execution: kind === "translation" ? "remote" : "local",
      available: true, unavailable_reason: null,
      models: [{ id: kind, devices: [kind === "translation" ? "remote" : "cpu"], source_languages: ["en", "zh", "ja", "auto"], target_languages: ["en", "zh", "ja"],
        voice_modes: kind === "tts" ? ["preset", "source_clone"] : [], voices: kind === "tts" ? [{ id: "voice", name: "测试Giọng", languages: ["en", "zh", "ja"] }] : [],
      }],
    })),
  }
}


function runtimeWithVoxCpm() {
  const runtime = testRuntime()
  const tts = runtime.capabilities.find((item) => item.capability === "tts")!
  runtime.capabilities.push({ ...tts, adapter: "voxcpm", models: [{ ...tts.models[0], id: "VoxCPM2" }] })
  return runtime
}

const qwenSelection = { adapter: "qwen_forced_aligner", model: "Qwen3-ForcedAligner-0.6B-hf", device: "cpu" } as const

function runtimeWithQwen() {
  const runtime = testRuntime()
  const base = runtime.capabilities.find((item) => item.capability === "separation")!
  runtime.capabilities.push({ ...base, adapter: qwenSelection.adapter, capability: "subtitle_alignment", models: [{
    ...base.models[0], id: qwenSelection.model, source_languages: [], target_languages: ["en", "zh"],
  }] })
  return runtime
}

function mount(runtime: Runtime, initial: TaskConfig = testConfig) {
  const onChange = vi.fn()
  function Form() {
    const [value, setValue] = useState(initial)
    return <TaskConfigForm runtime={runtime} value={value} onChange={(next) => { setValue(next); onChange(next) }} />
  }
  render(<LanguageProvider><Form /></LanguageProvider>)
  return onChange
}

async function choose(user: ReturnType<typeof userEvent.setup>, label: string, option: string) {
  await user.click(screen.getByLabelText(label))
  await user.click(await screen.findByRole("menuitem", { name: option }))
}

afterEach(() => { cleanup(); window.localStorage.clear() })

it('labels an AMD device with its actual ROCm backend', () => {
  const runtime = testRuntime()
  runtime.devices.unshift({ id: 'cuda:0', backend: 'rocm', available: true })
  runtime.capabilities[0].models[0].devices = ['cuda:0', 'cpu']
  mount(runtime, { ...testConfig, asr: { ...testConfig.asr, device: 'cuda:0' } })
  expect(screen.getByText(/AMD ROCm 0/)).toBeInTheDocument()
})

it("主页只显示三个基础选项，切换Đầu ra后GiữCài đặt中的Mô hình和处理Cấu hình", async () => {
  const runtime = runtimeWithQwen()
  runtime.capabilities.find((item) => item.capability === "tts")!.models.push({
    ...runtime.capabilities.find((item) => item.capability === "tts")!.models[0], id: "configured-tts",
  })
  const defaults: TaskConfig = { ...testConfig, output_mode: "both", keep_background: true,
    asr: { ...testConfig.asr, initial_prompt: "Saved hint" },
    tts: { adapter: "test_tts", model: "configured-tts", device: "cpu", voice: { mode: "preset", id: "voice" } },
    separation: { adapter: "test_separation", model: "separation", device: "cpu" }, subtitle_alignment: qwenSelection }
  const changed = vi.fn()
  function Options() {
    const [value, setValue] = useState(defaults)
    return <TaskOptions value={value} runtime={runtime} onChange={(next) => { setValue(next); changed(next) }} />
  }
  render(<LanguageProvider><Options /></LanguageProvider>)
  expect(document.querySelectorAll('[aria-haspopup="menu"]')).toHaveLength(3)
  expect(screen.queryByLabelText('Lồng tiếngMô hình')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Gợi ý tên riêng (không bắt buộc)')).not.toBeInTheDocument()
  const user = userEvent.setup()
  await choose(user, 'Nội dung đầu ra', 'Phụ đề · âm thanh gốc')
  expect(changed.mock.calls.at(-1)![0]).toMatchObject({ tts: null, separation: null, subtitle_alignment: null, keep_background: false })
  await choose(user, 'Nội dung đầu ra', 'Lồng tiếng')
  expect(changed.mock.calls.at(-1)![0]).toMatchObject({ tts: defaults.tts, separation: defaults.separation, subtitle_alignment: null, keep_background: true })
  await choose(user, 'Nội dung đầu ra', 'Lồng tiếng và phụ đề')
  expect(changed.mock.calls.at(-1)![0]).toEqual(defaults)
})

describe("本地化任务Cấu hình", () => {
  it("仅Lồng tiếng和Phụ đềChế độ显示 Qwen Thời gian选择，退出该Chế độ清除选择", async () => {
    const runtime = runtimeWithQwen()
    const onChange = mount(runtime)
    const user = userEvent.setup()
    expect(screen.queryByLabelText("Phụ đềThời gian")).not.toBeInTheDocument()
    await choose(user, "Nội dung đầu ra", "Lồng tiếng và phụ đề")
    expect(screen.getByLabelText("Phụ đềThời gian")).toHaveTextContent("Ước tính theo độ dài văn bản")
    await choose(user, "Phụ đềThời gian", "Qwen3-ForcedAligner-0.6B-hf · CPU")
    const config = onChange.mock.calls.at(-1)![0]
    expect(config.subtitle_alignment).toEqual(qwenSelection)
    await choose(user, "Nội dung đầu ra", "Phụ đề · âm thanh gốc")
    expect(onChange.mock.calls.at(-1)![0]).toMatchObject({ tts: null, subtitle_alignment: null })
    expect(screen.queryByLabelText("Phụ đềThời gian")).not.toBeInTheDocument()
  })

  it("Lưu的Phụ đềThời gian选择保持原值，Ngôn ngữ đích不支持时显式提示", async () => {
    const runtime = runtimeWithQwen()
    const defaults: TaskConfig = { ...testConfig, output_mode: "both", subtitle_alignment: qwenSelection,
      tts: { adapter: "test_tts", model: "tts", device: "cpu", voice: { mode: "preset", id: "voice" } } }
    const onChange = mount(runtime, defaults)
    expect(screen.getByLabelText("Phụ đềThời gian")).toHaveTextContent("Qwen3-ForcedAligner-0.6B-hf · CPU")
    await choose(userEvent.setup(), "Ngôn ngữ đích", "日本語")
    const config = onChange.mock.calls.at(-1)![0]
    expect(config.subtitle_alignment).toEqual(qwenSelection)
    expect(screen.getByLabelText("Phụ đềThời gian")).toHaveTextContent("Qwen3-ForcedAligner-0.6B-hf · không khả dụng")
  })

  it("Không bắt buộc Qwen Không khả dụng时允许原Cấu hình，已选择 Qwen 时提示Mô hìnhKhông khả dụng", async () => {
    const runtime = runtimeWithQwen()
    runtime.capabilities.at(-1)!.available = false
    runtime.capabilities.at(-1)!.unavailable_reason = "未Đang cài đặtMô hình"
    const defaults: TaskConfig = { ...testConfig, output_mode: "both", subtitle_alignment: qwenSelection,
      tts: { adapter: "test_tts", model: "tts", device: "cpu", voice: { mode: "preset", id: "voice" } } }
    mount(runtime, defaults)
    expect(screen.getByLabelText("Phụ đềThời gian")).toHaveTextContent("Qwen3-ForcedAligner-0.6B-hf · không khả dụng")
    await userEvent.setup().click(screen.getByLabelText("Phụ đềThời gian"))
    expect(await screen.findByRole("menuitem", { name: "Qwen — 未Đang cài đặtMô hình" })).toBeDisabled()
  })

  it("专名提示默认留空，切换识别Mô hình和Đầu ra后Giữ，允许清空", async () => {
    const runtime = testRuntime()
    runtime.capabilities[0].models.push({ ...runtime.capabilities[0].models[0], id: "second-asr" })
    const onChange = mount(runtime)
    const user = userEvent.setup()
    const hint = screen.getByLabelText("Gợi ý tên riêng (không bắt buộc)")
    expect(hint).toHaveValue("")
    expect(hint).toHaveAccessibleDescription("Thêm tên người hoặc thương hiệu để hỗ trợ nhận dạng giọng nói.")
    await user.type(hint, "YouDub, 张三")
    await choose(user, "Nhận dạng giọng nóiMô hình", "second-asr test_asr · CPU")
    await choose(user, "Nội dung đầu ra", "Lồng tiếng và phụ đề")
    expect(onChange.mock.calls.at(-1)![0].asr).toEqual({ adapter: "test_asr", model: "second-asr", device: "cpu", initial_prompt: "YouDub, 张三" })
    expect(hint).toHaveValue("YouDub, 张三")
    await user.clear(hint)
    expect(onChange.mock.calls.at(-1)![0].asr.initial_prompt).toBeNull()
  })

  it("首次启用Lồng tiếng优先Sẵn sàng VoxCPM2 源音色克隆", async () => {
    const runtime = runtimeWithVoxCpm()
    const onChange = mount(runtime)
    await choose(userEvent.setup(), "Nội dung đầu ra", "Lồng tiếng và phụ đề")
    expect(onChange.mock.calls.at(-1)![0]).toMatchObject({
      tts: { adapter: "voxcpm", model: "VoxCPM2", device: "cpu", voice: { mode: "source_clone" } },
      separation: { adapter: "test_separation", model: "separation", device: "cpu" },
    })
    expect(within(screen.getByRole("tablist", { name: "Nguồn giọng" })).getByRole("tab", { name: "Nhân bản giọng từ nguồn" })).toHaveAttribute("aria-selected", "true")
  })

  it.each(["unavailable", "no-clone", "unsupported-language", "unavailable-device"])("VoxCPM2 %s 时Giữ现有Sẵn sàngMô hình选择", async (reason) => {
    const runtime = runtimeWithVoxCpm()
    const voxcpm = runtime.capabilities.at(-1)!
    if (reason === "unavailable") voxcpm.available = false
    if (reason === "no-clone") voxcpm.models[0].voice_modes = ["preset"]
    if (reason === "unsupported-language") voxcpm.models[0].target_languages = ["ja"]
    if (reason === "unavailable-device") voxcpm.models[0].devices = ["cuda:0"]
    const onChange = mount(runtime)
    await choose(userEvent.setup(), "Nội dung đầu ra", "Lồng tiếng")
    expect(onChange.mock.calls.at(-1)![0].tts).toEqual({ adapter: "test_tts", model: "tts", device: "cpu", voice: { mode: "preset", id: "voice" } })
  })

  it("尊重Đã lưu的提示和Giọng cài sẵn，显式换 VoxCPM2 时选择源音色克隆", async () => {
    const runtime = runtimeWithVoxCpm()
    const defaults: TaskConfig = {
      ...testConfig, output_mode: "dubbing", asr: { ...testConfig.asr, initial_prompt: "Saved name" },
      tts: { adapter: "test_tts", model: "tts", device: "cpu", voice: { mode: "preset", id: "voice" } },
    }
    const onChange = mount(runtime, defaults)
    const user = userEvent.setup()
    expect(screen.getByLabelText("Gợi ý tên riêng (không bắt buộc)")).toHaveValue("Saved name")
    expect(within(screen.getByRole("tablist", { name: "Nguồn giọng" })).getByRole("tab", { name: "Giọng cài sẵn" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByLabelText("Giọng")).toHaveTextContent("测试Giọng")
    await choose(user, "Ngôn ngữ đích", "日本語")
    expect(onChange.mock.calls.at(-1)![0].tts).toEqual(defaults.tts)
    await choose(user, "Lồng tiếngMô hình", "VoxCPM2 VoxCPM · CPU")
    expect(onChange.mock.calls.at(-1)![0].tts).toEqual({ adapter: "voxcpm", model: "VoxCPM2", device: "cpu", voice: { mode: "source_clone" } })
  })

  it("Giữ âm thanh nền时补上分离Mô hình", async () => {
    const onChange = mount(testRuntime(), { ...testConfig, output_mode: "dubbing", tts: { adapter: "test_tts", model: "tts", device: "cpu", voice: { mode: "preset", id: "voice" } } })
    expect(screen.getByLabelText("Nhận dạng giọng nóiMô hình")).toBeInTheDocument()
    expect(screen.queryByLabelText("Tách âm thanh Mô hình")).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole("switch", { name: "Giữ âm thanh nền" }))
    expect(onChange.mock.calls.at(-1)![0]).toMatchObject({ keep_background: true, separation: { adapter: "test_separation", model: "separation", device: "cpu" } })
    expect(screen.getByLabelText("Tách âm thanh Mô hình")).toHaveTextContent("separation test_separation · CPU")
  })
})
