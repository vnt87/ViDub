import { RefObject, useEffect } from "react"

// Khi gỡ bỏ, chủ động ngắt các yêu cầu âm thanh/video: backend sẽ từ chối xóa tác vụ khi sản phẩm vẫn đang được đọc (TASK_BUSY).
export function useReleaseMediaOnUnmount(ref: RefObject<HTMLMediaElement | null>, src: string) {
  useEffect(() => {
    const media = ref.current
    if (!media) return
    // StrictMode khi phát triển sẽ mô phỏng một lần gỡ bỏ trước, nên ở đây phải khôi phục lại địa chỉ.
    if (!media.getAttribute("src")) media.setAttribute("src", src)
    return () => {
      if (!media.paused) media.pause()
      media.removeAttribute("src")
      if (media.networkState !== HTMLMediaElement.NETWORK_EMPTY) media.load()
    }
  }, [ref, src])
}
