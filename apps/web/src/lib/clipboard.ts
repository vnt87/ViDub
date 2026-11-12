import { writeClipboard } from '../components/ui/harness-primitives'
export async function copyText(text:string) { if (!await writeClipboard(text)) throw new Error('Không thể ghi vào clipboard') }
