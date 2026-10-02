<script>
	import { onMount } from 'svelte'
	import dayjs from 'dayjs'
	import {
		localDate,
		validate,
		encodeMoments,
		decode,
		elapsed,
		milestone,
		nextDisplay,
		resolveDisplay
	} from '../lib/moments.js'

	let moments = []
	let name = ''
	let date = ''
	let time = ''
	let note = ''
	let editingId = null
	let nameInput
	let fileInput
	let shareCode = ''
	let settingsStatus = ''
	let settingsError = ''
	let sharingId = null
	let shareFeedback = ''
	let canShare = false
	let displays = {}
	let pendingImport = null
	let status = ''
	let error = ''
	let undoState = null
	let now = new Date()
	let dateFormat = 'default'
	let theme = 'system'
	let display = 'calendar'
	let isFormVisible = false
	let isSettingsVisible = false
	let isEditMode = false
	let showArchive = false
	let draggedId = null

	const id = () => crypto.randomUUID()
	$: activeMoments = moments.filter((moment) => !moment.archived)
	$: archivedMoments = moments.filter((moment) => moment.archived)
	$: visibleMoments = showArchive ? archivedMoments : activeMoments

	onMount(() => {
		try {
			const saved = localStorage.getItem('momentTrackerData')
			if (saved) moments = decode(saved)
			dateFormat = localStorage.getItem('momentTrackerDateFormat') || 'default'
			theme = localStorage.getItem('theme') || 'system'
			display = localStorage.getItem('momentTrackerDisplay') || 'calendar'
			displays = JSON.parse(localStorage.getItem('momentTrackerDisplays') || '{}')
			if (!displays || typeof displays !== 'object' || Array.isArray(displays)) displays = {}
			applyTheme()
		} catch {
			error = 'Your saved moments could not be read. You can restore a backup in Settings.'
		}
		canShare = typeof navigator.share === 'function'
		const timer = setInterval(() => (now = new Date()), 60000)
		const refresh = () => (now = new Date())
		window.addEventListener('focus', refresh)
		return () => {
			clearInterval(timer)
			window.removeEventListener('focus', refresh)
		}
	})

	function payload() {
		return { version: 2, moments }
	}

	function encode() {
		return encodeMoments(moments)
	}

	function save() {
		try {
			const encoded = encode()
			localStorage.setItem('momentTrackerData', encoded)
			shareCode = encoded
		} catch {
			error = 'Your changes could not be saved in this browser. Download a backup to keep them.'
		}
	}

	function applyTheme() {
		if (theme === 'system') document.documentElement.removeAttribute('data-theme')
		else document.documentElement.setAttribute('data-theme', theme)
	}

	function preference(key, value) {
		try {
			localStorage.setItem(key, value)
		} catch {
			error = 'This browser could not save your preference.'
		}
	}

	function mode(moment, overrides, current) {
		const selected = overrides[moment.id] || display
		return resolveDisplay(moment, current, selected)
	}

	function toggleDisplay(moment) {
		displays = { ...displays, [moment.id]: nextDisplay(moment, now, mode(moment, displays, now)) }
		preference('momentTrackerDisplays', JSON.stringify(displays))
	}

	function displayLabel(value) {
		return value === 'calendar' ? 'years, months & days' : `total ${value}`
	}

	function formatDate(value) {
		if (dateFormat === 'logical') return value
		return localDate({ date: value })
			.toDate()
			.toLocaleDateString(dateFormat === 'us' ? 'en-US' : dateFormat === 'eu' ? 'en-GB' : undefined)
	}

	function resetForm() {
		name = ''
		date = ''
		time = ''
		note = ''
		editingId = null
		isFormVisible = false
	}

	function edit(moment) {
		name = moment.name
		date = moment.date
		time = moment.time || ''
		note = moment.note
		editingId = moment.id
		isFormVisible = true
		setTimeout(() => nameInput?.focus(), 0)
	}

	function submit(event) {
		event.preventDefault()
		try {
			const existing = moments.find((moment) => moment.id === editingId)
			const [entry] = validate([
				{ id: editingId || id(), name, date, time, note, archived: existing?.archived || false }
			])
			moments = editingId
				? moments.map((moment) => (moment.id === editingId ? entry : moment))
				: [...moments, entry]
			if (!editingId) showArchive = false
			error = ''
			save()
			resetForm()
			now = new Date()
		} catch (cause) {
			error = cause.message
		}
	}

	function remove(moment) {
		undoState = {
			type: 'delete',
			moment,
			index: moments.findIndex((entry) => entry.id === moment.id)
		}
		moments = moments.filter((entry) => entry.id !== moment.id)
		if (editingId === moment.id) resetForm()
		status = `Removed “${moment.name}”.`
		save()
	}

	function undo() {
		if (!undoState) return
		if (undoState.type === 'delete') {
			const restored = [...moments]
			if (!restored.some((entry) => entry.id === undoState.moment.id))
				restored.splice(undoState.index, 0, undoState.moment)
			moments = restored
		} else moments = undoState.moments
		const undoType = undoState.type
		undoState = null
		if (undoType === 'import') settingsStatus = 'Import undone.'
		else status = 'Moment restored.'
		save()
	}

	function archive(moment) {
		moments = moments.map((entry) =>
			entry.id === moment.id ? { ...entry, archived: !entry.archived } : entry
		)
		save()
	}

	function move(momentId, destinationId) {
		const from = moments.findIndex((moment) => moment.id === momentId)
		const to = moments.findIndex((moment) => moment.id === destinationId)
		if (from < 0 || to < 0 || from === to) return
		const reordered = [...moments]
		const [entry] = reordered.splice(from, 1)
		reordered.splice(to, 0, entry)
		moments = reordered
		save()
	}

	async function copyCode() {
		try {
			await navigator.clipboard.writeText(shareCode)
			settingsStatus = 'Moment code copied.'
			settingsError = ''
		} catch {
			settingsError = 'Copy failed. Select the code and copy it manually.'
		}
	}

	function shareText(moment, current, selectedDisplay) {
		return `${moment.name} — ${elapsed(moment, current, selectedDisplay)}.`
	}

	async function shareMoment(moment, native = false) {
		try {
			if (native) {
				await navigator.share({ text: shareText(moment, now, mode(moment, displays, now)) })
				shareFeedback = 'Moment shared.'
			} else {
				await navigator.clipboard.writeText(shareText(moment, now, mode(moment, displays, now)))
				shareFeedback = 'Message copied.'
			}
		} catch (cause) {
			if (cause.name !== 'AbortError')
				shareFeedback = 'Sharing unavailable. Select and copy the message below.'
		}
	}

	function prepareImport(text) {
		try {
			pendingImport = decode(text)
			settingsError = ''
			settingsStatus = ''
		} catch (cause) {
			pendingImport = null
			settingsError = `Could not import: ${cause.message}`
		}
	}

	async function readBackup(event) {
		const file = event.target.files?.[0]
		if (!file) return
		try {
			prepareImport(await file.text())
		} catch {
			settingsError = 'This backup file could not be read.'
		}
		event.target.value = ''
	}

	function importMoments(replace) {
		undoState = { type: 'import', moments: [...moments] }
		moments = replace
			? pendingImport
			: [...moments, ...pendingImport.map((moment) => ({ ...moment, id: id() }))]
		pendingImport = null
		settingsError = ''
		resetForm()
		save()
		settingsStatus = 'Moments imported.'
		status = ''
	}

	function downloadBackup() {
		const url = URL.createObjectURL(
			new Blob([JSON.stringify(payload(), null, 2)], { type: 'application/json' })
		)
		const link = document.createElement('a')
		link.href = url
		link.download = `moment-tracker-${dayjs().format('YYYY-MM-DD')}.json`
		document.body.append(link)
		link.click()
		link.remove()
		setTimeout(() => URL.revokeObjectURL(url), 1000)
		settingsStatus = 'Backup downloaded.'
	}
