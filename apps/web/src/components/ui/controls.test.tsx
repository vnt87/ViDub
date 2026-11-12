import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, expect, it } from 'vitest'
import { Segmented } from './segmented'
import { Switch } from './switch'
import { Progress } from './progress'
import { Disclosure } from './disclosure'
import { NativeSelect } from './native-select'
import { Select, SelectContent, SelectItem, SelectTrigger } from './select'
afterEach(cleanup)

it('switches enabled segments by keyboard and skips a disabled choice', async () => {
  function Example() {
    const [value, setValue] = useState('light')
    return <Segmented id="appearance" ariaLabel="Giao diện" value={value} onChange={setValue} options={[{ value: 'light', label: 'Sáng' }, { value: 'dark', label: 'Tối', disabled: true }, { value: 'system', label: 'Theo hệ thống' }]} />
  }
  const user = userEvent.setup(); render(<Example />)
  await user.tab(); await user.keyboard('{ArrowRight}')
  expect(screen.getByRole('tab', { name: 'Theo hệ thống' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('tab', { name: 'Theo hệ thống' })).toHaveFocus()
  await user.keyboard('{Home}')
  expect(screen.getByRole('tab', { name: 'Sáng' })).toHaveFocus()
})

it('keeps the switch accessible state synchronized with the controlled value', async () => {
  function Example() { const [value, setValue] = useState(false); return <Switch aria-label="Tự động tiếp tục" checked={value} onCheckedChange={setValue} /> }
  const user = userEvent.setup(); render(<Example />)
  await user.click(screen.getByRole('switch', { name: 'Tự động tiếp tục' }))
  expect(screen.getByRole('switch', { name: 'Tự động tiếp tục' })).toHaveAttribute('aria-checked', 'true')
})

it('exposes actual progress and no percentage for an unknown total', () => {
  const view = render(<Progress label="Tải xuống" />)
  expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
  view.rerender(<Progress label="Tải xuống" value={0.42} />)
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42')
})

it('opens diagnostic details without losing their content', async () => {
  const user = userEvent.setup(); render(<Disclosure contained title="Nhật ký tác vụ"><p>Tải xuống完成</p></Disclosure>)
  await user.click(screen.getByText('Nhật ký tác vụ'))
  expect(screen.getByRole('button', { name: 'Nhật ký tác vụ' })).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText('Tải xuống完成')).toBeVisible()
})

it('updates disclosure from its source while preserving manual collapse', async () => {
  const user = userEvent.setup()
  const view = render(<Disclosure contained title="Nhật ký tác vụ" open={false}>日志</Disclosure>)
  const toggle = screen.getByRole('button', { name: 'Nhật ký tác vụ' })
  view.rerender(<Disclosure contained title="Nhật ký tác vụ" open>日志</Disclosure>)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await user.click(toggle)
  view.rerender(<Disclosure contained title="Nhật ký tác vụ" open>新日志</Disclosure>)
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  view.rerender(<Disclosure contained title="Nhật ký tác vụ" open={false}>新日志</Disclosure>)
  view.rerender(<Disclosure contained title="Nhật ký tác vụ" open>新日志</Disclosure>)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
})


it.each(['field', 'compound'])('uses the Harness menu keyboard, disabled and focus contract for %s selection', async kind => {
  function Example() {
    const [value, setValue] = useState('zh')
    if (kind === 'field') return <NativeSelect aria-label="Ngôn ngữ" value={value} onChange={event => setValue(event.target.value)}><option value="zh">Tiếng Trung</option><option value="ja" disabled>日本語</option><option value="en">English</option></NativeSelect>
    return <Select value={value} onValueChange={setValue}><SelectTrigger aria-label="Ngôn ngữ">{value === 'zh' ? 'Tiếng Trung' : 'English'}</SelectTrigger><SelectContent><SelectItem value="zh">Tiếng Trung</SelectItem><SelectItem value="ja" disabled>日本語</SelectItem><SelectItem value="en">English</SelectItem></SelectContent></Select>
  }
  const user = userEvent.setup(); render(<Example />)
  const trigger = screen.getByRole('button', { name: 'Ngôn ngữ' })
  await user.tab(); await user.keyboard('{ArrowDown}')
  expect(screen.getByRole('menuitem', { name: 'Tiếng Trung' })).toHaveFocus()
  expect(screen.getByRole('menuitem', { name: '日本語' })).toBeDisabled()
  await user.keyboard('{ArrowDown}{Enter}')
  expect(trigger).toHaveTextContent('English')
  expect(trigger).toHaveFocus()
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  await user.keyboard('{ArrowDown}{Escape}')
  expect(trigger).toHaveFocus()
  expect(trigger).toHaveTextContent('English')
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
})
