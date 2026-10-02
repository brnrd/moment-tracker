import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	decode,
	encodeMoments,
	elapsed,
	milestone,
	validate,
	nextDisplay,
	resolveDisplay
} from '../src/lib/moments.js'

const moment = (date, time = null) => ({ name: 'A moment', date, time })

test('Unicode, delimiter characters, memories and archive survive codes and JSON backups', () => {
	const entries = validate([
		{
			...moment('2024-02-29'),
			name: 'Café ☕ | ~~ 日本語',
			note: 'A memory 🌿\nAnother line',
			archived: true
		}
	])
	assert.deepEqual(decode(encodeMoments(entries)), entries)
	assert.deepEqual(decode(JSON.stringify({ version: 2, moments: entries })), entries)
})

test('older share codes preserve Latin-1 names', () => {
	const entries = decode(btoa('Café|2024-02-29|12:30~~Second|2025-01-01|'))
	assert.equal(entries[0].name, 'Café')
	assert.equal(entries[0].time, '12:30')
	assert.equal(entries[1].archived, false)
})

test('malformed imports reject invalid calendar dates, times, and unsupported versions', () => {
	for (const entry of [
		moment('2025-02-29'),
		moment('2024-13-01'),
		moment('2024-01-01', '24:00'),
		{ ...moment('2024-01-01'), name: ' ' }
	]) {
		assert.throws(() => validate([entry]))
	}
	assert.throws(() => decode('{"version":3,"moments":[]}'))
	assert.throws(() => decode(btoa('bad|data')))
	assert.deepEqual(decode(encodeMoments([])), [])
})

test('date-only moments use local calendar days including daylight saving boundaries', () => {
	assert.equal(elapsed(moment('2026-03-28'), new Date('2026-03-30T00:00:00'), 'days'), '2 days ago')
	assert.equal(elapsed(moment('2026-10-02'), new Date('2026-10-02T23:59:00')), 'Today')
	assert.equal(elapsed(moment('2026-10-03'), new Date('2026-10-02T23:59:00')), 'Tomorrow')
	assert.equal(elapsed(moment('2026-10-01'), new Date('2026-10-02T00:01:00')), 'Yesterday')
})

test('past and future calendar durations stay positive and respect month boundaries', () => {
	assert.equal(elapsed(moment('2026-11-02'), new Date('2026-10-02T12:00:00')), 'In 1 month')
	assert.equal(elapsed(moment('2026-01-31'), new Date('2026-03-01T00:00:00')), '1 month, 1 day ago')
	assert.equal(
		elapsed(moment('2026-10-02', '13:30'), new Date('2026-10-02T12:00:00')),
		'In 1 hour, 30 minutes'
	)
	assert.equal(
		elapsed(moment('2026-10-02', '10:30'), new Date('2026-10-02T12:00:00')),
		'1 hour, 30 minutes ago'
	)
})

test('milestones appear quietly on the day or within the anniversary window', () => {
	assert.equal(milestone(moment('2026-06-24'), new Date('2026-10-02T12:00:00')), '100 days today')
	assert.equal(milestone(moment('2024-02-29'), new Date('2025-02-28T12:00:00')), '1 year today')
	assert.equal(
		milestone(moment('2025-10-14'), new Date('2026-10-02T12:00:00')),
		'1-year anniversary in 12 days'
	)
	assert.equal(milestone(moment('2027-10-14'), new Date('2026-10-02T12:00:00')), '')
	assert.equal(milestone(moment('2025-12-14'), new Date('2026-10-02T12:00:00')), '')
})

test('timed moments count completed days across midnight', () => {
	assert.equal(
		elapsed(moment('2026-10-01', '23:50'), new Date('2026-10-02T00:10:00'), 'days'),
		'Less than a day ago'
	)
	assert.equal(
		elapsed(moment('2026-10-03', '00:10'), new Date('2026-10-02T23:50:00'), 'days'),
		'Less than a day away'
	)
	assert.equal(decode(btoa('{A moment}|2025-01-01|'))[0].name, '{A moment}')
})

test('duration toggles offer exactly two views based on a calendar-year threshold', () => {
	const current = new Date('2026-10-02T12:00:00')
	assert.equal(nextDisplay(moment('2026-06-24'), current, 'calendar'), 'hours')
	assert.equal(nextDisplay(moment('2026-06-24'), current, 'days'), 'hours')
	assert.equal(nextDisplay(moment('2026-06-24'), current, 'hours'), 'days')
	assert.equal(nextDisplay(moment('2025-10-02'), current, 'days'), 'calendar')
	assert.equal(nextDisplay(moment('2027-01-01'), current, 'days'), 'hours')
	assert.equal(nextDisplay(moment('2027-10-02'), current, 'days'), 'calendar')
})

test('total hours use the exact time or local midnight, without negative units', () => {
	const current = new Date('2026-10-02T12:00:00')
	assert.equal(elapsed(moment('2026-10-02'), current, 'hours'), '12 hours ago')
	assert.equal(elapsed(moment('2026-10-02', '10:30'), current, 'hours'), '1 hour ago')
	assert.equal(elapsed(moment('2026-10-02', '13:30'), current, 'hours'), 'In 1 hour')
	assert.equal(elapsed(moment('2026-10-02', '12:30'), current, 'hours'), 'Less than an hour away')
	assert.equal(elapsed(moment('2026-10-02', '12:00'), current, 'hours'), 'Now')
})

test('saved views normalize when a moment crosses the year threshold', () => {
	const current = new Date('2026-10-02T12:00:00')
	assert.equal(resolveDisplay(moment('2026-06-24'), current, 'calendar'), 'days')
	assert.equal(resolveDisplay(moment('2025-10-02'), current, 'hours'), 'calendar')
	assert.equal(nextDisplay(moment('2025-10-02'), current, 'calendar'), 'days')
	assert.equal(resolveDisplay(moment('2026-06-24'), current, 'hours'), 'hours')
	assert.equal(resolveDisplay(moment('2025-10-02'), current, 'days'), 'days')
})
