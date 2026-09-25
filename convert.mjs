// Turns the XMLTV file made by the iptv-org grabber into guide.json for Zapper.
// Usage: node epg/convert.mjs guide.xml guide.json
import fs from 'node:fs'

const [, , inFile = 'guide.xml', outFile = 'guide.json'] = process.argv
const TZ = 'Europe/Brussels'
const KEEP_DAYS_BACK = 1

const xml = fs.readFileSync(inFile, 'utf8')
const decode = s => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&').trim()

// "20260925180000 +0200" -> Date
function parseTime(s) {
  const m = /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)\s*([+-])(\d\d):?(\d\d)$/.exec(s.trim())
  if (!m) return null
  const [, Y, Mo, D, h, mi, se, sign, oh, om] = m
  const utc = Date.UTC(+Y, +Mo - 1, +D, +h, +mi, +se)
  const off = (+oh * 60 + +om) * (sign === '+' ? 1 : -1)
  return new Date(utc - off * 60000)
}
const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
})
function local(d) {
  const p = Object.fromEntries(fmt.formatToParts(d).map(x => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` }
}

// channel -> [{t: Date, title}]
const progs = {}
const re = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/g
let m
while ((m = re.exec(xml))) {
  const attrs = Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map(a => [a[1], a[2]]))
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/.exec(m[2])
  const start = parseTime(attrs.start || '')
  if (!start || !title || !attrs.channel) continue
  ;(progs[attrs.channel] ||= []).push({ t: start, title: decode(title[1]) || '?' })
}

// Load the previous file so a channel that failed this time keeps its old data.
let prev = { days: {} }
try { prev = JSON.parse(fs.readFileSync(outFile, 'utf8')) } catch {}

const days = {}
for (const [ch, list] of Object.entries(progs)) {
  list.sort((a, b) => a.t - b.t)
  for (const p of list) {
    const { date, hm } = local(p.t)
    const arr = ((days[date] ||= { date, channels: {} }).channels[ch] ||= [])
    if (arr.length && arr[arr.length - 1][1] === p.title) continue // same show continues
    arr.push([hm, p.title])
  }
}

// Keep old lists for channels/dates missing from this grab, drop days that are too old.
const today = local(new Date()).date
const cutoff = new Date(Date.parse(today + 'T12:00:00Z') - KEEP_DAYS_BACK * 86400000).toISOString().slice(0, 10)
for (const [date, day] of Object.entries(prev.days || {})) {
  if (date < cutoff) continue
  const target = (days[date] ||= { date, channels: {} })
  for (const [ch, list] of Object.entries(day.channels || {})) {
    if (!target.channels[ch]) target.channels[ch] = list
  }
}
for (const date of Object.keys(days)) if (date < cutoff) delete days[date]

const out = {
  updatedAt: new Date().toISOString(),
  source: 'pickx.be, tvgids.nl, delta.nl (via iptv-org/epg)',
  days: Object.fromEntries(Object.entries(days).sort())
}
fs.writeFileSync(outFile, JSON.stringify(out))
const counts = Object.entries(out.days).map(([d, v]) => `${d}: ${Object.keys(v.channels).length} channels`)
console.log('guide.json written ->', counts.join(', '))
if (!Object.keys(progs).length) { console.error('No programmes found in', inFile); process.exitCode = 1 }
