import { useState } from 'react';
import { Button, IconDeliverDocRegular } from '@deepseek-ai/dsh-client-ui-primitives';
export const inject = ['slots'];
function Page() {
  const [count, setCount] = useState(0);
  return <section className="yd-feature-page" data-testid="external-text-page"><h1>Plugin văn bản ngoài</h1><Button data-testid="external-text-counter" onClick={() => setCount(value => value + 1)}>Số lần nhấn: {count}</Button></section>;
}
function Navigation({ navigate, collapsed }) {
  return <Button icon={<IconDeliverDocRegular />} aria-label="Plugin văn bản ngoài" onClick={() => navigate('/plugins/file-transform')}>{!collapsed && 'Plugin văn bản ngoài'}</Button>;
}
function Panel({ task }) {
  return task.workflowId !== 'example.uppercase' ? null : <section data-testid="external-transform-panel"><h3>Plugin văn bản ngoài</h3><p>Sau khi chuyển văn bản UTF-8, có thể tải văn bản chữ hoa.</p></section>;
}
export function apply(ctx) {
  for (const [name, key, component] of [['youdub.page', '/plugins/file-transform', Page], ['youdub.navigation', 'example.file-transform', Navigation], ['youdub.task.detail.panels', 'example.file-transform', Panel]]) {
    ctx.slots.inject(name, () => ctx.slots.register({ name, ...(name === 'youdub.page' ? { key } : { id:key }) }, component));
  }
}
