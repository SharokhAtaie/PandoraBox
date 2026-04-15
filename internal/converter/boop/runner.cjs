const fs = require('fs')
const path = require('path')
const vm = require('vm')

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = []
    process.stdin.on('data', (c) => chunks.push(c))
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    process.stdin.on('error', reject)
  })
}

function createState(inputText) {
  let value = String(inputText ?? '')
  let changed = false
  const infos = []

  function setValue(v) {
    const next = String(v ?? '')
    if (next !== value) changed = true
    value = next
  }

  return {
    get text() { return value },
    set text(v) { setValue(v) },
    get fullText() { return value },
    set fullText(v) { setValue(v) },
    get selection() { return value },
    set selection(v) { setValue(v) },
    postInfo(msg) { infos.push(String(msg ?? '')) },
    postError(msg) { throw new Error(String(msg ?? 'Boop script error')) },
    insert(v) {
      changed = true
      value += String(v ?? '')
    },
    __getResult() {
      if (!changed && infos.length > 0) {
        return infos[infos.length - 1]
      }
      return value
    },
  }
}

function buildRequire(coreLibDir) {
  return function boopRequire(mod) {
    if (mod && mod.startsWith('@boop/')) {
      const local = mod.replace('@boop/', '')
      return require(path.join(coreLibDir, local))
    }
    return require(mod)
  }
}

async function main() {
  try {
    const raw = await readStdin()
    const payload = JSON.parse(raw || '{}')
    const scriptPath = String(payload.script_path || '')
    const input = String(payload.input || '')
    const coreLibDir = String(payload.core_lib_dir || '')
    if (!scriptPath) throw new Error('missing script_path')
    if (!coreLibDir) throw new Error('missing core_lib_dir')

    const code = fs.readFileSync(scriptPath, 'utf8')
    const sandbox = {
      module: { exports: {} },
      exports: {},
      require: buildRequire(coreLibDir),
      console,
      Buffer,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
    }
    vm.createContext(sandbox)
    vm.runInContext(code, sandbox, { filename: scriptPath, timeout: 4000 })
    const fn = sandbox.main || sandbox.module.exports.main || sandbox.exports.main
    if (typeof fn !== 'function') throw new Error('script has no main function')

    const state = createState(input)
    fn(state)
    process.stdout.write(JSON.stringify({ output: state.__getResult() }))
  } catch (err) {
    process.stdout.write(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
    process.exitCode = 1
  }
}

main()
