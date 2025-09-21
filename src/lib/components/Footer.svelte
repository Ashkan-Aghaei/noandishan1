<script lang="ts">
	import HelpButton from './HelpButton.svelte';
	import { createEventDispatcher } from 'svelte';

	export let focusMode = false;
  export let getFormattedVersion: () => string;

  const dispatch = createEventDispatcher<{
    helpClick: void;
  }>();

  function handleHelpClick() {
    dispatch('helpClick');
  }
</script>

{#if !focusMode}
  <div class="absolute bottom-4 right-4 text-xs text-charcoal/60 dark:text-gray-300 flex items-center gap-2">
    <span>ساخته شده توسط نواندیشان عصر دیجیتال</span>
  </div>
    
  <!-- Help button and version display -->
  <div class="absolute bottom-4 left-4 flex items-center gap-2">
    <HelpButton
      on:click={handleHelpClick}
    />
    
    <!-- Version display -->
    <div class="text-xs text-charcoal/50 dark:text-gray-400 px-2 py-1 bg-white/60 dark:bg-gray-800/60 rounded-lg backdrop-blur-sm border border-charcoal/5 dark:border-gray-600/10">
      {getFormattedVersion()}
    </div>
  </div>
    
{/if}
