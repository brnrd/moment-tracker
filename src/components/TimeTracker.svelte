<script>
  let timers = [];
  let newTimerName = '';
  let newTimerDate = '';
  let newTimerTime = '';
  let nameInput; // Reference to the name input element
  let shareCode = '';
  let intervalId;

  // Load timers from localStorage on component mount
  import { onMount } from 'svelte';
  
  onMount(() => {
    const savedCode = localStorage.getItem('timeTrackerData');
    if (savedCode) {
      loadTimers(savedCode, false);
    }

    // Cleanup interval on component destroy
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  });

  function saveToStorage() {
    if (timers.length === 0) {
      localStorage.removeItem('timeTrackerData');
      shareCode = '';
      return;
    }
    
    const encoded = encodeTimers();
    localStorage.setItem('timeTrackerData', encoded);
    shareCode = encoded;
  }

  function encodeTimers() {
    return btoa(timers
      .map(timer => `${timer.name}|${timer.date}|${timer.time || ''}`)
      .join('~~'));
  }

  function loadTimers(code, askForMerge = true) {
    try {
      const decoded = atob(code.trim());
      const newTimers = decoded.split('~~').map(timer => {
        const [name, date, time] = timer.split('|');
        return {
          name,
          date,
          time: time || null,
          elapsedTime: ''
        };
      });
      
      if (askForMerge && timers.length > 0) {
        const choice = confirm('Do you want to add these timers to your existing ones? Click OK to add, Cancel to replace.');
        if (choice) {
          // Merge timers
          timers = [...timers, ...newTimers];
        } else {
          // Replace timers
          timers = newTimers;
        }
      } else {
        timers = newTimers;
      }

      updateElapsedTimes();
      
      if (timers.length > 0) {
        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(updateElapsedTimes, 1000);
      }
      
      saveToStorage();
    } catch (e) {
      alert('Invalid code');
      shareCode = timers.length > 0 ? encodeTimers() : '';
    }
  }

  function handleShareCodeChange() {
    if (!shareCode) return;
    if (shareCode !== encodeTimers()) {
      loadTimers(shareCode);
    }
  }

  function calculateElapsedTime(start, hasTime) {
    const now = new Date();
    if (!hasTime) {
      start.setHours(0, 0, 0, 0);
    }
    
    const diff = now - start;
    const years = now.getFullYear() - start.getFullYear();
    const months = now.getMonth() - start.getMonth();
    const days = now.getDate() - start.getDate();
    
    let adjustedYears = years;
    let adjustedMonths = months;
    let adjustedDays = days;
    
    if (days < 0) {
      adjustedMonths -= 1;
      const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      adjustedDays = lastMonth.getDate() + days;
    }
    
    if (months < 0 || (months === 0 && days < 0)) {
      adjustedYears -= 1;
      adjustedMonths += 12;
    }

    if (hasTime) {
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      let timeString = '';
      if (adjustedYears > 0) timeString += `${adjustedYears}y `;
      if (adjustedMonths > 0) timeString += `${adjustedMonths}m `;
      if (adjustedDays > 0) timeString += `${adjustedDays}d `;
      timeString += `${hours}h ${minutes}m ${seconds}s`;
      return timeString.trim();
    } else {
      let timeString = '';
      if (adjustedYears > 0) timeString += `${adjustedYears} years `;
      if (adjustedMonths > 0) timeString += `${adjustedMonths} months `;
      if (adjustedDays > 0) timeString += `${adjustedDays} days`;
      return timeString.trim() || '0 days';
    }
  }

  function updateElapsedTimes() {
    timers = timers.map(timer => {
      const date = new Date(timer.date);
      if (timer.time) {
        const [hours, minutes] = timer.time.split(':');
        date.setHours(hours, minutes, 0, 0);
      }
      return {
        ...timer,
        elapsedTime: calculateElapsedTime(date, !!timer.time)
      };
    });
  }

  function addTimer() {
    if (!newTimerName || !newTimerDate) return;
    
    timers = [...timers, {
      name: newTimerName,
      date: newTimerDate,
      time: newTimerTime || null,
      elapsedTime: ''
    }];
    
    saveToStorage();
    
    newTimerName = '';
    newTimerDate = '';
    newTimerTime = '';
    
    // Focus back to name input
    nameInput.focus();
    
    updateElapsedTimes();
    if (timers.length === 1) {
      intervalId = setInterval(updateElapsedTimes, 1000);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    addTimer();
  }

  function removeTimer(index) {
    timers = timers.filter((_, i) => i !== index);
    saveToStorage();
  }
</script>

<div>
  <form on:submit={handleSubmit}>
    <input 
      bind:this={nameInput}
      type="text"
      placeholder="Timer name"
      bind:value={newTimerName}
      required
    />
    <input 
      type="date"
      bind:value={newTimerDate}
      required
    />
    <input 
      type="time"
      bind:value={newTimerTime}
      placeholder="Optional time"
    />
    <button type="submit">Add Timer</button>
  </form>

  {#if timers.length > 0}
    <ul>
      {#each timers as timer, index}
        <li>
          <strong>{timer.name}</strong> 
          ({timer.date}{timer.time ? ` ${timer.time}` : ''}): 
          {timer.elapsedTime}
          <button on:click={() => removeTimer(index)}>Remove</button>
        </li>
      {/each}
    </ul>
  {:else}
    <p>No timers yet. Add one to get started!</p>
  {/if}

  <div style="margin-top: 2rem;">
    <p>{timers.length > 0 ? 'Share code:' : 'Import code:'}</p>
    <input 
      type="text" 
      placeholder="Paste import code here" 
      bind:value={shareCode}
      on:change={handleShareCodeChange}
      style="width: 100%;"
    />
  </div>
</div>