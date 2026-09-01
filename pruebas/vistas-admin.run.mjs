global.localStorage = { getItem: () => null, setItem(){}, removeItem(){} }
global.window = { localStorage: global.localStorage, addEventListener(){}, removeEventListener(){} }
const { vistas, render } = await import('./out/vistas-admin.js')
let fallos = 0
for (const [nombre, Comp] of Object.entries(vistas)) {
  try {
    const h = render(Comp)
    console.log('  ok   ' + nombre.padEnd(20) + ' (' + h.length + ' chars)')
  } catch (e) {
    fallos++
    console.log(' FALLA ' + nombre.padEnd(20) + ' -> ' + e.message)
  }
}
console.log('\nvistas probadas: ' + Object.keys(vistas).length + ' | fallos: ' + fallos)
console.log(fallos === 0 ? 'TODAS RENDERIZAN' : 'HAY VISTAS ROTAS')
process.exit(fallos === 0 ? 0 : 1)
