import {it,expect} from 'vitest'
import {csv,isoOffset} from './csv'
it('exports ordered headers when empty and escapes formulas while retaining numeric values',()=>{
 expect(csv(['Name','Minutes'],[])).toBe('\uFEFF"Name","Minutes"\r\n')
 expect(csv(['Name','Minutes'],[[' =HYPERLINK("x")\nnext, line',1.5]])).toContain('"\' =HYPERLINK(""x"")\nnext, line","1.5"')
 expect(csv(['Name'],[['@SUM(1)']])).toContain('"\'@SUM(1)"')
 expect(csv(['Number'],[[-1.5]])).toContain('"-1.5"')
 expect(isoOffset('2026-10-29T12:00:00-07:00')).toBe('2026-10-29T19:00:00.000+00:00')
 expect(isoOffset(null)).toBe('')
})
