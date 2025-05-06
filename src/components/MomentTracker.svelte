<script>
	import { onMount } from 'svelte'
	import dayjs from 'dayjs'

	const REFRESH_INTERVAL = 1000 * 60 // 1 minute

	let moments = []
	let newMomentName = ''
	let newMomentDate = ''
	let newMomentTime = ''
	let isEditing = false
	let editingIndex = null
	let nameInput
	let shareCode = ''
	let intervalId
	let dateFormat
	let theme = 'system'
	let isFormVisible = false
	let isSettingsVisible = false
	let isEditMode = false
	let draggedIndex = null

	if (typeof localStorage !== 'undefined' && localStorage.getItem('momentTrackerDateFormat')) {
		dateFormat = localStorage.getItem('momentTrackerDateFormat')
	} else {
		dateFormat = 'default'
	}

	// Load moments from localStorage on component mount
	onMount(() => {
		const savedCode = localStorage.getItem('momentTrackerData')

		if (savedCode) {
			loadMoments(savedCode, false)
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
		if (moments.length === 0) {
			localStorage.removeItem('momentTrackerData')
			shareCode = ''
			return
		}

		const encoded = encodeMoments()

		localStorage.setItem('momentTrackerData', encoded)
		shareCode = encoded
	}

	function encodeMoments() {
		return btoa(moments.map((moment) => `${moment.name}|${moment.date}|${moment.time || ''}`).join('~~'))
	}

	function loadMoments(code, askForMerge = true) {
		try {
			const decoded = atob(code.trim())
			const newMoments = decoded.split('~~').map((moment) => {
				const [name, date, time] = moment.split('|')
				return {
					name,
					date,
					time: time || null,
					elapsedTime: ''
				}
			})

			if (askForMerge && moments.length > 0) {
				const choice = confirm(
					'Do you want to add these moments to your existing ones? Click OK to add, Cancel to replace.'
				)
				if (choice) {
					// Merge moments
					moments = [...moments, ...newMoments]
				} else {
					// Replace moments
					moments = newMoments
				}
			} else {
				moments = newMoments
			}

			updateElapsedTimes()

			if (moments.length > 0) {
				if (intervalId) clearInterval(intervalId)
				intervalId = setInterval(updateElapsedTimes, REFRESH_INTERVAL)
			}

			saveToStorage()
		} catch (event) {
			alert('Invalid code')
			shareCode = moments.length > 0 ? encodeMoments() : ''
		}
	}

	function handleShareCodeChange() {
		if (!shareCode) return

		if (shareCode !== encodeMoments()) {
			loadMoments(shareCode)
		}
	}

	function generateDisplayString(momentTime, momentHasTime) {
		let from = dayjs()
		let to = dayjs(momentTime)
		
		if (!momentHasTime) {
			to = to.set('hour', 0).set('minute', 0).set('second', 0)
		}

		const isFuture = from.isBefore(to)

		let years = to.diff(from, 'year')
		from = from.add(years, 'year')
		
		let months = to.diff(from, 'month')
		from = from.add(months, 'month')
		
		let days = to.diff(from, 'day')
		from = from.add(days, 'day')
		
		if (!isFuture) {
			years = Math.abs(years)
			months = Math.abs(months)
			days = Math.abs(days)
		}
		
		if (isFuture && !momentHasTime && days < 1 && months === 0 && years === 0) {
			return 'tomorrow'
		}

		if (isFuture) {
			days += 1;
		}

		const parts = []

		if (years) parts.push(`${years} year${years > 1 ? 's' : ''}`)
		if (months) parts.push(`${months} month${months > 1 ? 's' : ''}`)
		if (days) parts.push(`${days} day${days > 1 ? 's' : ''}`)
		
		if (momentHasTime) {
			let hours = to.diff(from, 'hour')
			from = from.add(hours, 'hour')
			
			let minutes = to.diff(from, 'minute')
			from = from.add(minutes, 'minute')
			
			if (!isFuture) {
				hours = Math.abs(hours)
				minutes = Math.abs(minutes)
			}
			
			if (hours) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`)
			if (minutes) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`)
		}
		
		let timeString = parts.join(', ')

		if (isFuture) {
			return `in ${timeString}`
		}

		if (timeString === '' && !momentHasTime) {
			return 'today'
		}

		if (timeString === '' && momentHasTime) {
			return 'now'
		}
		
		return `${timeString} ago`
	}

	function updateElapsedTimes() {
		moments = moments.map((moment) => {
			const date = new Date(moment.date)

			if (moment.time) {
				const [hours, minutes] = moment.time.split(':')
				date.setHours(hours, minutes, 0, 0)
			}

			return {
				...moment,
				elapsedTime: generateDisplayString(date, !!moment.time)
			}
		})
	}

	function editMoment(index) {
		const moment = moments[index]

		newMomentName = moment.name
		newMomentDate = moment.date
		newMomentTime = moment.time
		editingIndex = index
		isEditing = true
		isFormVisible = true
		setTimeout(() => nameInput.focus(), 100)
	}

	function handleSubmit(event) {
		event.preventDefault()

		if (isEditing) {
			moments[editingIndex] = {
				name: newMomentName,
				date: newMomentDate,
				time: newMomentTime || null,
				elapsedTime: ''
			}
			isEditing = false
			editingIndex = null
		} else {
			if (!newMomentName || !newMomentDate) return
			moments = [
				...moments,
				{
					name: newMomentName,
					date: newMomentDate,
					time: newMomentTime || null,
					elapsedTime: ''
				}
			]
		}
		saveToStorage()
		newMomentName = ''
		newMomentDate = ''
		newMomentTime = ''
		isFormVisible = false
		updateElapsedTimes()
		if (moments.length === 1) {
			intervalId = setInterval(updateElapsedTimes, 1000)
		}
	}

	function removeMoment(index) {
		moments = moments.filter((_, i) => i !== index)
		saveToStorage()
	}

	function handleDateFormatChange(event) {
		dateFormat = event.target.value

		localStorage.setItem('momentTrackerDateFormat', dateFormat)
	}

	function formatDate(dateStr, format) {
		const date = new Date(dateStr)

		switch (format) {
			case 'us':
				return date.toLocaleDateString('en-US')
			case 'eu':
				return date.toLocaleDateString('en-GB')
			case 'logical':
				return dateStr
			default:
				return date.toLocaleDateString()
		}
	}

	function handleThemeChange(event) {
		theme = event.target.value

		if (theme === 'system') {
			document.documentElement.removeAttribute('data-theme')
		} else {
			document.documentElement.setAttribute('data-theme', theme)
		}
		localStorage.setItem('theme', theme)
	}

	function copyToClipboard() {
		navigator.clipboard.writeText(shareCode)
			.then(() => {
				console.log('Share code copied to clipboard')
			})
			.catch((err) => {
				console.error('Failed to copy share code: ', err)
			})
	}

	function handleDragStart(index) {
		draggedIndex = index
	}

	function handleDragOver(event, index) {
		event.preventDefault()
	}

	function handleDrop(event, index) {
		event.preventDefault()
		if (draggedIndex === null || draggedIndex === index) return

		const newMoments = [...moments]
		const [draggedMoment] = newMoments.splice(draggedIndex, 1)
		newMoments.splice(index, 0, draggedMoment)
		moments = newMoments
		draggedIndex = null
		saveToStorage()
	}

	function handleDragEnd() {
		draggedIndex = null
	}

</script>

<main class="app">
	<div class="action-row">
		<button
			class="settings-button"
			on:click={() => (isSettingsVisible = !isSettingsVisible)}
			aria-label={isSettingsVisible ? 'Hide settings' : 'Show settings'}
		>
			Settings {isSettingsVisible ? '−' : '+'}
		</button>
		{#if moments.length > 0}
			<button
				class="settings-button"
				class:active={isEditMode}
				on:click={() => isEditMode = !isEditMode}
				aria-label={isEditMode ? 'Exit edit mode' : 'Enter edit mode'}
			>
				{isEditMode ? 'Done' : 'Edit'}
			</button>
		{/if}
	</div>
	

	<section class="settings-container" class:visible={isSettingsVisible}>
		<div class="input-row">
			<div class="input-block">
				<label for="date-format" class="input-label">Date format </label>
				<select
					id="date-format"
					class="input"
					bind:value={dateFormat}
					on:change={handleDateFormatChange}
				>
					<option value="default">Default</option>
					<option value="logical">Logical (YYYY-MM-DD)</option>
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

		<div class="input-row">
			<div class="input-block">
				<label for="share-code" class="input-label">
					{moments.length > 0 ? 'Share or save your moments' : 'Import moments'}
				</label>
				<div class="share-code-wrapper">
					<input
						id="share-code"
						class="input share-input"
						type="text"
						placeholder="Paste your moment code here"
						bind:value={shareCode}
						on:change={handleShareCodeChange}
						on:focus={(e) => e.target.select()}
					/>
					{#if shareCode}
						<button type="button" class="copy-btn" on:click={copyToClipboard} aria-label="Copy share code">Copy</button>
					{/if}
				</div>
			</div>
		</div>
	</section>
	
	{#if moments.length > 0}
		<section aria-label="Moment list">
			<ul class="moment-list">
				{#each moments as moment, index}
					<li 
						class="moment-item"
						class:draggable={isEditMode}
						draggable={isEditMode}
						on:dragstart={() => handleDragStart(index)}
						on:dragover={(e) => handleDragOver(e, index)}
						on:drop={(e) => handleDrop(e, index)}
						on:dragend={handleDragEnd}
					>
						<div class="moment-meta">
							<strong>{moment.name}</strong>
							<span class="timestamp">
								({formatDate(moment.date, dateFormat)}{moment.time ? ` ${moment.time}` : ''})
							</span>
							<span class="elapsed">{moment.elapsedTime}</span>
						</div>
						{#if isEditMode}
							<div class="moment-actions">
								<button class="edit-btn" on:click={() => editMoment(index)} aria-label="Edit moment">✎</button>
								<button class="remove-btn" on:click={() => removeMoment(index)} aria-label="Remove moment">✕</button>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<p class="empty">No moment yet. Add one to get started!</p>
	{/if}


	<div class="action-row">
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
	</div>
	

	<section class="form-container" class:visible={isFormVisible}>
		<form class="add-moment-form" on:submit={handleSubmit}>
			<div class="input-row">
				<div class="input-block">
					<label for="moment-name" class="input-label">Moment name</label>
					<input
					id="moment-name"
					class="input"
					type="text"
					placeholder="Moment name"
					bind:this={nameInput}
					bind:value={newMomentName}
					required
					/>
				</div>
			</div>
			

			<div class="input-row">
				<div class="input-block">
					<label for="moment-date" class="input-label">Date (past or future)</label>
					<input id="moment-date" class="input" type="date" bind:value={newMomentDate} required />
				</div>

				<div class="input-block">
					<label for="moment-time" class="input-label">Time</label>
					<input
						id="moment-time"
						class="input"
						type="time"
						bind:value={newMomentTime}
						placeholder="Optional time"
					/>
				</div>
			</div>

			<button type="submit" class="primary-btn">
				{#if isEditing}
					Update a moment
				{:else}
					Track a moment
				{/if}
			</button>
		</form>
	</section>
</main>
