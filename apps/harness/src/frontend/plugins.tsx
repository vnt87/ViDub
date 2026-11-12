import { InlineAlert } from '../../../web/src/components/inline-alert'
/** YouDub composes the retained Harness plugin manager and its built-in catalog. */
import React from 'react'
import { StateDot, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { PluginManagerPage } from '../../../../vendor/deepseek-harness/source/packages/client/ui-plugin-manager/src/client/PluginManagerPage'
import { PluginManagerController } from '../../../../vendor/deepseek-harness/source/packages/client/ui-plugin-manager/src/client/manager-store'
import { configLedgerSource } from '../../../../vendor/deepseek-harness/source/packages/client/ui-plugin-manager/src/client/config-ledger'
import { tabLedgerSource } from '../../../../vendor/deepseek-harness/source/packages/client/ui-plugin-manager/src/client/tab-ledger'
import { createNavigationStore } from '../../../../vendor/deepseek-harness/source/packages/client/ui-plugin-manager/src/client/navigation-store'
import { PluginRefreshToast } from '../../../../vendor/deepseek-harness/source/packages/client/ui-plugin-manager/src/client/PluginRefreshToast'
import { rowText } from '../../../../vendor/deepseek-harness/source/packages/client/ui-plugin-manager/src/client/presentation'
import pluginCss from '../../../../vendor/deepseek-harness/source/packages/client/ui-plugin-manager/src/client/PluginManagerPage.module.css'
import { en } from '../../../../vendor/deepseek-harness/source/packages/client/ui-plugin-manager/src/client/locales'
import vietnamese from '../../locales/vi.json'

/** Preserve stable source snapshots while selecting this product's installed bundles. */
function project(source:any, select:(snapshot:any)=>any) {
  let previous:any, selected:any
  return {subscribe:source.subscribe,getSnapshot:() => {const current=source.getSnapshot();if(current!==previous){previous=current;selected=select(current)}return selected}}
}
function BuiltinYouDub({view,usePluginManager,t,resolveText}:any) {
  const state=usePluginManager((snapshot:any) => snapshot),bundle=state.packages.find((item:any) => item.name==='@youdub/harness-subtitles')
  if(!bundle) return <span role="status">{state.status==='idle'||state.status==='loading'?t('loading'):state.status==='unavailable'?t('unavailable'):t('youdub.bundleMissing')}</span>
  const rows=bundle.rows.filter((row:any) => row.moduleName.startsWith('@youdub/'))
  if(view==='summary')return <>YouDub {process.env.DSH_CLIENT_VERSION} · {t('partsCountTotal',{count:String(rows.length)})}</>
  return <div className="space-y-4 text-sm">
    <dl className={pluginCss.facts}><div><dt>{t('youdub.applicationVersion')}</dt><dd>{process.env.DSH_CLIENT_VERSION}</dd></div><div><dt>{t('youdub.packageVersion')}</dt><dd>{bundle.version??'—'}</dd></div><div><dt>{t('sourceTitle')}</dt><dd>{t('youdub.bundled')}</dd></div></dl>
    {bundle.error&&<InlineAlert>{bundle.error.diagnostic??bundle.error.code}</InlineAlert>}
    <div className="divide-y divide-border">{rows.map((row:any) => <div key={row.rowId} className="flex items-center gap-3 py-3"><StateDot state={row.phase==='active'?'done':row.phase==='failed'?'error':row.enabled?'ongoing':'idle'} /><div className="min-w-0 flex-1"><div>{rowText(row,resolveText).title}</div><div className="text-xs text-muted-foreground">{row.rowId}</div></div><Tag tone={row.phase==='active'?'success':row.phase==='failed'?'danger':'neutral'}>{t(row.phase==='active'?'rowPhaseActive':row.phase==='failed'?'rowPhaseFailed':row.enabled?'rowPhaseLoading':'partOff')}</Tag></div>)}</div>
  </div>
}
export function applyPlugins(ctx:any) {
  const namespace='pluginManager'
  const dictionaries={
    vi:{...vietnamese.pluginManager,reasonIncompatibleVersion:'{plugin} không tương thích với framework đi kèm YouDub ({runtime}; yêu cầu {requirements}); chạy có thể gây treo ứng dụng hoặc mất dữ liệu.',reasonIncompatibleVersionUnnamed:'Plugin này không tương thích với framework đi kèm YouDub; chạy có thể gây treo ứng dụng hoặc mất dữ liệu.','youdub.builtinTitle':'Tính năng tích hợp của YouDub','youdub.bundleMissing':'Chưa đọc được thông tin plugin tích hợp của YouDub.','youdub.applicationVersion':'Phiên bản ứng dụng','youdub.packageVersion':'Phiên bản gói plugin','youdub.bundled':'Đi kèm YouDub',title:'Plugin',intro:'',installDescription:'',infoDescription:'Cài đặt và quản lý plugin của YouDub.',installSpecPlaceholder:'Tên gói plugin, địa chỉ kho Git hoặc đường dẫn thư mục cục bộ',installGuideIdHint:'Nhập tên gói npm của plugin, ví dụ @tacgia/plugin.',installGuideIdExample:'@tacgia/ten-plugin',installUpgradeNotice:'Để cập nhật plugin, hãy gỡ cài đặt rồi cài lại.'},
    en:{...en,reasonIncompatibleVersion:'{plugin} is incompatible with the framework bundled with YouDub ({runtime}; requires {requirements}); running it may cause crashes or data loss.',reasonIncompatibleVersionUnnamed:'This plugin is incompatible with the framework bundled with YouDub; running it may cause crashes or data loss.','youdub.builtinTitle':'YouDub built-in features','youdub.bundleMissing':'The Host did not report the built-in YouDub bundle.','youdub.applicationVersion':'Application version','youdub.packageVersion':'Bundle version','youdub.bundled':'Included with YouDub',title:'Plugins',intro:'',installDescription:'',infoDescription:'Install and manage YouDub plugins.',installSpecPlaceholder:'Package name, Git repository, or local directory',installGuideIdHint:'Use the npm package name supplied by the plugin author.',installGuideIdExample:'@author/plugin',installUpgradeNotice:'To update a plugin, uninstall it and install the newer version.'},
  }
  ctx.effect(() => ctx.locale.register(namespace,dictionaries))
  const controller=new PluginManagerController(ctx)
  ctx.effect(() => () => controller.dispose())
  const face=controller.inject(configLedgerSource(ctx),tabLedgerSource(ctx),text => ctx.locale.resolveText(text))
  const productFace={...face,hooks:{...face.hooks,pluginManager:project(face.hooks.pluginManager,snapshot => ({...snapshot,packages:snapshot.packages.filter((pkg:any) => pkg.name!=='@youdub/harness-subtitles')})),configLedger:project(face.hooks.configLedger,ledger => ({...ledger,items:ledger.items.filter((item:any) => item.id.startsWith('youdub.'))}))}}
  ctx.effect(() => {
    const refresh=() => {if(controller.getSnapshot().status!=='idle')void controller.load()}
    const off=[ctx.remote.$on('plugin-manager/changed',refresh),ctx.remote.$on('plugin-manager/install-log',(chunk:any) => controller.appendLog(chunk)),ctx.remote.$on('plugin-manager/install-state',(progress:any) => controller.installProgress(progress)),ctx.on('connection/reset',refresh)]
    return () => off.forEach(dispose => dispose())
  })
  ctx.slots.inject('plugins.item',() => ctx.slots.register({name:'plugins.item',id:'youdub.builtin',label:() => ctx.locale.bind(namespace)('youdub.builtinTitle'),locale:namespace,inject:() => ({hooks:{pluginManager:face.hooks.pluginManager},resolveText:face.resolveText})},BuiltinYouDub))
  ctx.slots.inject('shell.overlay',() => ctx.slots.register({name:'shell.overlay',id:'youdub.plugins.refresh',locale:namespace,inject:() => ({hooks:{pluginManager:productFace.hooks.pluginManager},dismissNotice:face.dismissNotice})},PluginRefreshToast))
  ctx.slots.inject('main',function*(){
    const handle=createNavigationStore(),instance=handle.create(),store={...handle,create:() => instance}
    yield ctx.slots.register({name:'main',key:'plugins',locale:namespace,store,inject:() => productFace,children:{
      'plugins.add.actions':{kind:'list',scope:'root'},'plugins.tab':{kind:'list',scope:'root'},'plugins.item':{kind:'list',scope:'root'},
      'plugins.bundle.activation':{kind:'keyed',scope:'root'},'plugins.bundle.config':{kind:'keyed',scope:'root'},'plugins.row.config':{kind:'keyed',scope:'root'},
      'plugins.detail.actions':{kind:'list',scope:'root'},'plugins.detail.badge':{kind:'list',scope:'root'},'plugins.detail.section':{kind:'list',scope:'root'},
    }},PluginManagerPage)
    yield ctx.layout.panelInfo.subscribe(() => {if(ctx.layout.panelInfo.getSnapshot().activePanelId!=='plugins')instance.actions.setView({kind:'list'})})
    const dispose=ctx.reflect.provide('pluginNavigation',{openBundle:(name:string) => {ctx.layout.selectPanel('plugins');instance.actions.setTab('installed');instance.actions.setView({kind:'package',name})}})
    yield () => {void dispose()}
  })
}