</script>

<main class="app">
	<div class="action-row app-toolbar">
		<button
			class="settings-button"
			on:click={() => {
				isSettingsVisible = !isSettingsVisible
				if (isSettingsVisible) shareCode = encode()
			}}
			aria-expanded={isSettingsVisible}>Settings {isSettingsVisible ? '−' : '+'}</button
		>
		{#if moments.length}<button
				class="settings-button"
				class:active={isEditMode}
				on:click={() => (isEditMode = !isEditMode)}>{isEditMode ? 'Done' : 'Edit'}</button
			>{/if}
		{#if archivedMoments.length || showArchive}<button
				class="settings-button"
				on:click={() => (showArchive = !showArchive)}
				>{showArchive ? 'Back to moments' : `Archive (${archivedMoments.length})`}</button
			>{/if}
	</div>

	{#if status || undoState?.type === 'delete'}
		<div class="feedback" role="status">
			<span>{status}</span>{#if undoState?.type === 'delete'}<button
					class="settings-button"
					on:click={undo}>Undo</button
				>{/if}
		</div>
	{/if}
	{#if error}<p class="feedback error" role="alert">
			{error}<button class="settings-button" on:click={() => (error = '')}>Dismiss</button>
		</p>{/if}

	{#if isSettingsVisible}
		<section class="settings-panel" aria-label="Settings">
			<div class="input-row">
				<div class="input-block">
					<label for="date-format" class="input-label">Date format</label><select
						id="date-format"
						class="input"
						bind:value={dateFormat}
						on:change={() => preference('momentTrackerDateFormat', dateFormat)}
						><option value="default">Default</option><option value="logical">YYYY-MM-DD</option
						><option value="us">MM/DD/YYYY</option><option value="eu">DD/MM/YYYY</option></select
					>
				</div>
				<div class="input-block">
					<label for="theme" class="input-label">Theme</label><select
						id="theme"
						class="input"
						bind:value={theme}
						on:change={() => {
							applyTheme()
							preference('theme', theme)
						}}
						><option value="system">System preference</option><option value="light">Light</option
						><option value="dark">Dark</option></select
					>
				</div>
			</div>
			<div class="settings-group input-block">
				<label for="share-code" class="input-label">Share or import moments</label>
				<p id="code-help" class="quiet">
					Copy your code to save or transfer all your moments. To import, paste another code here
					and choose Load code.
				</p>
				<textarea
					id="share-code"
					class="input code-input"
					bind:value={shareCode}
					aria-describedby="code-help"
					spellcheck="false"
					on:input={() => {
						pendingImport = null
						settingsError = ''
						settingsStatus = ''
					}}
				></textarea>
				<div class="code-actions">
					<button class="settings-button" disabled={!shareCode.trim()} on:click={copyCode}
						>Copy code</button
					>
					<button
						class="settings-button"
						disabled={!shareCode.trim() || shareCode === encode()}
						on:click={() => prepareImport(shareCode)}>Load code</button
					>
					{#if shareCode !== encode()}<button
							class="text-button"
							on:click={() => {
								shareCode = encode()
								pendingImport = null
								settingsError = ''
								settingsStatus = ''
							}}>Use my code</button
						>{/if}
				</div>
				<p class="quiet privacy-note">
					Your code includes notes and archived moments. Anyone with it can read them.
				</p>
			</div>
			<div class="settings-group backup-actions">
				<div>
					<span class="input-label">File backup</span>
					<p class="quiet">Keep a copy on your device, or restore a saved file.</p>
				</div>
				<div class="code-actions">
					<button class="settings-button" on:click={downloadBackup}>Download</button><button
						class="settings-button"
						on:click={() => fileInput.click()}>Restore file</button
					>
				</div>
				<input
					class="sr-only"
					type="file"
					accept=".json,application/json"
					bind:this={fileInput}
					on:change={readBackup}
					tabindex="-1"
					aria-label="Choose backup file"
				/>
			</div>
			{#if settingsStatus || undoState?.type === 'import'}<div
					class="feedback settings-feedback"
					role="status"
				>
					<span>{settingsStatus}</span>{#if undoState?.type === 'import'}<button
							class="text-button"
							on:click={undo}>Undo import</button
						>{/if}
				</div>{/if}
			{#if settingsError}<p class="quiet error" role="alert">{settingsError}</p>{/if}

			{#if pendingImport !== null}
				<div class="import-preview">
					<p class="quiet">
						{pendingImport.length} moment{pendingImport.length === 1 ? '' : 's'} ready to import.
					</p>
					<ul class="preview-list">
						{#each pendingImport as moment (moment.id)}<li>
								{moment.name} · {formatDate(moment.date)}{moment.archived ? ' · archived' : ''}
							</li>{/each}
					</ul>
					<div class="action-row backup-actions">
						<button class="settings-button" on:click={() => importMoments(false)}
							>Add to moments</button
						><button class="settings-button" on:click={() => importMoments(true)}
							>Replace all moments</button
						><button class="settings-button" on:click={() => (pendingImport = null)}>Cancel</button>
					</div>
				</div>
			{/if}
		</section>
	{/if}

	{#if showArchive}<p class="quiet">Archived moments</p>{/if}
	{#if visibleMoments.length}
		<section aria-label={showArchive ? 'Archived moments' : 'Moment list'}>
			<ul class="moment-list">
				{#each visibleMoments as moment, index (moment.id)}
					<li
						class="moment-item"
						class:draggable={isEditMode}
						draggable={isEditMode}
						on:dragstart={() => (draggedId = moment.id)}
						on:dragover={(event) => event.preventDefault()}
						on:drop={(event) => {
							event.preventDefault()
							move(draggedId, moment.id)
							draggedId = null
						}}
						on:dragend={() => (draggedId = null)}
					>
						<div class="moment-meta">
							<strong>{moment.name}</strong><span class="timestamp"
								>{formatDate(moment.date)}{moment.time ? ` ${moment.time}` : ''}</span
							>
							<button
								class="elapsed elapsed-toggle"
								on:click={() => toggleDisplay(moment)}
								aria-label={`${elapsed(moment, now, mode(moment, displays, now))}. Show ${displayLabel(nextDisplay(moment, now, mode(moment, displays, now)))}`}
							>
								<span>{elapsed(moment, now, mode(moment, displays, now))}</span><span
									class="display-hint"
									>Show {displayLabel(nextDisplay(moment, now, mode(moment, displays, now)))} ↻</span
								>
							</button>

							{#if !showArchive && milestone(moment, now)}<span class="milestone"
									>{milestone(moment, now)}</span
								>{/if}
							{#if moment.note}<details class="moment-note">
									<summary>Memory</summary>
									<p>{moment.note}</p>
								</details>{/if}
							{#if sharingId === moment.id}
								<div class="moment-share" aria-label={`Share ${moment.name}`}>
									<textarea
										class="input share-message"
										aria-label="Message to share"
										readonly
										value={shareText(moment, now, mode(moment, displays, now))}
										on:focus={(event) => event.target.select()}
									></textarea>
									<div class="code-actions">
										<button class="settings-button" on:click={() => shareMoment(moment)}
											>Copy message</button
										>
										{#if canShare}<button
												class="settings-button"
												on:click={() => shareMoment(moment, true)}>Share via…</button
											>{/if}
										<button class="text-button" on:click={() => (sharingId = null)}>Close</button>
									</div>
									{#if shareFeedback}<p class="quiet" role="status">{shareFeedback}</p>{/if}
								</div>
							{/if}
						</div>
						<div class="moment-controls">
							<button
								class="text-button share-button"
								aria-expanded={sharingId === moment.id}
								aria-label={`Share ${moment.name}`}
								on:click={() => {
									sharingId = sharingId === moment.id ? null : moment.id
									shareFeedback = ''
								}}>Share ↗</button
							>
							{#if isEditMode}
								<div class="moment-actions">
									<button
										class="edit-btn"
										disabled={index === 0}
										on:click={() => move(moment.id, visibleMoments[index - 1].id)}
										aria-label={`Move ${moment.name} up`}>↑</button
									>
									<button
										class="edit-btn"
										disabled={index === visibleMoments.length - 1}
										on:click={() => move(moment.id, visibleMoments[index + 1].id)}
										aria-label={`Move ${moment.name} down`}>↓</button
									>
									<button
										class="edit-btn"
										on:click={() => edit(moment)}
										aria-label={`Edit ${moment.name}`}>✎</button
									>
									<button class="settings-button" on:click={() => archive(moment)}
										>{moment.archived ? 'Restore' : 'Archive'}</button
									>
									<button
										class="remove-btn"
										on:click={() => remove(moment)}
										aria-label={`Delete ${moment.name}`}>✕</button
									>
								</div>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{:else}<p class="empty">
			{showArchive
				? 'No archived moments.'
				: archivedMoments.length
					? 'Your moments are in the archive. Add another whenever you like.'
					: 'No moment yet. Add one to get started!'}
		</p>{/if}

	<div class="action-row">
		<button
			class="add-button"
			on:click={() => {
				if (isFormVisible) resetForm()
				else {
					isFormVisible = true
					setTimeout(() => nameInput?.focus(), 0)
				}
			}}
			aria-label={isFormVisible ? 'Close moment form' : 'Add a moment'}
			aria-expanded={isFormVisible}>{isFormVisible ? '−' : '+'}</button
		>
	</div>
	{#if isFormVisible}
		<section aria-label={editingId ? 'Edit moment' : 'Add moment'}>
			<form class="add-moment-form" on:submit={submit}>
				<div class="input-block">
					<label for="moment-name" class="input-label">Moment name</label><input
						id="moment-name"
						class="input"
						bind:this={nameInput}
						bind:value={name}
						required
					/>
				</div>
				<div class="input-row">
					<div class="input-block">
						<label for="moment-date" class="input-label">Date (past or future)</label><input
							id="moment-date"
							class="input"
							type="date"
							bind:value={date}
							required
						/>
					</div>
					<div class="input-block">
						<label for="moment-time" class="input-label">Time (optional)</label><input
							id="moment-time"
							class="input"
							type="time"
							bind:value={time}
						/>
					</div>
				</div>
				<div class="input-block">
					<label for="moment-note" class="input-label">A memory (optional)</label><textarea
						id="moment-note"
						class="input memory-input"
						bind:value={note}
						maxlength="1000"
						placeholder="A few words you’d like to remember"
					></textarea>
				</div>
				<button type="submit" class="primary-btn"
					>{editingId ? 'Update moment' : 'Track a moment'}</button
				><button type="button" class="settings-button" on:click={resetForm}>Cancel</button>
			</form>
		</section>
	{/if}
</main>
