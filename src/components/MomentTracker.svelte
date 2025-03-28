<script>
	import './MomentTracker.css'
	import { onMount } from 'svelte'

	let timers = []
	let newTimerName = ''
	let newTimerDate = ''
	let newTimerTime = ''
	let nameInput
	let shareCode = ''
	let intervalId
	let dateFormat
	let theme = 'system'
	let isFormVisible = false
	let isSettingsVisible = false

	if (typeof localStorage !== 'undefined' && localStorage.getItem('momentTrackerDateFormat')) {
		dateFormat = localStorage.getItem('momentTrackerDateFormat')
	} else {
		dateFormat = 'default'
	}

	// Load moments from localStorage on component mount
	onMount(() => {
		const savedCode = localStorage.getItem('momentTrackerData')

		if (savedCode) {
			loadTimers(savedCode, false)
		}

		// Load saved theme preference
		const savedTheme = localStorage.getItem('theme')

		if (savedTheme) {
			theme = savedTheme
			document.documentElement.setAttribute('data-theme', savedTheme)
		}

		// Cleanup interval on component destroy
		return () => {
			if (intervalId) clearInterval(intervalId)
		}
	})

	function saveToStorage() {
		if (timers.length === 0) {
			localStorage.removeItem('momentTrackerData')
			shareCode = ''
			return
		}

		const encoded = encodeTimers()

		localStorage.setItem('momentTrackerData', encoded)
		shareCode = encoded
	}

	function encodeTimers() {
		return btoa(timers.map((timer) => `${timer.name}|${timer.date}|${timer.time || ''}`).join('~~'))
	}

	function loadTimers(code, askForMerge = true) {
		try {
			const decoded = atob(code.trim())
			const newTimers = decoded.split('~~').map((timer) => {
				const [name, date, time] = timer.split('|')
				return {
					name,
					date,
					time: time || null,
					elapsedTime: ''
				}
			})

			if (askForMerge && timers.length > 0) {
				const choice = confirm(
					'Do you want to add these moments to your existing ones? Click OK to add, Cancel to replace.'
				)
				if (choice) {
					// Merge timers
					timers = [...timers, ...newTimers]
				} else {
					// Replace timers
					timers = newTimers
				}
			} else {
				timers = newTimers
			}

			updateElapsedTimes()

			if (timers.length > 0) {
				if (intervalId) clearInterval(intervalId)
				intervalId = setInterval(updateElapsedTimes, 1000)
			}

			saveToStorage()
		} catch (event) {
			alert('Invalid code')
			shareCode = timers.length > 0 ? encodeTimers() : ''
		}
	}

	function handleShareCodeChange() {
		if (!shareCode) return

		if (shareCode !== encodeTimers()) {
			loadTimers(shareCode)
		}
	}

	function calculateElapsedTime(start, hasTime) {
		const now = new Date()

		if (!hasTime) {
			start.setHours(0, 0, 0, 0)
		}

		const diff = Math.abs(now - start)
		const isFuture = start > now
		const years = Math.abs(now.getFullYear() - start.getFullYear())
		const months = Math.abs(now.getMonth() - start.getMonth())
		const days = Math.abs(now.getDate() - start.getDate())

		let adjustedYears = years
		let adjustedMonths = months
		let adjustedDays = days

		if (days < 0) {
			adjustedMonths -= 1
			const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
			adjustedDays = lastMonth.getDate() + days
		}

		if (months < 0 || (months === 0 && days < 0)) {
			adjustedYears -= 1
			adjustedMonths += 12
		}

		let timeString = isFuture ? 'in ' : ''

		if (adjustedYears > 0) timeString += `${adjustedYears} years, `
		if (adjustedMonths > 0) timeString += `${adjustedMonths} months, `
		if (adjustedDays > 0) timeString += `${adjustedDays} days`


		if (hasTime) {
			const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
			const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

			timeString += `, ${hours} hours, and ${minutes} minutes`
		}

			
		if (!isFuture) timeString += ' ago'

		return timeString.trim() || (isFuture ? 'in 0 days' : '0 days ago')
		
	}

	function updateElapsedTimes() {
		timers = timers.map((timer) => {
			const date = new Date(timer.date)

			if (timer.time) {
				const [hours, minutes] = timer.time.split(':')
				date.setHours(hours, minutes, 0, 0)
			}

			return {
				...timer,
				elapsedTime: calculateElapsedTime(date, !!timer.time)
			}
		})
	}

	function addTimer() {
		if (!newTimerName || !newTimerDate) return

		timers = [
			...timers,
			{
				name: newTimerName,
				date: newTimerDate,
				time: newTimerTime || null,
				elapsedTime: ''
			}
		]

		saveToStorage()

		newTimerName = ''
		newTimerDate = ''
		newTimerTime = ''
		isFormVisible = false

		updateElapsedTimes()
		if (timers.length === 1) {
			intervalId = setInterval(updateElapsedTimes, 1000)
		}
	}

	function handleSubmit(event) {
		event.preventDefault()
		addTimer()
	}

	function removeTimer(index) {
		timers = timers.filter((_, i) => i !== index)
		saveToStorage()
	}

	function handleDateFormatChange(e) {
		dateFormat = e.target.value
		localStorage.setItem('momentTrackerDateFormat', dateFormat)
	}

	function formatDate(dateStr, format) {
		const date = new Date(dateStr)

		switch (format) {
			case 'us':
				return date.toLocaleDateString('en-US')
			case 'eu':
				return date.toLocaleDateString('en-GB')
			default:
				return dateStr // Default format
		}
	}

	function handleThemeChange(e) {
		theme = e.target.value
		if (theme === 'system') {
			document.documentElement.removeAttribute('data-theme')
		} else {
			document.documentElement.setAttribute('data-theme', theme)
		}
		localStorage.setItem('theme', theme)
	}
