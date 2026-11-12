import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Page, PageHeader, WindowHeaderProvider } from './page-layout'

afterEach(cleanup)

it('keeps live page actions in the window header and metadata with the content', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const save = vi.fn()
  const page = (title: string, disabled = false) => <WindowHeaderProvider value={host}>
    <Page><PageHeader title={title} actions={<button disabled={disabled} onClick={save}>Lưu</button>}><time>今天</time></PageHeader><p>Chỉnh sửaNội dung</p></Page>
  </WindowHeaderProvider>
  const view = render(page('Quy trình'))
  expect(within(host).getByRole('heading', { name: 'Quy trình' })).toBeVisible()
  expect(within(view.container).queryByRole('heading')).not.toBeInTheDocument()
  expect(within(view.container).getByText('今天')).toBeVisible()
  await userEvent.setup().click(within(host).getByRole('button', { name: 'Lưu' }))
  expect(save).toHaveBeenCalledOnce()
  view.rerender(page('Đã lưuQuy trình', true))
  expect(within(host).getByRole('heading', { name: 'Đã lưuQuy trình' })).toBeVisible()
  expect(within(host).getByRole('button', { name: 'Lưu' })).toBeDisabled()
  view.unmount()
  expect(host).toBeEmptyDOMElement()
  host.remove()
})

it('keeps the regular page header when no window header is provided', () => {
  render(<Page><PageHeader title="Tài nguyên" actions={<button>Kiểm tra lại</button>} /></Page>)
  expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { name: 'Tài nguyên' }))
})
