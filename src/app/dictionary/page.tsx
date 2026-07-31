import { FIELD_DEFINITIONS, type FieldGroup } from "@/lib/fields";

const groupTitles: Record<FieldGroup, string> = { identity: "基本信息", literature: "文献信息", source: "来源与制备", structure: "结构信息", bioactivity: "生物活性", management: "数据管理" };

export default function DictionaryPage() {
  return <main className="page-shell"><p className="eyebrow">数据规范</p><h1>数据字典</h1><p className="page-intro">查看每条多糖科研记录采用的字段定义与数据分组。</p><div className="dictionary-groups">{(Object.keys(groupTitles) as FieldGroup[]).map((group) => <section className="dictionary-group" key={group}><h2>{groupTitles[group]}</h2><div className="dictionary-table"><div className="dictionary-row dictionary-row--head"><span>字段键</span><span>中文名称</span><span>字段组</span><span>可编辑</span></div>{FIELD_DEFINITIONS.filter((field) => field.group === group).map((field) => <div className="dictionary-row" key={field.key}><code>{field.key}</code><span>{field.label}</span><span>{groupTitles[field.group]}</span><span>{field.editable ? "是" : "否"}</span></div>)}</div></section>)}</div></main>;
}
