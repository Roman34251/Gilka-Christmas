// Vintage ornament studies for the sample catalogue.
const colors = [
  ['#ecd8c8','#990f28','#fb8490','#48081e'], ['#e2e5d9','#ae8039','#fff1ae','#664c29'],
  ['#eee3cd','#c59e58','#f9e8a9','#76562b'], ['#e3e0d9','#527463','#b5c5a8','#183f36']
]
export function ornament(index) {
  const [bg,mid,light,dark]=colors[index]
  const outlines=[
    'M150 76 C117 76 78 109 78 152 C78 192 110 226 150 230 C192 226 222 192 222 152 C222 109 183 76 150 76Z',
    'M150 72 C137 92 99 112 96 142 C89 180 128 205 150 241 C172 205 211 180 204 142 C201 112 163 92 150 72Z',
    'M150 66 L170 121 L228 124 L183 161 L197 217 L150 184 L103 217 L117 161 L72 124 L130 121Z',
    'M150 75 C134 84 108 104 108 117 Q107 126 120 127 Q87 151 102 168 L114 170 Q81 196 108 203 Q126 214 150 218 Q174 214 192 203 Q219 196 186 170 L198 168 Q213 151 180 127 Q193 126 192 117 C192 104 166 84 150 75Z'
  ]
  const shape=outlines[index]
  const ribs=Array.from({length:15},(_,i)=>{const x=10+i*20;return '<path d="M150 72 Q'+(x*2-150)+' 152 150 236" fill="none" stroke="'+(i%2?light:dark)+'" opacity=".5" stroke-width="3"/>'}).join('')
  const star='<path d="M150 66 L150 150 170 121 M228 124 L150 150 183 161 M197 217 L150 150 150 184 M103 217 L150 150 117 161 M72 124 L150 150 130 121" fill="none" stroke="'+light+'" stroke-width="2"/>'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 270"><defs><radialGradient id="bg"><stop stop-color="#fffcf2"/><stop offset="1" stop-color="${bg}"/></radialGradient><linearGradient id="g" x2=".95" y2=".4" gradientUnits="objectBoundingBox"><stop stop-color="${dark}"/><stop offset=".27" stop-color="${mid}"/><stop offset=".39" stop-color="${light}"/><stop offset=".55" stop-color="${mid}"/><stop offset=".84" stop-color="${dark}"/><stop offset="1" stop-color="${mid}"/></linearGradient><clipPath id="c"><path d="${shape}"/></clipPath></defs><path fill="url(#bg)" d="M0 0h300v270H0z"/><g transform="rotate(${[-10,8,-8,5][index]} 150 40)"><path d="M146 -24 Q153 26 150 63" fill="none" stroke="#907445" stroke-width="1.5"/><ellipse cx="150" cy="64" rx="5" ry="8" fill="none" stroke="#8e692e" stroke-width="2"/><path d="${shape}" fill="url(#g)"/><g clip-path="url(#c)">${index===2?star:ribs}</g><path d="M138 70 Q150 66 162 70 L163 79 Q158 75 155 79 Q150 74 145 79 Q140 75 137 79Z" fill="#a78443"/></g></svg>`
}
