import dayjs from 'dayjs'

const id = () => crypto.randomUUID()

export function localDate(moment) {
	return dayjs(`${moment.date}T${moment.time || '00:00'}:00`)
}

export function validate(items) {
	if (!Array.isArray(items)) throw new Error('Expected a list of moments.')
	const usedIds = new Set()
	return items.map((item) => {
		if (
			!item ||
			typeof item.name !== 'string' ||
			!item.name.trim() ||
			typeof item.date !== 'string' ||
			!/^\d{4}-\d{2}-\d{2}$/.test(item.date) ||
			!localDate(item).isValid() ||
			localDate(item).format('YYYY-MM-DD') !== item.date ||
			(item.time &&
				(typeof item.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time))) ||
			(item.note != null && typeof item.note !== 'string') ||
			(item.archived != null && typeof item.archived !== 'boolean')
		) {
			throw new Error('One or more moments have an invalid name, date, time, or note.')
		}
		let momentId = typeof item.id === 'string' && item.id ? item.id : id()
		if (usedIds.has(momentId)) momentId = id()
		usedIds.add(momentId)
		return {
			id: momentId,
			name: item.name.trim(),
			date: item.date,
			time: item.time || null,
			note: item.note || '',
			archived: item.archived || false
		}
	})
}

export function decode(code) {
	const text = code.trim()
	let parsed
	if (text.startsWith('{') || text.startsWith('[')) {
		parsed = JSON.parse(text)
	} else {
		const raw = atob(text)
		if (raw.startsWith('{') && raw.endsWith('}')) {
			const decoded = new TextDecoder('utf-8', { fatal: true }).decode(
				Uint8Array.from(raw, (char) => char.charCodeAt(0))
			)
			parsed = JSON.parse(decoded)
		} else
			return validate(
				raw.split('~~').map((entry) => {
					const parts = entry.split('|')
					if (parts.length !== 3) throw new Error('Invalid moment code.')
					return { name: parts[0], date: parts[1], time: parts[2] }
				})
			)
	}
	if (Array.isArray(parsed)) return validate(parsed)
	if (parsed?.version !== 2) throw new Error('This backup version is not supported.')
	return validate(parsed.moments)
}

export function elapsed(moment, current, display = 'calendar') {
	const target = localDate(moment)
	const today = moment.time || display === 'hours' ? dayjs(current) : dayjs(current).startOf('day')
	const future = today.isBefore(target)
	let start = future ? today : target
	const end = future ? target : today
	if (display === 'hours') {
		const hours = end.diff(start, 'hour')
		if (!hours)
			return today.isSame(target, 'minute')
				? 'Now'
				: future
					? 'Less than an hour away'
					: 'Less than an hour ago'
		return `${future ? 'In ' : ''}${hours.toLocaleString()} hour${hours === 1 ? '' : 's'}${future ? '' : ' ago'}`
	}
	if (display === 'days') {
		const days = moment.time
			? end.diff(start, 'day')
			: end.startOf('day').diff(start.startOf('day'), 'day')
		if (!days) {
			if (!moment.time) return 'Today'
			if (today.isSame(target, 'minute')) return 'Now'
			return future ? 'Less than a day away' : 'Less than a day ago'
		}
		return `${future ? 'In ' : ''}${days.toLocaleString()} day${days === 1 ? '' : 's'}${future ? '' : ' ago'}`
	}
	const parts = []
	for (const unit of moment.time
		? ['year', 'month', 'day', 'hour', 'minute']
		: ['year', 'month', 'day']) {
		const amount = end.diff(start, unit)
		start = start.add(amount, unit)
		if (amount) parts.push(`${amount} ${unit}${amount === 1 ? '' : 's'}`)
	}
	if (!parts.length) return moment.time ? 'Now' : 'Today'
	if (!moment.time && parts.join() === '1 day') return future ? 'Tomorrow' : 'Yesterday'
	return `${future ? 'In ' : ''}${parts.join(', ')}${future ? '' : ' ago'}`
}

export function milestone(moment, current) {
	const today = dayjs(current).startOf('day')
	const start = localDate(moment).startOf('day')
	if (today.isBefore(start)) return ''
	const days = today.diff(start, 'day')
	if ([100, 500, 1000, 5000, 10000].includes(days)) return `${days.toLocaleString()} days today`
	const years = today.year() - start.year()
	let anniversary = start.add(years, 'year')
	if (years > 0 && anniversary.isSame(today, 'day'))
		return `${years} year${years === 1 ? '' : 's'} today`
	if (!anniversary.isAfter(today)) anniversary = start.add(years + 1, 'year')
	const remaining = anniversary.diff(today, 'day')
	if (remaining <= 30)
		return `${anniversary.year() - start.year()}-year anniversary in ${remaining} day${remaining === 1 ? '' : 's'}`
	return ''
}

export function encodeMoments(moments) {
	const bytes = new TextEncoder().encode(JSON.stringify({ version: 2, moments }))
	return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
}

function displayOptions(moment, current) {
	const target = localDate(moment)
	const today = moment.time ? dayjs(current) : dayjs(current).startOf('day')
	const start = today.isBefore(target) ? today : target
	const end = today.isBefore(target) ? target : today
	return end.diff(start, 'year') < 1 ? ['days', 'hours'] : ['calendar', 'days']
}

export function resolveDisplay(moment, current, selected) {
	const options = displayOptions(moment, current)
	return options.includes(selected) ? selected : options[0]
}

export function nextDisplay(moment, current, selected) {
	const options = displayOptions(moment, current)
	const display = resolveDisplay(moment, current, selected)
	return options[display === options[0] ? 1 : 0]
}
