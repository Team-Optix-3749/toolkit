export function csvCell(value:unknown){
 const text=value==null?'':String(value)
 const safe=typeof value==='string'&&/^[\s\u0000-\u001f]*[=+@-]/.test(text)?`'${text}`:text
 return `"${safe.replaceAll('"','""')}"`
}
export function csv(columns:readonly string[],rows:readonly(readonly unknown[])[]):string{
 return '\uFEFF'+[columns.map(csvCell).join(','),...rows.map(row=>row.map(csvCell).join(','))].join('\r\n')+'\r\n'
}
export function isoOffset(value:string|null):string{return value?new Date(value).toISOString().replace(/Z$/,'+00:00'):''}
export function downloadCsv(filename:string,columns:readonly string[],rows:readonly(readonly unknown[])[]):void{
 const blob=new Blob([csv(columns,rows)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url)
}
