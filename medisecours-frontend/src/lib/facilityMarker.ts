export function facilityMarkerHtml(color: string, selected: boolean, name: string) {
  const escape = (value: string) => value.replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]!)
  const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : '#1a73e8'
  return `<div style="display:flex;align-items:center;gap:5px;white-space:nowrap;cursor:pointer">
    <span style="display:grid;place-items:center;width:${selected ? 30 : 24}px;height:${selected ? 30 : 24}px;border-radius:50%;background:${safeColor};color:white;border:2px solid white;font:bold 19px Arial">+</span>
    <span style="max-width:150px;overflow:hidden;text-overflow:ellipsis;color:${safeColor};font:${selected ? 'bold' : '500'} 12px Arial;text-shadow:1px 1px white,-1px -1px white,1px -1px white,-1px 1px white">${escape(name)}</span>
  </div>`
}