</script>

<main class="app">
	{#if timers.length > 0}
		<section aria-label="Timer list">
			<ul class="timer-list">
				{#each timers as timer, index}
					<li class="timer-item">
						<div class="timer-meta">
							<strong>{timer.name}</strong>
							<span class="timestamp">
								({formatDate(timer.date, dateFormat)}{timer.time ? ` ${timer.time}` : ''})
							</span>
							<span class="elapsed">{timer.elapsedTime}</span>
						</div>
						<button class="remove-btn" on:click={() => removeTimer(index)} aria-label="Remove timer"
							>✕</button
						>
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<p class="empty">No moment yet. Add one to get started!</p>
	{/if}

	{#if timers.length > 0}
		<button
			class="add-button"
			on:click={() => {
				isFormVisible = !isFormVisible
				if (isFormVisible) {
					setTimeout(() => nameInput.focus(), 100)
				}
			}}
			aria-label={isFormVisible ? 'Hide add moment form' : 'Show add moment form'}
		>
			{isFormVisible ? '−' : '+'}
		</button>
	{/if}

	<section class="form-container" class:visible={isFormVisible || timers.length === 0}>
		<form class="add-timer-form" on:submit={handleSubmit}>
			<label for="timer-name" class="input-label">Moment name</label>
			<input
				id="timer-name"
				class="input"
				type="text"
				placeholder="Moment name"
				bind:this={nameInput}
				bind:value={newTimerName}
				required
			/>

			<div class="input-row">
				<div class="input-block">
					<label for="timer-date" class="input-label">Date (past or future)</label>
					<input id="timer-date" class="input" type="date" bind:value={newTimerDate} required />
				</div>

				<div class="input-block">
					<label for="timer-time" class="input-label">Time</label>
					<input
						id="timer-time"
						class="input"
						type="time"
						bind:value={newTimerTime}
						placeholder="Optional time"
					/>
				</div>
			</div>

			<button type="submit" class="primary-btn">Track a moment</button>
		</form>
	</section>

	<button
		class="settings-button"
		on:click={() => (isSettingsVisible = !isSettingsVisible)}
		aria-label={isSettingsVisible ? 'Hide settings' : 'Show settings'}
	>
		Settings {isSettingsVisible ? '−' : '+'}
	</button>

	<section class="settings-container" class:visible={isSettingsVisible}>
		<div class="share-block">
			<label for="share-code" class="input-label">
				{timers.length > 0 ? 'Share or save your moments' : 'Import moments'}
			</label>
			<input
				id="share-code"
				class="input"
				type="text"
				placeholder="Paste your moment code here"
				bind:value={shareCode}
				on:change={handleShareCodeChange}
			/>
		</div>

		<div class="input-row">
			<div class="input-block">
				<label for="date-format" class="input-label"> Date format </label>
				<select
					id="date-format"
					class="input"
					bind:value={dateFormat}
					on:change={handleDateFormatChange}
				>
					<option value="default">Current (YYYY-MM-DD)</option>
					<option value="us">US (MM/DD/YYYY)</option>
					<option value="eu">EU (DD/MM/YYYY)</option>
				</select>
			</div>

			<div class="input-block">
				<label for="theme" class="input-label"> Theme </label>
				<select id="theme" class="input" bind:value={theme} on:change={handleThemeChange}>
					<option value="system">System preference</option>
					<option value="light">Light</option>
					<option value="dark">Dark</option>
				</select>
			</div>
		</div>
	</section>
</main>

<style>
	.input-row {
		margin-top: 0;
		display: flex;
		gap: 1rem;
	}

	.input-block {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.input-label {
		font-weight: 500;
		font-size: 0.95rem;
	}

	.add-button {
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		background: var(--button-bg);
		color: var(--button-text);
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		position: relative;
		margin: 1rem auto;
		display: block;
		transition: transform 0.2s ease;
	}

	.add-button:hover {
		transform: scale(1.1);
	}

	.form-container {
		max-height: 0;
		overflow: hidden;
		transition: max-height 0.3s ease-out;
	}

	.form-container.visible {
		max-height: 300px;
	}

	.add-timer-form {
		margin-top: 0;
		padding-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.settings-button {
		width: 100%;
		padding: 0.5rem;
		margin: 1rem 0;
		background: var(--bg-bg);
		color: var(--text);
		border: none;
		border-radius: 0.25rem;
		font-size: 1rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		transition: transform 0.2s ease;
	}

	.settings-button:hover {
		transform: scale(1.02);
	}

	.settings-container {
		max-height: 0;
		overflow: hidden;
		transition: max-height 0.3s ease-out;
	}

	.settings-container.visible {
		max-height: 300px;
	}
</style>
